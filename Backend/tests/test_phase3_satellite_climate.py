import sys
import os
import pytest
from datetime import datetime, date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, SatelliteObservation, ClimateObservation
from services.satellite import get_project_ndvi_series
from services.climate import get_project_climate_series

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_ndvi_endpoint_stored_and_unavailable():
    db = SessionLocal()
    try:
        # Check an existing project
        proj = db.query(Project).filter(Project.project_id == "PRJ-MAN-AMAZON").first()
        assert proj is not None

        # Seed 2 real-formatted test observations to test retrieval
        obs1 = SatelliteObservation(
            project_id=proj.project_id,
            source="MODIS MOD13Q1 via ORNL DAAC",
            band="250m_16_days_NDVI",
            obs_date=date(2026, 8, 13),
            value=0.8189,
            fetched_at=datetime.utcnow()
        )
        obs2 = SatelliteObservation(
            project_id=proj.project_id,
            source="MODIS MOD13Q1 via ORNL DAAC",
            band="250m_16_days_NDVI",
            obs_date=date(2026, 8, 29),
            value=0.7902,
            fetched_at=datetime.utcnow()
        )
        db.add_all([obs1, obs2])
        db.commit()

        # Query GET /projects/{id}/ndvi
        resp = client.get(f"/projects/{proj.project_id}/ndvi")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == proj.project_id
        assert data["band"] == "250m_16_days_NDVI"
        assert "ORNL DAAC" in data["source"]
        assert len(data["observations"]) >= 2

        # Test non-existent project returns data unavailable
        bad_resp = client.get("/projects/PRJ-NONEXISTENT/ndvi")
        assert bad_resp.status_code == 200
        bad_data = bad_resp.json()
        assert bad_data["status"] == "data unavailable" or len(bad_data.get("observations", [])) == 0

    finally:
        db.close()


def test_climate_endpoint():
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.project_id == "PRJ-MAN-AMAZON").first()
        assert proj is not None

        c_obs = ClimateObservation(
            project_id=proj.project_id,
            obs_date=date(2026, 9, 1),
            t2m=26.4,
            prectotcorr=4.5,
            rh2m=82.0,
            fetched_at=datetime.utcnow()
        )
        db.add(c_obs)
        db.commit()

        resp = client.get(f"/projects/{proj.project_id}/climate")
        assert resp.status_code == 200
        data = resp.json()
        assert "NASA POWER" in data["source"]
        assert "observations" in data
        assert len(data["observations"]) >= 1

    finally:
        db.close()


def test_esg_report_uses_stored_series_and_attributions():
    resp = client.post("/esg/generate-report", json={
        "corporate_name": "Microsoft Sustainability",
        "project_id": "PRJ-MAN-AMAZON"
    })
    assert resp.status_code == 200
    report = resp.json()
    assert "environmental" in report
    assert "attributions" in report
    assert "MODIS data via ORNL DAAC" in report["attributions"]["satellite"]
    assert "NASA POWER" in report["attributions"]["climate"]
    assert "NASA EOSDIS GIBS" in report["attributions"]["imagery"]
    assert "ndvi_trend" in report["environmental"]
    assert "lst_trend" in report["environmental"]
