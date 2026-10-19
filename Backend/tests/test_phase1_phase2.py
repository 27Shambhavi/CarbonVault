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
    assert payload["email"] == "testadmin@carbonvault.com"
    assert payload["sub"] == str(mock_user.id)
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


def test_phase1_public_config_endpoint():
    resp = client.get("/config/public")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "configs" in data
    configs = data["configs"]
    assert "base_price_usd" in configs
    assert "marketplace_commission_pct" in configs
    assert "inr_usd_fallback_rate" in configs
    assert configs["base_price_usd"]["source"] is not None


def test_phase1_plantation_types_endpoint():
    resp = client.get("/config/plantation-types")
    assert resp.status_code == 200
    data = resp.json()
    types = data.get("types", data)
    assert isinstance(types, list)
    assert len(types) >= 4
    keys = [t["type_key"] for t in types]
    assert "mangrove" in keys
    assert "teak" in keys
    mangrove = next(t for t in types if t["type_key"] == "mangrove")
    assert "IPCC" in mangrove["source"]


def test_phase1_fx_rate_endpoint():
    resp = client.get("/config/fx-rate")
    assert resp.status_code == 200
    data = resp.json()
    assert "rate" in data
    assert data["rate"] > 70.0
    assert "source" in data


def test_phase1_grs_score_endpoint():
    resp = client.get("/grs/score?company=Microsoft%20Sustainability")
    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data
    assert 0 <= data["score"] <= 1000
    assert 0 <= data.get("score_100", 0) <= 100
    assert "transparency" in data
    assert "quality" in data


def test_phase1_esg_truthful_reporting():
    resp = client.get("/esg/portfolio?company=Microsoft%20Sustainability")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_offset_tonnes" in data
    # Ensure no fabricated 49400
    assert data["total_offset_tonnes"] != 49400
    assert "disclaimer" in data
    assert "reporting_frameworks_aligned" in data


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 TESTS: REGISTRATION, JWT ME, RATE LIMITING, AUDIT LOGGING
# ══════════════════════════════════════════════════════════════════════════════

def test_phase2_ngo_registration_and_login():
    import uuid
    uid = uuid.uuid4().hex[:6]
    test_email = f"ngo_{uid}@testvault.org"
    reg_payload = {
        "email": test_email,
        "password": "StrongPassword123!",
        "full_name": "Amazonian Forest Guardian",
        "role": "ngo",
        "organization_name": f"Guardian Ecology {uid}",
        "country": "Brazil",
        "registration_number": "BR-2026-99"
    }
    # 1. Register NGO
    resp = client.post("/auth/register", json=reg_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["user"]["role"] == "ngo"
    assert "access_token" in data

    # 2. Login with newly registered credentials
    login_resp = client.post("/auth/login", json={"email": test_email, "password": "StrongPassword123!"})
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert login_data["user"]["email"] == test_email
    assert login_data["user"]["role"] == "ngo"

    # 3. Call /auth/me with Bearer token
    token = login_data["access_token"]
    me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["authenticated"] is True
    assert me_data["email"] == test_email
    assert me_data["role"] == "ngo"


def test_phase2_corporate_registration_and_wallet():
    import uuid
    uid = uuid.uuid4().hex[:6]
    test_email = f"corp_{uid}@testglobal.com"
    reg_payload = {
        "email": test_email,
        "password": "CorporatePassword2026!",
        "full_name": "Sarah Connor",
        "role": "corporate",
        "company_name": f"Nordic Energy {uid}",
        "industry": "Renewables",
        "country": "Norway",
        "website": "https://nordicenergy.example.com"
    }
    resp = client.post("/auth/register", json=reg_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "corporate"

    # Verify duplicate email is rejected
    dup_resp = client.post("/auth/register", json=reg_payload)
    assert dup_resp.status_code == 400


def test_phase2_rate_limiting():
    # Test rate limiter: 5 allowed, 6th triggers 429 Too Many Requests
    test_ip = "192.0.2.77"
    for i in range(5):
        resp = client.post(
            "/auth/login",
            json={"email": "ratelimit@example.com", "password": "wrong"},
            headers={"X-Forwarded-For": test_ip}
        )
        assert resp.status_code in [401, 429]

    # 6th attempt must be 429
    blocked_resp = client.post(
        "/auth/login",
        json={"email": "ratelimit@example.com", "password": "wrong"},
        headers={"X-Forwarded-For": test_ip}
    )
    assert blocked_resp.status_code == 429
    assert "Too many" in blocked_resp.json()["detail"]


def test_tampered_client_cannot_gain_super_admin():
    """
    R2-6: A tampered client (changed local storage, edited request headers such as X-Admin-Role: super_admin)
    cannot gain super-admin rights.
    """
    # 1. Login as Verifier (non-admin role)
    verifier_login = client.post("/auth/login", json={"email": "verifier@carbonvault.com", "password": "verifier123"})
    assert verifier_login.status_code == 200, f"Verifier login failed: {verifier_login.text}"
    verifier_token = verifier_login.json()["access_token"]

    # 2. Verifier attempts to access admin endpoint (/pricing) without header tampering
    pricing_payload = {
        "base": 30.0,
        "demand": 1.1,
        "supply": 1.0,
        "living": 1.0,
        "mode": "dynamic"
    }
    resp1 = client.post(
        "/pricing",
        json=pricing_payload,
        headers={"Authorization": f"Bearer {verifier_token}"}
    )
    assert resp1.status_code == 403, f"Expected 403, got {resp1.status_code}"
    assert "Super Admin privilege required" in resp1.json()["detail"]

    # 3. Tampered client: Verifier token + forged X-Admin-Role: super_admin header
    resp2 = client.post(
        "/pricing",
        json=pricing_payload,
        headers={
            "Authorization": f"Bearer {verifier_token}",
            "X-Admin-Role": "super_admin",
            "X-Admin-Email": "verifier@carbonvault.com"
        }
    )
    assert resp2.status_code == 403, f"Tampered client should be blocked with 403, got {resp2.status_code}"
    assert "Super Admin privilege required" in resp2.json()["detail"]

    # 4. Tampered client: Verifier attempts to invite users with forged header
    invite_resp = client.post(
        "/users/invite",
        json={"name": "Hacked User", "email": "hacked@example.com", "role": "admin"},
        headers={
            "Authorization": f"Bearer {verifier_token}",
            "X-Admin-Role": "super_admin",
            "X-Admin-Email": "verifier@carbonvault.com"
        }
    )
    assert invite_resp.status_code == 403

    # 5. Non-admin NGO user attempts to update pricing
    ngo_login = client.post("/auth/login", json={"email": "contact@ecoguard.org", "password": "ngo123"})
    if ngo_login.status_code == 200:
        ngo_token = ngo_login.json()["access_token"]
        ngo_resp = client.post(
            "/pricing",
            json=pricing_payload,
            headers={
                "Authorization": f"Bearer {ngo_token}",
                "X-Admin-Role": "super_admin"
            }
        )
        assert ngo_resp.status_code == 403



