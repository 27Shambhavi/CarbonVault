"""
CarbonVault Phase 4: Production Security Headers Middleware.
Injects defense-in-depth HTTP security headers into every API response:
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options (nosniff)
- X-Frame-Options (DENY / Clickjacking protection)
- Referrer-Policy
- Permissions-Policy
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Strict Content Security Policy allowing necessary CDN resources for fonts, tiles & Razorpay checkout
CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://gibs.earthdata.nasa.gov https://*.razorpay.com; "
    "connect-src 'self' https://carbonvault-api.onrender.com https://api.razorpay.com https://lumberjack.razorpay.com https://lumberjack-cx.razorpay.com https://*.razorpay.com wss: https:; "
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com; "
    "frame-ancestors 'none'; "
    "form-action 'self'; "
    "object-src 'none'; "
    "base-uri 'self';"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # 1. HSTS: enforce HTTPS for 1 year with subdomains and preload
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # 2. Content Type Sniffing protection
        response.headers["X-Content-Type-Options"] = "nosniff"

        # 3. Frame Protection: Clickjacking defense
        response.headers["X-Frame-Options"] = "DENY"

        # 4. Referrer Policy: prevent leakage of internal IDs/tokens in Referer header
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # 5. Content Security Policy
        response.headers["Content-Security-Policy"] = CSP_POLICY

        # 6. Permissions Policy (disable intrusive browser features)
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(self)"

        # 7. Legacy XSS filter
        response.headers["X-XSS-Protection"] = "1; mode=block"

        return response
