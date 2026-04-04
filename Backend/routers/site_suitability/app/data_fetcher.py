import ee
import math

PROJECT_ID = "blue-carbon-engine"

try:
    ee.Initialize(project=PROJECT_ID)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=PROJECT_ID)


def safe_get_info(obj, default_value):
    try:
        value = obj.getInfo()
        return value if value is not None else default_value
    except Exception:
        return default_value


def fetch_environmental_data(lat, lon):

    try:
        point = ee.Geometry.Point([lon, lat])

        # =====================================================
        # 1️⃣ CORRECT DISTANCE TO COAST (RASTER-BASED)
        # =====================================================

        water = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")

        # Permanent water mask (>= 90% water)
        permanent_water = water.gte(90)

        # Compute pixel-based distance (meters)
        distance_image = permanent_water.Not() \
            .fastDistanceTransform(1000) \
            .sqrt() \
            .multiply(30)

        distance_sample = distance_image.sample(point, 30).first()

        if distance_sample:
            distance_m = safe_get_info(
                distance_sample.get(distance_image.bandNames().get(0)),
                999999
            )
        else:
            distance_m = 999999

        distance_km = distance_m / 1000
        coastal_flag = distance_km < 20

        # =====================================================
        # 2️⃣ REAL ELEVATION (SRTM)
        # =====================================================

        elevation_img = ee.Image("USGS/SRTMGL1_003")
        elevation_sample = elevation_img.sample(point, 30).first()

        elevation = (
            safe_get_info(elevation_sample.get("elevation"), 0)
            if elevation_sample else 0
        )

        # =====================================================
        # 3️⃣ REAL NDVI (Sentinel-2)
        # =====================================================

        s2 = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(point)
            .filterDate("2023-01-01", "2023-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            .median()
        )

        ndvi = s2.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ndvi_sample = ndvi.sample(point, 10).first()

        ndvi_value = (
            safe_get_info(ndvi_sample.get("NDVI"), 0.3)
            if ndvi_sample else 0.3
        )

        # =====================================================
        # 4️⃣ REAL CYCLONE RISK (IBTrACS)
        # =====================================================

        try:
            cyclones = (
                ee.FeatureCollection("NOAA/IBTrACS")
                .filterDate("2000-01-01", "2023-12-31")
            )

            buffer = point.buffer(100000)  # 100 km
            cyclone_count = cyclones.filterBounds(buffer).size()
            cyclone_density = safe_get_info(cyclone_count, 0)

            cyclone_risk = min(cyclone_density / 20, 1)

        except Exception:
            cyclone_risk = 0

        # =====================================================
        # 5️⃣ FLOOD RISK (USE WATER VARIABILITY)
        # =====================================================

        # Use occurrence below 90% to indicate flood-prone zones
        flood_occurrence = (
            safe_get_info(
                water.sample(point, 30).first().get("occurrence"),
                0
            )
            if water.sample(point, 30).first()
            else 0
        )

        flood_risk = min(flood_occurrence / 100, 1)

        # =====================================================
        # 6️⃣ SEA LEVEL RISE EXPOSURE (ELEVATION + COASTAL)
        # =====================================================

        if coastal_flag:
            if elevation < 5:
                slr_risk = 1
            elif elevation < 15:
                slr_risk = 0.6
            else:
                slr_risk = 0.3
        else:
            slr_risk = 0.1

        # =====================================================
        # 7️⃣ FINAL RISK INDEX
        # =====================================================

        risk_index = (
            cyclone_risk * 0.4 +
            flood_risk * 0.3 +
            slr_risk * 0.3
        )

        survival_probability = math.exp(-risk_index * 1.5)
        expected_life_span = 50 * survival_probability

        # =====================================================
        # 8️⃣ Climate Placeholder (Upgrade later to ERA5)
        # =====================================================

        mean_temp = 27 if -23 <= lat <= 23 else 15
        rainfall = 2000 if -23 <= lat <= 23 else 900

        # =====================================================
        # RETURN ALL REQUIRED FIELDS
        # =====================================================

        return {
            "coastal_flag": coastal_flag,
            "distance_to_coast_km": round(distance_km, 2),
            "elevation_m": elevation,
            "mean_temp_C": mean_temp,
            "annual_precip_mm": rainfall,
            "ndvi_mean": ndvi_value,

            # Needed for scoring
            "pop_density_per_km2": 2000,
            "soil_org_c_t_ha": 50,
            "tidal_range_m": 2,
            "salinity_ppt": 30,
            "water_depth_m": 1,

            # Risk outputs
            "risk_index": round(risk_index, 2),
            "survival_probability": round(survival_probability, 2),
            "expected_life_span_years": round(expected_life_span, 1)
        }

    except Exception as e:
        print("Earth Engine Error:", str(e))
        return {
            "coastal_flag": False,
            "distance_to_coast_km": None,
            "elevation_m": 0,
            "mean_temp_C": 0,
            "annual_precip_mm": 0,
            "ndvi_mean": 0,
            "pop_density_per_km2": 0,
            "soil_org_c_t_ha": 0,
            "tidal_range_m": 0,
            "salinity_ppt": 0,
            "water_depth_m": 0,
            "risk_index": 0,
            "survival_probability": 0,
            "expected_life_span_years": 0
        }