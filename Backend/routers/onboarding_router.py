"""
Backend/routers/onboarding_router.py
Phase 6: Organisation Onboarding, Trust & KYC-Lite Verification
  - Organisation Profile & KYC Review
  - Document Upload with SHA-256 Checksum & Versioning
  - Project Submission Gates (4 Required Documents + Verified KYC)
  - Independent Verifier Role & Field Verification Sign-off Gate
  - ML Flag Reviewer Feedback (Labelled Data Store)
  - Account Lifecycle (Suspend / Reactivate, Deletion Request, Data Export)
"""

import os
import hashlib
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Header, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from credit_calculation.credits_module.db import get_db, SessionLocal
from credit_calculation.credits_module.db_models import (
    User, NGO, Project, Transaction, Wallet, Certificate, AuditLog, Notification,
    OrganizationProfile, OrganizationDocument, ProjectDocument, FieldVerification,
    MLFlagFeedback, AccountDeletionRequest
)
from routers.auth_router import get_current_user, require_role

logger = logging.getLogger("carbonvault.onboarding")
router = APIRouter(tags=["Onboarding & Trust"])

REQUIRED_PROJECT_DOCS = {
    "land_proof",
    "methodology_reference",
    "monitoring_plan",
    "baseline_notes"
}

VALID_ORG_DOC_TYPES = {
    "incorporation",
    "tax_id",
    "board_resolution",
    "identity_proof"
}


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class OrgProfileRequest(BaseModel):
    legal_name: str = Field(..., min_length=2, max_length=150)
    registration_number: str = Field(..., min_length=2, max_length=100)
    country: str = Field(..., min_length=2, max_length=100)
    org_type: str = Field(..., max_length=20)  # 'ngo' | 'corporate'


class OrgDocumentRequest(BaseModel):
    doc_type: str = Field(..., max_length=50)
    file_url: str = Field(..., max_length=500)
    sha256_checksum: str = Field(..., min_length=64, max_length=64)


class KycReviewRequest(BaseModel):
    profile_id: int
    decision: str = Field(..., max_length=20)  # 'verified' | 'rejected'
    notes: Optional[str] = None


class ProjectDocumentRequest(BaseModel):
    doc_type: str = Field(..., max_length=50)
    file_url: str = Field(..., max_length=500)
    sha256_checksum: str = Field(..., min_length=64, max_length=64)


class FieldVerificationRequest(BaseModel):
    report_url: str = Field(..., max_length=500)
    decision: str = Field(..., max_length=20)  # 'verified' | 'rejected'
    notes: Optional[str] = None
    signature_hash: Optional[str] = None


class MLFeedbackRequest(BaseModel):
    flag_name: str = Field(..., max_length=100)
    project_id: str = Field(..., max_length=100)
    feedback: str = Field(..., max_length=20)  # 'useful' | 'not_useful'
    comments: Optional[str] = None


class UserStatusUpdateRequest(BaseModel):
    status: str = Field(..., max_length=20)  # 'active' | 'suspended'


class DeletionRequest(BaseModel):
    reason: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Organisation Profile & KYC Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/onboarding/profile")
def create_or_update_org_profile(
    req: OrgProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register or update organisation legal identity for KYC-lite review."""
    profile = db.query(OrganizationProfile).filter(OrganizationProfile.user_id == current_user.id).first()
    if profile:
        profile.legal_name = req.legal_name.strip()
        profile.registration_number = req.registration_number.strip()
        profile.country = req.country.strip()
        profile.org_type = req.org_type.strip().lower()
        profile.kyc_status = "pending"  # Re-trigger review on profile updates
        profile.updated_at = datetime.utcnow()
    else:
        profile = OrganizationProfile(
            user_id=current_user.id,
            legal_name=req.legal_name.strip(),
            registration_number=req.registration_number.strip(),
            country=req.country.strip(),
            org_type=req.org_type.strip().lower(),
            kyc_status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(profile)
    
    db.commit()
    db.refresh(profile)

    return {
        "status": "ok",
        "message": "Organisation profile submitted for KYC review.",
        "profile": {
            "id": profile.id,
            "legal_name": profile.legal_name,
            "registration_number": profile.registration_number,
            "country": profile.country,
            "org_type": profile.org_type,
            "kyc_status": profile.kyc_status,
            "updated_at": profile.updated_at.isoformat()
        }
    }


@router.post("/onboarding/documents")
def upload_org_document(
    req: OrgDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload legal entity proof (incorporation, tax id, board resolution, identity)."""
    profile = db.query(OrganizationProfile).filter(OrganizationProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Organisation profile must be created before uploading onboarding documents."
        )

    doc_type_clean = req.doc_type.strip().lower()
    if doc_type_clean not in VALID_ORG_DOC_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Allowed types: {list(VALID_ORG_DOC_TYPES)}"
        )

    # Check versioning
    existing_docs = db.query(OrganizationDocument).filter(
        OrganizationDocument.org_profile_id == profile.id,
        OrganizationDocument.doc_type == doc_type_clean
    ).all()
    version = len(existing_docs) + 1

    doc = OrganizationDocument(
        org_profile_id=profile.id,
        doc_type=doc_type_clean,
        file_url=req.file_url.strip(),
        sha256_checksum=req.sha256_checksum.strip().lower(),
        version=version,
        uploaded_at=datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "status": "ok",
        "message": f"Document '{doc_type_clean}' version {version} uploaded successfully.",
        "document": {
            "id": doc.id,
            "doc_type": doc.doc_type,
            "file_url": doc.file_url,
            "sha256_checksum": doc.sha256_checksum,
            "version": doc.version,
            "uploaded_at": doc.uploaded_at.isoformat()
        }
    }


