import os
import logging
from pathlib import Path
import joblib
import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "model" / "trained_model.pkl"

_model = None


def get_model():
    global _model
    if _model is not None:
        return _model

    if MODEL_PATH.exists():
        try:
            _model = joblib.load(MODEL_PATH)
            logger.info("Loaded site suitability model from %s", MODEL_PATH)
            return _model
        except Exception as e:
            logger.warning("Failed to load model file (%s), attempting regeneration: %s", MODEL_PATH, e)

    # Attempt regeneration
    try:
        from ..train_model import train_and_save
        _model = train_and_save()
        if _model is not None:
            return _model
    except Exception as e:
        logger.warning("Failed to regenerate model: %s", e)

    return None


def predict_suitability(data: dict) -> float:
    features = np.array([[ 
        data.get("elevation_m", 5),
        data.get("mean_temp_C", 28),
        data.get("annual_precip_mm", 1200),
        data.get("ndvi_mean", 0.6),
        data.get("soil_org_c_t_ha", 50),
        data.get("tidal_range_m", 2),
        data.get("salinity_ppt", 30),
        data.get("water_depth_m", 1),
        data.get("flood_frequency_score", 0.5),
        data.get("pop_density_per_km2", 300),
        data.get("cyclone_exposure_score", 0.4),
        data.get("sea_level_rise_risk_score", 0.6)
    ]])

    model = get_model()
    if model is not None:
        try:
            score = model.predict(features)[0]
            return round(float(score), 2)
        except Exception as e:
            logger.warning("Model prediction error: %s, using heuristic fallback", e)

    # Heuristic fallback if model unavailable
    ndvi = data.get("ndvi_mean", 0.6)
    temp = data.get("mean_temp_C", 28)
    precip = data.get("annual_precip_mm", 1200)

    score = 0.5 + (ndvi * 0.3) + (0.1 if 20 <= temp <= 32 else -0.1) + (0.1 if precip >= 1000 else 0.0)
    score = max(0.1, min(0.95, score))
    return round(float(score), 2)