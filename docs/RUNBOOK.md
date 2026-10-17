# CarbonVault — Production Runbook & Operations Manual

This runbook is the authoritative guide for provisioning, operating, maintaining, and troubleshooting CarbonVault across Render (Backend & Database), Vercel (Frontend), and Razorpay (Payments).

---

## 1. Render Infrastructure Architecture

### 1.1 Region Alignment & Topology
> [!IMPORTANT]
> Both the Web Service and PostgreSQL Database **MUST be deployed in the same Render region: Virginia (US East, `us-east-1` / `virginia`)**.

```
Render Cloud (Virginia)
┌─────────────────────────────────────────────────────────────┐
│ Web Service: carbonvault-api (Virginia)                     │
│  - Environment: Python 3.10+                                │
│  - Start Command: alembic upgrade head &&                   │
│                   uvicorn main:app --host 0.0.0.0 --port $PORT│
│  - Health Check: /health                                   │
│  - Readiness Check: /ready                                  │
│                                                             │
│       ▲                                                     │
│       │ Internal Connection (Zero latency & egress costs)   │
│       ▼                                                     │
│                                                             │
│ PostgreSQL 18: carbonvault-postgres (Virginia)              │
│  - Internal Database URL: postgresql://...                  │
│  - Automatic continuous backups                             │
└─────────────────────────────────────────────────────────────┘
       ▲
       │ HTTPS / CORS
       ▼
Vercel Edge Network
┌─────────────────────────────────────────────────────────────┐
│ Frontend: final-carbon-vault.vercel.app                     │
│  - Framework: Vite + React 18 SPA                           │
│  - Deep Linking: /projects/:id, /projects/new, /ml-models   │
│  - VITE_API_URL: https://carbonvault-api.onrender.com       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Resolving Duplicate / Orphan Services
If your Render dashboard displays two services (e.g., an older `carbonvault-api` in Oregon and a `CarbonVault` in Virginia):
1. **Identify the Active Service**: Check which service URL is configured in Vercel under `VITE_API_URL` (typically `https://carbonvault-api.onrender.com`).
2. **Consolidate on Virginia**:
   - Verify that the web service is in the **Virginia** region alongside `carbonvault-postgres`.
   - If the active URL is linked to an Oregon service, migrate environment variables and custom domains to the Virginia service, or recreate `carbonvault-api` in Virginia.
3. **Decommission the Orphan**: Suspend or delete the unused secondary service to prevent configuration confusion and stray billing.

---

## 2. Render Web Service Configuration

### 2.1 Build & Start Settings

| Setting | Value |
| :--- | :--- |
| **Name** | `carbonvault-api` |
| **Region** | `Virginia (US East)` |
| **Branch** | `main` |
| **Root Directory** | `Backend` *(or root if using Docker/render.yaml)* |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path**| `/health` |

### 2.2 Environment Variables (Render Dashboard -> Environment)

| Variable | Required | Example / Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | **Yes** | Internal database URL from `carbonvault-postgres` (e.g. `postgresql://carbonvault:***@dpg-***-a.virginia-postgres.render.com/carbonvault_db`) |
| `PORT` | **Yes** | `10000` (Injected automatically by Render, bind with `--port $PORT`) |
| `PAYMENT_MODE` | **Yes** | `test` (staging) or `live` (production) |
| `RAZORPAY_KEY_ID` | **Yes** | Starts with `rzp_test_` in test mode, `rzp_live_` in live mode |
| `RAZORPAY_KEY_SECRET` | **Yes** | 32-character merchant secret from Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | **Yes** | High-entropy secret matching the webhook configuration in Razorpay |
| `SECRET_KEY` | **Yes** | Cryptographic secret for JWT authentication tokens |
| `ALLOWED_ORIGINS` | Optional | `https://final-carbon-vault.vercel.app,http://localhost:5173` |

> [!TIP]
> **Whitespace Sanitization**: CarbonVault automatically trims leading and trailing whitespace/newlines from all credentials upon boot (`strip_env_strings`). However, ensure no accidental surrounding quotes are included.

---

## 3. Database Migrations & Parity Maintenance

