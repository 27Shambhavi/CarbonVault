"""
Backend/tests/test_phase4_ml.py
Unit and integration tests for Phase 4 Machine Learning models:
- M1: IsolationForest anomaly detection + fused risk
- M2: Robust NDVI monitoring + DOY seasonal baseline + greenness decline alerts
- M3: Live climate-driven site suitability + tree feature contributions + confidence
- M4: ExponentialSmoothing price forecasting + prediction interval
- M5: Multi-orientation perceptual image hashing (phash)
"""

import sys
import os
import pytest
import numpy as np
from datetime import datetime, date, timedelta
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    Project, SatelliteObservation, PriceHistory, PhotoHash, MLAssessment
)
from ml.anomaly import run_anomaly_detection
from ml.ndvi_monitor import run_ndvi_monitor, compute_doy_baseline_and_zscores, Z_DECLINE_THRESHOLD
from ml.suitability import assess_site_suitability
from ml.forecast import generate_price_forecast
from ml.phash import compute_all_orientation_hashes, compare_hash_variant_distances, screen_and_store_photo

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_m1_anomaly_detection():
    db = SessionLocal()
    try:
        # Check an existing project
        proj = db.query(Project).first()
        assert proj is not None

        res = run_anomaly_detection(proj.project_id, db)
        assert res["project_id"] == proj.project_id
        assert "anomaly_score" in res
        assert 0.0 <= res["anomaly_score"] <= 100.0
        assert "fused_risk" in res
        assert "top_reasons" in res
        assert len(res["top_reasons"]) >= 1
        assert res["label"] == "unusual vs. peers, not proof of fraud"
        assert res["confidence"] in ("low", "medium", "high")

        # Check persistence in ml_assessments table
        row = db.query(MLAssessment).filter(
            MLAssessment.project_id == proj.project_id,
            MLAssessment.model == "anomaly"
        ).order_by(MLAssessment.id.desc()).first()
        assert row is not None
        assert row.score == res["anomaly_score"]
    finally:
        db.close()


def test_m2_ndvi_monitor_baseline_and_alert():
    db = SessionLocal()
    try:
        test_pid = "PRJ-TEST-DECLINE-ALERT"
        p = db.query(Project).filter(Project.project_id == test_pid).first()
        if not p:
            p = Project(
                project_id=test_pid,
                name="Test Decline Plantation",
                plantation_type="reforestation",
                area_hectares=10.0,
                status="approved",
                is_synthetic=True,
                created_at=datetime.utcnow()
            )
            db.add(p)
            db.commit()
        else:
            db.query(SatelliteObservation).filter(SatelliteObservation.project_id == test_pid).delete()
            db.commit()

        # Seed series of 8 observations with a sharp drop in the last two
        obs_dates = [
            date(2024, 6, 4),
            date(2024, 6, 20),
            date(2025, 4, 1),
            date(2025, 4, 17),
            date(2025, 5, 3),
            date(2025, 5, 19),
            date(2025, 6, 4),
            date(2025, 6, 20)
        ]
        # Normal historical baseline ~0.76, sudden drop to 0.35 in 2025 (strong decline)
        vals = [0.77, 0.78, 0.76, 0.75, 0.74, 0.75, 0.35, 0.32]

        for d, v in zip(obs_dates, vals):
            rec = SatelliteObservation(
                project_id=test_pid,
                source="MODIS MOD13Q1 via ORNL DAAC",
                band="250m_16_days_NDVI",
                obs_date=d,
                value=v,
                fetched_at=datetime.utcnow()
            )
            db.add(rec)
        db.commit()

        res = run_ndvi_monitor(test_pid, db)
        assert res["project_id"] == test_pid
        assert "series" in res
        assert len(res["series"]) >= 6
        assert "resolution_caveat" in res
        assert "250 m" in res["resolution_caveat"]
        assert "latest_z_score" in res

        # Verify baseline band calculations
        pt = res["series"][-1]
        assert "baseline_median" in pt
        assert "band_upper" in pt
        assert "band_lower" in pt
        assert pt["band_upper"] >= pt["baseline_median"] >= pt["band_lower"]

        # Drop should trigger decline condition
        assert res["consecutive_drops"] >= 1
    finally:
        db.close()


def test_m3_site_suitability_with_climate_and_contributions():
    # Test assess_site_suitability function
    res = assess_site_suitability(
        lat=13.0827,
        lon=80.2707,
        raw_inputs={"elevation_m": 4.5, "soil_org_c_t_ha": 48.0}
    )
    assert "suitability_score" in res
    assert 0.0 <= res["suitability_score"] <= 100.0
    # Precision: 1 decimal place
    assert round(res["suitability_score"], 1) == res["suitability_score"]

    assert "climate_inputs_used" in res
    assert "mean_temp_C" in res["climate_inputs_used"]
    assert "annual_precip_mm" in res["climate_inputs_used"]
    assert "feature_contributions" in res
    assert len(res["feature_contributions"]) >= 5
    assert res["confidence"] in ("low", "medium", "high")

    # Test HTTP endpoint
    api_resp = client.post("/suitability/predict", json={
        "lat": 13.08,
        "lon": 80.27,
        "area": 25.0
    })
    assert api_resp.status_code == 200
    api_data = api_resp.json()
    assert "suitability_score" in api_data
    assert "feature_contributions" in api_data
    assert "climate_inputs_used" in api_data


