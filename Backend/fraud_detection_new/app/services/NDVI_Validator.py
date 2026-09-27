# app/services/NDVI_Validator.py
"""
NDVI vegetation analysis using Sentinel Hub Process API on CDSE.

Key fixes applied:
  - grant_type changed from 'password' to 'client_credentials'
  - API endpoint changed to sh.dataspace.copernicus.eu
  - Token caching with automatic expiry refresh
  - Proper .env loading via centralised config
"""
import json
import time
import logging
import requests
from datetime import datetime, timedelta
from sqlalchemy import text

from ..config import SH_CLIENT_ID, SH_CLIENT_SECRET, TOKEN_URL, SENTINEL_PROCESS_URL
from ..db.database import SessionLocal

logger = logging.getLogger(__name__)

# ==============================
# TOKEN CACHE
# ==============================

_token_cache: dict = {
    "access_token": None,
    "expires_at": 0.0,       # epoch seconds
}


def get_access_token() -> str:
    """
    Obtain a CDSE access token using OAuth2 **client_credentials** flow.

    Caches the token and reuses it until 5 minutes before expiry.
    Tokens are typically valid for 600 seconds (10 min).
    """
    global _token_cache

    # Return cached token if still valid (with 5-min safety margin)
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 300:
        logger.debug("Reusing cached CDSE token (expires in %.0fs)",
                      _token_cache["expires_at"] - time.time())
        return _token_cache["access_token"]

    if not SH_CLIENT_ID or not SH_CLIENT_SECRET:
        raise ValueError(
            "SH_CLIENT_ID and SH_CLIENT_SECRET must be set in .env. "
            "Create OAuth credentials at https://shapps.dataspace.copernicus.eu/dashboard/ "
            "-> User Settings -> OAuth Clients."
        )

    logger.info("Requesting new CDSE access token …")

    response = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": SH_CLIENT_ID,
            "client_secret": SH_CLIENT_SECRET,
        },
        timeout=30,
    )

    if response.status_code != 200:
        logger.error("CDSE auth failed [%s]: %s", response.status_code, response.text)
        raise Exception(
            f"CDSE authentication failed (HTTP {response.status_code}): {response.text}"
        )

    data = response.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = time.time() + data.get("expires_in", 600)

    logger.info("CDSE token acquired (expires_in=%ss)", data.get("expires_in"))
    return _token_cache["access_token"]


# ==============================
# NDVI TIMESERIES (POLYGON)
# ==============================

def fetch_ndvi_timeseries(project_id: str):
    """Fetch NDVI timeseries from Sentinel-2 L2A for a project polygon."""
    db = SessionLocal()

    try:
        result = db.execute(text("""
            SELECT ST_AsGeoJSON(land)
            FROM projects
            WHERE id = :project_id
        """), {"project_id": project_id}).fetchone()

        if not result:
            raise Exception("Polygon not found for project " + project_id)

        geojson = json.loads(result[0])
        token = get_access_token()

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=90)

        payload = {
            "input": {
                "bounds": {
                    "geometry": geojson
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": start_date.isoformat() + "Z",
                            "to": end_date.isoformat() + "Z"
                        },
                        "maxCloudCoverage": 20
                    }
                }]
            },
            "output": {
                "responses": [{
                    "identifier": "default",
                    "format": {"type": "application/json"}
                }]
            },
            "evalscript": """
            //VERSION=3
            function setup() {
                return {
                    input: ["B04", "B08", "SCL"],
                    output: { bands: 1 }
                };
            }

            function evaluatePixel(sample) {
                if (sample.SCL == 3 || sample.SCL == 8 || sample.SCL == 9 || sample.SCL == 10) {
                    return [0];
                }

                let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
                return [ndvi];
            }
            """
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        logger.info("Sending NDVI request to %s", SENTINEL_PROCESS_URL)
        response = requests.post(SENTINEL_PROCESS_URL, json=payload, headers=headers, timeout=60)

        if response.status_code != 200:
            logger.error("Sentinel Hub error [%s]: %s", response.status_code, response.text[:500])
            raise Exception(f"Sentinel Hub error (HTTP {response.status_code}): {response.text[:300]}")

        data = response.json()

        ndvi_series = []
        for item in data.get("data", []):
            date = item.get("date")
            pixels = item.get("outputs", {}).get("default", [])

            values = [p[0] for row in pixels for p in row if p[0] > 0]

            if values:
                ndvi_series.append({
                    "date": date,
                    "ndvi": round(sum(values) / len(values), 3)
                })

        logger.info("NDVI timeseries: %d data points for project %s", len(ndvi_series), project_id)
        return ndvi_series

    finally:
        db.close()


# ==============================
# SEASONAL NORMALIZATION
# ==============================

def seasonal_normalization(series):
    baseline = {
        1: 0.3, 2: 0.35, 3: 0.4,
        4: 0.45, 5: 0.5, 6: 0.55,
        7: 0.6, 8: 0.6, 9: 0.55,
        10: 0.5, 11: 0.4, 12: 0.35
    }

    normalized = []
    for p in series:
        month = datetime.fromisoformat(p["date"]).month
        base = baseline.get(month, 0.4)
        normalized.append({
            "date": p["date"],
            "normalized_ndvi": round(p["ndvi"] / base, 3)
        })

    return normalized


# ==============================
# RISK SCORING
# ==============================

def compute_ndvi_risk(series):
    if len(series) < 2:
        return 0.5, "Insufficient data"

    change = series[-1]["ndvi"] - series[0]["ndvi"]

    if change < 0:
        return 0.9, "Vegetation declining"
    elif change < 0.1:
        return 0.5, "Weak growth"
    else:
        return 0.1, "Healthy vegetation"


# ==============================
# MAIN FUNCTION
# ==============================

def ndvi_risk_check(project_id: str):
    db = SessionLocal()

    try:
        res = db.execute(text("""
            SELECT plantation_date
            FROM projects
            WHERE id = :id
        """), {"id": project_id}).fetchone()

        if not res:
            return {"error": "Project not found"}

        plantation_date = res[0]
        days = (datetime.utcnow().date() - plantation_date).days

        if days < 30:
            return {
                "ndvi_risk": 0.2,
                "message": "Too early to evaluate",
                "days_since": days
            }

        series = fetch_ndvi_timeseries(project_id)

        if not series:
            return {"ndvi_risk": 0.8, "message": "No NDVI data"}

        normalized = seasonal_normalization(series)
        risk, message = compute_ndvi_risk(series)

        latest = series[-1]

        db.execute(text("""
            INSERT INTO ndvi_records
            (id, project_id, observation_date, avg_ndvi, created_at)
            VALUES (gen_random_uuid(), :pid, :date, :ndvi, NOW())
        """), {
            "pid": project_id,
            "date": latest["date"],
            "ndvi": latest["ndvi"]
        })

        db.commit()

        return {
            "project_id": project_id,
            "days_since_plantation": days,
            "ndvi_timeseries": series,
            "normalized_ndvi": normalized,
            "ndvi_risk": risk,
            "message": message
        }

    except Exception as e:
        db.rollback()
        logger.exception("NDVI check failed for project %s", project_id)
        return {"error": str(e)}

    finally:
        db.close()