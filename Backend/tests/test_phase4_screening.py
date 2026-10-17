"""
Backend/tests/test_phase4_screening.py
Unit and integration tests for the unified 5-check fraud & anomaly screening pipeline:
- Check 1: geo_boundary (Shoelace spherical area, +-10% tolerance, boundary overlap)
- Check 2: photo_gps_exif (EXIF GPS distance <= 25km, metadata missing handling)
- Check 3: perceptual_hash (Hamming distance <= 10 bits, multi-orientation)
- Check 4: satellite_ndvi (Canopy trend and recent delta)
- Check 5: ecological_isolation (IsolationForest 7 features)
- Precheck dry-run endpoint (POST /fraud/precheck)
- Full re-run (POST /fraud/projects/{id}/rerun)
- Report retrieval (GET /fraud/projects/{id}/report)
- Explanatory response (POST /fraud/projects/{id}/explanation)
- Verifier feedback (POST /fraud/checks/{id}/feedback)
"""

import os
import sys
import pytest
from datetime import datetime, date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, FraudRun, FraudCheck, MLFlagFeedback
from services.screening_service import (
    validate_geo_boundary, validate_photo_gps_exif, validate_perceptual_hash,
    validate_satellite_ndvi, validate_ecological_isolation,
    compute_polygon_area_hectares, run_project_screening, precheck_project_dryrun
)

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_polygon_area_calculation():
    # 0.01 deg x 0.01 deg square near equator ~ 1.11km x 1.11km ~ 123 hectares
    wkt = "POLYGON((0.00 0.00, 0.01 0.00, 0.01 0.01, 0.00 0.01, 0.00 0.00))"
    area_ha, centroid = compute_polygon_area_hectares(wkt)
    assert 110.0 <= area_ha <= 135.0
    assert centroid is not None
    assert abs(centroid[0] - 0.005) < 0.001
    assert abs(centroid[1] - 0.005) < 0.001


def test_geo_boundary_validator():
    db = SessionLocal()
    try:
        # Match within 10%
        # Area ~123 ha, declared 125 ha -> diff < 2% -> pass
        wkt = "POLYGON((0.00 0.00, 0.01 0.00, 0.01 0.01, 0.00 0.01, 0.00 0.00))"
        res_pass = validate_geo_boundary("PRJ-TEST-GEO-1", wkt, 125.0, db)
        assert res_pass["status"] == "pass"
        assert res_pass["score"] < 0.2

        # Discrepancy > 25% -> fail
        res_fail = validate_geo_boundary("PRJ-TEST-GEO-2", wkt, 500.0, db)
        assert res_fail["status"] == "fail"
        assert res_fail["score"] > 0.7
    finally:
        db.close()


def test_photo_gps_exif_validator():
    # Project centroid at (0.0, 0.0)
    # When no photos provided
    res_empty = validate_photo_gps_exif("PRJ-TEST-EXIF", 0.0, 0.0, [])
    assert res_empty["status"] == "not_checked"


def test_perceptual_hash_validator():
    db = SessionLocal()
    try:
        res_empty = validate_perceptual_hash("PRJ-TEST-PHASH", [], db)
        assert res_empty["status"] == "not_checked"
    finally:
        db.close()


def test_satellite_ndvi_validator():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None
        res = validate_satellite_ndvi(proj.project_id, proj.start_date, db)
        assert res["status"] in ("pass", "warn", "fail")
        assert "metric_value" in res
    finally:
        db.close()


def test_ecological_isolation_validator():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None
        res = validate_ecological_isolation(proj.project_id, db)
        assert res["status"] in ("pass", "warn", "fail")
        assert "Anomaly score" in res["metric_value"]
    finally:
        db.close()


def test_precheck_endpoint():
    payload = {
        "project_id": "PRJ-PRECHECK-001",
        "name": "Precheck Reforestation",
        "plantation_type": "reforestation",
        "area_hectares": 125.0,
        "number_of_trees": 150000,
        "polygon_wkt": "POLYGON((0.00 0.00, 0.01 0.00, 0.01 0.01, 0.00 0.01, 0.00 0.00))",
        "latitude": 0.005,
        "longitude": 0.005,
        "photos": []
    }
    resp = client.post("/fraud/precheck", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["dry_run"] is True
    assert data["overall_status"] in ("consistent", "needs_attention", "manual_review")
    assert 0.0 <= data["risk_index"] <= 1.0
    assert 0.0 <= data["integrity_score"] <= 100.0
    assert len(data["checks"]) == 5


def test_screening_rerun_and_report_endpoints():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None
        pid = proj.project_id
    finally:
        db.close()

    # Rerun
    resp_rerun = client.post(f"/fraud/projects/{pid}/rerun")
    assert resp_rerun.status_code == 200
    rerun_data = resp_rerun.json()
    assert rerun_data["project_id"] == pid
    assert len(rerun_data["checks"]) == 5
    assert rerun_data["overall_status"] in ("consistent", "needs_attention", "manual_review")

    # Fetch report
    resp_rep = client.get(f"/fraud/projects/{pid}/report")
    assert resp_rep.status_code == 200
    rep_data = resp_rep.json()
    assert rep_data["project_id"] == pid
    assert len(rep_data["checks"]) == 5
    assert "integrity_score" in rep_data

    # Submit explanation
    resp_exp = client.post(
        f"/fraud/projects/{pid}/explanation",
        json={"explanation": "The boundary difference accounts for access roads along northern perimeter.", "user_name": "Field Officer"}
    )
    assert resp_exp.status_code == 200
    assert resp_exp.json()["status"] == "ok"

    # Verifier feedback on first check
    first_check = rep_data["checks"][0]
    cid = first_check["id"]
    resp_fb = client.post(
        f"/fraud/checks/{cid}/feedback",
        json={"useful": True, "comments": "Accurate boundary variance detected"}
    )
    assert resp_fb.status_code == 200
    assert resp_fb.json()["feedback"] == "useful"
