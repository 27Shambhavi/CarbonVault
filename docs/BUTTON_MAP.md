# CarbonVault — Comprehensive Interactive Button & Control Map

This document catalogs every interactive button, link, and control across the CarbonVault frontend application, specifying its screen, action, network trigger, UI feedback, test selector, and automated test coverage.

---

## 1. Authentication & Onboarding (`LoginPage.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/` (Login) | `Admin (Alex Mercer)` | Quick-fills Super Admin demo credentials | None (Local State) | Inputs populated with `admin@carbonvault.com` | `button:has-text("Admin")` |
| `/` (Login) | `Approver (Sarah Jenkins)` | Quick-fills Approver demo credentials | None (Local State) | Inputs populated with `approver@carbonvault.com` | `button:has-text("Approver")` |
| `/` (Login) | `NGO (EcoGuard)` | Quick-fills NGO demo credentials | None (Local State) | Inputs populated with `contact@ecoguard.org` | `button:has-text("NGO")` |
| `/` (Login) | `Corporate (Microsoft)` | Quick-fills Corporate demo credentials | None (Local State) | Inputs populated with `carbon@microsoft.com` | `button:has-text("Corporate")` |
| `/` (Login) | `Public Explorer` | Enters public transparency view directly | None (Context) | Transitions immediately to Public Impact Dashboard | `button:has-text("Public Explorer")` |
| `/` (Login) | `Sign In` / Submit | Authenticates with credentials | `POST /auth/login` | Sets JWT bearer token, transitions to role dashboard | `button[type="submit"]:has-text("Sign In")` |
| `/` (Login) | `Create an account` | Toggles to Registration form | None (Local State) | Renders multi-field organization registration form | `button:has-text("Create an account")` |
| `/` (Register) | `Register Account` | Submits new developer/buyer organization | `POST /auth/register` | Displays success toast, switches back to sign-in | `button:has-text("Register Account")` |

---

## 2. Global Shell & Navigation (`Layout.jsx`, `Navbar.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| Sidebar | Navigation item (e.g. `Dashboard`, `My Projects`, etc.) | Navigates to target route | May trigger page data fetch | URL syncs (`/projects/new`, etc.), screen transitions | `nav button:has-text("<label>")` |
| Sidebar | `ML Models & Logs` | Opens ML Model Inspector | `GET /ml-models/`, `GET /ml-models/inferences` | Navigates to `/ml-models` | `nav button:has-text("ML Models")` |
| Sidebar | Collapse Toggle (`<X size={13}/>` / Menu) | Toggles sidebar width | None | Sidebar collapses to 0 width or expands to 252px | `button[title*="Sidebar"], nav + button` |
| Navbar | Notification Bell | Toggles notifications center | `GET /notifications` | Opens right drawer showing real platform notifications | `button[aria-label*="Notification"], button:has(svg.lucide-bell)` |
| Navbar | `Mark all as read` | Marks all active notifications as read | `POST /notifications/read-all` | Unread badge clears to 0 | `button:has-text("Mark all as read")` |
| Navbar | Theme Switcher (`Sun` / `Moon`) | Toggles Light / Dark mode | None | Updates `data-theme` attribute and localStorage | `button:has(svg.lucide-sun), button:has(svg.lucide-moon)` |
| Navbar | Profile Dropdown | Toggles user profile menu | None | Shows profile info, settings link, logout | `button:has(svg.lucide-user)` |
| Navbar | `Sign Out` | Clears session and logs out | None (Local State) | Clears JWT token, returns to login screen | `button:has-text("Sign Out"), button:has-text("Log out")` |

---

