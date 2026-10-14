# CarbonVault Threat Model & Security Architecture (STRIDE)

**Document Version:** 1.0.0  
**Phase:** Phase 4 — Security Hardening  
**Target Systems:** Frontend (Vercel Edge), Backend API (FastAPI on Render), Database (PostgreSQL / Alembic), Object Storage (AWS S3 / Cloudflare R2 / Signed Fallback), External APIs (Sentinel Hub, NASA POWER, MODIS, Anthropic Claude, Razorpay)

---

## 1. System Architecture & Trust Boundaries

```mermaid
flowchart TD
    subgraph Public Internet
        Browser[Client Web Browser / Mobile]
        Attacker[Malicious Actor / Botnet]
    end

    subgraph Edge CDN & Ingress
        Vercel[Vercel CDN Edge\nSecurity Headers, HSTS, CSP]
    end

    subgraph Backend Core (Render)
        FastAPI[FastAPI Application Server]
        RateLimiter[Sliding Window Rate Limiter]
        AuthGuard[JWT & RBAC Authorization Matrix]
        SSRFGuard[Outbound SSRF Allow-List & IP Validator]
        UploadSec[Secure Image Re-encoder & Polyglot Detector]
    end

    subgraph Persistence & Storage
        Postgres[(PostgreSQL Database\nAppend-Only Audit Logs & Triggers)]
        ObjectStorage[AWS S3 / Cloudflare R2\nTime-Limited Signed URLs]
    end

    subgraph Approved External Services
        NASA[NASA POWER & ORNL MODIS]
        Copernicus[ESA Copernicus CDSE]
        Razorpay[Razorpay Payment Gateway]
        Anthropic[Anthropic Claude API]
    end

    Browser -->|HTTPS| Vercel
    Attacker -->|Attacks| Vercel
    Vercel -->|HTTPS / Headers| FastAPI

    FastAPI --> RateLimiter
    RateLimiter --> AuthGuard
    AuthGuard --> Postgres
    FastAPI --> UploadSec
    UploadSec --> ObjectStorage

    FastAPI --> SSRFGuard
    SSRFGuard --> NASA
    SSRFGuard --> Copernicus
    SSRFGuard --> Razorpay
    SSRFGuard --> Anthropic
```

### Trust Boundaries
1. **TB-1 (Client to Edge / API)**: Untrusted boundary. All client input (forms, JSON payloads, headers, query params, cookies) is treated as untrusted and hostile.
2. **TB-2 (API to Database)**: Controlled boundary. Connections require TLS, parameterised SQL queries through SQLAlchemy ORM, and schema synchronization via Alembic.
3. **TB-3 (API to External APIs)**: Outbound boundary. Governed strictly by the SSRF Guard allow-list, blocking all loopback, private RFC1918, and cloud metadata (169.254.169.254) addresses.
4. **TB-4 (API to Object Storage)**: Controlled asset boundary. Assets stored with random UUID filenames, validated magic bytes, stripped EXIF, and served exclusively through short-lived signed URLs.

---

## 2. STRIDE Threat Analysis

### 2.1 Spoofing Identity
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **S-1** | Attacker attempts to forge JWT claims or manipulate `role` / `admin_role` | Critical | HMAC-SHA256 tokens validated with min 32-byte high-entropy `JWT_SECRET`. Verification in `check_admin_permission` inspects decoded token and matches against database record. | `Backend/tests/test_authorization_matrix.py` |
| **S-2** | Attacker spoofs client IP or client headers (`X-Admin-Role`, `X-Admin-Email`) | High | Client headers are ignored unless accompanied by a verified JWT. Client IP extraction takes leftmost value from `X-Forwarded-For` and falls back to socket host. | `Backend/tests/test_authorization_matrix.py` |
| **S-3** | Brute force attacks against corporate or NGO user accounts | High | Sliding-window rate limiter limits authentication attempts to 10 requests per 60 seconds per IP with HTTP 429 response. Bcrypt salted hashing prevents rainbow table lookup. | `Backend/tests/test_phase4_security.py` |

### 2.2 Tampering with Data
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **T-1** | Malicious insider or compromised admin account modifies audit logs to erase evidence | Critical | Cryptographic SHA-256 hash chain links each audit record to the preceding entry (Genesis to Head). SQLAlchemy `before_update` and `before_delete` event listeners block mutation. Endpoint `/audit-logs/verify` detects any break. | `Backend/tests/test_phase4_security.py` |
| **T-2** | Image upload tampering (polyglot files, hidden executable scripts, steganography) | High | `core/upload_security.py` validates binary magic bytes, inspects file headers/trailers for forbidden scripts (`<script`, `<?php`, `<svg`), and re-encodes images to WebP via Pillow, discarding raw original streams and EXIF metadata. | `Backend/tests/test_phase4_security.py` |
| **T-3** | Unauthorized modification of system pricing configuration or reference FX rates | High | Restricted to `super_admin` role exclusively (`test_authorization_matrix.py` validates approvers and regular admins are rejected with HTTP 403). | `Backend/tests/test_authorization_matrix.py` |

