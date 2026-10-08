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
┌──────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS
┌───────────────────────────────▼──────────────────────────────────────┐
│  FRONTEND — React 18 + Vite                       hosted on Vercel   │
│  Admin screens · NGO screens · Corporate screens · Public screens    │
│  services/api.js  →  the ONLY file that talks to the backend         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  JSON over REST  (VITE_API_BASE_URL)
┌───────────────────────────────▼──────────────────────────────────────┐
│  BACKEND — FastAPI (Python)                       hosted on Render   │
│  Routers: projects · marketplace · payment · credits · GRS · fraud · │
│           suitability · ESG · notifications · calculator ·           │
│           certificates                                               │
│  Engines: credit calculator · pricing · shadow credits · MRV · GRS   │
└──────────┬─────────────────────┬───────────────────────┬─────────────┘
           │                     │                       │
┌──────────▼─────────┐  ┌────────▼─────────┐   ┌─────────▼────────────┐
│ PostgreSQL         │  │ Razorpay         │   │ AI / analysis        │
│ (Render)           │  │ orders, checkout,│   │ fraud detection,     │
│ SQLite when local  │  │ webhook          │   │ suitability model    │
└────────────────────┘  └──────────────────┘   └──────────────────────┘
```

**Golden rule:** the frontend keeps **no business data**. Every number shown comes from the backend,
which reads it from the database. A number written inside frontend code is a bug.

**Why separate frontend and backend?** They can be updated, scaled and hosted independently, and the
same API can later serve a mobile app.

---

## 8. 🧰 Technology stack

| Layer | Technology | Why it is used |
|-------|-----------|----------------|
| UI | **React 18** | Reusable components, fast updates |
| Build | **Vite 5** | Very fast development server and build |
| Charts | **Recharts** | Line, bar, donut and radar charts |
| Maps | **Leaflet + React-Leaflet** | Free interactive maps, polygon drawing |
| Icons | **Lucide React** | Clean icon set |
| API | **FastAPI** | Fast, automatic API documentation, type checking |
| Server | **Uvicorn** | Runs the FastAPI app |
| ORM | **SQLAlchemy 2** | Talk to the database with Python classes |
| Validation | **Pydantic 2** | Reject bad input, shape every response |
| Database | **PostgreSQL** (SQLite locally) | Reliable storage; geospatial support |
| Geometry | **Shapely, PyProj, GeoAlchemy2** | Polygon area, coordinate conversion |
| ML / data | **scikit-learn, pandas, numpy** | Site suitability model |
| Image checks | **ImageHash, Pillow, ExifRead** | Duplicate detection, metadata, certificate image |
| Payments | **Razorpay** | Indian payment gateway with a free Test Mode |
| PDF | **ReportLab** | Certificates and dashboard reports |
| Hosting | **Vercel, Render** | Free-tier friendly deployment |

---

## 9. 📁 Project structure

```
final-carbon-vault/
├── README.md
├── requirements.txt                 Python dependencies
├── render.yaml                      Render blueprint (API service)
│
├── Backend/
│   ├── main.py                      Starts the app, registers routers, creates tables
│   ├── core/
│   │   └── config.py                Reads environment variables
│   ├── routers/
│   │   ├── project_servicerouter.py   Projects: create, list, approve, history, progress, import, PDF
│   │   ├── marketplace_router.py      Listings, filters, buy requests, compare
│   │   ├── payment_router.py          Razorpay order, purchase, wallet, webhook
│   │   ├── grs_router.py              Reputation score and leaderboard
│   │   ├── notifications_router.py    Notifications
│   │   ├── calculator_router.py       Footprint calculator
│   │   ├── certificate_router.py      Certificates and verification
│   │   └── site_suitability/          ML suitability model, training script, data
│   ├── credit_calculation/credits_module/
│   │   ├── db_models.py             All database tables
│   │   ├── db.py                    Database connection
│   │   ├── calculator.py            Area and tree type → credits
│   │   ├── live_engine.py           Live pricing
│   │   ├── shadow_engine.py         Five-year projected credits
│   │   └── funding_engine.py        Funding flow
│   ├── fraud_detection_new/         EXIF, image hash, geo and NDVI validators
│   └── uploads/                     Evidence photos
│
└── Frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx · App.jsx · AppContext.jsx
        ├── pages/LoginPage.jsx
        ├── services/api.js            All backend calls live here
        ├── utils/wktToLeaflet.js      Converts polygon text to map shapes
        └── components/
            ├── Layout.jsx             Sidebar, header, bell, theme switch
            ├── ErrorBoundary.jsx      Friendly error screen
            ├── UI.jsx                 Shared cards, buttons, badges
            ├── admin/                 Dashboard, Approvals, Users, Pricing & Analytics
            ├── ngo/                   Dashboard, projects, new project, marketplace
            ├── corporate/             Dashboard, marketplace, wallet, ESG, calculator
            ├── public/                Public portal pages
            └── map/                   Plantation maps
