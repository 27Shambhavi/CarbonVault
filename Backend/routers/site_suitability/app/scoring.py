# app/scoring.py

def clamp(value):
    return max(0, min(1, value))


def normalize(value, ideal, tolerance):
    return clamp(1 - abs(value - ideal) / tolerance)


# 🌴 Mangrove
def mangrove_score(d):
    score = (
        normalize(d["mean_temp_C"], 28, 15) * 0.15 +
        min(d["annual_precip_mm"] / 3000, 1) * 0.1 +
        normalize(d["salinity_ppt"], 28, 15) * 0.15 +
        clamp(1 - d["water_depth_m"] / 2) * 0.15 +
        clamp(1 - d["elevation_m"] / 3) * 0.1 +
        d["ndvi_mean"] * 0.15 +
        clamp(d["tidal_range_m"] / 3) * 0.1 +
        clamp(1 - d["pop_density_per_km2"] / 10000) * 0.1
    )
    return score * 100


# 🌾 Salt Marsh
def saltmarsh_score(d):
    score = (
        normalize(d["mean_temp_C"], 18, 15) * 0.15 +
        min(d["annual_precip_mm"] / 2000, 1) * 0.1 +
        normalize(d["salinity_ppt"], 25, 15) * 0.1 +
        clamp(1 - d["water_depth_m"] / 1.5) * 0.15 +
        min(d["soil_org_c_t_ha"] / 100, 1) * 0.15 +
        d["ndvi_mean"] * 0.15 +
        clamp(d["tidal_range_m"] / 3) * 0.1 +
        clamp(1 - d["pop_density_per_km2"] / 8000) * 0.1
    )
    return score * 100


# 🌊 Seagrass
def seagrass_score(d):
    score = (
        normalize(d["mean_temp_C"], 24, 15) * 0.15 +
        normalize(d["water_depth_m"], 2.5, 3) * 0.25 +
        normalize(d["salinity_ppt"], 32, 15) * 0.15 +
        clamp(1 - d["pop_density_per_km2"] / 5000) * 0.15 +
        clamp(1 - d["risk_index"]) * 0.2 +   # ✅ USE NEW REAL RISK
        clamp(1 - d["tidal_range_m"] / 4) * 0.1
    )
    return score * 100


# ⚠ Final Risk Index (Already computed in data_fetcher)
def risk_index(d):
    return d["risk_index"]


# 🌱 Carbon
def calculate_carbon(ecosystem):
    if ecosystem == "mangrove":
        return 10
    elif ecosystem == "salt_marsh":
        return 7
    else:
        return 8