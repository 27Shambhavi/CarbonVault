# app/services/fraud_service.py
"""
Orchestrator — runs all four fraud validators and aggregates a weighted risk score.
"""
import logging
from .geo_validator import spatial_risk_check
from .NDVI_Validator import ndvi_risk_check
from .ecological_validator import ecological_risk_check
from .Media_Validator import media_geo_risk_check

logger = logging.getLogger(__name__)


def _safe(fn, *args, fallback_risk=0.0, **kwargs) -> dict:
    """Run a validator; on any exception return a safe fallback dict."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        logger.exception("Validator %s failed", fn.__name__)
        return {"error": str(e), "risk": fallback_risk}


def run_fraud_detection(project_id: str, polygon_wkt: str, image_path: str) -> dict:
    """
    Runs all four fraud validators and aggregates a weighted risk score.

    Weights:
        - Spatial overlap  : 30%
        - Ecological density: 20%
        - NDVI vegetation  : 30%
        - Media geo check  : 20%
    """
    logger.info("Running fraud detection for project %s", project_id)

    # Run each check independently so one failure doesn't kill the others
    spatial    = _safe(spatial_risk_check,    polygon_wkt, project_id)
    ecological = _safe(ecological_risk_check, project_id)
    ndvi       = _safe(ndvi_risk_check,       project_id)
    media      = _safe(media_geo_risk_check,  project_id, image_path)

    # Extract risk scores (default 0 if key missing due to error)
    spatial_risk    = spatial.get("spatial_risk", 0.0)
    ecological_risk = ecological.get("ecological_risk", 0.0)
    ndvi_risk       = ndvi.get("ndvi_risk", 0.0)
    media_risk      = media.get("media_risk", 0.0)

    # Weighted aggregation
    final_score = (
        0.30 * spatial_risk +
        0.20 * ecological_risk +
        0.30 * ndvi_risk +
        0.20 * media_risk
    )
    final_score = round(final_score, 4)

    if final_score > 0.7:
        level = "HIGH"
    elif final_score > 0.4:
        level = "MEDIUM"
    else:
        level = "LOW"

    logger.info("Fraud detection result: score=%.4f level=%s", final_score, level)

    return {
        "integrity_score": round(1 - final_score, 4),
        "risk_score":      final_score,
        "risk_level":      level,
        "details": {
            "spatial":    spatial,
            "ecological": ecological,
            "ndvi":       ndvi,
            "media":      media,
        },
    }