```

---

## 10. 🧮 How the important calculations work

### Credits
Land area and plantation type give a yearly rate. The new-project form shows it live, for example
*"CO₂ rate: 20–40 credits per acre per year · 1 credit = 1 tonne CO₂"* for mangroves. The credit engine converts
this into **verified credits**, and the shadow engine projects the next five years as **shadow credits**.

### Live price
```
price per tonne = base price × demand multiplier × supply multiplier × living-credit multiplier
```
Example from the Pricing Engine: `28.50 × 1.12 × 0.98 × 1.08 = $33.78` per tonne.
Admin moves the sliders; the marketplace and analytics follow. INR is shown using the platform's exchange rate.

### Fraud risk (0–100%)
Several validators each contribute a risk signal (photo metadata, duplicate image, polygon shape and size,
vegetation index, ecological plausibility). The combined result is shown on the admin approval screen.

### MRV score (0–100)
How strong the monitoring, reporting and verification evidence is for a project.

### GRS (0–1000)
Transparency + Quality + Commitment + Verification, each scored 0–100 and combined onto a 1000-point scale,
then mapped to Bronze / Silver / Gold / Platinum.

### ESG score
Environmental, Social and Governance sub-scores (each /100) built from the project or portfolio data,
shown with trends and compliance indicators.

### Footprint
Emissions for each activity are multiplied by a standard factor and added up into Scope 1 (direct),
Scope 2 (purchased energy) and Scope 3 (indirect, such as flights). The total in tonnes of CO₂e becomes
the number of credits suggested.

---

## 11. 🗄️ Database

PostgreSQL in production, SQLite on your laptop. Tables are created automatically when the server starts.
Demo data is loaded by a **seed script**, never typed into the frontend.

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `projects` | id, name, ngo, latitude, longitude, polygon (WKT), area_hectares, trees, plantation_type, status, mrv_score, fraud_risk, credits, price, created_at | Every project |
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
| **Projects** | `GET /projects/all-projects` | All projects (admin) |
| | `GET /projects/projects?ngo_id=…` | Projects of one NGO |
| | `GET /projects/pending` | Projects waiting for review |
| | `GET /projects/map` | Polygons for maps |
| | `POST /projects/create-project` | Register a project (form + files) |
| | `PATCH /projects/projects/{id}/status` | Move a project to a new status |
| | `GET /projects/{id}/history` | Status history |
| | `GET / POST /projects/{id}/progress` | Progress updates |
| | `POST /projects/import-csv` | Bulk import |
| | `GET /projects/export-pdf` | Dashboard PDF |
| **Marketplace** | `GET /marketplace/listings` | Browse (supports filters and search) |
| | `POST /marketplace/request` | Create a buy request |
| | `POST /marketplace/accept/{id}` | NGO accepts |
| | `POST /marketplace/compare` | Compare up to 3 projects |
| **Payment** | `POST /payment/create-order` | Create Razorpay order |
| | `POST /payment/buy-credits` | Record a completed purchase |
| | `GET /payment/transactions/{corp}` | Transaction history |
| | `GET /payment/wallet/{corp}` | Wallet summary |
| | `POST /payment/webhook` | Razorpay server confirmation |
| **Credits** | `GET /credits/balance/{corp}` · `POST /credits/mint` · `POST /credits/transfer` | Credit accounting |
| **GRS** | `POST /grs/calculate-grs` · `GET /grs/leaderboard` | Reputation |
| **Fraud** | `POST /fraud/check-project` | Run fraud checks |
| **Suitability** | `POST /suitability/predict` | Location suitability |
| **ESG** | `POST /esg/generate-report` | Build ESG report |
| **Notifications** | `GET /notifications` · `GET /notifications/unread-count` · `PATCH /notifications/{id}/read` | Bell |
| **Calculator** | `POST /calculator/calculate` · `GET /calculator/history/{corp}` | Footprint |
| **Certificates** | `GET /certificates` · `GET /certificates/{id}/image` · `GET /certificates/verify/{id}` | Certificates |

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
| `DATABASE_URL` | `sqlite:///carbon_vault.db` or the Render Postgres URL | Where data is stored |
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxxxxx` | Test Key ID from Razorpay |
| `RAZORPAY_KEY_SECRET` | *(secret)* | Must belong to the **same** key pair as the ID |
| `RAZORPAY_WEBHOOK_SECRET` | *(secret)* | Set in Razorpay → Webhooks |
| `CORS_ORIGINS` | `http://localhost:5173,https://final-carbon-vault.vercel.app` | Which websites may call the API |

