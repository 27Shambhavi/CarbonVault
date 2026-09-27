import os
import logging
from pathlib import Path
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "data" / "blue_carbon_sample.csv"
MODEL_PATH = BASE_DIR / "model" / "trained_model.pkl"

features = [
    "elevation_m",
    "mean_temp_C",
    "annual_precip_mm",
    "ndvi_mean",
    "soil_org_c_t_ha",
    "tidal_range_m",
    "salinity_ppt",
    "water_depth_m",
    "flood_frequency_score",
    "pop_density_per_km2",
    "cyclone_exposure_score",
    "sea_level_rise_risk_score"
]


def train_and_save():
    if not CSV_PATH.exists():
        logger.error("Dataset not found at %s", CSV_PATH)
        return None

    df = pd.read_csv(CSV_PATH)
    X = df[features]
    y = df["suitability_score"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    logger.info("Model successfully trained and saved to %s", MODEL_PATH)
    return model


if __name__ == "__main__":
    train_and_save()
    print("Model trained and saved to:", MODEL_PATH)