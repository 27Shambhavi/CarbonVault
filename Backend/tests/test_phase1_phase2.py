import sys
import os
import pytest
import asyncio
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app, migrate_db, seed_initial_data
from core.events import publish, register_subscriber, unregister_subscriber, create_ticket, validate_ticket
from routers.auth_router import hash_password, verify_password, create_access_token, decode_access_token
from credit_calculation.credits_module.db_models import User

# Ensure schema migrations and foundational demo accounts exist
migrate_db()
seed_initial_data()

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "commit" in data
    assert data["db"] == "ok"


def test_ready_endpoint():
    resp = client.get("/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert "database" in data
    assert data["database"]["status"] == "ok"
    assert "scheduler" in data
    assert "services" in data
    assert "modis_ndvi" in data["services"]
    assert "nasa_power" in data["services"]
    assert "llm_explainer" in data["services"]


def test_auth_hashing_and_jwt():
    raw = "securePassword123"
    hashed = hash_password(raw)
    assert verify_password(raw, hashed)
    assert not verify_password("wrongPass", hashed)

    mock_user = User(id=99, email="testadmin@carbonvault.com", name="Test Admin", role="admin")
    token = create_access_token(mock_user)
    payload = decode_access_token(token)
    assert payload["sub"] == "testadmin@carbonvault.com"
    assert payload["role"] == "admin"


def test_auth_login_endpoints():
    # Valid login with demo account seeded in main.py
    resp = client.post("/auth/login", json={"email": "admin@carbonvault.com", "password": "admin123"})
    assert resp.status_code == 200
    res_data = resp.json()
    assert "access_token" in res_data or "token" in res_data
    assert res_data["user"]["role"] == "admin"

    # Invalid login
    bad_resp = client.post("/auth/login", json={"email": "admin@carbonvault.com", "password": "wrong"})
    assert bad_resp.status_code == 401


def test_stats_overview():
    resp = client.get("/stats/overview?role=admin&period=30d")
    assert resp.status_code == 200
    data = resp.json()
    assert "kpis" in data
    assert "total_credits" in data["kpis"]
    assert "as_of" in data


def test_public_stats():
    resp = client.get("/public/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tonnes_sequestered" in data
    assert "source" in data
    assert "CarbonVault" in data["source"]


@pytest.mark.asyncio
async def test_realtime_event_bus():
    sub = await register_subscriber(role="admin", email="admin@carbonvault.com")
    try:
        publish("test.event", {"hello": "world"}, audience="role:admin")
        evt = sub.queue.get_nowait()
        assert evt["type"] == "test.event"
        assert evt["payload"]["hello"] == "world"
    finally:
        unregister_subscriber(sub)

    # Ticket creation and validation
    ticket = create_ticket(role="admin", email="admin@carbonvault.com")
    assert ticket.startswith("tkt_")
    identity = validate_ticket(ticket)
    assert identity["role"] == "admin"
    assert identity["email"] == "admin@carbonvault.com"