### Frontend (Vercel → Settings → Environment Variables)
| Name | Example | Meaning |
|------|---------|---------|
| `VITE_API_BASE_URL` | `https://your-api.onrender.com` | Backend address, **no trailing slash** |

> 🔒 Never put real keys in GitHub. Use **Test Mode** keys for demos.

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
**Is the satellite data live?** The vegetation and temperature figures are proxies and estimates produced by the platform's engine, and the reports label them that way.

---

## 19. 🔐 Security

- Secrets live in **environment variables**, never in the code or Git.
- **CORS** restricts which websites can call the API.
- **Pydantic** validates every input; **SQLAlchemy** uses parameterised queries (protects against SQL injection).
- **Role-based access:** Admin, NGO, Corporate, Public, plus admin sub-roles (super admin, approver) enforced by the backend.
- **Payment webhook** is verified with an HMAC-SHA256 signature; repeated events do not double-credit.
- **Audit log** records important actions; **certificates** carry a SHA-256 fingerprint.
- Payments are handled by Razorpay, so card details never touch our servers.

---

## 20. ✅ Feature status

**Legend:** ✅ checked working on the live site · 🟡 built, still being verified · 🔧 problem found, being fixed

| Area | Feature | Status |
|------|---------|:-----:|
| Auth | Four-role login and role-based menus | ✅ |
| Projects | Registration form with map, polygon and evidence | 🟡 |
| Projects | Fraud detection, MRV score, fraud risk | ✅ |
| Projects | Admin approval and credit minting | ✅ |
| Projects | Five-stage lifecycle and history | 🟡 |
| Projects | Quarterly progress updates | 🟡 |
| Marketplace | Listings with live prices | ✅ |
| Marketplace | Search, filters, compare | 🟡 |
| Pricing | Pricing engine and price history | ✅ |
| Payments | Razorpay Test Mode checkout | ✅ |
| Payments | Full payment → wallet update, webhook | 🟡 |
| Wallet | Credits, value, transaction history | 🔧 |
| Certificates | Image/PDF and public verification | 🔧 |
| Reports | ESG report (portfolio and single project) | ✅ |
| Reports | Footprint calculator | 🟡 |
| Reports | Dashboard PDF export | 🟡 |
| Reputation | GRS score and leaderboard | ✅ |
| AI | Site suitability model | 🟡 |
| Platform | Notifications | 🔧 |
| Platform | Admin sub-roles, bulk CSV import | 🟡 |
| Public | Impact stats, climate insights, leaderboard | ✅ |
| Public | Audit trail | 🔧 |
| Maps | Plantation polygons with status colours | ✅ |

*Update this table as each item is confirmed on the live site.*

---

## 21. 🧭 Known limitations and roadmap

### Known limitations
- Free hosting sleeps when idle; first load can be slow.
- Razorpay is in **Test Mode**; going live needs a verified Razorpay business account.
- The site-suitability model is trained on a **small sample dataset**, so it is a screening aid, not a final judgement.
- Satellite figures are **proxies/estimates**, not a direct feed from a satellite provider.
- Email and SMS notifications are not included; messages appear in the app only.

### Roadmap
| Version | Plan |
|---------|------|
| v1.1 | Real satellite data integration, email notifications |
| v1.2 | Credit retirement records and downloadable audit packages |
| v1.3 | Blockchain-anchored certificates |
| v1.4 | Mobile app (React Native) |
| v1.5 | Multi-currency and global expansion |
| v2.0 | Secondary market where companies resell credits |

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
