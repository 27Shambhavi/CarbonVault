"""
Backend/tests/test_phase6_onboarding.py
Phase 6 Acceptance Test Suite:
  1. Organization Profile & KYC Submission
  2. Document Upload with Checksum & Version Tracking
  3. Admin KYC Review & Audit Logging
  4. Project Submission Gate (4 Mandatory Docs)
  5. Independent Verifier Gate (Field Verification Sign-off)
  6. ML Flag Reviewer Feedback (Labelled Data Store)
  7. Account Lifecycle (Suspension, Reactivation, Deletion Request, Data Portability)
  8. Admin Refund Flow (Wallet Reversal & Audit Event)
  9. NGO Payouts Ledger & Bank Settlement CSV Export
"""

import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    User, NGO, Project, Transaction, Wallet, OrganizationProfile,
    OrganizationDocument, ProjectDocument, FieldVerification, MLFlagFeedback,
    AccountDeletionRequest, Payout
)
from routers.auth_router import create_access_token

client = TestClient(app)


@pytest.fixture(scope="module")
def auth_tokens():
    """Generate JWT tokens for test roles."""
    db = SessionLocal()
    try:
        # Get or create admin
        admin = db.query(User).filter(User.email == "admin@carbonvault.com").first()
        admin_tok = create_access_token(admin)

        # Get or create verifier
        verifier = db.query(User).filter(User.email == "verifier@carbonvault.com").first()
        if not verifier:
            verifier = User(
                name="TUV Rheinland Verifier",
                email="verifier@carbonvault.com",
                role="verifier",
                status="active"
            )
            db.add(verifier)
            db.commit()
            db.refresh(verifier)
        verifier_tok = create_access_token(verifier)

        # Get or create NGO
        ngo_user = db.query(User).filter(User.email == "contact@ecoguard.org").first()
        ngo_tok = create_access_token(ngo_user)

        # Get or create Corporate
        corp_user = db.query(User).filter(User.email == "carbon@microsoft.com").first()
        corp_tok = create_access_token(corp_user)

        return {
            "admin": {"Authorization": f"Bearer {admin_tok}"},
            "verifier": {"Authorization": f"Bearer {verifier_tok}"},
            "ngo": {"Authorization": f"Bearer {ngo_tok}"},
            "corporate": {"Authorization": f"Bearer {corp_tok}"},
            "anonymous": {}
        }
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────────────
# 1. Organisation Profile & KYC
# ──────────────────────────────────────────────────────────────────────────────

