"""
Backend/services/satellite.py
Real MODIS NDVI satellite integration via ORNL DAAC Web Service.
Specification:
- Product: MOD13Q1 (Terra, 250 m, 16-day composites)
- Band: 250m_16_days_NDVI (Scale factor: 0.0001)
- Endpoints:
    Dates: https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=<lat>&longitude=<lon>
    Subset: https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=<lat>&longitude=<lon>&startDate=<start>&endDate=<end>&kmAboveBelow=0&kmLeftRight=0
- Caching: Persisted in `satellite_observations` table in PostgreSQL / SQLite.
- Ground Rule: If external call fails, store nothing and report data unavailable. Never invent curves.
"""

import logging
import time
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

import httpx
from sqlalchemy.orm import Session

from credit_calculation.credits_module.db_models import SatelliteObservation, Project

logger = logging.getLogger("carbonvault.satellite")

USER_AGENT = "CarbonVault/1.0 (EarthObservation Research; contact@carbonvault.com)"
ORNL_BASE = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
BAND_NAME = "250m_16_days_NDVI"
SCALE_FACTOR = 0.0001
ATTRIBUTION = "MODIS data courtesy of NASA EOSDIS Land Processes DAAC via ORNL DAAC Web Service (MOD13Q1, 250m 16-day composites)."


def fetch_modis_dates(lat: float, lon: float, timeout_s: float = 12.0) -> List[Dict[str, str]]:
    """Fetch valid calendar and modis dates for specific coordinates from ORNL DAAC."""
    url = f"{ORNL_BASE}/dates"
    params = {"latitude": f"{lat:.4f}", "longitude": f"{lon:.4f}"}
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    try:
        from core.ssrf_guard import safe_request
        resp = safe_request("GET", url, params=params, headers=headers, timeout=timeout_s, max_retries=2)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("dates", [])
        logger.warning("ORNL DAAC dates returned %d", resp.status_code)
    except Exception as e:
        logger.warning("ORNL DAAC dates request failed: %s", e)
    return []


def fetch_modis_subset_batch(
    lat: float,
    lon: float,
    start_modis: str,
    end_modis: str,
    timeout_s: float = 18.0
) -> List[Dict[str, Any]]:
    """Fetch 16-day composite subset for a valid modis date range (up to 4-5 dates)."""
    url = f"{ORNL_BASE}/subset"
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "startDate": start_modis,
        "endDate": end_modis,
        "kmAboveBelow": 0,
        "kmLeftRight": 0
    }
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    try:
        from core.ssrf_guard import safe_request
        resp = safe_request("GET", url, params=params, headers=headers, timeout=timeout_s, max_retries=2)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("subset", [])
        logger.warning("ORNL DAAC subset returned %d for range %s..%s", resp.status_code, start_modis, end_modis)
    except Exception as e:
        logger.warning("ORNL DAAC subset request failed for %s..%s: %s", start_modis, end_modis, e)
    return []


