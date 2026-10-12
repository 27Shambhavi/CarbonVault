"""
Backend/ml/ndvi_monitor.py
M2: Robust NDVI Monitoring & Greenness Decline Detection.
Specification:
- Baseline: Median NDVI by Day-of-Year (DOY) over earlier years with Median Absolute Deviation (MAD).
- Robust z-score: robust_z = (observed - median_doy) / max(0.02, 1.4826 * mad_doy)
- Raise `greenness.decline` event when z < -2.0 for two consecutive observations.
- Configurable thresholds stored in module / config table.
- Stores output in `ml_assessments` table.
- Resolution caveat: "MODIS 250 m resolution caveat: values represent mixed canopy averages within a 250m ground pixel."
"""

import json
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional

import numpy as np
from sqlalchemy.orm import Session

from credit_calculation.credits_module.db_models import SatelliteObservation, MLAssessment

logger = logging.getLogger("carbonvault.ml.ndvi_monitor")

# Configurable domain thresholds (cite source: robust statistical anomaly detection)
Z_DECLINE_THRESHOLD = -2.0       # 2 standard deviations below seasonal median (robust z)
CONSECUTIVE_DROPS_ALERT = 2      # Alert raised only after 2 consecutive 16-day composites drop
RESOLUTION_CAVEAT = (
    "MODIS 250 m resolution caveat: Observations reflect aggregated surface reflectance "
    "across a 250 m ground sampling pixel (6.25 hectares) and may include mixed understory canopy."
)


