# CarbonVault — Comprehensive Interactive Button & Control Map

This document catalogs every interactive button, link, and control across the CarbonVault frontend application, specifying its screen, authorized role, action performed, network trigger, UI feedback, and automated test selector.

---

## 1. Authentication & Onboarding (`LoginPage.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| `/` (Login) | Demo | `Admin (Alex Mercer)` | Quick-fills Admin demo credentials | None (Local State) | Inputs populated with `admin@carbonvault.com` | `[data-testid="demo-tile-admin"]` |
| `/` (Login) | Demo | `Approver (Dr. Sarah Jenkins)` | Quick-fills Approver demo credentials | None (Local State) | Inputs populated with `approver@carbonvault.com` | `[data-testid="demo-tile-approver"]` |
| `/` (Login) | Demo | `Verifier (Marcus Vance)` | Quick-fills Verifier demo credentials | None (Local State) | Inputs populated with `verifier@carbonvault.com` | `[data-testid="demo-tile-verifier"]` |
| `/` (Login) | Demo | `NGO (EcoGuard Brazil)` | Quick-fills NGO demo credentials | None (Local State) | Inputs populated with `contact@ecoguard.org` | `[data-testid="demo-tile-ngo"]` |
| `/` (Login) | Demo | `Corporate (Microsoft)` | Quick-fills Corporate demo credentials | None (Local State) | Inputs populated with `carbon@microsoft.com` | `[data-testid="demo-tile-corporate"]` |
| `/` (Login) | Public | `Explore the public registry (no login)` | Enters public transparency view directly | None (Context) | Transitions immediately to Public Impact Dashboard without authentication | `[data-testid="explore-public-registry"]` |
| `/` (Login) | All | `Sign In` / Submit | Authenticates with credentials | `POST /auth/login` | Validates JWT claims, displays server role, transitions to role dashboard | `button[type="submit"]:has-text("Access Dashboard")` |
| `/` (Login) | All | `Create Account` tab | Toggles to Registration form | None (Local State) | Renders multi-field organization registration form for NGO or Corporate | `button:has-text("Create Account")` |
| `/` (Register) | NGO / Corp | `Create Verified Account` | Submits new developer/buyer organization | `POST /auth/register` | Displays success toast, switches back to sign-in tab with pre-filled email | `button:has-text("Create Verified Account")` |

---

## 2. Global Shell & Navigation (`Layout.jsx`, `Navbar.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| Sidebar | Admin | `Home` | Operations Console | `GET /stats/platform`, `GET /ready` | Navigates to `/` (Operations Console) | `nav button:has-text("Home")` |
| Sidebar | Admin | `Review Queue (oversight)` | Platform review queue oversight | `GET /projects/all-projects` | Navigates to project oversight table | `nav button:has-text("Review Queue (oversight)")` |
| Sidebar | Admin | `Organisations` | KYC entity management | `GET /users/` | Opens KYC queue and developer list | `nav button:has-text("Organisations")` |
| Sidebar | Admin | `Users` | User roles & invitations | `GET /users/` | Opens user administration and role invite modal | `nav button:has-text("Users")` |
| Sidebar | Admin | `Pricing` | Algorithmic pricing engine | `GET /pricing/config` | Opens pricing floor and buffer configuration | `nav button:has-text("Pricing")` |
| Sidebar | Admin | `Payments and Payouts` | Financial settlements & reconciliation | `GET /transactions` | Opens treasury, payments today, refunds and payouts | `nav button:has-text("Payments and Payouts")` |
| Sidebar | Admin | `ML Models` | ML models retraining & telemetry | `GET /ml-models/` | Opens ML inference telemetry and retraining dashboard | `nav button:has-text("ML Models")` |
| Sidebar | Admin / Public | `Audit` | Immutable cryptographic audit log | `GET /audit/` | Displays tamper-evident platform event trail | `nav button:has-text("Audit")` |
| Sidebar | Approver | `Home` / `Decision Queue` | Project Decision Desk | `GET /projects/all-projects` | Displays risk-sorted queue with 72h SLA timers | `nav button:has-text("Home"), nav button:has-text("Decision Queue")` |
| Sidebar | Approver | `Decided` | Decided projects archive | `GET /projects/all-projects` | Displays projects decided by reviewer with outcomes | `nav button:has-text("Decided")` |
| Sidebar | Approver / Verifier | `My Audit` | Approver's audit trail | `GET /projects/all-projects` | Shows personal decisions and justifications | `nav button:has-text("My Audit")` |
| Sidebar | Verifier | `Field Queue` | Field verification queue | `GET /projects/all-projects` | Inspects field evidence and signs off | `nav button:has-text("Field Queue")` |
| Sidebar | NGO | `My Projects` | Developer portfolio | `GET /projects/projects` | Shows NGO registered forestry projects | `nav button:has-text("My Projects")` |
| Sidebar | NGO | `New Project` | Project wizard | None | Transitions to `/projects/new` | `nav button:has-text("New Project")` |
| Sidebar | Corporate | `Marketplace` | Carbon credit catalog | `GET /marketplace/` | Displays inventory with Razorpay checkout | `nav button:has-text("Marketplace")` |
| Navbar | All | Role Badge | Read-only authenticated role display | None | Matches tile color (Gold, Sky, Teal, Emerald, Violet) | `[data-testid="role-badge"]` |
| Navbar | All | Theme Switcher | Toggles Light / Dark mode | None | Updates `data-theme` attribute and local storage | `button:has(svg.lucide-sun), button:has(svg.lucide-moon)` |
| Navbar | All | Notification Bell | Toggles live notification drawer | `GET /notifications` | Displays real platform notifications and unread badge | `button:has(svg.lucide-bell)` |
| Navbar | All | `Sign Out` | Terminates active session | None (Local State) | Clears JWT token, redirects to login | `button:has-text("Logout")` |

