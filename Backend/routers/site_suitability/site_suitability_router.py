print("Loading site suitability file...")
from fastapi import APIRouter
from pydantic import BaseModel

from .app.ml_model import predict_suitability

router = APIRouter()


class SuitabilityInput(BaseModel):
    lat: float
    lon: float
    area: float


@router.post("/suitability/predict")
def get_suitability(data: SuitabilityInput):

    # 🚨 TEMP: Convert basic input → ML features
    features = {
        "elevation_m": 5,
        "mean_temp_C": 28,
        "annual_precip_mm": 1200,
        "ndvi_mean": 0.6,
        "soil_org_c_t_ha": 50,
        "tidal_range_m": 2,
        "salinity_ppt": 30,
        "water_depth_m": 1,
        "flood_frequency_score": 0.5,
        "pop_density_per_km2": 300,
        "cyclone_exposure_score": 0.4,
        "sea_level_rise_risk_score": 0.6
    }

    result = predict_suitability(features)

    return {
        "input_location": {
            "lat": data.lat,
            "lon": data.lon,
            "area": data.area
        },
        "suitability_score": result
    }


print("Site suitability router loaded")