def compute_doy_baseline_and_zscores(
    observations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Compute seasonal Day-of-Year median baseline and robust MAD z-scores for an observation series.
    Each item in observations must have 'obs_date' (YYYY-MM-DD or date object) and 'value' (float).
    """
    if not observations:
        return []

    parsed_obs = []
    for o in observations:
        d = o["obs_date"]
        if isinstance(d, str):
            dt = datetime.strptime(d[:10], "%Y-%m-%d").date()
        else:
            dt = d
        val = float(o["value"])
        doy = dt.timetuple().tm_yday
        parsed_obs.append({"date": dt, "date_str": dt.strftime("%Y-%m-%d"), "doy": doy, "value": val})

    parsed_obs.sort(key=lambda x: x["date"])

    all_values = [o["value"] for o in parsed_obs]
    global_median = float(np.median(all_values))
    global_mad = float(np.median(np.abs(np.array(all_values) - global_median)))
    global_sigma = max(0.03, 1.4826 * global_mad)

    results = []
    # For each observation, calculate baseline from earlier years in ±25 day DOY window
    for target in parsed_obs:
        t_doy = target["doy"]
        t_year = target["date"].year

        # 1. Baseline over earlier years within ±25 DOY window
        peer_vals = []
        for other in parsed_obs:
            if other["date"].year < t_year:
                diff = abs(other["doy"] - t_doy)
                if diff > 182:
                    diff = 365 - diff
                if diff <= 25:
                    peer_vals.append(other["value"])

        if len(peer_vals) >= 2:
            median_doy = float(np.median(peer_vals))
            abs_devs = np.abs(np.array(peer_vals) - median_doy)
            mad = float(np.median(abs_devs))
            robust_sigma = max(0.025, 1.4826 * mad)
        else:
            # Fallback when no earlier year data: baseline from prior observations in series
            prior_vals = [o["value"] for o in parsed_obs if o["date"] < target["date"]]
            if len(prior_vals) >= 2:
                median_doy = float(np.median(prior_vals))
                abs_devs = np.abs(np.array(prior_vals) - median_doy)
                mad = float(np.median(abs_devs))
                robust_sigma = max(0.025, 1.4826 * mad)
            else:
                median_doy = target["value"]
                robust_sigma = global_sigma

        z_score = (target["value"] - median_doy) / robust_sigma
        upper_band = round(median_doy + 2.0 * robust_sigma, 4)
        lower_band = round(median_doy - 2.0 * robust_sigma, 4)

        results.append({
            "obs_date": target["date_str"],
            "observed_ndvi": round(target["value"], 4),
            "baseline_median": round(median_doy, 4),
            "band_upper": upper_band,
            "band_lower": lower_band,
            "robust_z": round(float(z_score), 2)
        })

    return results


def run_ndvi_monitor(project_id: str, db: Session) -> Dict[str, Any]:
    """
    Run M2 NDVI monitor model on stored satellite observations for project.
    Detects persistent greenness decline and dispatches `greenness.decline` event if triggered.
    """
    rows = db.query(SatelliteObservation).filter(
        SatelliteObservation.project_id == project_id,
        SatelliteObservation.band == "250m_16_days_NDVI"
    ).order_by(SatelliteObservation.obs_date.asc()).all()

    if not rows:
        return {
            "project_id": project_id,
            "model": "ndvi_monitor",
            "status": "data unavailable",
            "message": "No stored satellite observations found for this project",
            "resolution_caveat": RESOLUTION_CAVEAT
        }

    raw_series = [{"obs_date": r.obs_date, "value": r.value} for r in rows]
    series_with_baseline = compute_doy_baseline_and_zscores(raw_series)

    # Check decline condition over the last observations
    consecutive_declines = 0
    for pt in reversed(series_with_baseline):
        if pt["robust_z"] < Z_DECLINE_THRESHOLD:
            consecutive_declines += 1
        else:
            break

    alert_active = consecutive_declines >= CONSECUTIVE_DROPS_ALERT
    latest_pt = series_with_baseline[-1] if series_with_baseline else None
    latest_z = latest_pt["robust_z"] if latest_pt else 0.0

    # If greenness decline alert triggered, publish real-time SSE event
    if alert_active:
        try:
            from core.events import publish
            publish(
                "greenness.decline",
                {
                    "project_id": project_id,
                    "consecutive_drops": consecutive_declines,
                    "latest_z": latest_z,
                    "latest_ndvi": latest_pt["observed_ndvi"] if latest_pt else None,
                    "baseline_median": latest_pt["baseline_median"] if latest_pt else None,
                    "message": f"Project {project_id} exhibits vegetative decline (z={latest_z} for {consecutive_declines} consecutive composites)."
                },
                audience="role:admin"
            )
            logger.warning("Raised 'greenness.decline' event for project %s (z=%.2f)", project_id, latest_z)
        except Exception as pe:
            logger.warning("Could not publish greenness.decline event: %s", pe)

    # Persist in ml_assessments table
    now_utc = datetime.utcnow()
    try:
        score_val = round(float(np.clip((latest_z + 3.0) / 6.0 * 100.0, 0.0, 100.0)), 1)
        reason_summary = {
            "latest_z": latest_z,
            "consecutive_drops": consecutive_declines,
            "alert_active": alert_active,
            "threshold_z": Z_DECLINE_THRESHOLD,
            "composites_monitored": len(series_with_baseline)
        }
        assessment_row = MLAssessment(
            project_id=project_id,
            model="ndvi_monitor",
            score=score_val,
            reasons=json.dumps(reason_summary),
            confidence="high" if len(series_with_baseline) >= 12 else "medium",
            model_version="1.0.0",
            created_at=now_utc
        )
        db.add(assessment_row)
        db.commit()
    except Exception as dbe:
        db.rollback()
        logger.warning("Could not persist ndvi_monitor assessment: %s", dbe)

    return {
        "project_id": project_id,
        "model": "ndvi_monitor",
        "model_version": "1.0.0",
        "status": "alert" if alert_active else "normal",
        "decline_alert_active": alert_active,
        "consecutive_drops": consecutive_declines,
        "latest_z_score": latest_z,
        "series": series_with_baseline,
        "resolution_caveat": RESOLUTION_CAVEAT,
        "created_at": now_utc.isoformat() + "Z"
    }