## 3. Project Detail Screen (`/projects/:id`, `ProjectDetail.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/projects/:id` | Tab: `1. Overview` | Displays mission, description, and location | None (Local State) | Tab switch; renders description & static map | `button:has-text("1. Overview")` |
| `/projects/:id` | Tab: `2. Evidence & ML` | Displays geotagged photos & ML metrics | None (Local State) | Shows photo cards with ExG, sharpness, GPS match | `button:has-text("2. Evidence & ML")` |
| `/projects/:id` | Tab: `3. Verification & MRV` | Displays 40/30/30 weights & fraud checks | None (Local State) | Renders MRV formula breakdown & screening table | `button:has-text("3. Verification & MRV")` |
| `/projects/:id` | Tab: `4. Satellite / NDVI` | Queries MODIS NDVI time-series | `GET /projects/:id/ndvi` | Renders 16-day composite interactive area chart | `button:has-text("4. Satellite / NDVI")` |
| `/projects/:id` | Tab: `5. Credits & Buffer` | Displays buffer pool & serial range | None (Local State) | Shows 15% buffer pool reserve and serial ID range | `button:has-text("5. Credits & Buffer")` |
| `/projects/:id` | Tab: `6. Documents` | Shows 4-Document Integrity Gate | `GET /documents` | Shows PDD, deed, baseline files with SHA-256 | `button:has-text("6. Documents")` |
| `/projects/:id` | Tab: `7. Timeline Audit` | Displays chronological audit trail | `GET /projects/:id/history` | Renders immutable state change log | `button:has-text("7. Timeline Audit")` |
| `/projects/:id` | Tab: `8. Orders & Settlement` | Displays credit transactions | `GET /transactions` | Shows table of corporate orders & INR amounts | `button:has-text("8. Orders & Settlement")` |
| `/projects/:id` | `Approve Project` (Admin/Approver) | Opens review approval modal | None (Local State) | Prompts for reviewer notes | `button:has-text("Approve Project")` |
| `/projects/:id` | `Reject` (Admin/Approver) | Opens rejection modal | None (Local State) | Prompts for rejection justification | `button:has-text("Reject")` |
| `/projects/:id` | `Buy Credits` (Corporate) | Opens Razorpay purchase modal | None (Local State) | Opens quantity slider & checkout summary | `button:has-text("Buy Credits")` |
| `/projects/:id` | `Pay via Razorpay` (Modal) | Initiates Razorpay checkout | `POST /payments/create-order` | Opens hosted Razorpay checkout modal | `button:has-text("Pay via Razorpay")` |
| `/projects/:id` | `Certificate of Issuance` (Public) | Opens digital certificate modal | None (Local State) | Displays signed certificate of issuance | `button:has-text("Certificate of Issuance")` |
| `/projects/:id` | `Download GeoJSON` | Downloads GIS boundary file | None (Client Blob) | Browser downloads `<project_id>_boundary.geojson` | `button:has-text("Download GeoJSON")` |
| `/projects/:id` | `Back to List` | Returns to previous projects list | None (Context) | Transitions back to `/projects` or `/marketplace` | `button:has-text("Back to List")` |

---

