# 🌱 CarbonVault — Carbon Credit Marketplace Platform

A comprehensive, full-stack *B2B*carbon credit marketplace** connecting NGOs, corporate buyers, and environmental projects in a **unified ecosystem**. Features blockchain-ready architecture, satellite-based verification (NDVI/LST), fraud detection, MRV-engine integration, and professional ESG reporting.

---

## 📋 Table of Contents

- [🎯 Project Overview](#-project-overview)
- [🏗️ Architecture](#-architecture)
- [⚙️ Tech Stack](#-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [📚 Features](#-features)
- [👥 User Roles & Dashboards](#-user-roles--dashboards)
- [🔌 API Documentation](#-api-documentation)
- [🗄️ Database Models](#-database-models)
- [🛠️ Configuration](#-configuration)
- [📦 Deployment](#-deployment)

---

## 🎯 Project Overview

**CarbonVault** is an enterprise-grade carbon credit marketplace that bridges the gap between:

| Role | Purpose |
|------|---------|
| 🌍 **NGOs** | Create & verify carbon credit projects (reforestation, renewable energy, etc.) |
| 🏢 **Corporate Buyers** | Purchase verified carbon credits for sustainability commitments |
| 👨‍⚖️ **Admins** | Oversee projects, verify submissions, manage disputes |
| 👥 **Public** | View projects, explore impact, learn about carbon credits |

**Core Value Proposition:**
✅ **Transparent** — Satellite-verified projects using NDVI & LST analysis  
✅ **Trustworthy** — Fraud detection system with multi-layer verification  
✅ **Scalable** — Blockchain-ready credit minting & transfer  
✅ **Professional** — GRS scoring, MRV engine, TCFD/GRI/ISSB compliance  
✅ **Frictionless** — Razorpay integration for instant payments  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │   Admin      │     NGO      │  Corporate   │   Public   │ │
│  │  Dashboard   │  Dashboard   │  Dashboard   │   Pages    │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    API Gateway (Vite Proxy)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Backend (FastAPI + SQLAlchemy)                │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │  Projects    │  Marketplace │   Credits    │  Payments  │ │
│  │  Router      │   Router     │   Router     │  Router    │ │
│  ├──────────────┼──────────────┼──────────────┼────────────┤ │
│  │  Fraud       │     GRS      │    Site      │    ESG     │ │
│  │ Detection    │   Scoring    │ Suitability  │  Reports   │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Data Layer (SQLite / PostgreSQL)                │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │   Projects   │     NGO      │  Corporate   │ Wallets    │ │
│  │       │      │   Request    │   Request    │            │ │
│  │  Transactions                                            │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Tech Stack

### 🎨 Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18.2** | UI component library |
| **Vite 5.2** | Lightning-fast build tool |
| **Recharts 2.12** | Data visualization (charts, graphs) |
| **React Leaflet 4.2** | Interactive map rendering |
| **Leaflet 1.9** | Geospatial mapping |
| **Lucide React 0.383** | Icon library (18k+ icons) |

### 🔧 Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI 0.100** | Modern async Python web framework |
| **Uvicorn 0.23** | ASGI server |
| **SQLAlchemy 2.0** | ORM for database abstraction |
| **Pydantic 2.0** | Data validation & serialization |
| **Scikit-learn 1.3** | ML for site suitability scoring |
| **Pandas / Numpy** | Data processing & analysis |

### 🗄️ Database & Geospatial
| Technology | Purpose |
|-----------|---------|
| **SQLite** | Development database |
| **PostgreSQL + PostGIS** | Production geospatial database |
| **Shapely 2.0** | Geometric operations |
| **PyProj 3.6** | Coordinate system transformations |
| **GeoAlchemy2** | Spatial database support |

### 💳 Payments & Security
| Tool | Purpose |
|------|---------|
| **Razorpay 1.4** | Payment gateway (INR support) |
| **python-dotenv** | Environment variable management |

### 🔍 Detection & Analysis
| Module | Purpose |
|--------|---------|
| **ImageHash 4.3** | Image duplicate detection |
| **PIL (Pillow 10)** | Image processing |
| **ExifRead 3.0** | Extract metadata from images |

---

## 📁 Project Structure

```
AI-carbon-vault/
│
├── 📄 README.md                          ← You are here
├── 📄 requirements.txt                   ← Python dependencies
├── 📂 Backend/                           ← FastAPI application
│   ├── 📄 main.py                        ← Entry point, route registration
│   ├── 📄 start.bat                      ← Windows dev startup script
│   │
│   ├── 📂 core/
│   │   ├── 📄 __init__.py
│   │   ├── 📄 config.py                  ← Global configuration
│   │   └── 📄 spacetimedb_bridge.py      ← SpaceTime DB integration
│   │
│   ├── 📂 credit_calculation/            ← Credit minting & accounting
│   │   ├── 📄 __init__.py
│   │   ├── 📄 main_backup_cred.py        ← Backup logic
│   │   │
│   │   └── 📂 credits_module/
│   │       ├── 📄 __init__.py
│   │       ├── 📄 api.py                 ← Credit API endpoints
│   │       ├── 📄 calculator.py          ← Credit calculation engine
│   │       ├── 📄 db_models.py           ← SQLAlchemy models
│   │       ├── 📄 db.py                  ← Database session setup
│   │       ├── 📄 funding_engine.py      ← Funding flow logic
│   │       ├── 📄 geo_utils.py           ← Geographic utilities
│   │       ├── 📄 live_engine.py         ← Real-time credit pricing
│   │       ├── 📄 models.py              ← Pydantic request/response models
│   │       ├── 📄 shadow_engine.py       ← Shadow credit tracking
│   │       └── 📄 schemas.sql            ← SQL schema definitions
│   │
│   ├── 📂 fraud_detection_new/           ← Multi-layer fraud detection
│   │   ├── 📄 __init__.py
│   │   ├── 📄 Readme.md                  ← Fraud module docs
│   │   ├── 📄 requirements.txt
│   │   │
│   │   └── 📂 app/
│   │       ├── 📄 __init__.py
│   │       ├── 📄 config.py              ← Fraud detection config
│   │       ├── 📄 main.py                ← Entry point (if standalone)
│   │       │
│   │       ├── 📂 api/
│   │       │   ├── 📄 __init__.py
│   │       │   └── 📄 fraud_routes.py    ← Fraud check endpoints
│   │       │
│   │       ├── 📂 core/
│   │       │   ├── 📄 __init__.py
│   │       │   ├── 📄 security.py        ← Security utilities
│   │       │   └── 📄 settings.py        ← Core settings
│   │       │
│   │       ├── 📂 db/
│   │       │   ├── 📄 __init__.py
│   │       │   ├── 📄 database.py        ← DB connection
│   │       │   ├── 📄 models.py          ← DB models
│   │       │   └── 📄 spatial_queries.py ← PostGIS queries
│   │       │
│   │       ├── 📂 schemas/
│   │       │   ├── 📄 __init__.py
│   │       │   ├── 📄 fraud_schema.py    ← Request schemas
│   │       │   └── 📄 init.py
│   │       │
│   │       ├── 📂 services/
│   │       │   ├── 📄 __init__.py
│   │       │   ├── 📄 fraud_service.py   ← Main fraud logic
│   │       │   ├── 📄 ecological_validator.py    ← Ecological checks
│   │       │   ├── 📄 geo_validator.py   ← Location validation
│   │       │   ├── 📄 Media_Validator.py ← Image validation
│   │       │   └── 📄 NDVI_Validator.py  ← Satellite data validation
│   │       │
│   │       └── 📂 utils/
│   │           ├── 📄 __init__.py
│   │           ├── 📄 exif_utils.py      ← EXIF extraction
│   │           └── 📄 image_hash.py      ← Image fingerprinting
│   │
│   ├── 📂 routers/                       ← API route handlers
│   │   ├── 📄 __init__.py
│   │   ├── 📄 grs_router.py              ← GRS scoring routes
│   │   ├── 📄 marketplace_router.py      ← Buy/sell requests
│   │   ├── 📄 payment_router.py          ← Razorpay integration
│   │   ├── 📄 project_servicerouter.py   ← Project CRUD & management
│   │   │
│   │   └── 📂 site_suitability/
│   │       ├── 📄 __init__.py
│   │       ├── 📄 requirements.txt       ← ML dependencies
│   │       ├── 📄 site_suitability_router.py    ← ML prediction routes
│   │       ├── 📄 train_model.py         ← Model training script
│   │       │
│   │       ├── 📂 app/
│   │       │   ├── 📄 __init__.py
│   │       │   ├── 📄 data_fetcher.py    ← Fetch environmental data
│   │       │   ├── 📄 data_loader.py     ← Data preprocessing
│   │       │   ├── 📄 main_back.py       ← Backup entry point
│   │       │   ├── 📄 ml_model.py        ← ML model definition
│   │       │   └── 📄 scoring.py         ← Suitability scoring
│   │       │
│   │       ├── 📂 data/
│   │       │   └── 📄 blue_carbon_sample.csv    ← Training dataset
│   │       │
│   │       └── 📂 model/                 ← Trained ML models
│   │
│   └── 📂 uploads/                       ← Project evidence storage
│
└── 📂 Frontend/                          ← React Vite application
    ├── 📄 index.html                     ← HTML entry point
    ├── 📄 package.json                   ← Node dependencies
    ├── 📄 package-lock.json
    ├── 📄 README.md                      ← Frontend docs
    ├── 📄 TODO.md                        ← Upcoming features
    ├── 📄 vite.config.js                 ← Vite configuration
    │
    └── 📂 src/
        ├── 📄 main.jsx                   ← React entry point
        ├── 📄 App.jsx                    ← Root component
        ├── 📄 AppContext.jsx             ← Global context/state
        │
        ├── 📂 components/
        │   ├── 📄 ErrorBoundary.jsx      ← Error handling wrapper
        │   ├── 📄 GoogleMap.jsx          ← Map component
        │   ├── 📄 Layout.jsx             ← Sidebar & navigation
        │   ├── 📄 SettingsProfile.jsx    ← User profile settings
        │   ├── 📄 UI.jsx                 ← Reusable UI components
        │   │                               (Cards, Buttons, Badges, etc.)
        │   │
        │   ├── 📂 admin/
        │   │   ├── 📄 AdminApprovals.jsx ← Project approval management
        │   │   ├── 📄 AdminDashboard.jsx ← Admin overview dashboard
        │   │   ├── 📄 AdminPricingAnalytics.jsx  ← Pricing controls
        │   │   └── 📄 AdminUsers.jsx     ← User management
        │   │
        │   ├── 📂 corporate/
        │   │   └── 📄 CorporatePages.jsx ← Corporate dashboard screens:
        │   │       ├── CorporateDashboard (portfolio overview)
        │   │       ├── CorporateMarketplace (browse projects)
        │   │       ├── CorporateWallet (credit balance)
        │   │       └── CorporateESG (ESG report generator) ✨ NEW
        │   │
        │   ├── 📂 ngo/
        │   │   ├── 📄 NGOMRVPlots.jsx    ← MRV monitoring plots
        │   │   └── 📄 NGOPages.jsx       ← NGO dashboard screens:
        │   │       ├── NGODashboard (analytics)
        │   │       ├── NGOProjectForm (create projects)
        │   │       └── NGOMarketplace (buy requests)
        │   │
        │   ├── 📂 public/
        │   │   └── 📄 PublicPages.jsx    ← Public-facing screens:
        │   │       ├── PublicHome (landing)
        │   │       ├── PublicProjects (project gallery)
        │   │       └── PublicLeaderboard (top performers)
        │   │
        │   └── 📂 map/
        │       ├── 📄 geojsonLeaflet.js  ← GeoJSON map rendering
        │       └── 📄 PlantationMap.jsx  ← Interactive plantation map
        │
        ├── 📂 pages/
        │   └── 📄 LoginPage.jsx          ← Authentication page
        │
        ├── 📂 services/
        │   └── 📄 api.js                 ← API client service layer
        │       • fetchAllProjects()
        │       • fetchMapProjects()
        │       • createProject()
        │       • calculateGRS()
        │       • generateESGReport() ✨ NEW
        │       • fetchMarketplaceListings()
        │       • buyCredits()
        │       • And 20+ more endpoints
        │
        ├── 📂 data/
        │   └── 📄 mockData.js            ← Client-side mock data
        │       • mockProjects (8 sample projects)
        │       • mockUsers (8 demo accounts)
        │       • mockTransactions
        │       • mockMarketplace
        │       • mockESGReport ✨ NEW
        │       • mockCreditsOverTime
        │       • mockGRSData
        │       • And more...
        │
        └── 📂 utils/
            └── 📄 wktToLeaflet.js        ← WKT polygon converter
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.9+** (Backend)
- **Node.js 16+** (Frontend)
- **npm or yarn** (Package manager)
- **Git** (Version control)

### Installation

#### 1️⃣ **Backend Setup**

```bash
# Navigate to backend
cd Backend

# Create virtual environment
python -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt

# Create .env file
echo "DATABASE_URL=sqlite:///carbon_vault.db" > .env
echo "RAZORPAY_KEY_ID=your_key_here" >> .env
echo "RAZORPAY_KEY_SECRET=your_secret_here" >> .env

# Run migrations
python -c "from credit_calculation.credits_module.db_models import Base; Base.metadata.create_all()"

# Start server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### 2️⃣ **Frontend Setup**

```bash
# Navigate to frontend
cd Frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Open in browser
# → http://localhost:5173
```

#### 3️⃣ **Access Application**

| Role | Email | Password |
|------|-------|----------|
| 👨‍⚖️ Admin | `admin@carbonvault.com` | demo@123 |
| 🌍 NGO | `ngo@carbonvault.com` | demo@123 |
| 🏢 Corporate | `corp@carbonvault.com` | demo@123 |

---

## 📚 Features

### 🌍 **Project Management** (`routers/project_servicerouter.py`)
```
✅ Create new projects (NGO)
✅ Upload evidence images with EXIF metadata
✅ Automatic location verification via GeoJSON polygons
✅ Admin approval workflow (Pending → Approved/Rejected)
✅ Real-time project updates
✅ Portfolio analytics & tracking
```

### 🏷️ **Carbon Credit System** (`credit_calculation/credits_module/`)
```
✅ Automatic credit minting based on carbon offsets
✅ Credit pricing with dynamic multipliers (demand, supply, living credit)
✅ Wallet management for corporates & NGOs
✅ Credit transfer & tracking
✅ Transaction history & receipts
```

### 🛡️ **Fraud Detection** (`fraud_detection_new/app/services/`)
| Detector | Method |
|----------|--------|
| 🖼️ **Image Validator** | Duplicate detection, EXIF verification |
| 🌳 **Ecological Validator** | NDVI/LST satellite checks, biodiversity scoring |
| 📍 **Geo Validator** | GPS coordinates validation, boundary checks |
| 🏞️ **NDVI Validator** | Land vegetation index analysis |
| 📸 **Media Validator** | Image integrity & authenticity checks |

**Result:** Multi-layer fraud risk scoring (0-100%)

### 🎟️ **GRS (Green Reputation Score)** (`routers/grs_router.py`)
```
Components:
├─ Transparency Score (0-100)
├─ Quality Score (0-100)
├─ Commitment Score (0-100)
├─ Verification Score (0-100)
└─ → Combined GRS (0-1000) → Badge Level: Bronze/Silver/Gold/Platinum
```

### 🛒 **Marketplace** (`routers/marketplace_router.py`)
```
Corporate Buyers:
├─ Browse all approved projects
├─ Check credibility (MRV score, fraud risk)
├─ Make buy requests at specified price
├─ Track pending offers

NGOs:
├─ Receive buy requests
├─ Accept/reject offers
├─ Manage credit inventory
└─ Track money received
```

### 💳 **Payment Integration** (`routers/payment_router.py`)
```
Gateway: Razorpay (INR support)

Flow:
1. Corporate selects credits to buy
2. System creates Razorpay order
3. Corporate completes payment
4. Credits transferred to wallet
5. Transaction recorded & receipt generated
```

### 🤖 **Site Suitability** (`routers/site_suitability/`)
```
ML Model predicts plantation success:
├─ Input: Latitude, Longitude, Area (hectares)
├─ Features: Rainfall, temperature, soil quality, proximity
├─ Output: Suitability score (0.0-1.0)
└─ Use: Pre-screen project proposals
```

### 📊 **ESG Report Generator** (`CorporatePages.jsx` - CorporateESG component) ✨ **NEW**
```
Generate professional ESG reports:
├─ Scope: Full Portfolio OR Single Project
├─ Metrics:
│  ├─ Environmental: Carbon offsets, NDVI, LST, biodiversity
│  ├─ Social: Communities, jobs, training, CSR
│  └─ Governance: Compliance, audit, risk, certifications
├─ Visualizations:
│  ├─ LineChart (NDVI trend)
│  ├─ LineChart (Temperature trend)
│  ├─ BarChart (Carbon by project)
│  └─ PieChart (ESG scores)
├─ Export: PDF (via window.print())
└─ Standards: Verified TCFD, GRI 305, ISSB IFRS S2
```

### 🗺️ **Interactive Maps**
```
Components:
├─ Leaflet.js for mapping
├─ GeoJSON polygon rendering
├─ WKT coordinate conversion
├─ Plantation footprint visualization
└─ Project location discovery
```

### 📱 **Responsive UI**
```
Design System:
├─ Glass morphism cards (backdrop blur)
├─ Dark theme (bg0: #040508)
├─ Teal accent color (#2dd4bf)
├─ Lucide icons (18k+)
├─ Mobile-first responsive layout
└─ Accessibility WCAG 2.1 AA
```

---

## 👥 User Roles & Dashboards

### 👨‍⚖️ **Admin Dashboard** (`admin/AdminDashboard.jsx`)
```
Overview:
├─ Platform statistics
├─ Pending projects queue
├─ Fraud risk alerts
├─ User management

Modules:
├─ AdminApprovals.jsx  → Project review & approval
├─ AdminPricingAnalytics.jsx → Dynamic pricing control
├─ AdminUsers.jsx → User role management
└─ AdminDashboard.jsx → KPI overview
```

### 🌍 **NGO Dashboard** (`ngo/NGOPages.jsx`)
```
Features:
├─ Create new projects
├─ Upload location & evidence
├─ Track verification status
├─ View buy requests
├─ Manage marketplace offers
├─ Monitor credit balance
├─ Download receipts

Components:
├─ NGODashboard → Analytics view
├─ NGOProjectForm → Create project
└─ NGOMarketplace → Buyer offers
```

### 🏢 **Corporate Dashboard** (`corporate/CorporatePages.jsx`)
```
Features:
├─ Browse marketplace projects
├─ Check project credibility & scores
├─ Make buy requests
├─ Track wallet & credits
├─ View transaction history
├─ Generate ESG reports ✨ NEW

Components:
├─ CorporateDashboard → Portfolio overview
├─ CorporateMarketplace → Project browser
├─ CorporateWallet → Credit balance
└─ CorporateESG → ESG report generator ✨ NEW
```

### 👥 **Public Pages** (`public/PublicPages.jsx`)
```
Pages:
├─ Landing page
├─ Project gallery
├─ Leaderboard (top performers)
├─ Project details
└─ Impact statistics
```

---

## 🔌 API Documentation

### Base URL
```
Development: http://127.0.0.1:8000
Production: https://api.carbonvault.com
```

### Core Endpoints

#### **Projects** (`/projects/`)
```
GET    /projects/all-projects         → Fetch all projects (admin)
GET    /projects/projects?ngo_id=...  → Fetch NGO projects
GET    /projects/map                  → GeoJSON for map
GET    /projects/map?ngo_id=...       → Map projects by NGO
GET    /projects/pending              → Pending projects (admin)
POST   /projects/create-project       → Create new project
PATCH  /projects/projects/{id}/status → Update project status
```

#### **Marketplace** (`/marketplace/`)
```
GET    /marketplace/listings          → Browse projects
GET    /marketplace/requests/{ngo_id} → NGO's buy requests
POST   /marketplace/request           → Create buy request
POST   /marketplace/accept/{req_id}   → Accept offer
```

#### **Credits** (`/credits/`)
```
GET    /credits/balance/{corporate}   → Wallet balance
POST   /credits/mint                  → Mint new credits
POST   /credits/transfer              → Transfer credits
```

#### **Payments** (`/payment/`)
```
POST   /payment/create-order          → Razorpay order creation
POST   /payment/buy-credits           → Record purchase
GET    /payment/transactions/{corp}   → Transaction history
GET    /payment/wallet/{corp}         → Wallet summary
```

#### **GRS** (`/grs/`)
```
POST   /grs/calculate-grs             → Calculate reputation score
GET    /grs/leaderboard               → Top performers
```

#### **Fraud** (`/fraud/`)
```
POST   /fraud/check-project           → Multi-layer fraud check
```

#### **Site Suitability** (`/suitability/`)
```
POST   /suitability/predict           → ML suitability score
```

#### **ESG** (`/esg/`) ✨ **NEW**
```
POST   /esg/generate-report           → Generate ESG report
```

---

## 🗄️ Database Models

### **Core Tables** (`credit_calculation/credits_module/db_models.py`)

```sql
-- Projects
Projects (
  id: String (PK)
  name: String
  ngo_id: String (FK → NGO)
  location: String
  area_hectares: Float
  credits_generated: Integer
  status: Enum (pending, approved, rejected)
  mrvScore: Float (0-100)
  fraud_risk: Float (0-100)
  created_at: DateTime
)

-- NGOs
NGO (
  id: String (PK)
  name: String
  email: String
  verified: Boolean
  total_credits: Integer
  created_at: DateTime
)

-- Corporate Requests
CorporateRequest (
  id: String (PK)
  corporate_name: String
  project_id: String (FK → Project)
  requested_tons: Integer
  requested_price: Float
  status: Enum (pending, accepted, rejected)
  created_at: DateTime
)

-- Transactions
Transaction (
  id: String (PK)
  credits: Integer
  amount_inr: Float
  corporate_name: String
  project_id: String
  status: Enum (pending, success, failed)
)

-- Wallets
Wallet (
  corporate_name: String (PK)
  total_credits: Integer
  total_spent_inr: Float
  last_updated: DateTime
)
```

---

## 🛠️ Configuration

### Environment Variables (`.env`)
```bash
# Database
DATABASE_URL=postgresql://user:pwd@localhost/carbonvault
SQLITE_URL=sqlite:///carbon_vault.db

# Payment Gateway
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxx

# Geospatial
POSTGIS_HOST=localhost
POSTGIS_PORT=5432

# API
API_HOST=127.0.0.1
API_PORT=8000
DEBUG=True

# CORS
CORS_ORIGINS=http://localhost:5173,https://carbonvault.com
```

### Vite Configuration (`Frontend/vite.config.js`)
```javascript
// Proxy API calls to backend
proxy: {
  '/api': 'http://127.0.0.1:8000'
}
```

---

## 📦 Deployment

### Backend Deployment (AWS/DigitalOcean)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Setup PostgreSQL with PostGIS
sudo apt-get install postgresql postgresql-contrib postgis

# 3. Configure environment
export DATABASE_URL=postgresql://user:pwd@host/db
export RAZORPAY_KEY_ID=...
export RAZORPAY_KEY_SECRET=...

# 4. Run migrations
alembic upgrade head

# 5. Start production server
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

# 6. Or with systemd (recommended)
sudo systemctl start carbonvault-api
sudo systemctl enable carbonvault-api
```

### Frontend Deployment (Vercel/Netlify)

```bash
# 1. Build static files
npm run build

# 2. Output directory: dist/

# 3. Deploy to Vercel
npm install -g vercel
vercel

# Or Netlify
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY Backend/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]

# Frontend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY Frontend/ .
RUN npm install && npm run build
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
```

---

## 🔐 Security Considerations

```
✅ Environment variables for secrets
✅ CORS middleware for cross-origin requests
✅ EXIF data validation for geo-spoofing prevention
✅ Image hash comparison for duplicate detection
✅ PostgreSQL parameterized queries (SQLAlchemy)
✅ Fraud detection multi-layer validation
✅ Transaction logging & audit trail
✅ Razorpay PCI-DSS compliant payments
```

---

## 📈 Performance Optimizations

```
Frontend:
├─ Lazy loading of heavy components
├─ Chart rendering with recharts (optimized)
├─ Mock data fallback (no blank screens)
└─ Responsive images & icons

Backend:
├─ Async/await with FastAPI
├─ Database query optimization
├─ ML model caching (site suitability)
└─ Efficient GeoJSON processing
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open pull request

---

## 📜 License

This project is licensed under the **MIT License** — see LICENSE file for details.

---

## 🆘 Support & Contact

- 📧 **Email:** support@carbonvault.com
- 🐛 **Issues:** [GitHub Issues](#)
- 💬 **Discussions:** [GitHub Discussions](#)

---

## 🙏 Acknowledgments

- 🌍 **UNFCCC** for carbon credit framework
- 🛰️ **NDVI/LST** satellite data providers
- 💳 **Razorpay** for payment infrastructure
- 🎨 **Lucide Icons** for beautiful iconography
- 📊 **Recharts** for visualization library

---

## 🚀 Roadmap

```
✅ v1.0  — MVP with core features
⏳ v1.1  — Blockchain integration (credits as NFTs)
⏳ v1.2  — Mobile app (React Native)
⏳ v1.3  — AI-powered project recommendations
⏳ v1.4  — Global expansion (multi-currency)
⏳ v2.0  — Carbon credit secondary market
```

---

**Last Updated:** April 5, 2026  
**Version:** 1.0.0  
**Status:** 🟢 Production Ready

Made with 🌱 for a sustainable future.
