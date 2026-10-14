"""
Backend/services/climate.py
Real climate integration via NASA POWER (Prediction Of Worldwide Energy Resources) API.
Specification:
- Community: AG (Agroclimatology, public, no API key required)
- Parameters:
    T2M: Temperature at 2 Meters (°C)
    PRECTOTCORR: Precipitation Corrected (mm/day)
    RH2M: Relative Humidity at 2 Meters (%)
- Endpoint:
    https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,RH2M&community=AG&longitude=<lon>&latitude=<lat>&start=<YYYYMMDD>&end=<YYYYMMDD>&format=JSON
- Caching: Persisted in `climate_observations` table in PostgreSQL / SQLite.
- Ground Rule: If external call fails, store nothing and report data unavailable. Never invent curves.
"""

import logging
import time
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

import httpx
from sqlalchemy.orm import Session

from credit_calculation.credits_module.db_models import ClimateObservation, Project

logger = logging.getLogger("carbonvault.climate")

USER_AGENT = "CarbonVault/1.0 (ClimateMonitoring Research; contact@carbonvault.com)"
NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/daily/point"
ATTRIBUTION = "Data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program (Agroclimatology daily observations)."


def fetch_nasa_power_climate(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
    timeout_s: float = 18.0
) -> Dict[str, Any]:
    """Fetch daily temperature, precipitation, and relative humidity from NASA POWER API."""
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    params = {
        "parameters": "T2M,PRECTOTCORR,RH2M",
        "community": "AG",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "start": start_str,
        "end": end_str,
        "format": "JSON"
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    try:
        from core.ssrf_guard import safe_request
        resp = safe_request("GET", NASA_POWER_BASE, params=params, headers=headers, timeout=timeout_s, max_retries=2)
        if resp.status_code == 200:
            data = resp.json()
            props = data.get("properties", {})
            return props.get("parameter", {})
        logger.warning("NASA POWER API returned %d", resp.status_code)
    except Exception as e:
        logger.warning("NASA POWER API request failed: %s", e)
    return {}


def sync_project_climate(project_id: str, db: Session, days: int = 90) -> int:
    """
    Fetch and persist real daily climate observations for the past `days` days.
    Stores rows in `climate_observations` table.
    Returns count of newly inserted observations.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project or project.latitude is None or project.longitude is None:
        logger.warning("Project %s has no coordinates for climate sync", project_id)
        return 0

    lat = float(project.latitude)
    lon = float(project.longitude)

    # NASA POWER daily data typically lags by ~2 to 3 days
    end_dt = datetime.utcnow().date() - timedelta(days=2)
    start_dt = end_dt - timedelta(days=days)

    # Check existing observation dates in DB
    existing_rows = db.query(ClimateObservation).filter(
        ClimateObservation.project_id == project_id,
        ClimateObservation.obs_date >= start_dt,
        ClimateObservation.obs_date <= end_dt
    ).all()
    existing_dates = {r.obs_date.strftime("%Y-%m-%d") for r in existing_rows}

    # If already have majority of days, skip redundant remote fetch
    if len(existing_dates) >= (days - 10):
        logger.info("Project %s climate data already up to date (%d days cached)", project_id, len(existing_dates))
        return 0

    raw_params = fetch_nasa_power_climate(lat, lon, start_dt, end_dt)
    if not raw_params:
        logger.warning("No climate data returned from NASA POWER for project %s", project_id)
        return 0

    t2m_map = raw_params.get("T2M", {})
    rain_map = raw_params.get("PRECTOTCORR", {})
    rh_map = raw_params.get("RH2M", {})

    inserted_count = 0
    now_utc = datetime.utcnow()

    # Iterate through dates
    all_keys = sorted(set(list(t2m_map.keys()) + list(rain_map.keys()) + list(rh_map.keys())))
    for k in all_keys:
        try:
            obs_d = datetime.strptime(k, "%Y%m%d").date()
            d_str = obs_d.strftime("%Y-%m-%d")
            if d_str in existing_dates:
                continue

            t_val = t2m_map.get(k)
            r_val = rain_map.get(k)
            rh_val = rh_map.get(k)

            # NASA POWER uses -999.0 for missing data
            clean_t = float(t_val) if t_val is not None and t_val > -900 else None
            clean_r = float(r_val) if r_val is not None and r_val > -900 else None
            clean_rh = float(rh_val) if rh_val is not None and rh_val > -900 else None

            if clean_t is not None or clean_r is not None or clean_rh is not None:
                new_row = ClimateObservation(
                    project_id=project_id,
                    obs_date=obs_d,
                    t2m=clean_t,
                    prectotcorr=clean_r,
                    rh2m=clean_rh,
                    fetched_at=now_utc
                )
                db.add(new_row)
                existing_dates.add(d_str)
                inserted_count += 1
        except Exception as err:
            logger.warning("Error parsing climate record %s: %s", k, err)

    db.commit()
    logger.info("Successfully persisted %d daily climate observations for %s", inserted_count, project_id)
    return inserted_count


def get_project_climate_series(project_id: str, db: Session, days: int = 90) -> Dict[str, Any]:
    """
    Retrieve stored climate observations for project.
    If database contains none, triggers live sync from NASA POWER.
    """
    cutoff_d = datetime.utcnow().date() - timedelta(days=days + 10)
    rows = db.query(ClimateObservation).filter(
        ClimateObservation.project_id == project_id,
        ClimateObservation.obs_date >= cutoff_d
    ).order_by(ClimateObservation.obs_date.asc()).all()

    if not rows:
        sync_project_climate(project_id, db, days=days)
        rows = db.query(ClimateObservation).filter(
            ClimateObservation.project_id == project_id,
            ClimateObservation.obs_date >= cutoff_d
        ).order_by(ClimateObservation.obs_date.asc()).all()

    if not rows:
        return {
            "project_id": project_id,
            "source": "NASA POWER Agroclimatology",
            "observations": [],
            "status": "data unavailable",
            "message": "No climate data observed for this project coordinates yet.",
            "attribution": ATTRIBUTION
        }

    obs_list = [
        {
            "obs_date": r.obs_date.strftime("%Y-%m-%d"),
            "temperature_c": round(r.t2m, 2) if r.t2m is not None else None,
            "precipitation_mm": round(r.prectotcorr, 2) if r.prectotcorr is not None else None,
            "relative_humidity_pct": round(r.rh2m, 1) if r.rh2m is not None else None,
            "source": "NASA POWER Daily",
            "fetched_at": r.fetched_at.isoformat() + "Z" if r.fetched_at else None
        }
        for r in rows
    ]

    valid_temps = [o["temperature_c"] for o in obs_list if o["temperature_c"] is not None]
    valid_rains = [o["precipitation_mm"] for o in obs_list if o["precipitation_mm"] is not None]
    valid_rhs = [o["relative_humidity_pct"] for o in obs_list if o["relative_humidity_pct"] is not None]

    mean_temp = round(sum(valid_temps) / len(valid_temps), 2) if valid_temps else None
    total_rain = round(sum(valid_rains), 1) if valid_rains else None
    mean_rh = round(sum(valid_rhs) / len(valid_rhs), 1) if valid_rhs else None

    return {
        "project_id": project_id,
        "source": "NASA POWER Agroclimatology",
        "attribution": ATTRIBUTION,
        "status": "available",
        "count": len(obs_list),
        "climatology_summary": {
            "mean_temperature_c": mean_temp,
            "total_precipitation_mm": total_rain,
            "mean_relative_humidity_pct": mean_rh,
            "period_days": len(obs_list)
        },
        "latest": obs_list[-1] if obs_list else None,
        "observations": obs_list
    }