def sync_project_ndvi(project_id: str, db: Session, backfill_years: int = 3, max_batches: int = 6) -> int:
    """
    Backfills or syncs MODIS NDVI observations for a project.
    Stores new composites in `satellite_observations` table.
    Returns count of newly inserted observations.
    """
    project = db.query(Project).filter(Project.project_id == project_id).first()
    if not project or project.latitude is None or project.longitude is None:
        logger.warning("Project %s has no coordinates for satellite NDVI sync", project_id)
        return 0

    lat = float(project.latitude)
    lon = float(project.longitude)

    # 1. Fetch available MODIS dates
    valid_dates = fetch_modis_dates(lat, lon)
    if not valid_dates:
        logger.warning("Could not retrieve valid MODIS dates for project %s (%f, %f)", project_id, lat, lon)
        return 0

    # 2. Filter dates for past backfill_years
    cutoff_dt = datetime.utcnow() - timedelta(days=backfill_years * 365)
    cutoff_str = cutoff_dt.strftime("%Y-%m-%d")
    target_dates = [d for d in valid_dates if d.get("calendar_date", "") >= cutoff_str]
    if not target_dates:
        target_dates = valid_dates[-12:]  # Fall back to latest 12 available composites

    # 3. Check existing stored observation dates
    stored_obs = db.query(SatelliteObservation).filter(
        SatelliteObservation.project_id == project_id,
        SatelliteObservation.band == BAND_NAME
    ).all()
    stored_dates = {o.obs_date.strftime("%Y-%m-%d") for o in stored_obs}

    # Identify missing dates
    missing_dates = [d for d in target_dates if d.get("calendar_date") not in stored_dates]
    if not missing_dates:
        logger.info("Project %s satellite NDVI observations are up to date (%d cached)", project_id, len(stored_obs))
        return 0

    logger.info("Syncing %d missing MODIS NDVI composites for project %s in batches of 4...", len(missing_dates), project_id)

    # 4. Fetch missing composites in batches of 4
    batch_size = 4
    inserted_count = 0
    now_utc = datetime.utcnow()

    batches_run = 0
    for i in range(0, len(missing_dates), batch_size):
        if batches_run >= max_batches:
            logger.info("Reached max_batches (%d) for project %s sync", max_batches, project_id)
            break

        chunk = missing_dates[i:i + batch_size]
        start_m = chunk[0]["modis_date"]
        end_m = chunk[-1]["modis_date"]

        subset_items = fetch_modis_subset_batch(lat, lon, start_m, end_m)
        batches_run += 1

        for item in subset_items:
            if item.get("band") == BAND_NAME:
                cal_date_str = item.get("calendar_date")
                raw_values = item.get("data", [])
                if cal_date_str and raw_values and len(raw_values) > 0:
                    raw_val = raw_values[0]
                    # Valid NDVI range is -2000 to 10000; fill value is -3000
                    if raw_val is not None and raw_val > -3000:
                        scaled_val = round(float(raw_val) * SCALE_FACTOR, 4)
                        try:
                            obs_d = datetime.strptime(cal_date_str, "%Y-%m-%d").date()
                            # Verify not duplicate
                            if obs_d.strftime("%Y-%m-%d") not in stored_dates:
                                new_row = SatelliteObservation(
                                    project_id=project_id,
                                    source="MODIS MOD13Q1 via ORNL DAAC",
                                    band=BAND_NAME,
                                    obs_date=obs_d,
                                    value=scaled_val,
                                    fetched_at=now_utc
                                )
                                db.add(new_row)
                                stored_dates.add(obs_d.strftime("%Y-%m-%d"))
                                inserted_count += 1
                        except Exception as parse_err:
                            logger.warning("Error parsing NDVI date %s: %s", cal_date_str, parse_err)

        db.commit()
        # Small courteous delay between remote calls
        time.sleep(0.3)

    logger.info("Successfully persisted %d new MODIS NDVI observations for %s", inserted_count, project_id)
    return inserted_count


def get_project_ndvi_series(project_id: str, db: Session) -> Dict[str, Any]:
    """
    Retrieve stored satellite observations for project.
    If database contains no observations, triggers immediate live sync from ORNL DAAC.
    """
    rows = db.query(SatelliteObservation).filter(
        SatelliteObservation.project_id == project_id,
        SatelliteObservation.band == BAND_NAME
    ).order_by(SatelliteObservation.obs_date.asc()).all()

    if not rows:
        sync_project_ndvi(project_id, db, backfill_years=3, max_batches=6)
        rows = db.query(SatelliteObservation).filter(
            SatelliteObservation.project_id == project_id,
            SatelliteObservation.band == BAND_NAME
        ).order_by(SatelliteObservation.obs_date.asc()).all()

    if not rows:
        return {
            "project_id": project_id,
            "source": "MODIS MOD13Q1 via ORNL DAAC",
            "band": BAND_NAME,
            "observations": [],
            "status": "data unavailable",
            "message": "No satellite data observed for this project coordinates yet.",
            "attribution": ATTRIBUTION
        }

    obs_list = [
        {
            "obs_date": r.obs_date.strftime("%Y-%m-%d"),
            "value": round(r.value, 4),
            "source": r.source,
            "band": r.band,
            "fetched_at": r.fetched_at.isoformat() + "Z" if r.fetched_at else None
        }
        for r in rows
    ]

    mean_val = round(sum(o["value"] for o in obs_list) / len(obs_list), 4) if obs_list else 0.0

    return {
        "project_id": project_id,
        "source": "MODIS MOD13Q1 via ORNL DAAC",
        "band": BAND_NAME,
        "resolution_m": 250,
        "temporal_resolution": "16-day composites",
        "attribution": ATTRIBUTION,
        "status": "available",
        "count": len(obs_list),
        "mean_ndvi": mean_val,
        "latest": obs_list[-1] if obs_list else None,
        "observations": obs_list
    }
