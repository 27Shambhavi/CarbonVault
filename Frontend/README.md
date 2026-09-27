# CarbonVault — Full Platform Prototype

A complete React prototype with **Admin**, **NGO**, **Buyer**, and **Public** dashboards.  
All mock data, no backend required. Runs in ~30 seconds.

---

## Quick Start

```bash
# 1. Install dependencies (only first time)
npm install

# 2. Run dev server
npm run dev

# 3. Open in browser
# → http://localhost:5173
```

---

## Demo Accounts

Click any role card on the login page, then click **"Access Dashboard →"**

| Role    | Email                     | What you can see                                      |
|---------|---------------------------|-------------------------------------------------------|
| Admin   | admin@carbonvault.com     | KPI cards, user management, project approvals, pricing engine, analytics |
| NGO     | ngo@carbonvault.com       | Projects, plots/maps, field evidence, MRV results, shadow credits, marketplace listings |
| Buyer   | buyer@carbonvault.com     | Marketplace, wallet, ESG reports, Green Reputation Score |
| Public  | guest@carbonvault.com     | Leaderboard, audit trail, certificates, climate analytics |

---

## Tech Stack

| Tool          | Purpose                         |
|---------------|---------------------------------|
| React 18      | UI framework                    |
| Vite          | Dev server & bundler            |
| Recharts      | All charts (line, bar, pie, radar) |
| Lucide React  | Icon set                        |
| Google Fonts  | DM Sans + Syne typefaces        |

No Tailwind, no backend, no environment variables needed.

---

## Project Structure

```
src/
├── App.jsx                    # Root router — wires all pages
├── AppContext.jsx             # Global state (user, page, sidebar)
├── main.jsx                   # React entry point
│
├── data/
│   └── mockData.js            # All mock data (projects, users, transactions…)
│
├── pages/
│   └── LoginPage.jsx          # Login + demo account selector
│
└── components/
    ├── UI.jsx                  # Shared components (KPICard, Table, Badge, Modal…)
    ├── Layout.jsx              # Sidebar + Navbar + NotificationCenter
    ├── SettingsProfile.jsx     # Settings page + Profile page
    │
    ├── admin/
    │   ├── AdminDashboard.jsx
    │   ├── AdminUsers.jsx
    │   ├── AdminApprovals.jsx
    │   └── AdminPricingAnalytics.jsx
    │
    ├── ngo/
    │   ├── NGOPages.jsx        # Dashboard, Projects, Shadow Credits, Evidence, Listings, Analytics
    │   └── NGOMRVPlots.jsx     # MRV Results + Plots & Maps
    │
    ├── buyer/
    │   └── BuyerPages.jsx      # Dashboard, Marketplace, Wallet, ESG, GRS
    │
    └── public/
        └── PublicPages.jsx     # Overview, Leaderboard, Audit, Certificates, Climate
```

---

## Pages Included

### Admin (5 pages)
- **Dashboard** — KPI cards, credits chart, project approvals table, fraud stats
- **User Management** — Searchable/filterable user table, invite modal, suspend/activate
- **Project Approvals** — 3-panel review: project list, details with field images, AI scores, approve/reject/mint
- **Pricing Engine** — Live multiplier sliders, real-time price calculator, price history chart
- **Analytics** — Credits by type, resilience radar chart, generation trend bar chart

### NGO (8 pages)
- **Dashboard** — KPI cards, project cards, recent activity feed
- **My Projects** — Project grid with detail modals
- **Plots & Maps** — SVG map with plot markers + plots sidebar
- **Field Evidence** — Upload form with drag-drop area + evidence history
- **MRV Results** — AI verification scores, image analysis breakdown
- **Shadow Credits** — Year 0–5 projection chart + tradable status table
- **Marketplace Listings** — Listing management cards
- **Analytics** — Survival rate trend + impact metrics

### Buyer (5 pages)
- **Dashboard** — Portfolio chart, GRS score gauge, recent purchases table
- **Marketplace** — Flip-style cards with purchase modal + quantity calculator
- **Wallet** — Credits overview + full transaction history + certificate links
- **ESG Reports** — Report builder + previous reports list with download
- **Green Reputation Score** — Score gauge, breakdown bars, achievement badges

### Public (5 pages)
- **Overview** — Platform-wide transparency stats + top organizations
- **Leaderboard** — Podium visualization + sortable rankings table
- **Audit Trail** — Timeline log of all platform actions
- **Certificates** — Certificate registry with download links
- **Climate Analytics** — CO₂ metrics + horizontal impact chart

### Shared (2 pages)
- **Settings** — Account, Notifications, Security, Preferences tabs
- **Profile** — User info + logout

---

## Customization

All mock data lives in `src/data/mockData.js`. Edit arrays there to change:
- Projects (name, status, MRV scores, fraud risk, credits)
- Users (organizations, roles, join dates)
- Transactions (buyer, project, price, certificates)
- Marketplace listings
- Notifications
- Audit logs

---

## Production Build

```bash
npm run build
# Output → dist/ folder, ready to deploy on Netlify / Vercel / S3
```
