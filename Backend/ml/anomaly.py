"""
Backend/ml/anomaly.py
M1: IsolationForest Anomaly Detection Model.
Features:
1. trees_per_ha: trees / max(1.0, area_hectares)
2. area_gap: abs(area_hectares - polygon_hectares) / max(0.1, area_hectares)
3. photo_count: count of evidence photos
4. mean_ndvi: mean NDVI from satellite observations
5. ndvi_trend: 12-month slope of NDVI values
6. coord_plausibility: distance from expected equatorial / tropical coordinates
7. plantation_type_enc: encoded plantation type (0=reforestation, 1=mangrove, 2=agroforestry, 3=bamboo, 4=other)

Outputs:
- 0–100 anomaly score
- Top 3 reasons (features with largest standardized deviation from peer mean)
- Fusion with rule-based fraud risk: fused_risk = 0.5 * rule_risk + 0.5 * anomaly_score
- Ground rule label: "unusual vs. peers, not proof of fraud"
- Persisted in `ml_assessments` table.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from credit_calculation.credits_module.db_models import Project, SatelliteObservation, MLAssessment

logger = logging.getLogger("carbonvault.ml.anomaly")

PLANTATION_TYPE_MAP = {
    "reforestation": 0,
    "mangrove": 1,
    "agroforestry": 2,
    "bamboo": 3,
    "carbon_capture": 4,
    "other": 5
}

FEATURE_NAMES = [
    "trees_per_ha",
    "area_gap_ratio",
    "photo_count",
    "mean_ndvi",
    "ndvi_trend",
    "coord_distance_deg",
    "plantation_type_code"
]


def extract_project_features(project: Project, db: Session) -> Tuple[np.ndarray, Dict[str, float]]:
    """Extract 7 standardized numerical features from a project record."""
    # 1. Trees per hectare
    area_ha = float(project.area_hectares or 1.0)
    trees = float(project.number_of_trees or 0)
    trees_per_ha = trees / max(1.0, area_ha)

    # 2. Declared vs polygon area gap
    poly_ha = area_ha
    if project.polygon_wkt:
        try:
            from shapely import wkt
            poly = wkt.loads(project.polygon_wkt)
            # Rough degree-to-hectare approximation (1 deg ~ 111km at equator)
            poly_ha = abs(poly.area) * (111000 ** 2) / 10000.0
        except Exception:
            poly_ha = area_ha
    area_gap_ratio = abs(area_ha - poly_ha) / max(0.1, area_ha)

    # 3. Photo count
    photos = (project.evidence_images or "").split(",") if project.evidence_images else []
    photo_count = float(len([p for p in photos if p.strip()]) + (1 if project.evidence_image else 0))

    # 4 & 5. Satellite NDVI statistics
    ndvi_rows = db.query(SatelliteObservation).filter(
        SatelliteObservation.project_id == project.project_id,
        SatelliteObservation.band == "250m_16_days_NDVI"
    ).order_by(SatelliteObservation.obs_date.asc()).all()

    if ndvi_rows and len(ndvi_rows) > 0:
        ndvi_vals = [r.value for r in ndvi_rows]
        mean_ndvi = float(np.mean(ndvi_vals))
        if len(ndvi_vals) >= 2:
            x = np.arange(len(ndvi_vals))
            slope, _ = np.polyfit(x, ndvi_vals, 1)
            ndvi_trend = float(slope)
        else:
            ndvi_trend = 0.0
    else:
        # Benchmark default
        mean_ndvi = 0.62
        ndvi_trend = 0.005

    # 6. Coordinate plausibility: distance in degrees from equator (-10 to 10 is prime tropics)
    lat = float(project.latitude or 0.0)
    lon = float(project.longitude or 0.0)
    coord_dist = float(abs(lat))

    # 7. Encoded plantation type
    ptype = (project.plantation_type or "reforestation").lower()
    ptype_enc = float(PLANTATION_TYPE_MAP.get(ptype, 5))

    feat_dict = {
        "trees_per_ha": trees_per_ha,
        "area_gap_ratio": area_gap_ratio,
        "photo_count": photo_count,
        "mean_ndvi": mean_ndvi,
        "ndvi_trend": ndvi_trend,
        "coord_distance_deg": coord_dist,
        "plantation_type_code": ptype_enc
    }

    vec = np.array([feat_dict[k] for k in FEATURE_NAMES], dtype=float)
    return vec, feat_dict


def train_anomaly_model(all_projects: List[Project], db: Session) -> Tuple[IsolationForest, np.ndarray, np.ndarray]:
    """Train IsolationForest over peer dataset."""
    feature_matrix = []
    for p in all_projects:
        vec, _ = extract_project_features(p, db)
        feature_matrix.append(vec)

    X = np.array(feature_matrix)
    # Peer statistics
    means = np.mean(X, axis=0)
    stds = np.std(X, axis=0)
    stds = np.where(stds == 0, 1.0, stds)

    # Train IsolationForest
    clf = IsolationForest(
        n_estimators=100,
        contamination=0.15,
        random_state=42
    )
    clf.fit(X)
    return clf, means, stds


def run_anomaly_detection(project_id: str, db: Session) -> Dict[str, Any]:
    """
    Run M1 IsolationForest anomaly assessment for a single project.
    Fuses output with rule-based fraud risk.
    Persists result in `ml_assessments` table.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project:
        return {"error": f"Project {project_id} not found"}

    all_projects = db.query(Project).all()
    if len(all_projects) < 3:
        # Fallback if sparse database
        confidence = "low"
    elif len(all_projects) < 10:
        confidence = "medium"
    else:
        confidence = "high"

    # Train model on current peer set
    clf, means, stds = train_anomaly_model(all_projects, db)

    # Feature vector for target project
    vec, feat_dict = extract_project_features(project, db)
    z_scores = (vec - means) / stds

    # Raw IsolationForest decision function: lower = more anomalous
    raw_score = float(clf.decision_function(vec.reshape(1, -1))[0])
    # Map raw score (-0.5 to 0.5 typically) to 0–100 anomaly index
    anomaly_score = round(float(np.clip((0.20 - raw_score) * 125.0, 0.0, 100.0)), 1)

    # Identify top 3 features with highest absolute deviation
    abs_deviations = np.abs(z_scores)
    top_indices = np.argsort(abs_deviations)[::-1][:3]

    human_reasons = []
    reason_details = []
    labels_map = {
        "trees_per_ha": ("Tree density", "trees/ha"),
        "area_gap_ratio": ("Declared vs polygon area gap", "ratio"),
        "photo_count": ("Evidence photo count", "photos"),
        "mean_ndvi": ("Mean satellite NDVI", "index"),
        "ndvi_trend": ("NDVI temporal trajectory", "slope"),
        "coord_distance_deg": ("Latitude biome distance", "deg"),
        "plantation_type_code": ("Plantation category", "class")
    }

    for idx in top_indices:
        fname = FEATURE_NAMES[idx]
        flabel, unit = labels_map.get(fname, (fname, ""))
        val = feat_dict[fname]
        mean_peer = means[idx]
        z_val = z_scores[idx]

        if abs(z_val) > 0.4:
            direction = "higher" if z_val > 0 else "lower"
            human_reasons.append(
                f"{flabel}: {val:.2f} {unit} is {abs(z_val):.1f}σ {direction} than peer benchmark ({mean_peer:.2f} {unit})"
            )
            reason_details.append({
                "feature": fname,
                "label": flabel,
                "value": round(float(val), 3),
                "peer_mean": round(float(mean_peer), 3),
                "z_score": round(float(z_val), 2)
            })

    if not human_reasons:
        human_reasons.append("All structural biometric features closely align with regional peer averages.")

    # Rule-based fraud risk from project
    rule_risk = float(project.fraud_risk or 15.0)

    # Fused risk quotient (50% rule-based domain checks + 50% unsupervised IsolationForest anomaly)
    fused_risk = round(0.50 * rule_risk + 0.50 * anomaly_score, 1)

    # Persist in ml_assessments table
    now_utc = datetime.utcnow()
    try:
        assessment_row = MLAssessment(
            project_id=project_id,
            model="anomaly",
            score=anomaly_score,
            reasons=json.dumps(reason_details),
            confidence=confidence,
            model_version="1.0.0",
            created_at=now_utc
        )
        db.add(assessment_row)
        db.commit()
    except Exception as dbe:
        db.rollback()
        logger.warning("Could not persist anomaly assessment in DB: %s", dbe)

    return {
        "project_id": project_id,
        "model": "IsolationForest",
        "model_version": "1.0.0",
        "anomaly_score": anomaly_score,
        "rule_risk": rule_risk,
        "fused_risk": fused_risk,
        "top_reasons": human_reasons,
        "reasons_json": reason_details,
        "confidence": confidence,
        "peer_count": len(all_projects),
        "label": "unusual vs. peers, not proof of fraud",
        "created_at": now_utc.isoformat() + "Z"
    }
