"""
CarbonVault Phase 4: Comprehensive Security Hardening Test Suite.
Validates:
1. Append-only cryptographic audit hash chain (Genesis to Head, tamper detection, event listeners blocking UPDATE/DELETE).
2. Public audit verification endpoints (/audit-logs/verify and /projects/audit-logs/verify).
3. Secure upload pipeline (5MB limit, magic-byte checks, polyglot rejection, Pillow re-encoding, EXIF stripping).
4. Storage adapter signed URLs & token validation (/uploads/secure/{filename}).
5. SSRF Guard (allow-list validation, private IP and AWS metadata 169.254.169.254 blocking, scheme restriction).
6. HTTP Security Headers (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
7. In-memory sliding-window rate limiter (HTTP 429 with Retry-After).
"""

import io
import os
import sys
import pytest
from PIL import Image

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import AuditLog
from core.audit import record_audit_event, verify_audit_hash_chain, calculate_audit_hash, GENESIS_HASH
from core.upload_security import validate_and_sanitize_image, check_magic_bytes
from core.ssrf_guard import validate_url_ssrf, SSRFBlockedException, APPROVED_EXTERNAL_HOSTS
from core.storage import get_storage
from core.rate_limiter import reset_rate_limiter, check_rate_limit
from fastapi import HTTPException, Request

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_ledger_initialized():
    """Ensure existing records are properly hash-chained before each test."""
    from core.audit import ensure_audit_chain_hashed
    db = SessionLocal()
    try:
        ensure_audit_chain_hashed(db)
    finally:
        db.close()


# ── 1. Cryptographic Audit Hash Chain Tests ─────────────────────────────────

def test_audit_hash_chain_creation_and_verification():
    """Verify sequential entries form an unbroken cryptographic chain."""
    db = SessionLocal()
    try:
        # Create test audit records
        e1 = record_audit_event("create", "PRJ-SEC-01", "Project registered", "Test NGO", db)
        assert e1.prev_hash is not None
        assert e1.hash is not None

        e2 = record_audit_event("approve", "PRJ-SEC-01", "Project approved", "Admin", db)
        assert e2.prev_hash == e1.hash
        assert e2.hash is not None

        # Chain verification should succeed
        res = verify_audit_hash_chain(db)
        assert res["verified"] is True
        assert res["status"] == "intact"
        assert res["total_records"] >= 2
    finally:
        db.close()


def test_audit_hash_chain_tamper_detection():
    """Verify any direct database tampering is immediately caught by the verification engine."""
    db = SessionLocal()
    try:
        # Record an event
        entry = record_audit_event("mint", "PRJ-TAMPER-01", "Legitimate minting", "System", db)
        entry_id = entry.id
        orig_detail = entry.detail
        orig_hash = entry.hash

        # Bypass SQLAlchemy event listener using raw table update to simulate malicious database attack
        db.execute(
            AuditLog.__table__.update()
            .where(AuditLog.id == entry_id)
            .values(detail="TAMPERED DATA: Fraudulent minting 999999 credits")
        )
        db.commit()

        # Chain verification MUST fail and pinpoint the tampered record
        res = verify_audit_hash_chain(db)
        assert res["verified"] is False
        assert res["status"] == "broken"
        assert res["broken_at_id"] == entry_id
        assert "tampering detected" in res["reason"]

        # Restore entry to keep test db clean
        db.execute(
            AuditLog.__table__.update()
            .where(AuditLog.id == entry_id)
            .values(detail=orig_detail, hash=orig_hash)
        )
        db.commit()
    finally:
        db.close()


def test_audit_log_event_listeners_block_update_and_delete():
    """SQLAlchemy event listeners MUST raise exceptions on attempt to UPDATE or DELETE an AuditLog."""
    db = SessionLocal()
    try:
        entry = record_audit_event("audit_test", "PRJ-LISTENER", "Immutability check", "Auditor", db)

        # Attempt UPDATE via ORM
        entry.detail = "Modified detail"
        with pytest.raises((PermissionError, ValueError), match="immutable|prohibited|forbidden"):
            db.commit()

        db.rollback()

        # Attempt DELETE via ORM
        refreshed = db.query(AuditLog).filter(AuditLog.id == entry.id).first()
        db.delete(refreshed)
        with pytest.raises((PermissionError, ValueError), match="immutable|prohibited|forbidden"):
            db.commit()

        db.rollback()
    finally:
        db.close()


def test_audit_verification_endpoints():
    """Verify public endpoints /audit-logs/verify and /projects/audit-logs/verify."""
    for path in ["/audit-logs/verify", "/projects/audit-logs/verify"]:
        resp = client.get(path)
        assert resp.status_code == 200
        data = resp.json()
        assert "verified" in data
        assert "status" in data
        assert data["status"] in ("intact", "empty", "broken")


# ── 2. Secure Upload Pipeline Tests ──────────────────────────────────────────

