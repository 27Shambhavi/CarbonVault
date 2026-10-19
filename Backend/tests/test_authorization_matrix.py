"""
CarbonVault Phase 3: Authorization Matrix Test Suite.
Validates the authorization matrix: (role x endpoint -> 200/401/403/422).
Consolidated ONE Admin role model (Approver merged into Admin; 4 sign-in roles: Admin, Verifier, NGO, Corporate).
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
    """Create and seed test users for all 4 RBAC roles."""
    db = SessionLocal()
    try:
        def get_or_create_user(email, name, role):
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    name=name,
                    email=email,
                    role=role,
                    password_hash="$2b$12$D25z1bWd7d/U30Xv4e5Z4.4K9q8G1B5/L8L1N3R9f6F8B0W5Z8D1m",
                    status="active",
                    joined="2026-01-01"
                )
                db.add(u)
                db.commit()
                db.refresh(u)
            else:
                u.role = role
                db.commit()
            return u

        admin_u = get_or_create_user("matrix.admin@carbonvault.com", "Matrix Admin", "admin")
        verifier_u = get_or_create_user("matrix.verifier@carbonvault.com", "Matrix Verifier", "verifier")
        ngo_u = get_or_create_user("matrix.ngo@ecoguard.org", "Matrix NGO", "ngo")
        corp_u = get_or_create_user("matrix.corp@microsoft.com", "Matrix Corp", "corporate")

        return {
            "anonymous": {},
            "admin": {"Authorization": f"Bearer {create_access_token(admin_u)}"},
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

    # Verifier -> 403
    res_ver = client.post("/config/set", json=payload, headers=auth_tokens["verifier"])
    assert res_ver.status_code == 403

    # Admin -> 200
    res_admin = client.post("/config/set", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["status"] == "ok"


def test_pricing_update_matrix(auth_tokens):
    """POST /pricing requires admin privilege."""
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

    # Verifier -> 403
    res_ver = client.post("/pricing", json=payload, headers=auth_tokens["verifier"])
    assert res_ver.status_code == 403

    # Admin -> 200
    res_admin = client.post("/pricing", json=payload, headers=auth_tokens["admin"])
    assert res_admin.status_code == 200
    assert res_admin.json()["final_price"] > 0


def test_non_admin_forbidden_endpoints(auth_tokens):
    """Non-admin roles (NGO, Corporate, Verifier) cannot call admin management endpoints."""
    forbidden_roles = ["ngo", "corporate", "verifier"]

    for r in forbidden_roles:
        h = auth_tokens[r]
        # 1. User invite
        res_user = client.post("/users/invite", json={"name": "Test", "email": f"test_{r}@test.com", "role": "ngo"}, headers=h)
        assert res_user.status_code == 403, f"Role {r} should be blocked from /users/invite"

        # 2. KYC review
        res_kyc = client.post("/onboarding/admin/review", json={"profile_id": 1, "decision": "verified"}, headers=h)
        assert res_kyc.status_code == 403, f"Role {r} should be blocked from /onboarding/admin/review"

        # 3. Project Reassign
        res_reassign = client.post("/projects/PRJ-MAN-AMAZON/reassign", json={"assignee_role": "verifier", "assignee_email": "test@test.com"}, headers=h)
        assert res_reassign.status_code == 403, f"Role {r} should be blocked from /projects/.../reassign"

        # 4. Project Suspend
        res_suspend = client.post("/projects/PRJ-MAN-AMAZON/suspend", json={"reason": "Audit issue"}, headers=h)
        assert res_suspend.status_code == 403, f"Role {r} should be blocked from /projects/.../suspend"


def test_admin_override_workflow(auth_tokens):
    """Admin cannot approve an unverified project without independent verifier sign-off unless explicit override is provided."""
    db = SessionLocal()
    try:
        from credit_calculation.credits_module.db_models import Project
        unverified_prj = db.query(Project).filter(Project.project_id == "PRJ-UNVERIFIED-TEST").first()
        if not unverified_prj:
            unverified_prj = Project(
                project_id="PRJ-UNVERIFIED-TEST",
                name="Unverified Test Plantation",
                status="pending",
                area_hectares=50.0,
                number_of_trees=5000,
                plantation_type="teak"
            )
            db.add(unverified_prj)
            db.commit()

        # 1. Admin attempts approval of unverified project without override -> 400 Bad Request
        res_silent = client.patch(
            "/projects/PRJ-UNVERIFIED-TEST/status",
            json={"status": "approved", "comment": "Approval attempt without verifier sign-off"},
            headers=auth_tokens["admin"]
        )
        assert res_silent.status_code == 400
        assert "Approval blocked" in res_silent.json()["detail"]

        # 2. Admin provides valid override reason (>= 10 chars) and confirmation -> 200 OK
        res_override = client.patch(
            "/projects/PRJ-UNVERIFIED-TEST/status",
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
    finally:
        db.close()


def test_admin_separation_of_duties_violation(auth_tokens):
    """Admin cannot approve a project belonging to an organization they are affiliated with."""
    db = SessionLocal()
    try:
        from credit_calculation.credits_module.db_models import Project, NGO
        affiliated_ngo = db.query(NGO).filter(NGO.email == "matrix.admin@carbonvault.com").first()
        if not affiliated_ngo:
            affiliated_ngo = NGO(name="Admin Linked NGO", email="matrix.admin@carbonvault.com")
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
        else:
            test_prj.ngo_id = affiliated_ngo.id
        db.commit()

        # Admin attempts to approve affiliated project -> 403
        res = client.patch(
            "/projects/PRJ-FOUR-EYES-TEST/status",
            json={"status": "approved", "comment": "Self-dealing attempt"},
            headers=auth_tokens["admin"]
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