### 3.1 Migration Command
Migrations execute automatically upon every deployment via the start command:
```bash
alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 3.2 Pre-Deployment Local Verification
Before pushing schema changes to GitHub, run the zero-diff migration verification script:
```powershell
python scripts/check_migrations.py
```
This script validates:
1. **Scratch Migration**: Creates a fresh database from scratch, runs `alembic upgrade head`, and confirms `alembic check` produces zero diffs.
2. **Target Migration**: Upgrades the active development database and verifies zero pending schema differences against SQLAlchemy metadata models.

### 3.3 Manual Migration Rollback
If a deployment fails due to a bad migration:
```bash
# Connect to Render shell or run via CLI
alembic downgrade -1
```

---

## 4. Health & Readiness Probes

### 4.1 Liveness Probe (`GET /health`)
- **URL**: `https://carbonvault-api.onrender.com/health`
- **Purpose**: Render container health check. Returns `HTTP 200 OK` if the process is up and accepting connections.
- **Payload**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-17T20:25:00Z",
    "version": "1.0.0"
  }
  ```

### 4.2 Dynamic Readiness Probe (`GET /ready`)
- **URL**: `https://carbonvault-api.onrender.com/ready`
- **Purpose**: Validates database connectivity, migration schema parity, and payment gateway configuration before routing traffic.
- **Payload**:
  ```json
  {
    "status": "ready",
    "database": "connected",
    "migration_current": "b8c9d0e1f2a3",
    "migration_head": "b8c9d0e1f2a3",
    "schema": "ok",
    "payment_mode": "test",
    "razorpay_status": "ready",
    "razorpay_key_hint": "rzp_test_••••9xyz"
  }
  ```
- **Error States**:
  - `schema: "behind"`: Database migrations have not caught up to code revisions.
  - `razorpay_status: "missing_keys"`: Key ID or secret is empty.
  - `razorpay_status: "prefix_mismatch"`: Test key used with `PAYMENT_MODE=live` (or vice-versa).

---

## 5. Razorpay Payments & Webhook Setup

### 5.1 Webhook Endpoint Configuration
1. Open [Razorpay Merchant Dashboard](https://dashboard.razorpay.com/) -> **Settings** -> **Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL**:
   ```
   https://carbonvault-api.onrender.com/payment/webhook
   ```
4. **Secret**: Enter the exact value configured in Render's `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events**:
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.processed`
6. Click **Save**.

### 5.2 Frontend Script & CSP Compatibility
CarbonVault includes the official Razorpay script asynchronously in `Frontend/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
```
The Vercel Content Security Policy (`vercel.json`) allows:
- `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com`
- `frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com`
- `connect-src 'self' https://api.razorpay.com https://carbonvault-api.onrender.com`

---

## 6. Common Incidents & Troubleshooting Runbook

### Incident 1: "Razorpay Authentication failed" (HTTP 401)
- **Symptom**: Checkout modal fails to open or backend returns `401 Unauthorized` on `/payment/create-order`.
- **Root Causes**:
  1. Secrets were entered into the wrong Render service (e.g., entered in Oregon service while Vercel calls Virginia service).
  2. Key ID prefix mismatch: Using `rzp_test_...` with `PAYMENT_MODE=live`.
  3. Key secret contains unstripped characters or was regenerated in Razorpay dashboard without updating Render.
- **Resolution**:
  1. Check `GET /ready` on the live API URL and verify `razorpay_key_hint` matches the expected Razorpay account.
  2. In Render dashboard, verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the Virginia service.
  3. Trigger manual deploy in Render to reload environment variables.

### Incident 2: Database Connection Timeout / Schema Error
- **Symptom**: API returns `500 Internal Server Error` on project list or `/ready` returns `database: disconnected`.
- **Root Causes**:
  1. Web service is in Oregon attempting to connect to PostgreSQL in Virginia across regions.
  2. Render suspended the free PostgreSQL instance due to inactivity.
- **Resolution**:
  1. Verify both services are in Virginia.
  2. In Render dashboard, click `carbonvault-postgres` and confirm status is **Available**.
  3. Verify `DATABASE_URL` uses the Internal Connection String (starts with `postgres://...render.com`).

### Incident 3: Alembic Migration Behind (`schema: behind`)
- **Symptom**: `/ready` returns `"schema": "behind"` with `"migration_current": "old_rev"`.
- **Resolution**:
  1. Inspect Render deployment logs to confirm if `alembic upgrade head` executed or encountered a lock timeout.
  2. In Render Shell, manually run `alembic upgrade head`.

---

## 7. Daily Verification & Monitoring Scripts

```powershell
# 1. Run full backend test suite
pytest Backend -q

# 2. Verify migration consistency
python scripts/check_migrations.py

# 3. Evaluate fraud screening ML model recall
python scripts/eval_screening.py

# 4. Execute live end-to-end audit
node scripts/verify_live.mjs
```