## 4. Project Creation Wizard (`/projects/new`, `ProjectWizard.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/projects/new` | Step Pill: `1. Basic Info` | Switches to Step 1 | None | Shows Name, Ecology, Description, Objectives | `div:has-text("Basic Info")` |
| `/projects/new` | Step Pill: `2. Location` | Switches to Step 2 | None | Shows Latitude, Longitude, Area, Polygon WKT | `div:has-text("Location & Polygon")` |
| `/projects/new` | `Auto-Generate WKT from Center` | Calculates bounding box polygon | None (Math) | Auto-fills `polygon_wkt` with 5-point closed polygon | `button:has-text("Auto-Generate WKT")` |
| `/projects/new` | Step Pill: `3. Baseline` | Switches to Step 3 | None | Shows Tree count, planting date, annual model | `div:has-text("Baseline & Carbon")` |
| `/projects/new` | Step Pill: `4. Evidence` | Switches to Step 4 | None | Shows photo dropzone | `div:has-text("Evidence Upload")` |
| `/projects/new` | Photo File Dropzone | Selects evidence photo | None (File staging) | Stages image for ML analysis | `input[type="file"][accept*="image"]` |
| `/projects/new` | Step Pill: `5. Documents` | Switches to Step 5 | None | Shows PDD, Deed, and FPIC file inputs | `div:has-text("Legal Documents")` |
| `/projects/new` | Step Pill: `6. Review` | Switches to Step 6 | None | Summarizes all staged project parameters | `div:has-text("Review & Submit")` |
| `/projects/new` | `Run Pre-Flight Screening Test` | Tests integrity before submit | `POST /fraud/precheck` | Shows precheck pass/flag badge | `button:has-text("Run Pre-Flight Screening")` |
| `/projects/new` | `Submit Project to Platform` | Submits project & photos | `POST /projects/create-project` | Emits notification, navigates to `/projects/:id` | `button:has-text("Submit Project to Platform")` |
| `/projects/new` | `Clear Draft` | Clears autosaved draft | None (Local Storage) | Resets form to clean defaults | `button:has-text("Clear Draft")` |
| `/projects/new` | `Next Step` / `Previous` | Advances or steps back | None | Updates active wizard step 1 through 6 | `button:has-text("Next Step"), button:has-text("Previous")` |

---

## 5. Machine Learning Inspector (`/ml-models`, `AdminMLModels.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/ml-models` | `Refresh Telemetry` | Reloads models & inferences | `GET /ml-models/`, `GET /ml-models/inferences` | Refreshes 24h count and inference log table | `button:has-text("Refresh Telemetry")` |
| `/ml-models` | `Run on Sample` (M1 Isolation Forest) | Executes peer anomaly test | `POST /ml-models/run-sample` | Shows JSON explainability in <500ms; logs inference | `button:has-text("Run on Sample") >> nth=0` |
| `/ml-models` | `Run on Sample` (M2 Seasonal NDVI) | Executes harmonic fit test | `POST /ml-models/run-sample` | Shows sigma deviation & R2; logs inference | `button:has-text("Run on Sample") >> nth=1` |
| `/ml-models` | `Run on Sample` (M3 Photo Screener) | Executes ExG/sharpness test | `POST /ml-models/run-sample` | Shows ExG index & Laplacian variance; logs inference | `button:has-text("Run on Sample") >> nth=2` |
| `/ml-models` | `Run on Sample` (M4 Reviewer Model)| Runs decision classifier | `POST /ml-models/run-sample` | Shows predicted decision & confidence; logs inference | `button:has-text("Run on Sample") >> nth=3` |
| `/ml-models` | `Close` Output Inspector | Closes sample JSON drawer | None | Collapses sample output panel | `button:has-text("Close")` |

---

## 6. NGO Dashboard & My Projects (`NGOPages.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/projects` | `New Project` | Navigates to project wizard | None | Transitions to `/projects/new` wizard | `button:has-text("New Project")` |
| `/projects` | Filter Pills (`All`, `Approved`, `Pending`, `Rejected`) | Filters table by status | None (Local Filter) | Updates visible project list | `button:has-text("All"), button:has-text("Approved")` |
| `/projects` | Project Name / ID link | Opens Project Detail view | `GET /projects/:id` | Navigates to `/projects/:id` | `button:has-text("PRJ-")` |
| `/projects` | `Screening` | Opens integrity screening modal | `GET /fraud/runs/:id` | Displays ProjectScreeningReport | `button:has-text("Screening")` |
| `/projects` | `Timeline` | Opens quarterly updates modal | `GET /projects/:id/progress` | Displays telemetry timeline & quarterly submit form | `button:has-text("Timeline")` |
| `/projects` | `Submit Quarterly Report` | Submits field monitoring data | `POST /projects/:id/progress` | Appends report to timeline, triggers SSE refresh | `button:has-text("Submit & Trigger Verification")` |
| `/site_suitability` | `Run Feasibility Scan` | Analyzes coordinates | `POST /projects/check-suitability` | Shows soil, rainfall, and suitability index | `button:has-text("Run Feasibility Scan")` |
| `/ngo_marketplace` | `Accept Request` | Accepts corporate buy offer | `POST /marketplace/requests/:id/accept` | Changes request status to accepted | `button:has-text("Accept Request")` |

