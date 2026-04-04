import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

# Load dataset
df = pd.read_csv("data/blue_carbon_sample.csv")

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

X = df[features]
y = df["suitability_score"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = RandomForestRegressor(n_estimators=100)
model.fit(X_train, y_train)

joblib.dump(model, "model/trained_model.pkl")

print("Model trained and saved.")