def test_org_profile_submission_and_retrieval(auth_tokens):
    payload = {
        "legal_name": "Amazon Conservation Initiative NGO",
        "registration_number": "BR-REG-2024-9988",
        "country": "Brazil",
        "org_type": "ngo"
    }
    resp = client.post("/onboarding/profile", json=payload, headers=auth_tokens["ngo"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["profile"]["legal_name"] == payload["legal_name"]
    assert data["profile"]["kyc_status"] == "pending"

    # View my profile
    resp_get = client.get("/onboarding/profile", headers=auth_tokens["ngo"])
    assert resp_get.status_code == 200
    p_data = resp_get.json()
    assert p_data["has_profile"] is True
    assert p_data["profile"]["registration_number"] == payload["registration_number"]


def test_org_document_upload_and_versioning(auth_tokens):
    doc_payload_v1 = {
        "doc_type": "incorporation",
        "file_url": "https://storage.carbonvault.com/legal/cert_inc_v1.pdf",
        "sha256_checksum": "a" * 64
    }
    resp1 = client.post("/onboarding/documents", json=doc_payload_v1, headers=auth_tokens["ngo"])
    assert resp1.status_code == 200
    v1 = resp1.json()["document"]["version"]
    assert v1 >= 1

    # Upload version 2
    doc_payload_v2 = {
        "doc_type": "incorporation",
        "file_url": "https://storage.carbonvault.com/legal/cert_inc_v2.pdf",
        "sha256_checksum": "b" * 64
    }
    resp2 = client.post("/onboarding/documents", json=doc_payload_v2, headers=auth_tokens["ngo"])
    assert resp2.status_code == 200
    v2 = resp2.json()["document"]["version"]
    assert v2 == v1 + 1

    # Invalid document type
    invalid_doc = {
        "doc_type": "unsupported_doc",
        "file_url": "https://storage.carbonvault.com/legal/foo.pdf",
        "sha256_checksum": "c" * 64
    }
    resp3 = client.post("/onboarding/documents", json=invalid_doc, headers=auth_tokens["ngo"])
    assert resp3.status_code == 400


def test_admin_kyc_review_decision(auth_tokens):
    # Ensure at least one pending profile exists
    payload = {
        "legal_name": f"Pending KYC Org {uuid.uuid4().hex[:6]}",
        "registration_number": f"REG-{uuid.uuid4().hex[:6]}",
        "country": "Brazil",
        "org_type": "ngo"
    }
    client.post("/onboarding/profile", json=payload, headers=auth_tokens["ngo"])

    # Get pending list as admin
    resp_pending = client.get("/onboarding/admin/pending", headers=auth_tokens["admin"])
    assert resp_pending.status_code == 200
    profiles = resp_pending.json()["profiles"]
    assert len(profiles) > 0
    target_id = profiles[0]["id"]

    # Review as non-admin -> 403
    resp_ngo = client.post("/onboarding/admin/review", json={"profile_id": target_id, "decision": "verified"}, headers=auth_tokens["ngo"])
    assert resp_ngo.status_code == 403

    # Review as admin -> 200
    resp_admin = client.post(
        "/onboarding/admin/review",
        json={"profile_id": target_id, "decision": "verified", "notes": "Corporate registry and tax ID cross-checked"},
        headers=auth_tokens["admin"]
    )
    assert resp_admin.status_code == 200
    data = resp_admin.json()
    assert data["kyc_status"] == "verified"


# ──────────────────────────────────────────────────────────────────────────────
# 2. Project Documents & Submission Gates
# ──────────────────────────────────────────────────────────────────────────────

def test_project_submission_gates_and_verifier_signoff(auth_tokens):
    db = SessionLocal()
    unique_pid = f"PRJ-TEST-{uuid.uuid4().hex[:6].upper()}"
    try:
        ngo_user = db.query(User).filter(User.email == "contact@ecoguard.org").first()
        ngo_entity = db.query(NGO).first()
        proj = Project(
            project_id=unique_pid,
            ngo_id=ngo_entity.id if ngo_entity else 1,
            name="Test Verification Canopy Project",
            latitude=-4.12,
            longitude=-60.45,
            area_hectares=1200.0,
            plantation_type="agroforestry",
            number_of_trees=50000,
            status="draft",
            price=28.0
        )
        db.add(proj)
        db.commit()
    finally:
        db.close()

    # 1. Attempt to move from draft to submitted WITHOUT 4 documents -> 400 blocked
    resp_sub_fail = client.patch(
        f"/projects/{unique_pid}/status",
        json={"status": "submitted", "comment": "Submitting without documents"},
        headers=auth_tokens["admin"]
    )
    assert resp_sub_fail.status_code == 400
    assert "Missing required project documents" in resp_sub_fail.json()["detail"]

    # 2. Upload all 4 mandatory documents
    doc_types = ["land_proof", "methodology_reference", "monitoring_plan", "baseline_notes"]
    for dt in doc_types:
        resp_upload = client.post(
            f"/projects/{unique_pid}/documents",
            json={
                "doc_type": dt,
                "file_url": f"https://storage.carbonvault.com/docs/{unique_pid}_{dt}.pdf",
                "sha256_checksum": "e" * 64
            },
            headers=auth_tokens["ngo"]
        )
        assert resp_upload.status_code == 200

    # 3. Check document completeness
    resp_doc_status = client.get(f"/projects/{unique_pid}/documents")
    assert resp_doc_status.status_code == 200
    assert resp_doc_status.json()["is_complete"] is True

    # 4. Now transition to under_review -> 200
    resp_sub_ok = client.patch(
        f"/projects/{unique_pid}/status",
        json={"status": "under_review", "comment": "All documents verified"},
        headers=auth_tokens["admin"]
    )
    assert resp_sub_ok.status_code == 200

    # 5. Attempt admin approval WITHOUT verifier sign-off -> 400 blocked!
    resp_app_fail = client.patch(
        f"/projects/{unique_pid}/status",
        json={"status": "approved", "comment": "Attempting approval without verifier"},
        headers=auth_tokens["admin"]
    )
    assert resp_app_fail.status_code == 400
    assert "Approval blocked: Field verification sign-off" in resp_app_fail.json()["detail"]

    # 6. Non-verifier attempts to submit field verification -> 403
    resp_fv_ngo = client.post(
        f"/projects/{unique_pid}/field-verification",
        json={"report_url": "https://storage.carbonvault.com/reports/audit.pdf", "decision": "verified"},
        headers=auth_tokens["ngo"]
    )
    assert resp_fv_ngo.status_code == 403

    # 7. Independent Verifier submits signed verification report -> 200
    resp_fv_ok = client.post(
        f"/projects/{unique_pid}/field-verification",
        json={
            "report_url": f"https://storage.carbonvault.com/reports/field_{unique_pid}.pdf",
            "decision": "verified",
            "notes": "LiDAR and allometric biomass audit verified on-site"
        },
        headers=auth_tokens["verifier"]
    )
    assert resp_fv_ok.status_code == 200
    assert resp_fv_ok.json()["verification"]["decision"] == "verified"

    # 8. Admin approval now succeeds -> 200!
    resp_app_ok = client.patch(
        f"/projects/{unique_pid}/status",
        json={"status": "approved", "comment": "Approved following verifier audit"},
        headers=auth_tokens["admin"]
    )
    assert resp_app_ok.status_code == 200
    assert resp_app_ok.json()["status"] == "approved"


# ──────────────────────────────────────────────────────────────────────────────
# 3. ML Flag Reviewer Feedback (Labelled Dataset)
# ──────────────────────────────────────────────────────────────────────────────

def test_ml_reviewer_feedback(auth_tokens):
    fb_payload = {
        "flag_name": "canopy_cover_anomaly",
        "project_id": "PRJ-MAN-AMAZON",
        "feedback": "useful",
        "comments": "Correctly detected drought-related seasonal drop."
    }
    resp = client.post("/ml/feedback", json=fb_payload, headers=auth_tokens["verifier"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # Retrieve feedback list
    resp_list = client.get("/ml/feedback?project_id=PRJ-MAN-AMAZON", headers=auth_tokens["admin"])
    assert resp_list.status_code == 200
    assert resp_list.json()["count"] > 0


# ──────────────────────────────────────────────────────────────────────────────
# 4. Account Lifecycle, Privacy & Data Portability
# ──────────────────────────────────────────────────────────────────────────────

def test_user_suspension_and_reactivation_flow(auth_tokens):
    db = SessionLocal()
    test_email = f"user_{uuid.uuid4().hex[:6]}@example.com"
    try:
        from routers.auth_router import hash_password
        u = User(
            name="Suspension Test User",
            email=test_email,
            password_hash=hash_password("password123"),
            role="corporate",
            status="active"
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        user_id = u.id
    finally:
        db.close()

    # User can log in
    resp_login1 = client.post("/auth/login", json={"email": test_email, "password": "password123"})
    assert resp_login1.status_code == 200

    # Admin suspends user
    resp_sus = client.patch(f"/auth/users/{user_id}/status", json={"status": "suspended"}, headers=auth_tokens["admin"])
    assert resp_sus.status_code == 200
    assert resp_sus.json()["new_status"] == "suspended"

    # User login now rejected with 403 Forbidden
    resp_login2 = client.post("/auth/login", json={"email": test_email, "password": "password123"})
    assert resp_login2.status_code == 403
    assert "suspended" in resp_login2.json()["detail"].lower()

    # Admin reactivates user
    resp_act = client.patch(f"/auth/users/{user_id}/status", json={"status": "active"}, headers=auth_tokens["admin"])
    assert resp_act.status_code == 200

    # User logs in again -> 200 OK
    resp_login3 = client.post("/auth/login", json={"email": test_email, "password": "password123"})
    assert resp_login3.status_code == 200


def test_account_deletion_request_and_data_export(auth_tokens):
    # Deletion request
    resp_del = client.post("/auth/request-deletion", json={"reason": "Testing GDPR deletion request flow"}, headers=auth_tokens["corporate"])
    assert resp_del.status_code == 200
    assert "request_id" in resp_del.json()

    # GDPR Data export
    resp_exp = client.get("/auth/export-data", headers=auth_tokens["corporate"])
    assert resp_exp.status_code == 200
    data = resp_exp.json()
    assert "user_profile" in data
    assert "wallet" in data
    assert "exported_at" in data


# ──────────────────────────────────────────────────────────────────────────────
# 5. Phase 7: Admin Refund Flow & NGO Payouts
# ──────────────────────────────────────────────────────────────────────────────

def test_admin_refund_flow(auth_tokens):
    db = SessionLocal()
    try:
        # Create a test transaction
        txn = Transaction(
            corporate_name="Microsoft Sustainability",
            project_id="PRJ-MAN-AMAZON",
            amount_inr=50000.0,
            quantity=20.0,
            price_per_ton=2500.0,
            status="completed",
            certificate_id=f"CERT-REF-{uuid.uuid4().hex[:6].upper()}"
        )
        db.add(txn)
        db.commit()
        db.refresh(txn)
        txn_id = txn.id

        # Ensure wallet has enough credits
        w = db.query(Wallet).filter(Wallet.corporate_name == "Microsoft Sustainability").first()
        if w:
            w.total_credits += 20.0
            w.total_spent_inr += 50000.0
            db.commit()
    finally:
        db.close()

    # Admin processes refund
    resp_refund = client.post(
        "/payment/refund",
        json={"transaction_id": txn_id, "reason": "Customer cancellation within SLA window"},
        headers=auth_tokens["admin"]
    )
    assert resp_refund.status_code == 200
    ref_data = resp_refund.json()
    assert ref_data["current_status"] == "refunded"
    assert ref_data["refunded_amount"] == 50000.0

    # Attempt second refund on already refunded transaction -> 400
    resp_re_refund = client.post(
        "/payment/refund",
        json={"transaction_id": txn_id},
        headers=auth_tokens["admin"]
    )
    assert resp_re_refund.status_code == 400
    assert "already been refunded" in resp_re_refund.json()["detail"]


def test_ngo_payouts_and_csv_export(auth_tokens):
    # 1. Create a payout record
    payout_payload = {
        "ngo_id": 1,
        "amount_inr": 250000.0,
        "bank_account_last4": "1234",
        "ifsc_code": "HDFC0001234",
        "reference_note": "Quarterly afforestation milestone payment"
    }
    resp_create = client.post("/payment/payouts", json=payout_payload, headers=auth_tokens["admin"])
    assert resp_create.status_code == 200
    assert "payout_id" in resp_create.json()["payout"]

    # 2. List payouts
    resp_list = client.get("/payment/payouts")
    assert resp_list.status_code == 200
    assert len(resp_list.json()) > 0

    # 3. Export CSV
    resp_csv = client.get("/payment/payouts/export-csv")
    assert resp_csv.status_code == 200
    assert resp_csv.headers["content-type"].startswith("text/csv")
    assert "Payout ID,Beneficiary NGO,Bank Account Last 4" in resp_csv.text
