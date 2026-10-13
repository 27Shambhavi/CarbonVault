# tests/test_api_contracts.py
import sys
import os
import pytest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, Transaction, Wallet, PricingConfig

migrate_db()
seed_initial_data()
client = TestClient(app)


def test_contract_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data.get("status"), str)
    assert isinstance(data.get("db"), str)
    assert "commit" in data


def test_contract_ready():
    resp = client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ready"
    assert "database" in data
    assert "razorpay_status" in data
    assert data["razorpay_status"] in ["ok", "auth_failed", "unreachable"]


def test_contract_public_config():
    resp = client.get("/config/public")
    assert resp.status_code == 200
    data = resp.json()
    assert "payment_mode" in data
    assert "razorpay_status" in data
    assert "app_mode" in data


def test_contract_fx_rate():
    resp = client.get("/config/fx-rate")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data.get("rate"), (int, float))
    assert data["rate"] > 0
    assert "source" in data
    assert "fetched_at" in data


def test_contract_public_stats():
    resp = client.get("/public/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "credits_issued" in data
    assert "active_projects" in data
    assert "total_capital_deployed_usd" in data
    assert "active_ngos_count" in data


def test_contract_esg_report_seeded_and_empty():
    # 1. Seeded corporate (Microsoft Sustainability)
    resp_seeded = client.post("/esg/report", json={"corporate_name": "Microsoft Sustainability"})
    assert resp_seeded.status_code == 200
    data_seeded = resp_seeded.json()
    assert "has_data" in data_seeded
    assert "meta" in data_seeded
    assert data_seeded["meta"]["company"] == "Microsoft Sustainability"
    if data_seeded["has_data"]:
        assert "environmental" in data_seeded
        assert "esg_scores" in data_seeded
        assert "social" in data_seeded
        assert "governance" in data_seeded

    # 2. Fresh new corporate with zero records (Empty contract)
    resp_empty = client.post("/esg/report", json={"corporate_name": "BrandNewCorp_ZeroHoldings_99"})
    assert resp_empty.status_code == 200
    data_empty = resp_empty.json()
    assert data_empty["has_data"] is False
    assert data_empty["environmental"] is None
    assert data_empty["esg_scores"] is None
    assert data_empty["social"] is None
    assert "governance" in data_empty
    assert "methodology" in data_empty


def test_contract_pricing_and_forecast():
    resp_pricing = client.get("/pricing")
    assert resp_pricing.status_code == 200
    data_pricing = resp_pricing.json()
    assert "final_price" in data_pricing
    assert "base" in data_pricing

    resp_forecast = client.get("/pricing/forecast")
    assert resp_forecast.status_code == 200
    data_forecast = resp_forecast.json()
    assert "forecast" in data_forecast
    assert "trend_direction" in data_forecast


def test_contract_payment_quote():
    resp = client.get("/payment/quote?project_id=PRJ-MAN-AMAZON&quantity=10&corporate_name=Microsoft")
    assert resp.status_code == 200
    data = resp.json()
    assert "quote_id" in data
    assert "unit_price_usd" in data
    assert "total_usd" in data
    assert "total_inr" in data
    assert "fx_rate" in data
    assert "expires_at" in data
