# CarbonVault — ADDENDUM: Admin vs Approver, and a Clean Login (Option B)

This document formalizes the owner-directed architectural separation of duties between **Platform Administration (Admin)** and **Project Evaluation (Approver)**, along with server-authoritative role verification and clean login rules.

---

## 1. Separation of Duties Matrix

| Capability | Admin (platform operator) | Approver (project reviewer) | Verifier | NGO | Corporate | Public |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Review queue, read screening report | ✅ all | ✅ assigned or unassigned | ✅ assigned only | own projects | — | summary only |
| **Decide** a project (approve / reject / request data) | ⚠️ only as flagged **override** (mandatory reason + confirm) | ✅ **primary decision-maker** | ❌ (signs off field verification only) | ❌ | ❌ | ❌ |
| Reassign project to another approver/verifier | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Suspend live project (take-down) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Organisation KYC review | ✅ | ❌ | ❌ | submit own | submit own | ❌ |
| Create users, invite approvers/verifiers | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pricing, buffer share, thresholds | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Payments, refunds, payouts, reconciliation | ✅ | ❌ | ❌ | own payouts (view) | own orders | ❌ |
| ML Models page and retraining | ✅ | ❌ (feedback only) | ❌ | ❌ | ❌ | ❌ |
| Audit trail | ✅ full | ✅ own decisions/projects | ✅ own | own | own | public view |
| Platform health (`/ready`), alerts | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Enforced Invariants
- **Four-Eyes Rule:** An approver cannot approve a project belonging to an organisation they are linked to (`user.organization_id == project.ngo_id` -> 403 Forbidden).
- An approver cannot be the verifier of the same project (`project.verifier_id == user.id` -> 403 Forbidden).
- **Admin Override:** Admin decision is rare by design. Must include mandatory `override_reason` (min 10 characters) and `override_confirmed = True`. Highlighted in the audit trail and tracked as `"Overrides this month"`.
- **Server-Authoritative Claims:** Role and permissions are signed in JWT claims. Route guards are convenience; server strictly returns 403 Forbidden for any unauthorized route.

---

## 2. Dashboard Experience

### Admin Home — "Operations Console"
- Platform health (`/ready`), reconciliation status (0 variance vs Razorpay).
- Environmental & biometric alerts (NDVI decline, IsolationForest anomalies).
- KYC queue count, unassigned projects count, overrides this month.
- Money summary: payments today, refunds pending, payouts owed.
- Shortcuts: Organisations, Users, Pricing, Payments, ML Models, Audit, Settings.
- Navigation: Home · Review Queue (oversight) · Organisations · Users · Pricing · Payments and Payouts · ML Models · Audit · Settings.

### Approver Home — "Decision Desk"
- Decision queue sorted by risk and age.
- 72-hour SLA deadline timer per project.
- Counts: "Needs my decision / Waiting on NGO / Waiting on verifier".
- One-screen decision panel: risk summary with reasons, 5 per-check traffic lights, evidence, documents, verifier status, comment box, buttons (`Request data`, `Reject [reason required]`, `Approve [disabled until required documents & verifier sign-off exist]`).
- Personal stats: decided this week, average decision time, agreement with feedback.
- Strictly no pricing, users, payouts, organisations or ML configuration.
- Navigation: Home · Decision Queue · Decided · My Audit.

---

## 3. Login Screen & Demo Architecture
- Demo Mode: Exactly 5 distinct tiles (Admin, Approver, Verifier, NGO, Corporate) with respective icons, colors, descriptions, and tooltips.
- Public tile removed: Public never signs in; single link button: `"Explore the public registry (no login)"`.
- Served by `GET /auth/demo-accounts` (returns 404 in production mode to hide tiles).
- Tile selection only fills email and password; server authentication dictates the active role.