---

## 7. Corporate Marketplace, Wallet & ESG (`CorporatePages.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/marketplace` | Project Name / ID link | Opens Project Detail view | `GET /projects/:id` | Navigates to `/projects/:id` | `button:has-text("PRJ-")` |
| `/marketplace` | `Compare` Checkbox/Button | Adds project to compare dock | None (Local State) | Stages up to 3 projects; displays compare floating bar | `button:has-text("Compare")` |
| `/marketplace` | `Compare Selected Projects` | Opens side-by-side modal | None (Local State) | Shows ProjectComparisonModal with MRV metrics | `button:has-text("Compare Selected Projects")` |
| `/marketplace` | `Buy Credits` | Opens purchase modal | None (Local State) | Opens Razorpay purchase modal with price quote | `button:has-text("Buy Credits")` |
| `/wallet` | `Retire Credits` | Retires verified offsets | `POST /credits/retire` | Deducts balance, generates public certificate | `button:has-text("Retire Credits")` |
| `/wallet` | `Download Certificate` | Opens signed PDF modal | None (Local State) | Displays official CertificateModal | `button:has-text("Download Certificate")` |
| `/esg` | `Generate Official ESG Report` | Compiles portfolio emissions | `POST /esg/generate` | Generates GRI 305 / GHG Protocol compliant report | `button:has-text("Generate Official ESG Report")` |
| `/calculator` | `Calculate Net Liability` | Computes scope 1/2/3 footprint | None (Math) | Shows estimated tCO2e footprint and offset cost | `button:has-text("Calculate Net Liability")` |

---

## 8. Approver & Verifier Workbenches (`ApproverDashboard.jsx`, `VerifierDashboard.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| Approver Queue | `Approve` | Opens decision modal | None (Local State) | Prompts for reviewer justification | `button:has-text("Approve")` |
| Approver Queue | `Reject` | Opens rejection modal | None (Local State) | Prompts for rejection reason | `button:has-text("Reject")` |
| Approver Queue | `Confirm APPROVED` | Commits approval | `PATCH /projects/:id/status` | Moves status to approved, generates audit log | `button:has-text("Confirm APPROVED")` |
| Approver Queue | `Inspect Dossier` | Opens full 8-tab project view | `GET /projects/:id` | Navigates to `/projects/:id` | `button:has-text("Inspect Dossier")` |
| Verifier Queue | `Sign Off Verification` | Opens audit signoff modal | None (Local State) | Prompts for audit PDF URL and comments | `button:has-text("Sign Off Verification")` |
| Verifier Queue | `Submit Verification` | Submits ISO signoff | `POST /verifier/signoff` | Updates project status to verified | `button:has-text("Submit Verification")` |

---

## 9. Public Transparency Portal (`PublicPages.jsx`)

| Screen / Page | Control Label / Icon | Action Performed | Network Call Triggered | Target State Change / UI Feedback | Test Selector / ID |
|---|---|---|---|---|---|
| `/leaderboard` | Filter Chips (`All`, `Buyers`, `NGOs`) | Filters public ranking | None (Local Filter) | Updates leaderboard rows | `button:has-text("All"), button:has-text("Buyers")` |
| `/certificates` | `Verify Certificate` | Looks up certificate by ID | `GET /certificates/:id` | Displays certificate authenticity badge & details | `button:has-text("Verify Certificate")` |
| `/audit` | Audit Search Input | Filters immutable audit log | None (Local Filter) | Filters audit records in real time | `input[placeholder*="Search audit"]` |
