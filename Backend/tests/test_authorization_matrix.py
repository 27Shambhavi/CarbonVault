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
        approver_u = get_or_create_user("matrix.approver@carbonvault.com", "Matrix Approver", "approver", "approver")
        verifier_u = get_or_create_user("matrix.verifier@carbonvault.com", "Matrix Verifier", "verifier", None)
        ngo_u = get_or_create_user("matrix.ngo@ecoguard.org", "Matrix NGO", "ngo", None)
        corp_u = get_or_create_user("matrix.corp@microsoft.com", "Matrix Corp", "buyer", None)

        return {
            "anonymous": {},
            "admin": {"Authorization": f"Bearer {create_access_token(admin_u)}"},
            "approver": {"Authorization": f"Bearer {create_access_token(approver_u)}"},
            "verifier": {"Authorization": f"Bearer {create_access_token(verifier_u)}"},
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

    # Approver -> 200
    res_app = client.get("/auth/me", headers=auth_tokens["approver"])
    assert res_app.status_code == 200
    assert res_app.json()["user"]["role"] == "approver"

    # Verifier -> 200
    res_ver = client.get("/auth/me", headers=auth_tokens["verifier"])
    assert res_ver.status_code == 200
    assert res_ver.json()["user"]["role"] == "verifier"

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

    # Verifier -> 403
    res_ver = client.post("/config/set", json=payload, headers=auth_tokens["verifier"])
    assert res_ver.status_code == 403

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

    # Verifier -> 403
    res_ver = client.post("/pricing", json=payload, headers=auth_tokens["verifier"])
    assert res_ver.status_code == 403

    # Super Admin -> 200
    res_admin = client.post("/pricing", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["final_price"] > 0


def test_approver_forbidden_admin_endpoints(auth_tokens):
    """Approvers cannot call users, pricing, payouts, KYC review, or project reassignment endpoints."""
    # 1. User management
    res_user = client.post("/users/invite", json={"name": "Test", "email": "test@test.com", "role": "ngo"}, headers=auth_tokens["approver"])
    assert res_user.status_code == 403

    # 2. KYC review
    res_kyc = client.post("/onboarding/admin/review", json={"profile_id": 1, "decision": "verified"}, headers=auth_tokens["approver"])
    assert res_kyc.status_code == 403

    # 3. Project Reassign
    res_reassign = client.post("/projects/PRJ-MAN-AMAZON/reassign", json={"assignee_role": "approver", "assignee_email": "test@test.com"}, headers=auth_tokens["approver"])
    assert res_reassign.status_code == 403

    # 4. Project Suspend
    res_suspend = client.post("/projects/PRJ-MAN-AMAZON/suspend", json={"reason": "Audit issue"}, headers=auth_tokens["approver"])
    assert res_suspend.status_code == 403


def test_admin_override_workflow(auth_tokens):
    """Admin cannot silently approve: requires override=True, override_confirmed=True, and a mandatory reason."""
    # 1. Admin attempts approval without override -> 400 Bad Request
    res_silent = client.patch(
        "/projects/PRJ-MAN-AMAZON/status",
        json={"status": "approved", "comment": "Silent admin approval"},
        headers=auth_tokens["admin"]
    )
    assert res_silent.status_code == 400
    assert "Admin override required" in res_silent.json()["detail"]

    # 2. Admin provides valid override reason and confirmation -> 200 OK
    res_override = client.patch(
        "/projects/PRJ-MAN-AMAZON/status",
        json={
            "status": "approved",
            "comment": "Administrative override execution",
            "override": True,
            "override_confirmed": True,
            "override_reason": "Executive scientific board reviewed satellite telemetry and signed off."
        },
        headers=auth_tokens["admin"]
    )
    assert res_override.status_code == 200


def test_approver_four_eyes_violation(auth_tokens):
    """Approver cannot approve a project belonging to an organization they are affiliated with."""
    db = SessionLocal()
    try:
        from credit_calculation.credits_module.db_models import Project, NGO
        affiliated_ngo = db.query(NGO).filter(NGO.email == "matrix.approver@carbonvault.com").first()
        if not affiliated_ngo:
            affiliated_ngo = NGO(name="Approver Linked NGO", email="matrix.approver@carbonvault.com")
            db.add(affiliated_ngo)
            db.commit()
            db.refresh(affiliated_ngo)

        test_prj = db.query(Project).filter(Project.project_id == "PRJ-FOUR-EYES-TEST").first()
        if not test_prj:
            test_prj = Project(
                project_id="PRJ-FOUR-EYES-TEST",
                name="Four Eyes Test Forest",
                ngo_id=affiliated_ngo.id,
                status="pending",
                area_hectares=100.0,
                number_of_trees=10000,
                plantation_type="reforestation"
            )
            db.add(test_prj)
            db.commit()

        # Approver attempts to approve affiliated project -> 403
        res = client.patch(
            "/projects/PRJ-FOUR-EYES-TEST/status",
            json={"status": "approved", "comment": "Self-dealing attempt"},
            headers=auth_tokens["approver"]
        )
        assert res.status_code == 403
        assert "Four-eyes violation" in res.json()["detail"]
    finally:
        db.close()


def test_tampered_token_rejection():
    """Tampered or invalid tokens are rejected with 401 Unauthorized."""
    res = client.get("/auth/me", headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature"})
    assert res.status_code == 401


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