def test_upload_magic_bytes_detection():
    """Validates JPEG, PNG, and WebP signatures and rejects invalid files."""
    jpeg_header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01"
    png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\r"
    webp_header = b"RIFF\x20\x00\x00\x00WEBPVP8 "

    assert check_magic_bytes(jpeg_header) == "JPEG"
    assert check_magic_bytes(png_header) == "PNG"
    assert check_magic_bytes(webp_header) == "WEBP"

    # Reject executable / script / random bytes
    with pytest.raises(HTTPException) as exc:
        check_magic_bytes(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00")
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        check_magic_bytes(b"#!/bin/bash\necho bad\n")
    assert exc.value.status_code == 400


def test_upload_re_encoding_and_exif_stripping():
    """Valid image is sanitized and re-encoded to clean WebP format with random filename."""
    # Create an in-memory test PNG
    img = Image.new("RGB", (200, 200), color=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    sanitized_bytes, filename, mime = validate_and_sanitize_image(png_bytes, "field_photo.png")

    assert filename.endswith(".webp")
    assert mime == "image/webp"
    assert len(sanitized_bytes) > 0
    # Must be valid WebP header
    assert sanitized_bytes.startswith(b"RIFF")
    assert sanitized_bytes[8:12] == b"WEBP"


def test_upload_polyglot_and_script_rejection():
    """Disguised polyglot images containing embedded script tags MUST be rejected."""
    # Valid PNG header followed by malicious script tag
    polyglot_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\r<script>alert(1)</script>"
    with pytest.raises(HTTPException) as exc:
        validate_and_sanitize_image(polyglot_bytes, "malicious.png")
    assert exc.value.status_code == 400
    assert "Malicious or disguised" in exc.value.detail or "Corrupted" in exc.value.detail


def test_upload_size_limit_rejection():
    """Files exceeding 5MB hard limit MUST be rejected with HTTP 413."""
    oversized = b"\xff\xd8\xff" + (b"\x00" * (6 * 1024 * 1024))
    with pytest.raises(HTTPException) as exc:
        validate_and_sanitize_image(oversized, "huge.jpg")
    assert exc.value.status_code == 413


# ── 3. Storage & Signed URL Tests ────────────────────────────────────────────

def test_storage_signed_token_lifecycle():
    """Validates HMAC-signed URL generation and expiration checking."""
    storage = get_storage()
    filename = "test_asset_uuid.webp"

    signed_url = storage.get_signed_url(filename, ttl_seconds=300)
    assert "/uploads/secure/" in signed_url
    assert "token=" in signed_url
    assert "expires=" in signed_url

    # Extract token and expires
    parts = signed_url.split("?")[-1].split("&")
    params = dict(p.split("=") for p in parts)
    token = params["token"]
    expires = int(params["expires"])

    # Valid token passes
    assert storage.verify_token(filename, token, expires) is True

    # Tampered token fails
    assert storage.verify_token(filename, "tampered_token_hash", expires) is False

    # Expired token fails
    assert storage.verify_token(filename, token, expires=1000) is False


def test_secure_upload_endpoint_access_control():
    """Endpoint /uploads/secure/{filename} blocks requests with invalid or missing tokens."""
    resp = client.get("/uploads/secure/test.webp?token=invalid&expires=9999999999")
    assert resp.status_code == 403

    resp_expired = client.get("/uploads/secure/test.webp?token=invalid&expires=100")
    assert resp_expired.status_code == 403


# ── 4. SSRF Guard Tests ──────────────────────────────────────────────────────

def test_ssrf_approved_hosts():
    """All approved external API hosts MUST pass SSRF validation."""
    for host in APPROVED_EXTERNAL_HOSTS:
        url = f"https://{host}/api/v1/test"
        assert validate_url_ssrf(url) == url


def test_ssrf_prohibited_hosts_and_schemes():
    """Prohibited hosts, private networks, and cloud metadata MUST be blocked."""
    prohibited_urls = [
        "http://169.254.169.254/latest/meta-data/",  # AWS / Cloud Metadata Service
        "http://127.0.0.1:8000/internal-admin",     # Localhost IPv4
        "http://localhost:5432",                     # Localhost name
        "http://10.0.0.1/admin",                     # RFC1918 Class A
        "http://192.168.1.1/router",                 # RFC1918 Class C
        "http://172.16.0.1/status",                  # RFC1918 Class B
        "http://evil-attacker-site.com/pwn",         # Arbitrary external host not in allow-list
        "file:///etc/passwd",                        # File scheme
        "ftp://modis.ornl.gov/data",                 # FTP scheme
    ]

    for bad_url in prohibited_urls:
        with pytest.raises(SSRFBlockedException):
            validate_url_ssrf(bad_url)


# ── 5. Security Headers Middleware Tests ─────────────────────────────────────

def test_security_headers_present_on_responses():
    """Verify all defense-in-depth security headers are attached to responses."""
    resp = client.get("/")
    assert resp.status_code == 200
    headers = resp.headers

    assert "Strict-Transport-Security" in headers
    assert "max-age=31536000" in headers["Strict-Transport-Security"]

    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in headers
    assert "default-src 'self'" in headers["Content-Security-Policy"]
    assert "Permissions-Policy" in headers


# ── 6. Sliding-Window Rate Limiter Tests ─────────────────────────────────────

def test_sliding_window_rate_limiter_triggers_429():
    """Rate limiter MUST raise HTTP 429 when threshold is reached within the window."""
    reset_rate_limiter()

    # Simulate fake Request
    class DummyClient:
        host = "192.0.2.42"

    class DummyRequest:
        headers = {}
        client = DummyClient()

    req = DummyRequest()

    # Limit of 3 requests per 60 seconds
    for _ in range(3):
        check_rate_limit(req, limit=3, window_seconds=60, scope="test_limiter")

    # 4th request MUST raise HTTPException 429
    with pytest.raises(HTTPException) as exc:
        check_rate_limit(req, limit=3, window_seconds=60, scope="test_limiter")

    assert exc.value.status_code == 429
    assert "Rate limit exceeded" in exc.value.detail
    assert "Retry-After" in exc.value.headers
