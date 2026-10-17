# CarbonVault — Fraud & Anomaly Screening Pipeline

CarbonVault implements an automated 5-check screening pipeline designed to detect registration errors, double-counting, coordinate drift, and photo reuse prior to credit issuance.

---

## 1. Core Philosophy: Objective Science Over Accusation

Traditional security systems often alienate project developers by presenting harsh, accusatory flags like "Fraudulent" or "Fake Image". CarbonVault rejects this approach:
- Most flagged issues are benign: developers frequently upload photos received over messaging apps that strip camera EXIF GPS metadata, or draw boundary perimeters that include access roads or buffer zones.
- The platform presents neutral, empirical findings with transparent metrics and actionable recommendations.

### Review Status Vocabulary

| Status | User-Facing Label | Meaning | Action Required |
| :---: | :--- | :--- | :--- |
| **PASS** | **Looks consistent** | Conforms fully within scientific, geometric, and catalog thresholds. | None. Project moves to next audit stage. |
| **WARN** | **Needs attention** | Minor discrepancy (e.g. area differs by 15%, or camera GPS missing). | Developer can submit an explanation or upload camera originals. |
| **FAIL** | **Needs manual review** | Significant variance (e.g. boundary overlap with another project, or duplicate photo). | Field auditor conducts manual inspection before sign-off. |

---

## 2. The 5 Mathematical & Telemetry Checkpoints

### Check 1: Boundary Geometry & Registry Overlap (`geo_boundary`)
- **Mathematical Basis**:
  - Polygon coordinates in degrees longitude/latitude are projected to metric coordinates at mean latitude:
    $$\Delta x = \Delta \lambda \times 111,139 \times \cos(\phi_m), \quad \Delta y = \Delta \phi \times 111,139$$
  - Spherical surface area is computed via the Shoelace formula:
    $$A = \frac{1}{2} \left| \sum_{i=0}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) \right|$$
  - Area in hectares = $A / 10,000$.
- **Validation Rules**:
  - Area discrepancy $\frac{|A_{\text{computed}} - A_{\text{declared}}|}{\max(0.1, A_{\text{declared}})} \le 10\% \implies$ **Looks consistent**
  - Area discrepancy between 10% and 25% $\implies$ **Needs attention**
  - Area discrepancy $> 25\% \implies$ **Needs manual review**
  - Boundary overlap with any other active project $> 0.05\text{ ha} \implies$ **Needs manual review** (prevents double-issuance).

### Check 2: Field Photo GPS & Proximity Verification (`photo_gps_exif`)
- **Extraction Mechanism**:
  - Inspects uploaded JPEG/TIFF/PNG files using Pillow's `getexif().get_ifd(0x8825)` API, falling back to `exifread` for legacy rational formats.
  - Converts Degrees-Minutes-Seconds (DMS) to decimal degrees with hemisphere compensation.
- **Proximity Calculation**:
  - Computes great-circle distance to the project site centroid using the Haversine formula:
    $$d = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
- **Thresholds**:
  - $d \le 25.0\text{ km} \implies$ **Looks consistent**
  - $25.0\text{ km} < d \le 50.0\text{ km} \implies$ **Needs attention**
  - $d > 50.0\text{ km} \implies$ **Needs manual review**
  - Photos uploaded without embedded GPS $\implies$ **Needs attention** ("GPS metadata stripped; please supply camera originals or field note").

### Check 3: Multi-Orientation Perceptual Hash Screening (`perceptual_hash`)
- **Invariance Engineering**:
  - Computes perceptual image hash (DCT-based pHash) for 5 distinct orientations:
    1. Original orientation
    2. Horizontal mirror (flip left-right) — defeats the common horizontal reflection exploit
    3. 90° clockwise rotation
    4. 180° rotation
    5. 270° rotation
- **Hamming Distance Comparison**:
  - Compares query hashes against stored hashes in `photo_hashes` table across all active projects.
  - If $\min(\text{Hamming Distance}) \le 10\text{ bits} \implies$ **Needs manual review** (near-duplicate image detected).
  - If $\min(\text{Hamming Distance}) > 10\text{ bits} \implies$ **Looks consistent** (fingerprint is unique across registry).

### Check 4: Satellite NDVI Vegetative Health Trend (`satellite_ndvi`)
- **Telemetry Pipeline**:
  - Synchronizes surface reflectance from ORNL DAAC MODIS and Sentinel-2 satellites.
  - Normalised Difference Vegetation Index: $\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$.
- **Trajectory Analysis**:
  - Compares mean baseline greenness before planting vs. recent orbital composite passes.
  - If recent $\Delta \text{NDVI} < -0.20 \implies$ **Needs manual review** (severe canopy stress or harvesting detected).
  - If recent $\Delta \text{NDVI} < -0.10 \implies$ **Needs attention** (seasonal dry dip or slow establishment).
  - If recent $\text{NDVI} \ge 0.35$ and trend stable $\implies$ **Looks consistent**.

### Check 5: Regional Peer Anomaly & Allometrics (`ecological_isolation`)
- **Isolation Forest Architecture**:
  - Evaluates 7 standardized biometric features:
    1. `trees_per_ha`: Planting density relative to species maximum.
    2. `area_gap_ratio`: Discrepancy between cadastral and surveyed boundary.
    3. `photo_count`: Photographic evidence sampling depth.
    4. `mean_ndvi`: Multi-year mean canopy greenness.
    5. `ndvi_trend`: 12-month linear regression slope.
    6. `coord_distance_deg`: Geographic distance from regional bioclimatic zone.
    7. `plantation_type_code`: Allometric species classification.
- **Scoring & Attribution**:
  - Isolation Forest score scaled to 0–100.
  - Identifies top-3 contributing features with largest standardized deviation from regional peer mean.
  - Score $< 55 \implies$ **Looks consistent**.
  - $55 \le \text{Score} < 75 \implies$ **Needs attention**.
  - $\text{Score} \ge 75 \implies$ **Needs manual review**.

---

## 3. Empirical Evaluation Benchmark

Results from executing `python scripts/eval_screening.py` across 160 synthetic and control test cases:

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

## 4. Auditor Feedback & Explanation Workflow

1. **Pre-Flight Dry Run (`POST /fraud/precheck`)**:
   - Allows NGOs to test boundary polygons and photographs in memory prior to project creation.
2. **Developer Explanations (`POST /fraud/projects/{id}/explanation`)**:
   - If a check triggers "Needs attention", the developer submits explanatory context (e.g., access roads, local nursery photos).
   - Explanations are recorded in the SHA-256 cryptographic audit log and displayed to accredited auditors.
3. **Verifier Utility Feedback (`POST /fraud/checks/{id}/feedback`)**:
   - Verifiers mark whether a flag was useful or a false positive during audit review.
   - Persisted in `ml_flag_feedbacks` to enable continuous model recalibration.
