# credits_module/models.py

from pydantic import BaseModel, Field
from typing import Optional


class MLProjectInput(BaseModel):
    project_id: str
    latitude: float
    longitude: float
    area_hectares: float
    plantation_type: str        # bamboo, eucalyptus, teak, neem, mangrove, pine, banyan, mixed
    number_of_trees: int = 0
    polygon_wkt: Optional[str] = None

    # These are computed from plantation_type + area, not user-supplied
    co2_tons_per_acre_per_year: float = 0.0
    survival_probability: float = Field(ge=0, le=1, default=0.8)
    confidence_score: float = Field(ge=0, le=1, default=0.85)
    expected_lifespan_years: int = 25


# ── CO₂ Sequestration Rates per Plantation Type ──────────────────────────────
# Values: tons CO₂ per HECTARE per year (realistic Indian forestry rates)
# Sources: India State of Forest Report, IPCC Guidelines, Verra VCS projects
#
# Indian voluntary carbon credit market: $3-$8 per tonne CO₂
# 1 Carbon Credit = 1 tonne CO₂ sequestered
CO2_RATES = {
    "bamboo":      {"min": 5,  "max": 12, "mid": 9.0,   "lifespan": 30, "survival": 0.88, "confidence": 0.90},
    "eucalyptus":  {"min": 3,  "max": 8,  "mid": 6.0,   "lifespan": 25, "survival": 0.85, "confidence": 0.87},
    "teak":        {"min": 2,  "max": 5,  "mid": 3.5,   "lifespan": 40, "survival": 0.90, "confidence": 0.92},
    "neem":        {"min": 1,  "max": 3,  "mid": 2.0,   "lifespan": 35, "survival": 0.88, "confidence": 0.86},
    "mangrove":    {"min": 5,  "max": 12, "mid": 8.0,   "lifespan": 30, "survival": 0.82, "confidence": 0.88},
    "pine":        {"min": 3,  "max": 6,  "mid": 4.5,   "lifespan": 30, "survival": 0.86, "confidence": 0.85},
    "banyan":      {"min": 1,  "max": 3,  "mid": 2.0,   "lifespan": 50, "survival": 0.92, "confidence": 0.90},
    "mixed":       {"min": 4,  "max": 10, "mid": 7.0,   "lifespan": 30, "survival": 0.85, "confidence": 0.87},
}


def compute_co2_rate(plantation_type: str, area_hectares: float, number_of_trees: int) -> dict:
    """
    Compute the CO₂ sequestration rate based on plantation type, area, and tree count.
    Returns a dict with annual_credits, co2_per_hectare, survival, confidence, lifespan.

    Logic:
    - Use the midpoint CO₂/hectare/year rate for the plantation type
    - Adjust based on tree density (if density is low, reduce rate proportionally)
    - annual_credits = adjusted_rate × area_hectares
    """
    pt = plantation_type.lower().strip()
    rates = CO2_RATES.get(pt, CO2_RATES["mixed"])

    co2_per_hectare = rates["mid"]

    # Adjust rate based on tree density if trees are provided
    # Expected reasonable density: ~400-2500 trees/hectare depending on type
    density_limits = {
        "bamboo": 2500, "eucalyptus": 1600, "teak": 1000,
        "neem": 800, "mangrove": 4000, "pine": 1500,
        "banyan": 200, "mixed": 1200,
    }
    max_density = density_limits.get(pt, 1200)

    density_factor = 1.0
    if number_of_trees > 0 and area_hectares > 0:
        actual_density = number_of_trees / area_hectares
        if actual_density < max_density * 0.3:
            # Very sparse planting — reduce rate
            density_factor = 0.5 + (actual_density / (max_density * 0.3)) * 0.5
        elif actual_density > max_density * 1.5:
            # Over-dense — cap at slightly above mid rate
            density_factor = 1.1
        else:
            # Normal range — scale linearly between 0.8 and 1.2
            ratio = actual_density / max_density
            density_factor = 0.8 + ratio * 0.4
        density_factor = max(0.3, min(1.3, density_factor))

    adjusted_rate = co2_per_hectare * density_factor
    annual_credits = adjusted_rate * area_hectares

    return {
        "co2_per_hectare_per_year": round(adjusted_rate, 2),
        "area_hectares": round(area_hectares, 2),
        "annual_credits": round(annual_credits, 2),
        "survival_probability": rates["survival"],
        "confidence_score": rates["confidence"],
        "expected_lifespan_years": rates["lifespan"],
        "density_factor": round(density_factor, 3),
        "plantation_type": pt,
    }