---

## 3. Project Detail Screen (`/projects/:id`, `ProjectDetail.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| Project Detail | Approver | `Request data` | Requests clarification from NGO | `PATCH /projects/:id/status` | Prompts for specific clarification points | `button:has-text("Request data")` |
| Project Detail | Approver | `Approve` | Primary admission to registry | `PATCH /projects/:id/status` | Disabled if verifier signoff missing; admits project | `button:has-text("Approve")` |
| Project Detail | Approver | `Reject` | Denies project admission | `PATCH /projects/:id/status` | Prompts for mandatory rejection justification (>=5 chars) | `button:has-text("Reject")` |
| Project Detail | Approver / Admin | `Add comment` | Records audited remark | `PATCH /projects/:id/status` | Appends comment to immutable timeline | `button:has-text("Add comment")` |
| Project Detail | Admin | `Reassign` | Reassigns reviewer or verifier | `POST /projects/:id/reassign` | Opens reassign modal with approver/verifier selects | `button:has-text("Reassign")` |
| Project Detail | Admin | `Suspend` | Immediate project take-down | `POST /projects/:id/suspend` | Delists project from public registry and trading | `button:has-text("Suspend")` |
| Project Detail | Admin | `Override decision (reason + confirm)` | Administrative flagged override | `PATCH /projects/:id/status` | Prompts for mandatory reason (>=10 chars) & confirmation | `button:has-text("Override decision")` |
| Project Detail | Admin | `Open organisation` | Navigates to developer entity | None (Context) | Transitions to Organisations screen | `button:has-text("Open organisation")` |
| Project Detail | Verifier | `Sign off` | Field verification sign-off | `PATCH /projects/:id/status` | Confirms field ground-truth & telemetry accuracy | `button:has-text("Sign off")` |
| Project Detail | Verifier | `Request re-upload` | Requests new field photos | `POST /projects/:id/evidence` | Flags photo quality or boundary mismatch | `button:has-text("Request re-upload")` |
| Project Detail | NGO | `Edit draft` | Edits draft project | None | Opens project wizard with draft data | `button:has-text("Edit draft")` |
| Project Detail | NGO | `Submit` | Submits draft for review | `PATCH /projects/:id/status` | Moves project status to pending review queue | `button:has-text("Submit")` |
| Project Detail | NGO | `Upload` | Uploads new field evidence | `POST /projects/:id/evidence` | Stages photo for ExG and Laplacian screening | `button:has-text("Upload")` |
| Project Detail | NGO | `Respond` | Responds to clarification | `POST /fraud/projects/:id/explanation` | Sends note and evidence to decision desk | `button:has-text("Respond")` |
| Project Detail | Corporate | `Buy` | Purchases verified credits | `POST /payments/create-order` | Opens Razorpay live checkout modal | `button:has-text("Buy")` |
| Project Detail | Corporate | `Compare` | Adds to portfolio comparison | None (Local State) | Adds project to floating comparison tray | `button:has-text("Compare")` |
| Project Detail | Corporate | `Fact-sheet PDF` | Downloads audit summary | `GET /analytics/export-pdf` | Downloads official PDF fact-sheet | `button:has-text("Fact-sheet PDF")` |
| Project Detail | Public | `Verify certificates` | Verifies issuance authenticity | `GET /certificates/:id` | Opens public CertificateModal with QR code | `button:has-text("Verify certificates")` |
| Project Detail | All | Tab: `1. Overview` to `8. Orders` | Switches dossier tabs | None / `GET /projects/:id/ndvi` | Displays 8-tab comprehensive audit dossier | `button:has-text("1. Overview")` |

