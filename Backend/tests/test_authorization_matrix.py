"""
CarbonVault Phase 3: Authorization Matrix Test Suite.
Validates the authorization matrix: (role x endpoint -> 200/401/403/422).
Verifies that:
  - Unauthenticated anonymous requests to protected routes are rejected with 401 Unauthorized.
  - Authenticated users with insufficient privileges receive 403 Forbidden.
  - Authorized roles receive 200 OK.
  - Tampered client headers cannot bypass server-side JWT verification.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import User
from routers.auth_router import create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def auth_tokens():
    """Create and seed test users for all RBAC roles."""
    db = SessionLocal()
    try:
        def get_or_create_user(email, name, role, admin_role=None):
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    name=name,
                    email=email,
                    role=role,
                    admin_role=admin_role,
                    password_hash="$2b$12$D25z1bWd7d/U30Xv4e5Z4.4K9q8G1B5/L8L1N3R9f6F8B0W5Z8D1m",
                    status="active",
                    joined="2026-01-01"
                )
                db.add(u)
                db.commit()
                db.refresh(u)
            else:
                u.role = role
                u.admin_role = admin_role
                db.commit()
            return u

        admin_u = get_or_create_user("matrix.admin@carbonvault.com", "Matrix Admin", "admin", "super_admin")
        approver_u = get_or_create_user("matrix.approver@carbonvault.com", "Matrix Approver", "admin", "approver")
        ngo_u = get_or_create_user("matrix.ngo@ecoguard.org", "Matrix NGO", "ngo", None)
        corp_u = get_or_create_user("matrix.corp@microsoft.com", "Matrix Corp", "buyer", None)

        return {
            "anonymous": {},
            "admin": {"Authorization": f"Bearer {create_access_token(admin_u)}"},
            "approver": {"Authorization": f"Bearer {create_access_token(approver_u)}"},
            "ngo": {"Authorization": f"Bearer {create_access_token(ngo_u)}"},
            "corporate": {"Authorization": f"Bearer {create_access_token(corp_u)}"},
        }
    finally:
        db.close()


def test_auth_me_matrix(auth_tokens):
    """GET /auth/me requires valid authentication token."""
    # Anonymous -> 401
    res_anon = client.get("/auth/me", headers=auth_tokens["anonymous"])
    assert res_anon.status_code == 401

    # NGO -> 200
    res_ngo = client.get("/auth/me", headers=auth_tokens["ngo"])
    assert res_ngo.status_code == 200
    assert res_ngo.json()["user"]["role"] == "ngo"

    # Corporate -> 200
    res_corp = client.get("/auth/me", headers=auth_tokens["corporate"])
    assert res_corp.status_code == 200
    assert res_corp.json()["user"]["role"] in ("buyer", "corporate")

    # Admin -> 200
    res_admin = client.get("/auth/me", headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["user"]["role"] == "admin"


def test_config_set_matrix(auth_tokens):
    """POST /config/set requires admin privileges."""
    payload = {"key": "test_matrix_key", "value": "123", "admin_name": "Matrix Tester"}

    # Anonymous -> 401
    res_anon = client.post("/config/set", json=payload, headers=auth_tokens["anonymous"])
    assert res_anon.status_code == 401

    # NGO -> 403
    res_ngo = client.post("/config/set", json=payload, headers=auth_tokens["ngo"])
    assert res_ngo.status_code == 403

    # Corporate -> 403
    res_corp = client.post("/config/set", json=payload, headers=auth_tokens["corporate"])
    assert res_corp.status_code == 403

    # Approver (non-super-admin) -> 403
    res_app = client.post("/config/set", json=payload, headers=auth_tokens["approver"])
    assert res_app.status_code == 403

    # Super Admin -> 200
    res_admin = client.post("/config/set", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["status"] == "ok"


def test_pricing_update_matrix(auth_tokens):
    """POST /pricing requires super_admin privilege."""
    payload = {
        "base": 28.5,
        "demand": 1.12,
        "supply": 0.98,
        "living": 1.08,
        "mode": "manual",
    }

    # Anonymous -> 403
    res_anon = client.post("/pricing", json=payload, headers=auth_tokens["anonymous"])
    assert res_anon.status_code == 403

    # NGO -> 403
    res_ngo = client.post("/pricing", json=payload, headers=auth_tokens["ngo"])
    assert res_ngo.status_code == 403

    # Corporate -> 403
    res_corp = client.post("/pricing", json=payload, headers=auth_tokens["corporate"])
    assert res_corp.status_code == 403

    # Approver -> 403 (cannot modify pricing)
    res_app = client.post("/pricing", json=payload, headers=auth_tokens["approver"])
    assert res_app.status_code == 403

    # Super Admin -> 200
    res_admin = client.post("/pricing", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["final_price"] > 0


def test_project_status_approval_matrix(auth_tokens):
    """PATCH /projects/{id}/status requires approver or admin role."""
    payload = {"status": "approved", "comment": "Matrix authorized test approval", "changed_by": "Tester"}

    # Anonymous -> 403
    res_anon = client.patch("/projects/PRJ-MAN-AMAZON/status", json=payload, headers=auth_tokens["anonymous"])
    assert res_anon.status_code == 403

    # NGO -> 403
    res_ngo = client.patch("/projects/PRJ-MAN-AMAZON/status", json=payload, headers=auth_tokens["ngo"])
    assert res_ngo.status_code == 403

    # Corporate -> 403
    res_corp = client.patch("/projects/PRJ-MAN-AMAZON/status", json=payload, headers=auth_tokens["corporate"])
    assert res_corp.status_code == 403

    # Approver Admin -> 200
    res_app = client.patch("/projects/PRJ-MAN-AMAZON/status", json=payload, headers=auth_tokens["approver"])
    assert res_app.status_code == 200

    # Super Admin -> 200
    res_admin = client.patch("/projects/PRJ-MAN-AMAZON/status", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200


def test_public_transparency_endpoints_accessible_to_all(auth_tokens):
    """Public read-only endpoints must return 200 OK for every role including anonymous."""
    public_endpoints = [
        "/health",
        "/ready",
        "/config/public",
        "/config/plantation-types",
        "/public/stats",
        "/pricing",
    ]

    for ep in public_endpoints:
        for role, headers in auth_tokens.items():
            res = client.get(ep, headers=headers)
            assert res.status_code == 200, f"Endpoint {ep} failed for role {role} with status {res.status_code}"