def test_m4_forecast_linear_and_exponential_smoothing():
    db = SessionLocal()
    try:
        # Clear or inspect existing price history
        res_linear = generate_price_forecast(db, horizon_days=7)
        assert res_linear["horizon_days"] == 7
        assert len(res_linear["forecast"]) == 7
        assert "predicted_price" in res_linear["forecast"][0]
        assert "lower_bound" in res_linear["forecast"][0]
        assert "upper_bound" in res_linear["forecast"][0]
        # Upper bound must be greater than or equal to lower bound
        assert res_linear["forecast"][0]["upper_bound"] >= res_linear["forecast"][0]["lower_bound"]

        # Seed 32 synthetic price points to test ExponentialSmoothing branch
        now = datetime.utcnow()
        for i in range(35):
            ph = PriceHistory(
                base_price=28.0 + (i * 0.1),
                m_demand=1.0 + (i % 5) * 0.02,
                m_supply=1.0,
                m_living=1.05,
                effective_usd=29.4 + (i * 0.12),
                source="test_series",
                ts=now - timedelta(days=35 - i)
            )
            db.add(ph)
        db.commit()

        res_es = generate_price_forecast(db, horizon_days=7)
        assert res_es["historical_points"] >= 35
        assert res_es["model"] == "ExponentialSmoothing"
        assert len(res_es["forecast"]) == 7

        # Test HTTP endpoint
        resp = client.get("/pricing/forecast?horizon_days=7")
        assert resp.status_code == 200
        forecast_data = resp.json()
        assert len(forecast_data["forecast"]) == 7
    finally:
        db.close()


def test_m5_phash_flip_and_rotation_invariance():
    import random
    salt = random.randint(20, 220)
    # Create test image with distinct colored block
    arr = np.zeros((80, 80, 3), dtype=np.uint8)
    arr[10:40, 10:40] = [salt, (salt * 3) % 250, (salt * 7) % 250]
    img = Image.fromarray(arr)

    # 1. Compute multi-orientation hashes
    hashes = compute_all_orientation_hashes(img)
    assert "original" in hashes
    assert "hflip" in hashes
    assert "rot90" in hashes

    # 2. Test horizontal flip match
    flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
    flipped_hashes = compute_all_orientation_hashes(flipped)

    stored_cand = {
        "hash_original": hashes["original"],
        "hash_hflip": hashes["hflip"],
        "hash_rot90": hashes["rot90"]
    }

    # Minimum hamming distance against stored candidate must be 0 for flipped image!
    min_dist, mtype = compare_hash_variant_distances(flipped_hashes, stored_cand)
    assert min_dist == 0
    assert "transform" in mtype or "exact" in mtype

    # 3. Test 90-degree rotation match
    rotated = img.rotate(90, expand=True)
    rotated_hashes = compute_all_orientation_hashes(rotated)
    rot_dist, _ = compare_hash_variant_distances(rotated_hashes, stored_cand)
    assert rot_dist == 0

    # 4. Test duplicate screening database flow
    db = SessionLocal()
    try:
        db.query(PhotoHash).filter(PhotoHash.project_id.in_(["PRJ-UNIT-1", "PRJ-UNIT-2"])).delete()
        db.commit()

        import io
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw_bytes = buf.getvalue()

        # Upload for project 1
        res1 = screen_and_store_photo(raw_bytes, "plot_evidence_1.png", "PRJ-UNIT-1", db)
        assert res1["is_duplicate"] is False

        # Upload flipped version for project 2 (attempted flip exploit)
        buf_flip = io.BytesIO()
        flipped.save(buf_flip, format="PNG")
        res2 = screen_and_store_photo(buf_flip.getvalue(), "plot_evidence_2.png", "PRJ-UNIT-2", db)
        # Should be flagged duplicate!
        assert res2["is_duplicate"] is True
        assert res2["min_hamming_distance"] == 0
        assert res2["match_details"]["matched_project_id"] == "PRJ-UNIT-1"
    finally:
        db.close()


def test_consolidated_ml_assessment_endpoint():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None

        resp = client.get(f"/projects/{proj.project_id}/ml-assessment")
        assert resp.status_code == 200
        data = resp.json()
        assert "anomaly" in data
        assert "ndvi_monitor" in data
        assert "photo_screening" in data
        assert data["anomaly"]["model"] == "IsolationForest"
        assert "fused_risk" in data["anomaly"]
    finally:
        db.close()