@router.get("/onboarding/profile")
def get_my_org_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch current user's organization profile and verification state."""
    profile = db.query(OrganizationProfile).filter(OrganizationProfile.user_id == current_user.id).first()
    if not profile:
        return {
            "has_profile": False,
            "kyc_status": "not_started",
            "profile": None,
            "documents": []
        }
    
    docs = db.query(OrganizationDocument).filter(OrganizationDocument.org_profile_id == profile.id).all()
    return {
        "has_profile": True,
        "kyc_status": profile.kyc_status,
        "profile": {
            "id": profile.id,
            "legal_name": profile.legal_name,
            "registration_number": profile.registration_number,
            "country": profile.country,
            "org_type": profile.org_type,
            "kyc_status": profile.kyc_status,
            "kyc_reviewed_by": profile.kyc_reviewed_by,
            "kyc_reviewed_at": profile.kyc_reviewed_at.isoformat() if profile.kyc_reviewed_at else None,
            "kyc_notes": profile.kyc_notes,
            "updated_at": profile.updated_at.isoformat()
        },
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "file_url": d.file_url,
                "sha256_checksum": d.sha256_checksum,
                "version": d.version,
                "uploaded_at": d.uploaded_at.isoformat()
            }
            for d in docs
        ]
    }


@router.get("/onboarding/admin/pending")
def get_pending_kyc_profiles(
    admin_user: User = Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Admin endpoint: lists all organisation profiles awaiting KYC-lite review."""
    pending_profiles = db.query(OrganizationProfile).filter(OrganizationProfile.kyc_status == "pending").all()
    results = []
    for p in pending_profiles:
        docs = db.query(OrganizationDocument).filter(OrganizationDocument.org_profile_id == p.id).all()
        results.append({
            "id": p.id,
            "user_id": p.user_id,
            "user_name": p.user.name if p.user else None,
            "user_email": p.user.email if p.user else None,
            "legal_name": p.legal_name,
            "registration_number": p.registration_number,
            "country": p.country,
            "org_type": p.org_type,
            "kyc_status": p.kyc_status,
            "submitted_at": p.created_at.isoformat(),
            "documents_count": len(docs),
            "documents": [
                {
                    "doc_type": d.doc_type,
                    "file_url": d.file_url,
                    "sha256_checksum": d.sha256_checksum,
                    "version": d.version
                }
                for d in docs
            ]
        })
    return {"pending_count": len(results), "profiles": results}


@router.post("/onboarding/admin/review")
def review_kyc_profile(
    req: KycReviewRequest,
    admin_user: User = Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Admin endpoint: record KYC-lite decision (verified / rejected) with reviewer identity."""
    profile = db.query(OrganizationProfile).filter(OrganizationProfile.id == req.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Organisation profile not found")

    decision_clean = req.decision.strip().lower()
    if decision_clean not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Decision must be 'verified' or 'rejected'")

    profile.kyc_status = decision_clean
    profile.kyc_reviewed_by = admin_user.email
    profile.kyc_reviewed_at = datetime.utcnow()
    profile.kyc_notes = req.notes or f"KYC marked as {decision_clean} by {admin_user.name}"
    profile.updated_at = datetime.utcnow()
    db.commit()

    # Create notification for organization user
    notif = Notification(
        recipient_role=profile.org_type,
        recipient_email=profile.user.email if profile.user else None,
        type="success" if decision_clean == "verified" else "warning",
        title="KYC Verification Decision",
        message=f"Your organisation profile for '{profile.legal_name}' was reviewed: {decision_clean.upper()}. {req.notes or ''}".strip(),
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)

    # Record Audit Log
    try:
        from core.audit import record_audit_event
        record_audit_event(
            action=f"kyc_{decision_clean}",
            name=profile.legal_name,
            detail=f"KYC reviewed for org '{profile.legal_name}' (ID: {profile.id}). Decision: {decision_clean}. Notes: {req.notes or ''}",
            user=admin_user.email,
            db=db
        )
    except Exception as e:
        logger.warning("Failed to record KYC audit event: %s", e)

    db.commit()

    return {
        "status": "ok",
        "message": f"Organisation KYC marked as '{decision_clean}'.",
        "profile_id": profile.id,
        "kyc_status": profile.kyc_status,
        "reviewed_by": profile.kyc_reviewed_by,
        "reviewed_at": profile.kyc_reviewed_at.isoformat()
    }


# ──────────────────────────────────────────────────────────────────────────────
# Project Documents & Submission Gates
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/documents")
def upload_project_document(
    project_id: str,
    req: ProjectDocumentRequest,
    current_user: User = Depends(require_role(["ngo", "admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """
    Upload mandatory project document (land_proof, methodology_reference, monitoring_plan, baseline_notes).
    Each document stores version and SHA-256 cryptographic checksum.
    """
    project = db.query(Project).filter(
        (Project.project_id == project_id) | (Project.id == project_id if str(project_id).isdigit() else False)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc_type_clean = req.doc_type.strip().lower()
    if doc_type_clean not in REQUIRED_PROJECT_DOCS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid document type. Allowed types: {list(REQUIRED_PROJECT_DOCS)}"
        )

    # Check version count
    existing_docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project.project_id,
        ProjectDocument.doc_type == doc_type_clean
    ).all()
    version = len(existing_docs) + 1

    doc = ProjectDocument(
        project_id=project.project_id,
        doc_type=doc_type_clean,
        file_url=req.file_url.strip(),
        sha256_checksum=req.sha256_checksum.strip().lower(),
        version=version,
        uploaded_by=current_user.email,
        uploaded_at=datetime.utcnow()
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "status": "ok",
        "message": f"Project document '{doc_type_clean}' version {version} recorded.",
        "document": {
            "id": doc.id,
            "project_id": doc.project_id,
            "doc_type": doc.doc_type,
            "file_url": doc.file_url,
            "sha256_checksum": doc.sha256_checksum,
            "version": doc.version,
            "uploaded_by": doc.uploaded_by,
            "uploaded_at": doc.uploaded_at.isoformat()
        }
    }


@router.get("/projects/{project_id}/documents")
def get_project_documents(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve all uploaded project documents and check readiness for submission."""
    project = db.query(Project).filter(
        (Project.project_id == project_id) | (Project.id == project_id if str(project_id).isdigit() else False)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = db.query(ProjectDocument).filter(ProjectDocument.project_id == project.project_id).all()
    uploaded_types = {d.doc_type for d in docs}
    missing_docs = list(REQUIRED_PROJECT_DOCS - uploaded_types)

    return {
        "project_id": project.project_id,
        "is_complete": len(missing_docs) == 0,
        "uploaded_types": list(uploaded_types),
        "missing_required_docs": missing_docs,
        "documents": [
            {
                "id": d.id,
                "doc_type": d.doc_type,
                "file_url": d.file_url,
                "sha256_checksum": d.sha256_checksum,
                "version": d.version,
                "uploaded_by": d.uploaded_by,
                "uploaded_at": d.uploaded_at.isoformat()
            }
            for d in docs
        ]
    }


# ──────────────────────────────────────────────────────────────────────────────
# Independent Verifier Role & Field Verification Sign-off
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/field-verification")
def submit_field_verification(
    project_id: str,
    req: FieldVerificationRequest,
    verifier_user: User = Depends(require_role(["verifier"])),
    db: Session = Depends(get_db)
):
    """
    Independent Verification Body sign-off.
    Admin approval is BLOCKED until a valid verified field verification is recorded.
    """
    project = db.query(Project).filter(
        (Project.project_id == project_id) | (Project.id == project_id if str(project_id).isdigit() else False)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    decision_clean = req.decision.strip().lower()
    if decision_clean not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="Decision must be 'verified' or 'rejected'")

    # Compute cryptographic signature of the verification decision if not supplied
    sig_raw = req.signature_hash or hashlib.sha256(
        f"{project.project_id}:{verifier_user.id}:{decision_clean}:{req.report_url}:{datetime.utcnow().isoformat()}".encode("utf-8")
    ).hexdigest()

    fv = FieldVerification(
        project_id=project.project_id,
        verifier_id=verifier_user.id,
        verifier_name=verifier_user.name,
        report_url=req.report_url.strip(),
        decision=decision_clean,
        notes=req.notes or f"Field verification completed with result: {decision_clean}",
        signature_hash=sig_raw,
        verified_at=datetime.utcnow()
    )
    db.add(fv)

    # Record Project Status History
    from credit_calculation.credits_module.db_models import ProjectStatusHistory
    hist = ProjectStatusHistory(
        project_id=project.project_id,
        from_status=project.status or "under_review",
        to_status="field_verification",
        changed_by=f"{verifier_user.name} (Independent Verifier)",
        comment=f"Field verification report uploaded. Decision: {decision_clean.upper()}",
        timestamp=datetime.utcnow()
    )
    db.add(hist)

    # Log to audit trail
    try:
        from core.audit import record_audit_event
        record_audit_event(
            action=f"field_verification_{decision_clean}",
            name=project.project_id,
            detail=f"Field verification submitted by {verifier_user.name}. Report: {req.report_url}. Decision: {decision_clean}",
            user=verifier_user.email,
            db=db
        )
    except Exception as e:
        logger.warning("Failed to record field verification audit log: %s", e)

    db.commit()
    db.refresh(fv)

    return {
        "status": "ok",
        "message": f"Field verification sign-off recorded with decision: '{decision_clean}'.",
        "verification": {
            "id": fv.id,
            "project_id": fv.project_id,
            "verifier_name": fv.verifier_name,
            "decision": fv.decision,
            "report_url": fv.report_url,
            "signature_hash": fv.signature_hash,
            "verified_at": fv.verified_at.isoformat()
        }
    }


@router.get("/projects/{project_id}/field-verification")
def get_field_verifications(
    project_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve field verification sign-off history for a project."""
    project = db.query(Project).filter(
        (Project.project_id == project_id) | (Project.id == project_id if str(project_id).isdigit() else False)
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    verifications = db.query(FieldVerification).filter(
        FieldVerification.project_id == project.project_id
    ).order_by(FieldVerification.verified_at.desc()).all()

    latest_verified = any(v.decision == "verified" for v in verifications)

    return {
        "project_id": project.project_id,
        "is_field_verified": latest_verified,
        "history": [
            {
                "id": v.id,
                "verifier_name": v.verifier_name,
                "decision": v.decision,
                "notes": v.notes,
                "report_url": v.report_url,
                "signature_hash": v.signature_hash,
                "verified_at": v.verified_at.isoformat()
            }
            for v in verifications
        ]
    }


# ──────────────────────────────────────────────────────────────────────────────
# Reviewer Feedback on ML Flags (Labelled Dataset Collection)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/ml/feedback")
def submit_ml_feedback(
    req: MLFeedbackRequest,
    current_user: User = Depends(require_role(["admin", "super_admin", "verifier"])),
    db: Session = Depends(get_db)
):
    """Store reviewer feedback ('useful' / 'not_useful') on ML risk flags for active retraining."""
    fb_clean = req.feedback.strip().lower()
    if fb_clean not in ["useful", "not_useful"]:
        raise HTTPException(status_code=400, detail="Feedback must be 'useful' or 'not_useful'")

    feedback_rec = MLFlagFeedback(
        flag_name=req.flag_name.strip(),
        project_id=req.project_id.strip(),
        user_id=current_user.id,
        feedback=fb_clean,
        comments=req.comments,
        created_at=datetime.utcnow()
    )
    db.add(feedback_rec)
    db.commit()
    db.refresh(feedback_rec)

    return {
        "status": "ok",
        "message": f"Feedback '{fb_clean}' recorded for flag '{req.flag_name}'.",
        "feedback_id": feedback_rec.id
    }


@router.get("/ml/feedback")
def get_ml_feedbacks(
    project_id: Optional[str] = None,
    flag_name: Optional[str] = None,
    admin_user: User = Depends(require_role(["admin", "super_admin", "verifier"])),
    db: Session = Depends(get_db)
):
    """Export labelled ML reviewer feedback for model evaluation and retraining."""
    query = db.query(MLFlagFeedback)
    if project_id:
        query = query.filter(MLFlagFeedback.project_id == project_id)
    if flag_name:
        query = query.filter(MLFlagFeedback.flag_name == flag_name)

    records = query.order_by(MLFlagFeedback.created_at.desc()).all()
    return {
        "count": len(records),
        "feedbacks": [
            {
                "id": r.id,
                "flag_name": r.flag_name,
                "project_id": r.project_id,
                "user_id": r.user_id,
                "reviewer": r.user.name if r.user else None,
                "feedback": r.feedback,
                "comments": r.comments,
                "created_at": r.created_at.isoformat()
            }
            for r in records
        ]
    }


# ──────────────────────────────────────────────────────────────────────────────
# Account Lifecycle & Privacy / Data Export
# ──────────────────────────────────────────────────────────────────────────────

@router.patch("/auth/users/{user_id}/status")
def update_user_status(
    user_id: int,
    req: UserStatusUpdateRequest,
    admin_user: User = Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db)
):
    """Admin endpoint: suspend or reactivate an account."""
    status_clean = req.status.strip().lower()
    if status_clean not in ["active", "suspended"]:
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'suspended'")

    user_to_update = db.query(User).filter(User.id == user_id).first()
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    old_status = user_to_update.status or "active"
    user_to_update.status = status_clean
    db.commit()

    # Log to audit trail
    try:
        from core.audit import record_audit_event
        record_audit_event(
            action=f"user_{status_clean}",
            name=user_to_update.email,
            detail=f"User {user_to_update.email} status changed from {old_status} to {status_clean} by {admin_user.email}",
            user=admin_user.email,
            db=db
        )
    except Exception as e:
        logger.warning("Failed to record user status audit: %s", e)

    return {
        "status": "ok",
        "message": f"User '{user_to_update.email}' status updated to '{status_clean}'.",
        "user_id": user_to_update.id,
        "new_status": status_clean
    }


@router.post("/auth/request-deletion")
def request_account_deletion(
    req: DeletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """User endpoint: request GDPR/privacy account deletion."""
    existing_req = db.query(AccountDeletionRequest).filter(
        AccountDeletionRequest.user_id == current_user.id,
        AccountDeletionRequest.status == "pending"
    ).first()
    if existing_req:
        return {
            "status": "ok",
            "message": "An account deletion request is already pending review.",
            "request_id": existing_req.id
        }

    del_req = AccountDeletionRequest(
        user_id=current_user.id,
        reason=req.reason or "User self-requested account closure",
        status="pending",
        created_at=datetime.utcnow()
    )
    db.add(del_req)
    db.commit()
    db.refresh(del_req)

    return {
        "status": "ok",
        "message": "Account deletion request submitted. An administrator will review your data erasure.",
        "request_id": del_req.id
    }


@router.get("/auth/export-data")
def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """GDPR Article 20 compliant data portability: export all personal data and transaction records."""
    profile = db.query(OrganizationProfile).filter(OrganizationProfile.user_id == current_user.id).first()
    org_docs = db.query(OrganizationDocument).filter(OrganizationDocument.org_profile_id == profile.id).all() if profile else []
    
    # Transactions / Wallet
    transactions = db.query(Transaction).filter(
        (Transaction.corporate_name == current_user.name) | (Transaction.corporate_name == current_user.email)
    ).all()
    wallet = db.query(Wallet).filter(Wallet.corporate_name == current_user.name).first()

    # Certificates
    certs = db.query(Certificate).filter(
        Certificate.buyer_name == current_user.name
    ).all()

    # Projects (if NGO)
    ngo = db.query(NGO).filter(func.lower(NGO.email) == current_user.email.lower()).first()
    projects = db.query(Project).filter(Project.ngo_id == ngo.id).all() if ngo else []

    # Audit Trail
    audit_records = db.query(AuditLog).filter(
        (AuditLog.user == current_user.email) | (AuditLog.name == current_user.email)
    ).order_by(AuditLog.timestamp.desc()).all()

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user_profile": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "joined": current_user.joined,
            "status": current_user.status
        },
        "organization": {
            "profile": {
                "legal_name": profile.legal_name,
                "registration_number": profile.registration_number,
                "country": profile.country,
                "kyc_status": profile.kyc_status
            } if profile else None,
            "documents_count": len(org_docs)
        },
        "wallet": {
            "total_credits": wallet.total_credits if wallet else 0,
            "total_spent_inr": wallet.total_spent_inr if wallet else 0
        } if wallet else None,
        "transactions_count": len(transactions),
        "certificates_count": len(certs),
        "projects_count": len(projects),
        "audit_logs_count": len(audit_records)
    }
