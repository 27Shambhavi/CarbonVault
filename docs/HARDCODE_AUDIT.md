# CarbonVault — Hardcode Audit & Eradication Inventory

> **Document Status:** Active Audit Log  
> **Phase:** Phase 1 — Hardcode Eradication  
> **Standard:** Zero tolerance for synthetic entities, fabricated metrics, ungrounded certifications, or hardcoded financial multipliers in production paths.

---

## 1. Executive Summary

This inventory documents all hardcoded domain numbers, fake entities, fabricated climate metrics, mock leaderboards, ungrounded compliance claims, and static financial multipliers audited across the CarbonVault frontend and backend codebases. 

Every entry maps the offending code to its architectural replacement and the CI gate test that prevents regression.

---

## 2. Comprehensive Hardcode Inventory

| # | File & Line | Offending Value / Construct | Original Rationale | Architectural Replacement | Verification Test / CI Gate |
|---|-------------|------------------------------|--------------------|---------------------------|----------------------------|
| 1 | `Backend/routers/payment_router.py:44` | Fallback INR FX multiplier `83.5` | Quick conversion multiplier for Razorpay orders | Dynamic rate lookup via `get_current_inr_rate(db)` backed by `fx_rates` table and European Central Bank (Frankfurter API) feed | `test_fx_rates_endpoint`, `test_check_hardcoded_script` |
| 2 | `Backend/routers/payment_router.py:15-18` | Hardcoded Razorpay test secret fallback keypair (`rzp_test_***`) | Fallback when env vars missing in local dev | Removed; strictly imports `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` from `core.config` | Gitleaks CI scan & `test_payment_no_hardcoded_secrets` |
| 3 | `Backend/routers/marketplace_router.py:48` | Hardcoded INR multiplier `83.5` | Currency conversion in marketplace listings | Dynamic `get_current_inr_rate(db)` | `test_marketplace_dynamic_fx`, `scripts/check-hardcoded.mjs` |
| 4 | `Backend/credit_calculation/credits_module/funding_engine.py:15` | Fallback rate `inr_rate = 83.5` | Seed funding calculation fallback | Dynamic query on `fx_rates` table with fallback to `SystemConfig['inr_usd_fallback_rate']` | `test_funding_engine_dynamic_fx` |
| 5 | `Backend/routers/esg_router.py:22-38` | Hardcoded portfolio offsets `49,400 tonnes`, `$1,420,000` demo holdings, fake Scope 1-3 bars | Dummy ESG portfolio for Corporate dashboard | Replaced with real transactional aggregation over `transactions` and `footprint_estimates` tables; clean zero-state when empty | `test_esg_metrics_truthful`, `scripts/check-hardcoded.mjs` |
| 6 | `Backend/routers/esg_router.py:55` | Fabricated `compliance_score = 95` and ISO 14001 ticks (`iso_14001_certified = True`) | Unverified regulatory compliance claims | Replaced with `reporting_frameworks_aligned` (informational only) and mandatory disclaimers; no ungrounded accreditation claims | `test_esg_no_ungrounded_claims` |
| 7 | `Backend/routers/project_servicerouter.py:260` | Fabricated `89 GWh renewable energy generated` in public stats | Prototype climate impact card metric | Eradicated; replaced with true forest area sum (`total_hectares_monitored`) and credit volume strictly from approved projects | `test_public_stats_truthful`, `scripts/check-hardcoded.mjs` |
| 8 | `Backend/routers/grs_router.py:18-45` | Hardcoded dictionary `MOCK_COMPANIES = {"EcoGuard Brazil": 94, "Microsoft": 88}` | In-memory GRS leaderboard | Eradicated; replaced with dynamic calculation over real project audits, retirement volumes, and weights from `SystemConfig` (`grs_weight_*`) | `test_grs_score_dynamic_db` |
| 9 | `Backend/routers/calculator_router.py:14-25` | Hardcoded emission multipliers (`0.35`, `0.014`, `0.45`, `0.15`, `0.60`, `0.50`) | Corporate footprint estimation formula | Loaded dynamically from `SystemConfig` table with source citations (GHG Protocol, EPA eGRID, DEFRA) | `test_calculator_uses_config` |
| 10 | `Frontend/src/pages/LoginPage.jsx:82` | Marketing claim `"Live Blockchain & Satellite Ledger"` | Misleading prototype text (no blockchain in production) | Updated to `"Cryptographic Audit & Satellite MRV Ledger"` reflecting real SHA-256 certificate hashing and Sentinel-2 telemetry | `scripts/check-hardcoded.mjs` |
| 11 | `Frontend/src/components/public/PublicPages.jsx:12` | Static array `mockPublicLeaderboard` containing synthetic corporate rankings | Placeholder data for public landing page | Eradicated; bound to dynamic `fetchGrsLeaderboard()` from backend API | `scripts/check-hardcoded.mjs` |
| 12 | `Frontend/src/components/public/PublicPages.jsx:89` | Hardcoded `"89 GWh Renewable Energy"` impact card | Prototype public stats card | Removed entirely; replaced with verifiable platform metrics from `/public/stats` | `scripts/check-hardcoded.mjs` |
| 13 | `Frontend/src/components/corporate/CorporatePages.jsx:32-45` | Hardcoded GRS gauge `92/100`, fake ISO audit dates, and hardcoded `83.5` FX multiplier | Placeholder dashboard state | Bound to `fetchCorporateGrsScore()` and `fetchLiveFxRate()`; removed fake ISO badges; dynamic conversion | `test_corporate_dashboard_bindings` |
| 14 | `Frontend/src/components/corporate/CorporateCalculator.jsx:20-25` | Default pre-filled 250 headcount triggering automatic demo calculation on mount | Auto-calculating fake footprint | Form initialized to empty strings; calculator only computes upon explicit user interaction | `scripts/check-hardcoded.mjs` |
| 15 | `Frontend/src/components/ngo/NGOPages.jsx:140-160` | Hardcoded tree species list with hardcoded absorption rates and `EcoGuard Brazil` defaults | Static dropdown values for project submission | Bound to dynamic `fetchPlantationTypes()` from `/config/plantation-types`; displays official IPCC/FAO source citations | `test_plantation_types_endpoint` |
| 16 | `Frontend/src/services/api.js` | Missing dynamic configuration and reference endpoints | Prototype client lacked endpoints for system config | Added `fetchPublicConfig()`, `fetchPlantationTypes()`, `fetchLiveFxRate()`, `fetchCorporateGrsScore()`, `fetchGrsLeaderboard()` | `test_frontend_api_endpoints` |

