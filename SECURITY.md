# CarbonVault Security Policy & Incident Response

## 1. Security Overview

CarbonVault is committed to upholding enterprise-grade security standards across our carbon MRV registry, financial ledgers, satellite verification pipelines, and machine learning models.

---

## 2. Supported Versions

| Version | Supported | Security Maintenance |
| :--- | :--- | :--- |
| `1.0.x` (current main) | :white_check_mark: | Active vulnerability fixes & secret scanning |
| `< 1.0.0` | :x: | Deprecated |

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability, configuration weakness, or secret leak within CarbonVault:

1. **Do NOT open a public GitHub issue.**
2. Send an encrypted advisory to **security@carbonvault.com** (or contact the platform repository maintainers directly).
3. Include:
   - Nature of the vulnerability (e.g. IDOR, SSRF, injection, secret leak).
   - Step-by-step reproduction guide or proof-of-concept.
   - Affected endpoints or components.
   - Potential impact assessment.

### Response SLA
- **Initial Acknowledgement:** Within 24 hours.
- **Triage & Severity Assessment:** Within 48 hours.
- **Remediation & Patch Deployment:** Critical vulnerabilities within 24 hours of triage; high severity within 72 hours.

---

## 4. Secret Management & Key Rotation Procedure

### Zero Plaintext Secrets Policy
- **Never commit credentials to version control.** All secrets (`DATABASE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `JWT_SECRET`) must be provided via runtime environment variables (`render.yaml` with `sync: false`, Render Environment Groups, or local `.env` which is ignored by Git).
- Git pre-commit hooks and automated GitHub Actions CI run `gitleaks` on every pull request and commit to prevent secret leakage.

### Razorpay Test / Live Key Rotation Procedure
If API keys or secrets are ever exposed or suspected to be compromised:
1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch to **Test Mode** (or **Live Mode** if operating live keys).
3. Navigate to **Settings** → **API Keys**.
4. Click **Regenerate Key**. Razorpay displays options:
   - *Deactivate old key in 24 hours* (recommended for zero-downtime rotation), or
   - *Deactivate old key immediately* (emergency response).
5. Copy the newly generated **Key ID** and **Key Secret**.
6. Immediately update the environment variables in your hosting provider:
   - In **Render Dashboard**: Go to `carbonvault-api` → **Environment** → Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   - Save changes; Render triggers an automated restart.
7. Verify that payment creation succeeds using the new credentials (`POST /payment/create-order`).

### JWT Secret Rotation Procedure
1. Generate a cryptographically secure 256-bit secret:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Update `JWT_SECRET` in the Render Environment Variables tab.
3. Upon restart, existing tokens will expire and require user re-authentication.

### Database Credential Rotation
1. Rotate user credentials in your managed PostgreSQL instance.
2. Update `DATABASE_URL` in the Render Environment Variables tab.
3. Validate readiness via `GET /ready`.

---

## 5. Security Measures & Compliance

- **Authentication & RBAC:** Cryptographic password hashing using `bcrypt` with unique salts. Stateless signed JWT tokens (`HS256`, 256-bit entropy).
- **Append-Only Auditing:** Immutable event auditing across all administrative approvals, credit minting, and wallet transactions.
- **CORS & Network Security:** Strict origin whitelisting (`CORS_ORIGINS`). Reverse-proxy buffering disabled (`X-Accel-Buffering: no`) for real-time streams.
- **Automated Scanners:** Gitleaks pre-commit enforcement, dependabot dependency tracking, and static code analysis.
