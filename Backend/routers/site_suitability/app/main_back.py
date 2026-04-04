# app/main.py

from fastapi import FastAPI
from pydantic import BaseModel
from Backend.services.site_suitability.app.scoring import (
    mangrove_score,
    saltmarsh_score,
    seagrass_score,
    calculate_carbon
)
from Backend.services.site_suitability.app.data_fetcher import fetch_environmental_data

app = FastAPI(title="Blue Carbon Climate Resilience Engine")


class SiteInput(BaseModel):
    latitude: float
    longitude: float


@app.post("/analyze")
def analyze_site(data: SiteInput):

    env_data = fetch_environmental_data(data.latitude, data.longitude)

    # =========================
    # Ecosystem Scoring
    # =========================

    m_score = mangrove_score(env_data)
    s_score = saltmarsh_score(env_data)
    sea_score = seagrass_score(env_data)

    scores = {
        "Mangrove Plantation": m_score,
        "Salt Marsh Restoration": s_score,
        "Seagrass Meadow Restoration": sea_score
    }

    recommended = max(scores, key=scores.get)
    final_score = scores[recommended]

    # =========================
    # Carbon Based on Ecosystem
    # =========================

    carbon = calculate_carbon(
        "mangrove" if "Mangrove" in recommended
        else "salt_marsh" if "Salt" in recommended
        else "seagrass"
    )

    # =========================
    # Inland Warning
    # =========================

    message = None
    if not env_data.get("coastal_flag", False):
        message = "Location is inland. Coastal ecosystems may not be naturally viable."
        final_score *= 0.3

    # =========================
    # Build Clean Response
    # =========================

    response = {
        "Input Coordinates": {
            "Latitude": data.latitude,
            "Longitude": data.longitude
        },
        "Distance to Coast (km)": env_data.get("distance_to_coast_km"),
        "Suitability Score": round(final_score, 2),
        "Plantation Type": recommended,
        "Estimated Carbon (tCO2/ha/year)": carbon,
        "Risk Index": env_data.get("risk_index"),
        "Survival Probability": env_data.get("survival_probability"),
        "Expected Life Span (years)": env_data.get("expected_life_span_years"),
        "Ecosystem Scores": {
            "Mangrove": round(m_score, 2),
            "Salt Marsh": round(s_score, 2),
            "Seagrass": round(sea_score, 2)
        }
    }

    if message:
        response["Message"] = message

    return response