---

## 3. Database System Configuration (`system_config`)

All platform constants are centrally governed in the `system_config` table and auditable through `config_audit_history`:

| Key | Default Value | Unit | Source Citation | Public |
|-----|---------------|------|-----------------|--------|
| `base_price_usd` | `28.50` | USD/tonne | Ecosystem Marketplace 2024 | Yes |
| `multiplier_demand_default` | `1.12` | ratio | Dynamic Pricing Model v1.2 | Yes |
| `multiplier_supply_default` | `0.98` | ratio | Dynamic Pricing Model v1.2 | Yes |
| `multiplier_living_default` | `1.08` | ratio | Fairtrade Living Wage Index 2023 | Yes |
| `buffer_pool_share` | `0.15` | percentage | VCS Non-Permanence Risk Tool | Yes |
| `shadow_credit_horizon_years` | `5` | years | ISO 14064-2 Forward Sequestration | Yes |
| `marketplace_commission_pct` | `5.0` | % | CarbonVault Fee Schedule | Yes |
| `admin_fee_usd` | `50.0` | USD | CarbonVault Fee Schedule | Yes |
| `payment_gateway_fee_pct` | `2.5` | % | Razorpay Standard Rate | Yes |
| `inr_usd_fallback_rate` | `83.50` | INR/USD | Reserve Bank of India Reference Rate | Yes |
| `ecb_cache_ttl_seconds` | `3600` | seconds | System Cache Policy | Yes |
| `satellite_ndvi_threshold` | `0.45` | index | Sentinel-2 AFOLU Standard | Yes |
| `satellite_canopy_threshold` | `25.0` | % | Global Forest Watch Canopy Standard | Yes |
| `corporate_carbon_intensity_factor` | `0.85` | factor | IEA Global Energy & Emissions 2023 | Yes |
| `corporate_scope3_spend_multiplier` | `0.0004` | factor | GHG Protocol Scope 3 Standard | Yes |
| `corporate_commute_factor` | `0.12` | factor | EPA Commuter Model | Yes |
| `grs_weight_retirement` | `0.35` | weight | CarbonVault GRS Methodology 2024 | Yes |
| `grs_weight_reporting` | `0.25` | weight | CarbonVault GRS Methodology 2024 | Yes |
| `grs_weight_diversity` | `0.20` | weight | CarbonVault GRS Methodology 2024 | Yes |
| `grs_weight_vintage` | `0.20` | weight | CarbonVault GRS Methodology 2024 | Yes |
| `scope1_employee_coeff` | `0.35` | tCO2e/employee/yr | GHG Protocol Corporate Standard | Yes |
| `scope2_sqft_coeff` | `0.014` | tCO2e/sqft/yr | US EIA CBECS Standard | Yes |
| `scope2_employee_coeff` | `0.45` | tCO2e/employee/yr | EPA eGRID National Average | Yes |
| `scope3_shorthaul_coeff` | `0.15` | tCO2e/flight | DEFRA GHG Factors 2023 | Yes |
| `scope3_longhaul_coeff` | `0.60` | tCO2e/flight | DEFRA GHG Factors 2023 | Yes |
| `scope3_cloud_coeff` | `0.50` | tCO2e/$1k | Cloud Carbon Footprint Research | Yes |

---

## 4. Automated Regression Testing (CI Gate)

Regression testing is enforced at two stages:
1. **Static AST & Pattern Scanning (`scripts/check-hardcoded.mjs` & `scripts/check_hardcoded.py`)**:
   - Runs on every PR and git push via GitHub Actions.
   - Detects banned literals: `83.5`, `49,400`, `89 GWh`, `ISO 14001` (certification ticks), fake corporations in user-facing views.
   - Exempts designated test files and seed migrations.
2. **Dynamic Endpoint Integration (`Backend/tests/test_phase1.py`)**:
   - Asserts `/config/public` returns all system parameters with units and citations.
   - Asserts `/config/plantation-types` returns DB records with IPCC/FAO attributions.
   - Asserts `/config/fx-rate` connects to Frankfurter/ECB feed and falls back smoothly to DB cache.
   - Asserts `/grs/score` calculates score dynamically without in-memory dictionaries.
   - Asserts `/esg/portfolio` returns honest metrics and disclaimers.
