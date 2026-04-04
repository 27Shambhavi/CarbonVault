import joblib
import numpy as np
import os

BASE_DIR = os.path.dirname(__file__)
model_path = os.path.join(BASE_DIR, "../model/trained_model.pkl")

model = joblib.load(model_path)


def predict_suitability(data: dict):
    features = np.array([[ 
        data["elevation_m"],
        data["mean_temp_C"],
        data["annual_precip_mm"],
        data["ndvi_mean"],
        data["soil_org_c_t_ha"],
        data["tidal_range_m"],
        data["salinity_ppt"],
        data["water_depth_m"],
        data["flood_frequency_score"],
        data["pop_density_per_km2"],
        data["cyclone_exposure_score"],
        data["sea_level_rise_risk_score"]
    ]])

    score = model.predict(features)[0]
    return round(float(score), 2)