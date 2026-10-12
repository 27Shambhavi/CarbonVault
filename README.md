<div align="center">

# 🌱 CarbonVault

### Carbon Intelligence Platform — *Track Carbon. Verify Impact. Build Trust.*

An online marketplace where tree-planting projects sell **verified carbon credits** to companies,
with built-in **fraud detection**, **secure payments**, and a **public audit trail**.

![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Razorpay](https://img.shields.io/badge/Payments-Razorpay-0C2451)
![Vercel](https://img.shields.io/badge/Hosted-Vercel%20%2B%20Render-000000?logo=vercel&logoColor=white)

**🌐 Live app:** https://final-carbon-vault.vercel.app
**📘 API docs:** `<your-render-url>/docs`

</div>

---

## 📑 Table of Contents

1. [What is CarbonVault? (simple explanation)](#1--what-is-carbonvault-simple-explanation)
2. [The problem and our solution](#2--the-problem-and-our-solution)
3. [Who uses it](#3--who-uses-it)
4. [Features in detail](#4--features-in-detail)
5. [The story of one carbon credit](#5--the-story-of-one-carbon-credit)
6. [Screen-by-screen guide](#6--screen-by-screen-guide)
7. [Architecture](#7--architecture)
8. [Technology stack](#8--technology-stack)
9. [Project structure](#9--project-structure)
10. [How the important calculations work](#10--how-the-important-calculations-work)
11. [Database](#11--database)
12. [API reference](#12--api-reference)
13. [Run it on your computer](#13--run-it-on-your-computer)
14. [Environment variables](#14--environment-variables)
15. [Deploying it online](#15--deploying-it-online)
16. [Demo accounts and a 10-minute demo script](#16--demo-accounts-and-a-10-minute-demo-script)
17. [How to check that a screen is really dynamic](#17--how-to-check-that-a-screen-is-really-dynamic)
18. [Troubleshooting and FAQ](#18--troubleshooting-and-faq)
19. [Security](#19--security)
20. [Feature status](#20--feature-status)
21. [Known limitations and roadmap](#21--known-limitations-and-roadmap)
22. [Glossary](#22--glossary)
23. [Team and license](#23--team-and-license)

---

## 1. 🌍 What is CarbonVault? (simple explanation)

Trees absorb carbon dioxide (CO₂) from the air. Companies that pollute can **pay people to plant
trees** to balance out their pollution. The proof of that payment is called a **carbon credit**.

> **1 carbon credit = 1 tonne of CO₂ removed from the air.**

CarbonVault is a website where this happens safely:

- **Tree planters (NGOs)** list their planting projects.
- **The platform** checks that those projects are real, using photos, maps and satellite data.
- **Companies** buy credits from projects they trust, and pay online.
- **Anyone** can open the public pages to see what has been approved, who is buying, and what happened when.

Think of it as an **online shop for carbon credits, with a lie detector and a public record book**.

---

## 2. 🎯 The problem and our solution

| The problem in today's carbon market | How CarbonVault handles it |
|---|---|
| Fake projects: the trees do not exist | Fraud checks on photos, land boundary and satellite greenness before approval |
| Same photo reused for many projects | Image fingerprinting (hash) detects duplicates |
| Hard to tell good projects from weak ones | Every project gets a **quality (MRV) score** and **fraud risk %** |
| Prices are random | **Live pricing engine** driven by demand and supply |
| Buyers cannot prove what they bought | **Certificates** with a verifiable ID, plus **ESG reports** |
| Nobody can audit the platform | **Public audit trail**, leaderboard and impact statistics |
| Payments are manual and slow | **Razorpay** online payment with automatic wallet update |

---

## 3. 👥 Who uses it

| Role | Who they are | What they do on the platform |
|------|--------------|------------------------------|
| 🌳 **NGO** | Organisations that plant trees | Register projects, upload evidence, track approval, accept buyer offers, get paid |
| 🛡️ **Admin** | The platform team | Review projects, read fraud and quality scores, approve or reject, set prices, manage users |
| 🏢 **Corporate** | Companies that want to offset emissions | Browse the marketplace, buy credits, hold them in a wallet, download certificates and ESG reports |
| 🌐 **Public** | Anyone (no login) | Read the leaderboard, impact numbers, certificates and audit trail |

---

## 4. ✨ Features in detail

### 4.1 Project registration (NGO)
- One form: name, organisation, latitude/longitude, area in hectares, number of trees, plantation type
  (Mixed, Teak, Mangrove), start date, notes.
- **Land boundary** as a polygon (WKT text). A button can **auto-generate** the polygon from the
  coordinates and area.
- **Evidence upload** (field photos). Photo metadata is read for the fraud check.
- A live **location preview** map and a **project summary** card show what will be submitted.
- Each project gets a unique ID such as `PRJ-MAN-AMAZON`.

### 4.2 Fraud and quality checks
The system combines several checks into a **fraud risk score (0–100%)** and an **MRV score (0–100)**:

| Check | What it looks at |
|-------|------------------|
| 📸 Photo metadata (EXIF) | Does the photo's GPS position and date agree with the claimed site? |
| 🧬 Image hash | Has this photo, or one very similar, been used before? |
| 📍 Geometry | Is the polygon valid, and is its size consistent with the claimed area? |
| 🛰️ Satellite vegetation (NDVI) and land temperature | Is there real green cover at that place? |
| 🌿 Ecological sense | Is the plantation type realistic for that location? |

### 4.3 Admin approval and credit minting
- Left list of projects with status filters, right panel with the map, MRV score, fraud risk,
  environmental score, credit summary and the evidence photo.
- Admin can **Approve**, **Reject** or **Request Data**.
- On approval the system **calculates credits** from area and tree type and also projects
  **shadow credits** (expected credits over the next five years).
- Optional multi-stage workflow: Draft → Submitted → Under Review → Field Verification → Approved / Rejected,
  with a history of who changed what and when.

### 4.4 Marketplace and live pricing
- Approved projects are listed with credits available, area, location and price per tonne in USD and INR.
- **Pricing Engine (admin):** base price × demand multiplier × supply multiplier × living-credit multiplier.
- Filters by plantation type; search, price range and project comparison for buyers.

### 4.5 Payments
- Buyer chooses a quantity, sees the total in USD and INR, and clicks pay.
- **Razorpay checkout** opens (Test Mode in demos, so no real money moves).
- After payment: transaction saved, wallet updated, available credits reduced, certificate and
  notification created, audit entry written.
- A **webhook** lets Razorpay confirm payments server-to-server so a fake browser message cannot fool the system.

### 4.6 Wallet, certificates and receipts
- **Wallet:** total credits held, portfolio value, total spent, full transaction history.
- **Certificates:** an image and a PDF with buyer, project, tonnes, date and a unique ID, which anyone
  can check on a public verification page.

### 4.7 ESG reports
- Choose **Full Portfolio** or **Single Project**, click **Generate Report**.
- Report contains: ESG score breakdown (Environmental, Social, Governance), carbon offset, vegetation (NDVI)
  trend, land-temperature trend, governance and compliance panel, methodology and verification notes.
- Aligned with **GRI 305**, **ISSB IFRS S2** and **TCFD**. Export to PDF.
- Note: vegetation and temperature figures are satellite *proxies* and engine *estimates*, and the report says so.

### 4.8 Carbon footprint calculator (Corporate)
- Enter electricity, fuel, travel and company size. The calculator estimates yearly emissions in
  tonnes of CO₂e (Scope 1, 2 and 3) using standard GHG Protocol factors, and tells you **how many credits
  you would need**, with a button to open the marketplace for that quantity. Past calculations are saved.

### 4.9 Reputation score (GRS)
- Four parts: **Transparency, Quality, Commitment, Verification**. They combine into **0–1000** and a badge:
  Bronze, Silver, Gold or Platinum. Used for the leaderboard and on buyer dashboards.

### 4.10 Site suitability checker (NGO)
- Enter a latitude and longitude. A machine-learning model returns how suitable the place is for planting
  (0 to 1), helping an NGO choose a site **before** applying.

### 4.11 Notifications
- Bell icon with an unread count. Events such as approval, buy request, payment and credit minting
  create a message for the person concerned. Click to open and mark as read.

### 4.12 Public transparency portal (no login)
- **Impact Stats**, **Leaderboard**, **Marketplace View**, **Climate Insights** (co-benefits, forest area, CO₂ removed),
  **Certificates** and **Audit Trail** (a log of what happened and when).

### 4.13 Admin tools
- **User Management** (invite, view, suspend), **Analytics** (revenue, average price, credits by project type, climate radar),
  **role permissions** (super admin and approver), **bulk CSV import** of projects, and **PDF export** of the dashboard.

### 4.14 Everyday comfort
- Dark and light themes, mobile-friendly layout, loading states, and an error screen with a **Try again** button
  so one broken page never blanks the whole app.

---

## 5. 📖 The story of one carbon credit

1. **Maria** from *EcoGuard Brazil* (NGO) registers the *Amazon Reforestation Initiative*: 4,500 ha, 180,000 trees, mixed forest.
2. She draws the boundary and uploads field photos. The system scores it: **MRV 94, fraud risk 8%**.
3. **Alex** (Admin) sees the project in *Project Approvals*, reads the scores and clicks **Approve**.
4. The system **mints 12,400 verified credits** (and projects 43,400 shadow credits). An audit entry is written.
5. The project appears in the **Marketplace** at **$28.50 per tonne** (base price), adjusted by the live multipliers.
6. **James** from *Microsoft Sustainability* (Corporate) opens the marketplace and clicks **Buy** for 25 tonnes.
7. The checkout shows the total in INR. He pays through **Razorpay**.
8. The backend records the transaction, adds 25 credits to his **wallet**, reduces the project's available credits,
   creates a **certificate**, and notifies the NGO.
9. James opens **ESG Reports**, selects the project, and generates a report for his investors.
10. Anyone on the **public portal** can now see the new purchase in the audit trail and the updated impact totals.

---

## 6. 🖥️ Screen-by-screen guide

### 🛡️ Admin
| Menu | What you see |
|------|--------------|
| Dashboard | Credits minted, active projects, pending reviews, fraud flags, plantation map, type breakdown, activity log, approval rate |
| User Management | Total users, NGO and buyer counts, searchable user table, invite user |
| Project Approvals | Project list and filters, map, scores, credit summary, evidence, Approve / Reject / Request Data |
| Pricing Engine | Base price and three multipliers with sliders, live effective price, price history |
| Analytics | Total revenue, average price, credits available, verification rate, credits by type, climate radar |

### 🌳 NGO
| Menu | What you see |
|------|--------------|
| Dashboard | Active projects, verified and shadow credits, total funding, project map, recent projects |
| My Projects | Searchable table with status filters |
| New Project | Registration form with map preview, polygon tools and evidence upload |
| Site Suitability | Coordinates in, suitability result and map out |
| Marketplace | Buy requests from companies, accept, receive payment |

### 🏢 Corporate
| Menu | What you see |
|------|--------------|
| Dashboard | Portfolio overview, map, reputation score, available projects |
| Marketplace | All approved projects with Buy buttons, type filters |
| My Wallet | Credits held, portfolio value, total spent, transaction history, receipts |
| ESG Reports | Scope selector, Generate Report, charts, PDF export |
| Footprint Calculator | Emission estimate and credits needed |

### 🌐 Public
Impact Stats · Leaderboard · Marketplace View · Climate Insights · Certificates · Audit Trail

---

## 7. 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   USER'S BROWSER                                       │
│    Animated numbers · Live connectivity badge · Activity feed toasts · GIBS WMTS tiles │
└───────────────────────────┬───────────────────────────────────▲────────────────────────┘
                            │ HTTPS (REST)                      │ Server-Sent Events (SSE)
                            │                                   │ /realtime/stream
┌───────────────────────────▼───────────────────────────────────┴────────────────────────┐
│  FRONTEND — React 18 + Vite (Tailwind-free Vanilla CSS tokens)      hosted on Vercel   │
│  Admin Approvals & Alerts · NGO Suitability · Corporate Marketplace · Public Portal    │
│  useLiveStream hook · Leaflet NASA GIBS WMTS toggle · Recharts Real Satellite Series   │
└───────────────────────────┬───────────────────────────────────▲────────────────────────┘
                            │ REST JSON                         │ SSE Broadcasts
┌───────────────────────────▼───────────────────────────────────┴────────────────────────┐
│  BACKEND — FastAPI (Python 3.10)                                    hosted on Render   │
│  Real-Time Spine: In-memory asyncio queues + ticket-based auth + live_events table     │
│  External Feeds: ORNL DAAC MODIS MOD13Q1 NDVI + NASA POWER Agroclimatology             │
│  ML Pipeline (M1-M5): IsolationForest, DOY baseline monitor, RF suitability, forecast │
│  Grounded AI Explainer: Anthropic Claude + verify_grounded_numbers strict post-check   │
└──────────┬───────────────────┬────────────────────┬────────────────────┬───────────────┘
           │                   │                    │                    │
┌──────────▼─────────┐ ┌───────▼────────┐  ┌────────▼─────────┐ ┌────────▼─────────────┐
│ PostgreSQL         │ │ NASA Scientific│  │ Machine Learning │ │ Anthropic Claude     │
│ (Render / Supabase)│ │ ORNL DAAC MODIS│  │ M1 IsolationForest│ │ Messages API with   │
│ Real-time & audit  │ │ NASA POWER Clim│  │ M2 DOY Baseline  │ │ Number Verification │
│ observations cache │ │ NASA GIBS WMTS │  │ M4 Price Forecast│ │ & Fallback Template  │
└────────────────────┘ └────────────────┘  └──────────────────┘ └──────────────────────┘
```

**Ground Rules:**
1. **Zero invented data & zero invented constants:** Every number shown is computed from the database or fetched from verified external scientific APIs. If external feeds are temporarily unreachable, interfaces show explicit "data unavailable" banners rather than synthetic curves.
2. **Strict Grounded AI:** The AI reviewer explanation is verified through a strict post-check parser (`verify_grounded_numbers`). Any hallucinated number causes immediate rejection and graceful deterministic fallback.
3. **Render free-tier resilience:** Memory stays well under 512 MB by employing lightweight scikit-learn algorithms, NumPy Holt-Winters exponential smoothing, batched DAAC queries, and non-blocking background workers.

---

## 8. 🧰 Technology stack

| Layer | Technology | Why it is used |
|-------|-----------|----------------|
| **UI** | **React 18** | High-performance reactive component tree |
| **Build** | **Vite 5** | Instant hot-reloading and optimized production bundles |
| **Styling** | **Vanilla CSS tokens** | Custom, lightweight design system; zero CSS bundle bloat |
| **Charts** | **Recharts** | Interactive NDVI growth series, price forecasts with prediction bands |
| **Maps** | **Leaflet + React-Leaflet** | Interactive vector polygons + NASA GIBS WMTS satellite tile overlays |
| **Real-Time** | **Server-Sent Events (SSE)** | Low-overhead streaming (`/realtime/stream`) with 15s heartbeats |
| **API** | **FastAPI** | Async REST API, OpenAPI docs, background tasks |
| **Server** | **Uvicorn** | High-concurrency ASGI server |
| **Database** | **PostgreSQL** (SQLite locally) | Relational integrity, temporal observation indices |
| **Satellite Feed** | **ORNL DAAC Web Service** | Real MODIS MOD13Q1 250m 16-day NDVI composites |
| **Climate Feed** | **NASA POWER API** | Daily Agroclimatology (T2M, PRECTOTCORR, RH2M) |
| **Satellite Tiles**| **NASA GIBS WMTS** | MODIS Terra 8-day true-color and NDVI raster tiles |
| **ML Models** | **scikit-learn, NumPy** | IsolationForest (M1), DOY baseline (M2), RF (M3), Forecast (M4) |
| **Image Integrity**| **ImageHash & Pillow** | Perceptual hashing with flip/rotation invariance (M5) |
| **Grounded AI** | **Anthropic Messages API** | Claude 3.5 Sonnet / Haiku with strict number-verification post-check |
| **Payments** | **Razorpay** | Order generation, checkout modal, HMAC-SHA256 webhooks |
| **Certificates** | **ReportLab & Pillow** | Verifiable PDF & PNG certificate generation with SHA-256 digests |

---

## 9. 📁 Project structure

```
final-carbon-vault/
├── README.md
├── requirements.txt                 Python dependencies (scikit-learn, statsmodels, httpx, etc.)
├── render.yaml                      Render deployment blueprint
│
├── Backend/
│   ├── main.py                      FastAPI application, CORS, router mounting, DB initialization
│   ├── seed.py                      Seed database with synthetic flag (is_synthetic = True)
│   ├── test_backend_endpoints.py    Full production API test suite
│   ├── core/
│   │   ├── config.py                Environment variables (DB, JWT, Anthropic, Razorpay)
│   │   ├── database.py              SQLAlchemy session management and engine
│   │   ├── events.py                In-memory SSE event bus, replay buffer, and DB logging
│   │   └── security.py              Password hashing (bcrypt) and JWT role validation
│   ├── routers/
│   │   ├── project_servicerouter.py Projects, approvals, status transitions, satellite sync
│   │   ├── marketplace_router.py    Listings, live pricing, order requests
│   │   ├── payment_router.py        Razorpay checkout, wallet updates, webhooks
│   │   ├── stats_router.py          Dynamic KPI stats overview with period deltas
│   │   ├── realtime_router.py       SSE streaming, ticket handshakes, polling fallback
│   │   ├── grs_router.py            Green Reputation Score engine and leaderboard
│   │   ├── certificate_router.py    Certificate minting and public verification
│   │   └── site_suitability/        Bio-climatic suitability model and training data
│   ├── services/
│   │   ├── satellite.py             ORNL DAAC MODIS MOD13Q1 NDVI ingestion & caching
│   │   └── climate.py               NASA POWER Agroclimatology ingestion & caching
│   ├── ml/
│   │   ├── anomaly.py               M1: IsolationForest biometric anomaly detection
│   │   ├── ndvi_monitor.py          M2: Day-of-year seasonal baseline NDVI decline monitor
│   │   ├── suitability.py           M3: Bio-climatic suitability with live NASA climate
│   │   ├── forecast.py              M4: 7-day ExponentialSmoothing price forecast & 95% PI
│   │   └── phash.py                 M5: Perceptual hash index with flip/rotation invariance
│   ├── ai/
│   │   └── explainer.py             Anthropic Claude explainer + verify_grounded_numbers check
│   └── tests/
│       ├── test_phase1_phase2.py    Real-time spine and template-removal tests
│       ├── test_phase3_satellite_climate.py Real external data tests
│       ├── test_phase4_ml.py        M1–M5 machine learning tests
│       └── test_phase5_ai.py        Grounded AI explainer & post-check rejection tests
│
├── Frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── scripts/
│   │   └── check-no-mockdata.js     CI prebuild script banning mockData imports
│   └── src/
│       ├── main.jsx · App.jsx · AppContext.jsx
│       ├── hooks/
│       │   └── useLiveStream.js     SSE hook with auto-reconnect and heartbeat tracking
│       ├── services/api.js          Unified backend API client
│       └── components/
│           ├── LiveBadge.jsx        Real stream status badge (LIVE / CONNECTING / OFFLINE)
│           ├── AnimatedNumber.jsx   Micro-animated metric counters
│           ├── ActivityFeed.jsx     Real-time platform activity feed & toasts
│           ├── admin/               AdminApprovals, AdminDashboard, AdminPricingAnalytics
│           ├── ngo/                 NGODashboard, NGOSiteSuitability, NGOProjects
│           ├── corporate/           CorporateMarketplace, CorporateWallet, ESGReports
│           ├── public/              PublicTransparencyPortal, PublicCertificates
│           └── map/                 PlantationMap with NASA GIBS WMTS layer toggle
```

---

## 10. 🧮 How the important calculations work

### Credits & Shadow Credits
Land area and plantation type determine the annual sequestration rate. The credit engine converts this into **verified credits**, and the shadow engine projects the next five years as **shadow credits** based on verified growth trajectories.

### Real-Time Dynamic Pricing Engine
```
price per tonne = base price × demand multiplier × supply multiplier × living-credit multiplier
```
- Operates in **Automatic Mode** (recomputing demand and supply multipliers from actual 30-day buy order volume and available minted credit inventory) or **Manual Admin Override Mode**.
- Every price update immediately writes to the `price_history` database table, emits a `pricing.update` SSE broadcast, and updates the corporate marketplace ticker and 7-day forecast.

### M1: Unsupervised Biometric Anomaly Detection (`ml/anomaly.py`)
- Algorithm: `IsolationForest` (contamination=0.10, n_estimators=100) trained across 7 standardized biometric features:
  1. `trees_per_ha`: Plantation tree density
  2. `area_gap_ratio`: Relative discrepancy between stated hectares and WKT polygon geodesic area
  3. `photo_count`: Volume of photographic ground evidence submitted
  4. `mean_ndvi`: Mean historical vegetation index from MODIS
  5. `ndvi_trend`: Linear slope of vegetation index over time
  6. `coord_distance_deg`: Geodesic distance from centroid of declared biome
  7. `plantation_type_code`: Categorical encoding of plantation ecosystem (Mangrove, Teak, Mixed, etc.)
- Normalizes raw decision scores into a **0–100 Anomaly Score**.
- Extracts the **top 3 biometric standardized deviations (z-scores)** against peer benchmarks to explain why a project was flagged.
- Fuses 50% deterministic rule risk + 50% IsolationForest score into a **Fused Reviewer Risk Index**.
- Explicitly labeled in the UI as **"unusual vs. peers, not proof of fraud"** to ensure audit objectivity.

### M2: Seasonal Day-of-Year Baseline NDVI Monitor (`ml/ndvi_monitor.py`)
- Evaluates real MODIS MOD13Q1 250m composites against a historical **Day-of-Year (DOY) median baseline** computed strictly over *earlier years* (`other.year < target.year`) within a ±24 day seasonal window.
- Computes robust z-scores using Median Absolute Deviation: `z = (observed - median) / (1.4826 * MAD)`.
- If `z < -2.0` for **two consecutive composites**, triggers an automated `greenness.decline` real-time alert event.
- Displays a prominent **MODIS 250 m ground sampling resolution caveat** noting potential mixed-canopy reflectance.

### M3: Bio-Climatic Site Suitability (`ml/suitability.py`)
- `RandomForestRegressor` model predicting site suitability (0–100).
- Dynamically queries live NASA POWER daily agroclimatology (mean temperature and annual precipitation) for the exact clicked coordinates.
- Calculates per-feature contributions against coastal training centroids and outputs high/medium/low confidence intervals.
- Scores rounded to 1 decimal place reflecting bio-climatic sensor precision.

### M4: 7-Day Carbon Price Forecasting (`ml/forecast.py`)
- Employs `statsmodels.tsa.holtwinters.ExponentialSmoothing` (with graceful fallback to pure NumPy Holt-Winters additive smoothing for constrained environments) when ≥ 30 historical price observations exist.
- Falls back to OLS `LinearTrend` when historical observations are limited (< 30 points).
- Generates 7-day daily forecasts accompanied by **95% prediction intervals** (`lower_bound`, `upper_bound`, `std_err`).

### M5: Multi-Orientation Perceptual Photo Integrity (`ml/phash.py`)
- Computes perceptual difference hash (`dhash` / `phash`) across submitted ground photos.
- Evaluates 0°, 90°, 180°, 270° rotations and horizontal flips against all registered images in the database.
- Detects deliberate evasion attempts and duplicate evidence uploads with Hamming distance thresholding.

### Grounded AI Explainer with Number-Verification Post-Check (`ai/explainer.py`)
- Compiles exact stored database numbers (`gather_project_facts`): biometrics, M1 anomaly score, M2 seasonal NDVI z-scores, climate observations, and verification status.
- Prompts Anthropic Claude (Messages API) with strict guidelines prohibiting ungrounded statistics.
- **Strict Post-Check Algorithm (`verify_grounded_numbers`):**
  1. Extracts all integers, decimals, and percentages from the generated narrative using regex.
  2. Cross-references each number against the factual payload.
  3. If **any number** is not present in the facts payload, the model response is rejected as a hallucination, logged, and replaced with deterministic, verified template sentences.
- Results are cached in the `ai_summaries` table keyed by the SHA256 digest of the facts dictionary.

---

## 11. 🗄️ Database

PostgreSQL in production (Render / Supabase), SQLite for local development. Tables are auto-created at startup via SQLAlchemy ORM. Synthetic seed records are strictly marked with `is_synthetic = True`.

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `projects` | id, project_id, name, ngo, latitude, longitude, polygon (WKT), area_hectares, trees, plantation_type, status, mrv_score, fraud_risk, credits, price, is_synthetic, created_at | Plantation registry |
| `live_events` | event_id, event_type, payload (JSON), audience, target_user, created_at | Server-Sent Events audit log & replay buffer |
| `satellite_observations` | id, project_id, source, band, obs_date, value, fetched_at | Real MODIS MOD13Q1 NDVI composites |
| `climate_observations` | id, project_id, obs_date, t2m, prectotcorr, rh2m, fetched_at | Real NASA POWER daily agroclimatology |
| `photo_hashes` | id, project_id, photo_url, phash_hex, created_at | Perceptual image fingerprint index |
| `price_history` | id, base_price, demand_mult, supply_mult, living_credit_mult, effective_price, mode, created_at | Pricing engine audit trail |
| `ai_summaries` | id, project_id, audience, summary, next_steps, status, facts_hash, created_at | Grounded AI reviewer narratives |
| `users` | id, name, email, password_hash, role, admin_role, status | User accounts with bcrypt password hashes |
| `transactions` | id, corporate_name, project_id, credits, amount_inr, razorpay_order_id, razorpay_payment_id, status | Payment records |
| `wallets` | corporate_name, total_credits, total_spent_inr, last_updated | Corporate credit holdings |
| `audit_log` | id, action, subject, actor, details, created_at | Immutable public transparency audit trail |
| `certificates` | public_id, project_id, transaction_id, tonnes, issued_at, hash | Verifiable carbon credit certificates |
| `users` | id, name, email, role, admin_role, status | People and organisations |
| `corporate_requests` | id, corporate_name, project_id, tonnes, price, status | Buy requests to NGOs |
| `transactions` | id, corporate_name, project_id, credits, amount_inr, razorpay_order_id, razorpay_payment_id, status | Every payment |
| `wallets` | corporate_name, total_credits, total_spent_inr, last_updated | Balance per company |
| `audit_log` | id, action, subject, actor, details, created_at | Public audit trail |
| `pricing_config` | base_price, demand, supply, living_credit | Pricing engine settings |
| `notifications` | id, recipient, type, title, message, link, is_read, created_at | Bell messages |
| `project_status_history` | id, project_id, from_status, to_status, changed_by, comment, created_at | Lifecycle history |
| `project_progress_updates` | id, project_id, quarter, year, survival_rate, canopy_cover, evidence_url, notes | Progress over time |
| `footprint_estimates` | id, corporate_name, inputs, scope1, scope2, scope3, total_tonnes, created_at | Saved calculations |
| `certificates` | public_id, project_id, transaction_id, tonnes, issued_at, hash | Certificates and verification |

---

## 12. 🔌 API reference

Interactive version with "Try it out": **`<your-render-url>/docs`**

| Group | Endpoint | What it does |
|-------|----------|--------------|
| **Core & Health** | `GET /health` | Health probe returning commit hash, DB connection status, uptime |
| | `POST /auth/login` | Bcrypt password verification + signed JWT token issuance |
| **Real-Time Stream** | `POST /realtime/ticket` | Exchange JWT/session for short-lived (60s) single-use SSE ticket |
| | `GET /realtime/stream?ticket=…` | Server-Sent Events stream with 15s keep-alive and event replay |
| | `GET /realtime/events` | Polling fallback returning recent events |
| **KPIs & Stats** | `GET /stats/overview?period=30d` | Dynamic dashboard metrics with delta_pct computed from DB |
| | `GET /public/stats` | Live impact metrics for the public landing page |
| **Projects** | `GET /projects/all-projects` | All projects (admin) |
| | `GET /projects/projects?ngo_id=…` | Projects of one NGO |
| | `GET /projects/pending` | Projects waiting for review |
| | `GET /projects/map` | Polygons for Leaflet maps |
| | `POST /projects/create-project` | Register a project (form + evidence image) |
| | `PATCH /projects/projects/{id}/status` | Move project lifecycle status (triggers background satellite sync) |
| | `GET /projects/{id}/history` | Lifecycle status history |
| | `GET / POST /projects/{id}/progress` | Progress updates |
| | `POST /projects/import-csv` | Bulk project import |
| | `GET /projects/export-pdf` | Dashboard PDF |
| **Satellite & Climate** | `GET /projects/{id}/ndvi` | Real MODIS MOD13Q1 250m NDVI time series via ORNL DAAC |
| | `GET /projects/{id}/climate` | Real NASA POWER daily agroclimatology (T2M, PRECTOTCORR, RH2M) |
| | `POST /projects/{id}/sync-satellite` | Trigger background backfill of satellite and climate records |
| **Machine Learning** | `GET /projects/{id}/ml-assessment` | M1 IsolationForest anomaly score + M2 DOY NDVI baseline + M5 pHash |
| | `GET /pricing/forecast` | M4 7-day carbon price forecast with 95% prediction intervals |
| | `POST /suitability/predict` | M3 RandomForest bio-climatic suitability with live NASA climate |
| **Grounded AI** | `GET /projects/{id}/ai-summary` | Anthropic Claude narrative verified against stored DB numbers |
| **Marketplace** | `GET /marketplace/listings` | Browse listings with live pricing engine rates |
| | `POST /marketplace/request` | Create a corporate buy request |
| | `POST /marketplace/accept/{id}` | NGO accepts offer |
| | `POST /marketplace/compare` | Compare up to 3 projects |
| **Payment** | `POST /payment/create-order` | Create Razorpay order |
| | `POST /payment/buy-credits` | Record a completed purchase |
| | `GET /payment/transactions/{corp}` | Transaction history |
| | `GET /payment/wallet/{corp}` | Wallet balance and spending summary |
| | `POST /payment/webhook` | Razorpay HMAC-SHA256 server confirmation |
| **Credits** | `GET /credits/balance/{corp}` · `POST /credits/mint` · `POST /credits/transfer` | Credit accounting |
| **GRS** | `POST /grs/calculate-grs` · `GET /grs/leaderboard` | Green Reputation Score and rankings |
| **Fraud** | `POST /fraud/check-project` | Biometric, geographic, and image fraud screening |
| **ESG** | `POST /esg/generate-report` | Build ESG report with real satellite series |
| **Notifications** | `GET /notifications` · `GET /notifications/unread-count` · `PATCH /notifications/{id}/read` | In-app alerts |
| **Calculator** | `POST /calculator/calculate` · `GET /calculator/history/{corp}` | Footprint estimations |
| **Certificates** | `GET /certificates` · `GET /certificates/{id}/image` · `GET /certificates/verify/{id}` | Digital and verifiable certificates |

---

## 13. 💻 Run it on your computer

**You need:** Python 3.9+, Node.js 16+, npm, Git.

### Step 1 — Get the code
```bash
git clone https://github.com/27Shambhavi/final-carbon-vault.git
cd final-carbon-vault
```

### Step 2 — Start the backend
```bash
cd Backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r ../requirements.txt
cp .env.example .env                # open .env and fill in your values
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Open http://127.0.0.1:8000/docs. If you see the API page, the backend works.

### Step 3 — Start the frontend (new terminal)
```bash
cd Frontend
npm install
npm run dev
```
Open http://localhost:5173 and log in with a demo account (section 16).

---

## 14. 🔑 Environment variables

### Backend (`Backend/.env` locally, Render → Environment online)
| Name | Example | Meaning |
|------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Production PostgreSQL connection string |
| `JWT_SECRET` | `your-secure-jwt-secret-min-32-chars` | HMAC secret for session and role tokens |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Claude API key for Grounded AI explainer (server-side only) |
| `LLM_MODEL` | `claude-3-5-sonnet-20241022` | Claude model tier (`claude-3-5-sonnet-20241022` or `claude-3-haiku-20240307`) |
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxxxxx` | Test Key ID from Razorpay |
| `RAZORPAY_KEY_SECRET` | *(secret)* | Must belong to the **same** key pair as the ID |
| `RAZORPAY_WEBHOOK_SECRET` | *(secret)* | Webhook verification secret |
| `CORS_ORIGINS` | `http://localhost:5173,https://final-carbon-vault.vercel.app` | Allowed frontend origins |

### Frontend (Vercel → Settings → Environment Variables)
| Name | Example | Meaning |
|------|---------|---------|
| `VITE_API_BASE_URL` | `https://carbonvault-api.onrender.com` | Backend address, **no trailing slash** |

> 🔒 **Security Notice:** `ANTHROPIC_API_KEY` and `RAZORPAY_KEY_SECRET` stay strictly on the backend and are never sent to the client browser.

---

## 15. 🚀 Deploying it online

### Backend on Render
1. Create a **PostgreSQL** database on Render (name it `carbonvault-postgres`). Copy its **Internal Database URL**.
2. Create a **Web Service** from this GitHub repo. Root directory `Backend`.
   Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add the environment variables from section 14, with `DATABASE_URL` set to the URL from step 1.
4. Deploy. Check `<your-render-url>/docs` loads.

### Frontend on Vercel
1. Import the GitHub repo, root directory `Frontend`.
2. Add `VITE_API_BASE_URL` = your Render URL.
3. **Redeploy** (a variable added after a build does not apply until the next build).

### Razorpay webhook
1. Razorpay Dashboard → Settings → Webhooks → Add.
2. URL: `<your-render-url>/payment/webhook`. Events: `payment.captured`, `payment.failed`, `order.paid`.
3. Copy the secret into `RAZORPAY_WEBHOOK_SECRET` on Render.

> ⏱️ On Render's free plan the server **sleeps when idle**. The first request after a pause can take
> 30–50 seconds. **Open the API docs page a minute before any demo** to wake it up.

---

## 16. 🎬 Demo accounts and a 10-minute demo script

### Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@carbonvault.com` | `demo@123` |
| NGO | `ngo@carbonvault.com` | `demo@123` |
| Corporate | `corp@carbonvault.com` | `demo@123` |
| Public | click **Explore Public Transparency Portal** | none |

**Razorpay Test card:** `4111 1111 1111 1111` · any future expiry · any CVV · any OTP.

### Script
| Min | Do this | Say this |
|-----|---------|----------|
| 0–1 | Open the login page | "Companies want to offset emissions, but fake projects make it hard to trust the market." |
| 1–3 | Log in as **NGO** → New Project, fill the form, auto-generate polygon, submit | "NGOs register a project with a map boundary and evidence." |
| 3–5 | Log in as **Admin** → Project Approvals → open the new project, show MRV and fraud risk, approve | "The system scored it. The admin decides, and credits are created." |
| 5–6 | Admin → Pricing Engine, move a slider | "Price follows demand and supply in real time." |
| 6–8 | Log in as **Corporate** → Marketplace → Buy 25 tonnes → Razorpay Test checkout | "The company pays online; the wallet updates automatically." |
| 8–9 | Corporate → ESG Reports → Generate | "One click produces an investor-ready ESG report." |
| 9–10 | Open the **Public portal**: leaderboard, certificates, audit trail | "Everything is transparent and auditable." |

---

## 17. 🔍 How to check that a screen is really dynamic

1. Open the screen, press **F12**, go to the **Network** tab, and reload.
2. A dynamic screen shows requests to your Render URL with JSON replies. No requests means the data is written in the code.
3. Change something (create a project, buy credits) and **reload the page**. The numbers should change.
4. Compare the same total on Admin, NGO and Public pages. They must match because they read the same database.

---

## 18. 🛠️ Troubleshooting and FAQ

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Pages stay on **"Loading…"** for a long time | Render free server was asleep | Wait up to 50 s; open `<render-url>/docs` first next time |
| Page shows **"Something went wrong… X is not defined"** | A code import was missed | Check the browser console; add the missing import and redeploy |
| Razorpay says **"Authentication failed"** | Key ID and secret are from different pairs, or Render was not redeployed after saving | Re-copy both from the same Test key, save, **redeploy** Render |
| Razorpay says **"Amount exceeds maximum"** | Test Mode limit per order | Buy a smaller quantity (for example 25 tonnes) |
| Frontend loads but shows no data | `VITE_API_BASE_URL` missing or wrong | Set it on Vercel without a trailing slash, then redeploy |
| Browser console shows a **CORS** error | Frontend URL not allowed | Add it to `CORS_ORIGINS` on Render |
| New project does not appear | Request failed | Check Network tab for the response and the Render logs |
| Data disappears after a redeploy | SQLite on a temporary disk | Use Render PostgreSQL |
| Backend crashes on start | Missing package or bad `DATABASE_URL` | Read the Render logs; run `pip install -r requirements.txt` |
| Database URL starts with `postgres://` and fails | SQLAlchemy needs `postgresql://` | The config converts it automatically; check you pasted the full URL |

**Is real money involved?** No. Razorpay runs in Test Mode with fake cards.
**Is the satellite and climate data real?** Yes! CarbonVault connects to live NASA scientific data feeds:
- **MODIS MOD13Q1 NDVI**: Queried directly from NASA EOSDIS ORNL DAAC REST API (`250m_16_days_NDVI`, scale 0.0001) for the plantation centroid coordinates and cached in PostgreSQL.
- **NASA POWER Agroclimatology**: Queried daily from the NASA POWER API (`T2M`, `PRECTOTCORR`, `RH2M`) for historical temperature and rainfall observations.
- **NASA GIBS WMTS**: Live satellite raster layers rendered directly on Leaflet maps via NASA's Global Imagery Browse Services.

### 📜 Scientific Attributions & Citations
- **MODIS Vegetation Indices**: Didan, K. (2021). *MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061*. NASA EOSDIS Land Processes DAAC. https://doi.org/10.5067/MODIS/MOD13Q1.061. Accessed via Oak Ridge National Laboratory (ORNL) Distributed Active Archive Center (DAAC).
- **Agroclimatology**: NASA Prediction of Worldwide Energy Resources (POWER) Project, NASA Langley Research Center (LaRC). https://power.larc.nasa.gov.
- **Imagery**: NASA Global Imagery Browse Services (GIBS), part of the NASA Earth Observing System Data and Information System (EOSDIS).

---

## 19. 🔐 Security & Grounding

- **Grounded AI Verification:** Every LLM summary is audited by `verify_grounded_numbers` against active PostgreSQL records before display. Hallucinated numbers trigger automatic rejection and fallback to deterministic templates.
- **Zero Secrets on Client:** `ANTHROPIC_API_KEY` and `RAZORPAY_KEY_SECRET` remain strictly server-side.
- **Bcrypt & JWT:** Role claims (`admin`, `ngo`, `corporate`) are cryptographically signed.
- **CORS:** Restricts API access to authorized frontend domains.
- **Parameterised Queries:** SQLAlchemy protects against SQL injection.
- **Tamper-Evident SHA-256:** Audit log and certificate verification hashes.

---

## 20. ✅ Feature status

**Legend:** ✅ checked and verified live on production Render + Vercel · 🟡 built & staging verified

| Area | Feature | Status |
|------|---------|:-----:|
| **Auth** | Four-role login (Admin, NGO, Corporate, Public) + bcrypt + JWT | ✅ |
| **Real-Time Spine** | Server-Sent Events (`/realtime/stream`) + LiveBadge + Activity Feed | ✅ |
| **Real External Data** | Real MODIS MOD13Q1 250m NDVI via ORNL DAAC Web Service | ✅ |
| **Real External Data** | Real NASA POWER daily agroclimatology (temp, precipitation, humidity) | ✅ |
| **Real External Data** | NASA GIBS WMTS satellite tile toggle on interactive Leaflet maps | ✅ |
| **Machine Learning** | M1: IsolationForest unsupervised biometric anomaly detection & z-scores | ✅ |
| **Machine Learning** | M2: Seasonal Day-of-Year baseline NDVI monitor & decline alerts | ✅ |
| **Machine Learning** | M3: Bio-climatic suitability model with live NASA climate inputs | ✅ |
| **Machine Learning** | M4: 7-day ExponentialSmoothing price forecast with 95% prediction intervals | ✅ |
| **Machine Learning** | M5: Multi-orientation perceptual photo hash integrity (rotation/flip) | ✅ |
| **Grounded AI** | Claude Explainer + strict `verify_grounded_numbers` rejection & fallback | ✅ |
| **Projects** | Registration form with map, polygon, evidence upload, auto-WKT | ✅ |
| **Projects** | Dynamic MRV score & fraud risk screening | ✅ |
| **Projects** | Admin approval and credit minting (with background satellite sync) | ✅ |
| **Projects** | Lifecycle history and progress updates | ✅ |
| **Marketplace** | Dynamic pricing engine (auto & manual modes) with live ticker | ✅ |
| **Payments** | Razorpay checkout + wallet accounting + transaction history | ✅ |
| **Certificates** | SHA-256 signed verifiable PDF & PNG certificates + public lookup | ✅ |
| **Reports** | Corporate ESG report with real satellite series & PDF export | ✅ |
| **Reputation** | GRS score engine and public leaderboard | ✅ |
| **Public Portal** | Dynamic impact stats, public leaderboard, and immutable audit trail | ✅ |

---

## 21. 🧭 Known limitations and roadmap

### Known limitations
- Render free tier spins down on prolonged inactivity (cold starts ~30–50s).
- Razorpay operates in Test Mode with sandbox payment credentials.
- Satellite observations are subject to the MODIS 250 m ground sampling resolution caveat (observations reflect aggregated surface reflectance within a 6.25-hectare pixel).

### Roadmap
| Version | Plan |
|---------|------|
| v1.1 | Email and SMS webhook alerts for critical NDVI decline events |
| v1.2 | Automated credit retirement ledger and downloadable auditor bundles |
| v1.3 | Decentralized registry cross-anchoring |
| v1.4 | Mobile inspector application (React Native) |

---

## 22. 📚 Glossary

| Term | Meaning |
|------|---------|
| **Carbon credit** | A tradable certificate for 1 tonne of CO₂ removed or avoided |
| **Offsetting** | Paying for credits to balance out your own emissions |
| **NGO** | Non-governmental organisation; here, the tree planter |
| **MRV** | Monitoring, Reporting, Verification: proving that the project is real and measured |
| **NDVI** | Normalised Difference Vegetation Index: a satellite measure of how green and healthy plants are |
| **LST** | Land Surface Temperature |
| **GRS** | Green Reputation Score (0–1000) |
| **Shadow credits** | Credits a project is expected to produce over the next five years, not yet issued |
| **Minting** | Creating verified credits after approval |
| **ESG** | Environmental, Social and Governance: how responsibly a company behaves |
| **GRI 305, ISSB IFRS S2, TCFD** | International standards for reporting emissions and climate risk |
| **Scope 1 / 2 / 3** | Direct emissions / purchased energy / all other indirect emissions |
| **WKT polygon** | A text format describing a land boundary as a list of coordinates |
| **EXIF** | Hidden data inside a photo (GPS position, date, camera) |
| **Hash** | A short fingerprint of a file; identical or very similar photos give matching fingerprints |
| **REST API** | The way the frontend asks the backend for data |
| **Webhook** | A message one server sends another automatically, here from Razorpay to us |
| **Test Mode** | Razorpay sandbox with fake cards and no real money |
| **CORS** | A browser rule that controls which websites may call an API |

---

Licensed under the **MIT License**.

<div align="center">

*Made with 🌱 for a more transparent carbon market.*

</div>
