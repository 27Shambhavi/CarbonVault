# Production Verification & Audit Report

**Date & Time:** 2026-10-17T15:09:57.431Z  
**Target Frontend:** [https://final-carbon-vault.vercel.app](https://final-carbon-vault.vercel.app)  
**Target Backend:** [https://carbonvault-api.onrender.com](https://carbonvault-api.onrender.com)  
**Verified Git Commit:** `79c28c1d9de7225dadfa26005103dd43a29f6382`  

---

## 1. Executive Summary

| Verification Category | Status | Details |
| :--- | :---: | :--- |
| **Content Security Policy (CSP)** | ✅ **ZERO CSP Violations** (Pass) | `cdn.razorpay.com` & OpenStreetMap tiles allowed without script blocks |
| **Commit Hash Integrity** | ✅ **Eliminated** (Real commit SHA displayed) | Footer and build metadata resolve to real git SHA, never literal `HEAD` |
| **Cold-Start Resilience** | ✅ Pass | Server waking banner up to 60s without unhandled React crashes |
| **Razorpay Test Integration** | ✅ **Allowed by CSP** (`cdn.razorpay.com`) | Risk detection bundle allowed under `script-src` |
| **5-Check Screening Pipeline** | ✅ Pass | 100.0% benchmark recall, 0.0% false positive rate on controls |
| **Frontend Life-cycle & Hooks** | ✅ Pass | Zero React hook order crashes (#310), clean 401 expiration |

---

## 2. Live API Endpoint Health Probes

| Endpoint | HTTP Status | Response Latency | Health Assessment |
| :--- | :---: | :---: | :--- |
| `GET /health` | 200 | 536ms | Healthy |
| `GET /ready` | 200 | 358ms | DB pool, scheduler & payment readiness |
| `GET /stats` | 200 | 918ms | Public platform verified totals |
| `GET /projects` | 422 | 302ms | Registry project catalog & polygons |

---

## 3. Browser Audit & Console Integrity

- **CSP Violations Detected:** 0
  - None. All inline styles and third-party scripts match whitelist.

- **Unhandled Console Errors:** 0
  - None. Clean DOM initialization.

- **Footer Commit Rendering:** Clean git SHA (No literal "HEAD" string)
- **API Status Indicator:** `API: Online · 527ms · checked 4s ago · Mode: demo`

---

## 4. Visual Evidence & Captured Screenshots

### Landing page & login view with cold-start status
![live_landing_login.png](evidence/live_landing_login.png)

### Public Transparency Dashboard with impact metrics
![live_public_transparency.png](evidence/live_public_transparency.png)


---

## 5. Fraud & Anomaly Screening Benchmark Results

```
Case Type                  | n    | Flagged | Missed | Detection %
------------------------------------------------------------------
identical_photo            | 20   | 20      | 0      |     100.0%
resized_recompressed       | 20   | 20      | 0      |     100.0%
flipped_mirror             | 20   | 20      | 0      |     100.0%
gps_far_from_site          | 20   | 20      | 0      |     100.0%
declared_vs_poly_gap       | 20   | 20      | 0      |     100.0%
invalid_polygon            | 20   | 20      | 0      |     100.0%
low_ndvi_site              | 20   | 20      | 0      |     100.0%
------------------------------------------------------------------
genuine_controls (Clean)   | 20   | 0       | 20     | (FPR: 0.0%)
==================================================================
Overall Fraud Screening Recall : 100.0%
False Positive Rate (FPR)       : 0.0%
```

---
*Report certified by CarbonVault Automated Production Verifier.*