### 2.3 Repudiation
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **R-1** | Corporate claims they did not initiate or authorize a credit purchase | Medium | Verified Razorpay payment signature required; double-entry transaction record stored with timestamp, corporate identifier, and immutable certificate ID. | `Backend/tests/test_phase6_payments.py` |
| **R-2** | Platform claims audit records were never altered | Medium | Non-repudiation guaranteed by public verification endpoint `/projects/audit-logs/verify` allowing independent mathematical verification of SHA-256 hashes. | `Backend/tests/test_phase4_security.py` |

### 2.4 Information Disclosure
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **I-1** | Sensitive server environment variables or database credentials leaked in error traces | High | Production mode (`APP_MODE=production`) disables debug stack traces; custom exception handlers in `core/errors.py` return structured JSON errors with sanitised messages and `request_id`. | `Backend/tests/test_phase3_foundations.py` |
| **I-2** | Geolocation and camera EXIF metadata leaked through uploaded project photos | Medium | `upload_security.py` re-encodes all image pixel data into fresh WebP buffers, automatically stripping all EXIF tags (including GPS coordinates and camera serial numbers). | `Backend/tests/test_phase4_security.py` |
| **I-3** | Internal database or storage URLs exposed directly to end-users | Low | Assets served via time-limited signed URLs (`/uploads/secure/{filename}?token=...&expires=...` or AWS S3 presigned URLs with 1-hour TTL). Storage bucket credentials remain entirely server-side. | `Backend/tests/test_phase4_security.py` |

### 2.5 Denial of Service (DoS)
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **D-1** | Image decompression bomb (billion laughs / pixel flood) crashes the server | High | Hard 5MB upload size limit (`MAX_UPLOAD_SIZE_BYTES`); Pillow dimension guard strictly rejects images exceeding 8000x8000 pixels before allocation. | `Backend/tests/test_phase4_security.py` |
| **D-2** | Unbounded list queries exhaust memory and CPU | Medium | All list endpoints enforce mandatory pagination (`core/pagination.py`) with default page size 20 and hard ceiling of 100 items. | `Backend/tests/test_phase3_foundations.py` |
| **D-3** | Exhaustion of external AI or satellite API quotas via abusive repeated requests | High | In-memory sliding-window rate limiters on AI summarization (10 req/min), order creation (15 req/min), and upload endpoints (10 req/min). | `Backend/tests/test_phase4_security.py` |

### 2.6 Elevation of Privilege
| Threat ID | Threat Description | Severity | Countermeasure / Mitigation | Verification Gate |
|---|---|---|---|---|
| **E-1** | Project approver elevates permissions to modify platform pricing and fees | High | RBAC Matrix distinguishes `super_admin` from `approver`. Endpoints `/config/set` and `/fx-rate/override` reject non-super_admin callers with 403. | `Backend/tests/test_authorization_matrix.py` |
| **E-2** | SSRF (Server-Side Request Forgery) targeting cloud metadata (`169.254.169.254`) or internal services | Critical | `core/ssrf_guard.py` validates all external request destinations against a strict domain allow-list, resolves hostnames to verify against prohibited IP subnets (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `192.168.0.0/16`), and rejects arbitrary URL schemes. | `Backend/tests/test_phase4_security.py` |

---

## 3. Defense-in-Depth HTTP Headers Baseline

Both FastAPI (`SecurityHeadersMiddleware`) and Vercel Edge (`vercel.json`) inject the following hardened HTTP response headers:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforces HTTPS strictly, preventing SSL stripping. |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; ...` | Mitigates XSS, data exfiltration, and unauthorized script execution. |
| `X-Content-Type-Options` | `nosniff` | Disables MIME type sniffing attacks. |
| `X-Frame-Options` | `DENY` | Prevents iframe embedding and clickjacking attacks. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects privacy by omitting sensitive query parameters in Referer headers. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` | Restricts browser hardware access to unauthorized features. |

---

## 4. OWASP ZAP Baseline Alignment & Residual Risks

### Tested Baseline Status
- **SQL Injection (SQLi)**: Completely mitigated by SQLAlchemy parameterised queries and Alembic ORM schemas.
- **Cross-Site Scripting (XSS)**: Mitigated by React automatic escaping, strict CSP header, and ReportLab `html.escape` sanitation.
- **Cross-Site Request Forgery (CSRF)**: Mitigated by Authorization header Bearer tokens (not cookie-dependent) and strict CORS origin allowlists.
- **Security Misconfiguration**: Mitigated by typed Pydantic `BaseSettings` which fail fast on startup if SQLite or weak secrets are used in production.

### Documented Residual Risks & Operational Considerations
1. **Render Free Tier Spin-Down**: In demo mode, cold-start latency (30-60s) occurs after 15 minutes of inactivity. Resolved by upgrading Render instance to a persistent tier.
2. **In-Memory Rate Limiting**: The sliding-window rate limiter is currently in-memory per worker process. For horizontally auto-scaled multi-container deployments in Phase 7, state can be backed by a shared Redis cluster (`REDIS_URL`).