---

## 4. Project Creation Wizard (`/projects/new`, `ProjectWizard.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| `/projects/new` | NGO | `Auto-Generate WKT from Center` | Calculates bounding box polygon | None (Math) | Auto-fills `polygon_wkt` with 5-point closed polygon | `button:has-text("Auto-Generate WKT")` |
| `/projects/new` | NGO | Photo File Dropzone | Selects evidence photo | None (File staging) | Stages image for ML analysis | `input[type="file"][accept*="image"]` |
| `/projects/new` | NGO | `Run Pre-Flight Screening Test` | Tests integrity before submit | `POST /fraud/precheck` | Shows precheck pass/flag badge | `button:has-text("Run Pre-Flight Screening")` |
| `/projects/new` | NGO | `Submit Project to Platform` | Submits project & photos | `POST /projects/create-project` | Emits notification, navigates to `/projects/:id` | `button:has-text("Submit Project to Platform")` |
| `/projects/new` | NGO | `Clear Draft` | Clears autosaved draft | None (Local Storage) | Resets form to clean defaults | `button:has-text("Clear Draft")` |
| `/projects/new` | NGO | `Next Step` / `Previous` | Advances or steps back | None | Updates active wizard step 1 through 6 | `button:has-text("Next Step")` |

---

## 5. Machine Learning Inspector (`/ml-models`, `AdminMLModels.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| `/ml-models` | Admin | `Refresh Telemetry` | Reloads models & inferences | `GET /ml-models/`, `GET /ml-models/inferences` | Refreshes 24h count and inference log table | `button:has-text("Refresh Telemetry")` |
| `/ml-models` | Admin | `Run on Sample` (M1 Isolation Forest) | Executes peer anomaly test | `POST /ml-models/run-sample` | Shows JSON explainability in <500ms; logs inference | `button:has-text("Run on Sample") >> nth=0` |
| `/ml-models` | Admin | `Run on Sample` (M2 Seasonal NDVI) | Executes harmonic fit test | `POST /ml-models/run-sample` | Shows sigma deviation & R2; logs inference | `button:has-text("Run on Sample") >> nth=1` |
| `/ml-models` | Admin | `Run on Sample` (M3 Photo Screener) | Executes ExG/sharpness test | `POST /ml-models/run-sample` | Shows ExG index & Laplacian variance; logs inference | `button:has-text("Run on Sample") >> nth=2` |
| `/ml-models` | Admin | `Run on Sample` (M4 Reviewer Model)| Runs decision classifier | `POST /ml-models/run-sample` | Shows predicted decision & confidence; logs inference | `button:has-text("Run on Sample") >> nth=3` |
| `/ml-models` | Admin | `Close` Output Inspector | Closes sample JSON drawer | None | Collapses sample output panel | `button:has-text("Close")` |

---

## 6. Public Transparency Portal (`PublicPages.jsx`)

| Screen / Page | Role | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|---|
| `/leaderboard` | Public | Filter Chips (`All`, `Buyers`, `NGOs`) | Filters public ranking | None (Local Filter) | Updates leaderboard rows | `button:has-text("All"), button:has-text("Buyers")` |
| `/certificates` | Public | `Verify Certificate` | Looks up certificate by ID | `GET /certificates/:id` | Displays certificate authenticity badge & details | `button:has-text("Verify Certificate")` |
| `/audit` | Public | Audit Search Input | Filters immutable audit log | None (Local Filter) | Filters audit records in real time | `input[placeholder*="Search audit"]` |
