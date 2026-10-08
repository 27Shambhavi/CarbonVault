# 🌱 CarbonVault — Carbon Credit Marketplace

A full-stack marketplace where tree-planting projects sell verified carbon credits to companies.
NGOs register projects, admins verify them with AI-based checks, corporates buy credits through
Razorpay, and the public can audit everything.

**Live app:** https://final-carbon-vault.vercel.app
**API docs (Swagger):** `<your-render-url>/docs`

> One credit = 1 tonne of CO₂ removed.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Features and current status](#features-and-current-status)
6. [User roles](#user-roles)
7. [API overview](#api-overview)
8. [Database](#database)
9. [Run it locally](#run-it-locally)
10. [Environment variables](#environment-variables)
11. [Deployment](#deployment)
12. [Demo accounts](#demo-accounts)
13. [Glossary](#glossary)
14. [Team](#team)

---

## How it works

1. **NGO** registers a plantation project (location, area, trees, boundary polygon, photo evidence).
2. The backend runs **fraud and MRV checks** (photo EXIF and duplicate hash, polygon, satellite vegetation index).
3. **Admin** reviews the scores and approves the project. Credits are calculated from area and tree type.
4. The project appears in the **Marketplace** with a live price (base price × demand × supply × living-credit multipliers).
5. **Corporate** buys credits. Razorpay creates the order and takes the payment (Test Mode for demos).
6. The backend records the transaction, updates the wallet, and writes an audit entry.
7. Corporate generates an **ESG report**. **Public** pages show the same totals, leaderboard, certificates and audit trail.

**Design rule:** the frontend never stores data. Every number on every screen comes from the backend,
and the backend reads it from the database.

---

## Architecture

```
 Browser
    │
    ▼
 FRONTEND  React + Vite            hosted on Vercel
    │      (backend address comes from VITE_API_BASE_URL)
    ▼
 BACKEND   FastAPI (Python)        hosted on Render
    │
    ├──► DATABASE   PostgreSQL (Render)     SQLite for local development
    ├──► RAZORPAY   order creation, checkout, payment verification
    └──► AI MODULES fraud detection, site suitability (ML), GRS scoring
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Recharts, React-Leaflet, Lucide icons |
| Backend | FastAPI, Uvicorn, SQLAlchemy 2, Pydantic 2 |
| Database | PostgreSQL (production), SQLite (local) |
| Geospatial | Shapely, PyProj, GeoAlchemy2, Leaflet |
| ML / detection | scikit-learn, pandas, numpy, ImageHash, Pillow, ExifRead |
| Payments | Razorpay (Test Mode for demos) |
| Documents | ReportLab (PDF), Pillow (certificate images) |
| Hosting | Vercel (frontend), Render (backend + database) |

---

## Project structure

```
final-carbon-vault/
├── README.md
├── requirements.txt
├── render.yaml                  Render blueprint (API service + database)
├── Backend/
│   ├── main.py                  Starts the server, registers all routers
│   ├── core/config.py           Reads environment variables
│   ├── routers/
│   │   ├── project_servicerouter.py   Create, list, approve projects
│   │   ├── marketplace_router.py      Listings, buy requests, accept
│   │   ├── payment_router.py          Razorpay order, payment record, webhook
│   │   ├── grs_router.py              Green Reputation Score, leaderboard
│   │   ├── notifications_router.py    In-app notifications
│   │   ├── calculator_router.py       Carbon footprint calculator
│   │   ├── certificate_router.py      Certificate list, image/PDF, verify
│   │   └── site_suitability/          ML model: is this site good for planting?
│   ├── credit_calculation/credits_module/
│   │   ├── db_models.py         All database tables
│   │   ├── calculator.py        Hectares and tree type → credits
│   │   ├── live_engine.py       Live pricing
│   │   └── shadow_engine.py     Projected (5-year) credits
│   ├── fraud_detection_new/     EXIF, image hash, geo, NDVI validators
│   └── uploads/                 Evidence photos
└── Frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx, AppContext.jsx
        ├── pages/LoginPage.jsx
        ├── services/api.js      The only place that calls the backend
        ├── components/
        │   ├── admin/           Dashboard, Approvals, Users, Pricing and Analytics
        │   ├── ngo/             Dashboard, My Projects, New Project, Marketplace
        │   ├── corporate/       Dashboard, Marketplace, Wallet, ESG, Calculator
        │   ├── public/          Impact Stats, Leaderboard, Certificates, Audit Trail
        │   └── map/             Plantation polygons on Leaflet maps
        └── utils/wktToLeaflet.js
```

---

## Features and current status

Legend: ✅ checked on the live site · 🟡 implemented, still being verified on the live site

| Area | Feature | Status |
|------|---------|--------|
| Auth | Role-based login (Admin, NGO, Corporate, Public) | ✅ |
| Projects | Create project with polygon and evidence upload | 🟡 |
| Projects | Admin approval and credit minting | ✅ |
| Projects | Five-stage lifecycle (Draft → Submitted → Under Review → Field Verification → Approved/Rejected) | 🟡 |
| Projects | Quarterly progress and evidence updates | 🟡 |
| Marketplace | Live pricing engine with multipliers | ✅ |
| Marketplace | Search, filters, side-by-side compare | 🟡 |
| Payments | Razorpay Test Mode checkout opens | ✅ |
| Payments | Webhook verification, wallet and transaction update | 🟡 |
| Reports | ESG report (portfolio and single project) | ✅ |
| Reports | Carbon footprint calculator | 🟡 |
| Reports | Admin dashboard PDF export | 🟡 |
| Trust | Certificates (PNG/PDF) with public verification | 🟡 |
| Trust | Public audit trail | 🟡 |
| Platform | Notifications | 🟡 |
| Platform | Admin sub-roles (super admin / approver) | 🟡 |
| Platform | Bulk project import (CSV) | 🟡 |
| AI | Fraud detection, MRV score, site suitability | ✅ |
| Public | Leaderboard, impact stats, climate insights | ✅ |

> Update this table as each 🟡 item is confirmed on the live site.

---

## User roles

| Role | Can do |
|------|--------|
| **NGO** | Register projects, upload evidence, track status, receive and accept buy requests |
| **Admin** | Review and approve projects, manage users, set pricing multipliers, view analytics |
| **Corporate** | Browse marketplace, buy credits, view wallet, generate ESG reports, estimate footprint |
| **Public** | View leaderboard, certificates, impact stats and the audit trail (no login) |

---

## API overview

Full interactive list: `<your-render-url>/docs`

| Group | Examples |
|-------|----------|
| `/projects` | `GET /all-projects`, `GET /pending`, `GET /map`, `POST /create-project`, `PATCH /projects/{id}/status` |
| `/marketplace` | `GET /listings`, `POST /request`, `POST /accept/{id}` |
| `/payment` | `POST /create-order`, `POST /buy-credits`, `GET /transactions/{corp}`, `GET /wallet/{corp}`, `POST /webhook` |
| `/credits` | `GET /balance/{corporate}`, `POST /mint`, `POST /transfer` |
| `/grs` | `POST /calculate-grs`, `GET /leaderboard` |
| `/fraud` | `POST /check-project` |
| `/suitability` | `POST /predict` |
| `/esg` | `POST /generate-report` |
| `/notifications` | `GET /`, `GET /unread-count`, `PATCH /{id}/read` |
| `/calculator` | `POST /calculate`, `GET /history/{corporate}` |
| `/certificates` | `GET /`, `GET /{id}/image`, `GET /verify/{id}` |

---

## Database

Local development uses SQLite. Production uses PostgreSQL on Render. Tables are created on server start.

| Table | Holds |
|-------|-------|
| `projects` | name, NGO, location, polygon (WKT), area, trees, type, status, MRV score, fraud risk |
| `users` | name, email, role, admin sub-role |
| `corporate_requests` | buyer, project, tonnes, price, status |
| `transactions` | credits, amount in INR, buyer, Razorpay IDs, status |
| `wallets` | credits held and money spent per company |
| `audit_log` | who did what and when (feeds the public audit trail) |
| `pricing_config` | base price and multipliers |
| `notifications` | per-user messages, read/unread |
| `project_status_history` | every stage change of a project |
| `project_progress_updates` | quarterly evidence uploads |
| `footprint_estimates` | saved footprint calculations |

Demo data is created by a seed script, never hardcoded in the frontend.

---

## Run it locally

**Backend**

```bash
cd Backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
cp .env.example .env              # then fill in your values
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend**

```bash
cd Frontend
npm install
npm run dev                       # http://localhost:5173
```

---

## Environment variables

**Backend (`Backend/.env`, or Render → Environment)**

| Name | Meaning |
|------|---------|
| `DATABASE_URL` | `sqlite:///carbon_vault.db` locally, Postgres URL on Render |
| `RAZORPAY_KEY_ID` | Razorpay **test** Key ID (starts with `rzp_test_`) |
| `RAZORPAY_KEY_SECRET` | Matching secret for that key |
| `RAZORPAY_WEBHOOK_SECRET` | Secret set in Razorpay Dashboard → Webhooks |
| `CORS_ORIGINS` | Allowed frontends, comma separated |

**Frontend (Vercel → Environment Variables)**

| Name | Meaning |
|------|---------|
| `VITE_API_BASE_URL` | Public URL of the Render backend, no trailing slash |

Never commit real keys. Use Test Mode keys for demos.

---

## Deployment

| Part | Where | How |
|------|-------|-----|
| Frontend | Vercel | Connect the GitHub repo, root `Frontend`, set `VITE_API_BASE_URL`, redeploy after any change to env vars |
| Backend | Render web service | Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Database | Render PostgreSQL | Copy its internal URL into `DATABASE_URL` |
| Payments | Razorpay | Test keys in Render env; webhook URL: `<your-render-url>/payment/webhook` |

The free Render plan sleeps when idle, so the first request after a pause can take 30–50 seconds.
Open the API once before a demo.

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@carbonvault.com` | `demo@123` |
| NGO | `ngo@carbonvault.com` | `demo@123` |
| Corporate | `corp@carbonvault.com` | `demo@123` |

Razorpay Test Mode card: `4111 1111 1111 1111`, any future expiry, any CVV.

---

## Glossary

- **MRV**: Monitoring, Reporting and Verification. Proof that the trees are real.
- **NDVI**: satellite measure of how green and healthy vegetation is.
- **GRS**: Green Reputation Score (0–1000) for NGOs and buyers.
- **Shadow credits**: projected credits for the next five years, not yet sold.
- **WKT polygon**: text format describing a project's land boundary.
- **Test Mode**: Razorpay sandbox with fake cards and no real money.

---

## Team

Shubh Jain · Sakshi Sharma · Shambhavi Jha · Vaibhav Soni

License: MIT
