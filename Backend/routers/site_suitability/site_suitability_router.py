"""
Backend/routers/site_suitability/site_suitability_router.py
M3: Site Suitability Assessment API driven by live NASA POWER climate and scikit-learn model.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any

from ml.suitability import assess_site_suitability

router = APIRouter()


class SuitabilityInput(BaseModel):
    lat: float
    lon: float
    area: float
    elevation_m: Optional[float] = None
    soil_org_c_t_ha: Optional[float] = None
    tidal_range_m: Optional[float] = None
    salinity_ppt: Optional[float] = None
    water_depth_m: Optional[float] = None
    flood_frequency_score: Optional[float] = None
    pop_density_per_km2: Optional[float] = None
    cyclone_exposure_score: Optional[float] = None
    sea_level_rise_risk_score: Optional[float] = None


@router.post("/suitability/predict")
def get_suitability(data: SuitabilityInput):
    """
    Predict site suitability using RandomForest model driven by live NASA POWER climate observations.
    Returns:
    - suitability_score (0-100, 1 decimal place)
    - climate_inputs_used (T2M, PRECTOTCORR)
    - feature_contributions
    - confidence (low/medium/high)
    """
    raw_inputs = {
        "elevation_m": data.elevation_m or 6.0,
        "soil_org_c_t_ha": data.soil_org_c_t_ha or 52.0,
        "tidal_range_m": data.tidal_range_m or 2.1,
        "salinity_ppt": data.salinity_ppt or 29.0,
        "water_depth_m": data.water_depth_m or 1.1,
        "flood_frequency_score": data.flood_frequency_score or 0.45,
        "pop_density_per_km2": data.pop_density_per_km2 or 220.0,
        "cyclone_exposure_score": data.cyclone_exposure_score or 0.35,
        "sea_level_rise_risk_score": data.sea_level_rise_risk_score or 0.50
    }

    result = assess_site_suitability(
        lat=data.lat,
        lon=data.lon,
        raw_inputs=raw_inputs
    )

    return {
        "input_location": {
            "lat": data.lat,
            "lon": data.lon,
            "area": data.area
        },
        "suitability_score": result["suitability_score"],
        "climate_inputs_used": result["climate_inputs_used"],
        "confidence": result["confidence"],
        "confidence_description": result["confidence_description"],
        "feature_contributions": result["feature_contributions"],
        "model": result["model"],
        "precision_note": result["precision_note"]
    }