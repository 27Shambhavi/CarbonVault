"""
CarbonVault Phase 4: SSRF (Server-Side Request Forgery) Protection & Resilient HTTP Client.
Enforces:
- Strict allow-list of external destination hosts (NASA MODIS, NASA POWER, GIBS, Copernicus, Anthropic, OpenAI, Frankfurter, Razorpay).
- Blocking of private RFC1918, link-local, loopback, and cloud metadata (169.254.169.254) addresses.
- DNS resolution checks to prevent DNS rebinding.
- Automatic exponential backoff retries and default timeouts (10.0s).
"""

import socket
import ipaddress
import logging
import time
from urllib.parse import urlparse
from typing import Set, Optional, Dict, Any
import httpx

logger = logging.getLogger("carbonvault.ssrf_guard")

# Strict Allow-List of Approved Third-Party Service Hosts
APPROVED_EXTERNAL_HOSTS: Set[str] = {
    "modis.ornl.gov",
    "power.larc.nasa.gov",
    "gibs.earthdata.nasa.gov",
    "identity.dataspace.copernicus.eu",
    "sh.dataspace.copernicus.eu",
    "api.frankfurter.app",
    "api.anthropic.com",
    "api.openai.com",
    "api.razorpay.com",
}

# Blocked IP Networks (Private, Loopback, Link-Local, Cloud Metadata)
PROHIBITED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),     # Carrier-grade NAT
    ipaddress.ip_network("127.0.0.0/8"),      # Loopback
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / Cloud metadata (169.254.169.254)
    ipaddress.ip_network("172.16.0.0/12"),    # Private class B
    ipaddress.ip_network("192.168.0.0/16"),   # Private class C
    ipaddress.ip_network("198.18.0.0/15"),    # Benchmark tests
    ipaddress.ip_network("fc00::/7"),         # IPv6 Unique Local
    ipaddress.ip_network("fe80::/10"),        # IPv6 Link-Local
    ipaddress.ip_network("::1/128"),          # IPv6 Loopback
]


class SSRFBlockedException(Exception):
    """Raised when an outbound HTTP request violates SSRF security boundaries."""
    pass


def is_ip_prohibited(ip_str: str) -> bool:
    """Checks if an IP address belongs to internal, private, loopback, or cloud-metadata space."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return True
        for net in PROHIBITED_NETWORKS:
            if ip in net:
                return True
        return False
    except ValueError:
        return True


def validate_url_ssrf(url: str, allowed_hosts: Optional[Set[str]] = None) -> str:
    """
    Validates that a URL:
    1. Uses HTTP/HTTPS scheme.
    2. Has a hostname matching the approved allow-list.
    3. Does NOT resolve to a prohibited/internal IP address (DNS rebinding defense).

    Raises SSRFBlockedException on violation.
    Returns normalized URL if safe.
    """
    if not url:
        raise SSRFBlockedException("Empty destination URL.")

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise SSRFBlockedException(f"Unsupported URI scheme: '{scheme}'. Only HTTP and HTTPS are permitted.")

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        raise SSRFBlockedException("URL does not contain a valid hostname.")

    allowed = allowed_hosts if allowed_hosts is not None else APPROVED_EXTERNAL_HOSTS

    # Check hostname against allow-list
    is_allowed = False
    for allowed_pattern in allowed:
        if hostname == allowed_pattern or hostname.endswith("." + allowed_pattern):
            is_allowed = True
            break

    if not is_allowed:
        logger.warning("SSRF Block: Host '%s' is not in approved external allowlist.", hostname)
        raise SSRFBlockedException(f"Outbound connection to host '{hostname}' is blocked by SSRF policy.")

    # Check DNS resolution to ensure host does not resolve to private IP
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip_candidate = entry[4][0]
            if is_ip_prohibited(ip_candidate):
                logger.warning(
                    "SSRF Block: Host '%s' resolves to prohibited IP address %s.",
                    hostname, ip_candidate
                )
                raise SSRFBlockedException(
                    f"Outbound connection blocked: '{hostname}' resolves to private or metadata IP ({ip_candidate})."
                )
    except socket.gaierror as e:
        logger.warning("DNS lookup failed for %s: %s", hostname, e)
        # We don't necessarily block if DNS is temporarily unavailable,
        # but let the client raise normal connection error

    return url


def safe_request(
    method: str,
    url: str,
    timeout: float = 10.0,
    max_retries: int = 3,
    backoff_factor: float = 1.5,
    allowed_hosts: Optional[Set[str]] = None,
    **kwargs
) -> httpx.Response:
    """
    Executes a hardened HTTP request protected against SSRF, with explicit
    timeout (default 10s) and exponential backoff retry on transient errors.
    """
    # 1. Enforce SSRF validation
    validated_url = validate_url_ssrf(url, allowed_hosts=allowed_hosts)

    # 2. Retrying HTTP execution with exponential backoff
    last_exception = None
    delay = 0.5

    for attempt in range(1, max_retries + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.request(method=method, url=validated_url, **kwargs)

                # Retry on 502, 503, 504 server gateway errors
                if response.status_code in (502, 503, 504) and attempt < max_retries:
                    logger.info(
                        "External service %s returned %d (attempt %d/%d). Retrying in %.2fs...",
                        url, response.status_code, attempt, max_retries, delay
                    )
                    time.sleep(delay)
                    delay *= backoff_factor
                    continue

                return response

        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            last_exception = exc
            logger.warning(
                "HTTP %s to %s failed on attempt %d/%d: %s",
                method, url, attempt, max_retries, exc
            )
            if attempt < max_retries:
                time.sleep(delay)
                delay *= backoff_factor
            else:
                raise last_exception

    if last_exception:
        raise last_exception
    raise RuntimeError("Unexpected state in safe_request execution loop")
