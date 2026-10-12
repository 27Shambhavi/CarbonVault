"""
Backend/tests/test_phase5_ai.py
Unit tests for Phase 5 Grounded AI Explainer:
- Extraction of factual biometrics from DB.
- Strict post-check verification of supplied vs unsupplied numbers.
- Verification that an invented/unsupplied number causes the post-check to reject the output.
- Caching behavior in `ai_summaries` table.
- Deterministic fallback when API key is missing or output is rejected.
- HTTP endpoint `GET /projects/{project_id}/ai-summary`.
"""

import sys
import os
import pytest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, AISummary
from ai.explainer import (
    gather_project_facts,
    extract_allowed_numbers_from_facts,
    extract_numbers_from_text,
    verify_grounded_numbers,
    explain_project,
    generate_deterministic_summary
)

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_facts_gathering():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None

        facts = gather_project_facts(proj.project_id, db)
        assert facts["project_id"] == proj.project_id
        assert "area_hectares" in facts
        assert "number_of_trees" in facts
        assert "tree_density_per_ha" in facts
        assert "m1_anomaly_score" in facts
        assert "latest_ndvi" in facts
        assert "mean_temperature_c" in facts
        assert "total_precipitation_mm" in facts
    finally:
        db.close()


def test_post_check_accepts_valid_numbers():
    facts = {
        "area_hectares": 45.0,
        "number_of_trees": 12000,
        "m1_anomaly_score": 18.5,
        "latest_ndvi": 0.74,
        "mean_temperature_c": 28.2,
        "total_precipitation_mm": 1350.0
    }
    allowed = extract_allowed_numbers_from_facts(facts)

    # Narrative that quotes only supplied numbers
    valid_text = (
        "Project encompasses 45.0 hectares with 12000 registered trees. "
        "Observed satellite NDVI is 0.74 with mean temperature of 28.2°C "
        "and precipitation of 1350.0 mm. Anomaly index is 18.5/100."
    )

    is_valid, unsupplied = verify_grounded_numbers(valid_text, allowed)
    assert is_valid is True
    assert len(unsupplied) == 0


def test_post_check_strictly_rejects_unsupplied_numbers():
    facts = {
        "area_hectares": 45.0,
        "number_of_trees": 12000,
        "m1_anomaly_score": 18.5,
        "latest_ndvi": 0.74,
        "mean_temperature_c": 28.2,
        "total_precipitation_mm": 1350.0
    }
    allowed = extract_allowed_numbers_from_facts(facts)

    # Narrative hallucinating an unsupplied metric (e.g., 99.9% accuracy or 42500 tonnes)
    hallucinated_text = (
        "Project encompasses 45.0 hectares with 12000 trees. "
        "Our model estimates a 99.9% confidence and 42500 tonnes of carbon sequestration."
    )

    is_valid, unsupplied = verify_grounded_numbers(hallucinated_text, allowed)
    # MUST BE FALSE!
    assert is_valid is False
    assert 99.9 in unsupplied or 42500.0 in unsupplied


def test_explain_project_and_caching():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None

        # Call explain_project
        res = explain_project(proj.project_id, db, audience="admin", force_refresh=True)
        assert res["project_id"] == proj.project_id
        assert "summary" in res
        assert len(res["summary"]) > 20
        assert "next_steps" in res
        assert len(res["next_steps"]) <= 3
        assert res["status"] in ("grounded_ai", "deterministic_fallback", "rejected_unsupplied_number")
        assert "facts_hash" in res

        # Verify caching in ai_summaries table
        cached_row = db.query(AISummary).filter(
            AISummary.project_id == proj.project_id,
            AISummary.facts_hash == res["facts_hash"]
        ).first()
        assert cached_row is not None
        assert cached_row.summary == res["summary"]

        # Call again without force_refresh: should return cached=True
        res_cached = explain_project(proj.project_id, db, audience="admin", force_refresh=False)
        assert res_cached["cached"] is True
    finally:
        db.close()


def test_ai_summary_endpoint():
    db = SessionLocal()
    try:
        proj = db.query(Project).first()
        assert proj is not None

        resp = client.get(f"/projects/{proj.project_id}/ai-summary?audience=admin")
        assert resp.status_code == 200
        data = resp.json()
        assert data["project_id"] == proj.project_id
        assert "summary" in data
        assert "next_steps" in data
        assert len(data["next_steps"]) >= 1
    finally:
        db.close()
