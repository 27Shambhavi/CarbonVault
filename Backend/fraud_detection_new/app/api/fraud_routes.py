# app/api/fraud_routes.py
"""
FastAPI router for fraud detection & screening endpoints.
Includes:
- POST /fraud/precheck: Non-recording dry-run for NGOs prior to submission.
- POST /fraud/projects/{project_id}/rerun: Trigger full 5-check screening pipeline with SSE.
- GET  /fraud/projects/{project_id}/report: Fetch latest screening run, 5 checks, and history.
- POST /fraud/projects/{project_id}/explanation: Submit explanatory note for flagged items.
- POST /fraud/checks/{check_id}/feedback: Record verifier feedback on check utility.
- POST /fraud/check-project: Legacy validator endpoint for backwards compatibility.
"""

import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    FraudRun, FraudCheck, Project, MLFlagFeedback, AuditLog
)
from services.screening_service import (
    run_project_screening, precheck_project_dryrun
)
from ..services.fraud_service import run_fraud_detection

logger = logging.getLogger("carbonvault.fraud_routes")
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

class PrecheckRequest(BaseModel):
    project_id: Optional[str] = "PRECHECK-TEMP"
    name: Optional[str] = None
    plantation_type: Optional[str] = "mangrove"
    area_hectares: Optional[float] = 10.0
    number_of_trees: Optional[int] = 5000
    polygon_wkt: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photos: Optional[List[str]] = None


class ExplanationRequest(BaseModel):
    explanation: str = Field(..., min_length=5, description="Explanatory context or corrective notes")
    user_name: Optional[str] = "Project Lead"


class CheckFeedbackRequest(BaseModel):
    useful: bool = Field(..., description="True if check was actionable/useful, False otherwise")
    comments: Optional[str] = None
    user_id: Optional[int] = 1


class LegacyFraudCheckRequest(BaseModel):
    project_id: str = Field(..., description="ID or UUID of the project to check")
    polygon_wkt: Optional[str] = Field("", description="WKT polygon, e.g. POLYGON((...)) ")
    image_path: Optional[str] = Field("", description="Path or filename of the uploaded image file")


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/precheck")
def precheck_project(req: PrecheckRequest):
    """
    Non-recording pre-flight check endpoint for NGOs.
    Validates boundary geometry, EXIF GPS tags, perceptual hash uniqueness,
    and allometric feasibility in-memory without saving to database.
    """
    db = SessionLocal()
    try:
        data = req.model_dump() if hasattr(req, "model_dump") else req.dict()
        return precheck_project_dryrun(data, db)
    finally:
        db.close()


@router.post("/projects/{project_id}/rerun")
def rerun_project_screening(project_id: str, trigger: str = "manual_rerun"):
    """
    Trigger a full re-evaluation of the 5 screening checks:
    - geo_boundary
    - photo_gps_exif
    - perceptual_hash
    - satellite_ndvi
    - ecological_isolation
    Emits live SSE events and persists the new run.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found.")

        result = run_project_screening(project_id, db, trigger=trigger, save_to_db=True)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error running screening for project %s", project_id)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/projects/{project_id}/report")
def get_project_screening_report(project_id: str):
    """
    Fetch the latest screening report for a project, including all 5 check results,
    explanation history, and feedback flags.
    If no screening has been run yet, automatically executes an initial screening.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found.")

        latest_run = db.query(FraudRun).filter(
            FraudRun.project_id == project_id
        ).order_by(FraudRun.id.desc()).first()

        if not latest_run:
            # Run initial screening
            return run_project_screening(project_id, db, trigger="initial_report", save_to_db=True)

        # Build report from persisted records
        checks_data = []
        for c in latest_run.checks:
            try:
                details = json.loads(c.details) if c.details else {}
            except Exception:
                details = {}
            try:
                evidence = json.loads(c.evidence_refs) if c.evidence_refs else []
            except Exception:
                evidence = []

            # Check if verifier feedback exists in details or ml_flag_feedbacks
            feedback_useful = details.get("feedback_useful")
            feedback_comments = details.get("feedback_comments")

            checks_data.append({
                "id": c.id,
                "validator": c.validator,
                "status": c.status,
                "score": c.score,
                "reason": c.reason,
                "metric_value": details.get("metric_value", f"Score: {c.score}"),
                "threshold": details.get("threshold", "Standard bounds"),
                "recommendation": details.get("recommendation", "None required."),
                "details": details,
                "evidence_refs": evidence,
                "feedback_useful": feedback_useful,
                "feedback_comments": feedback_comments
            })

        integrity_score = round((1.0 - (latest_run.risk_index or 0.2)) * 100.0, 1)

        return {
            "run_id": latest_run.id,
            "project_id": project_id,
            "project_name": project.name,
            "overall_status": latest_run.overall_status,
            "overall_label": {
                "consistent": "Looks consistent",
                "needs_attention": "Needs attention",
                "manual_review": "Needs manual review"
            }.get(latest_run.overall_status, latest_run.overall_status),
            "risk_index": latest_run.risk_index,
            "integrity_score": integrity_score,
            "model_version": latest_run.model_version,
            "trigger": latest_run.trigger,
            "started_at": latest_run.started_at.isoformat() + "Z" if latest_run.started_at else None,
            "finished_at": latest_run.finished_at.isoformat() + "Z" if latest_run.finished_at else None,
            "explanation": latest_run.explanation,
            "checks": checks_data
        }
    finally:
        db.close()


@router.post("/projects/{project_id}/explanation")
def submit_project_explanation(project_id: str, req: ExplanationRequest):
    """
    Allow NGO to submit explanatory context for any flagged checks.
    Attaches explanation to the latest FraudRun and logs an immutable entry in the audit trail.
    """
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found.")

        latest_run = db.query(FraudRun).filter(
            FraudRun.project_id == project_id
        ).order_by(FraudRun.id.desc()).first()

        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        formatted_explanation = f"[{now_str} by {req.user_name}]: {req.explanation.strip()}"

        if latest_run:
            if latest_run.explanation:
                latest_run.explanation = f"{latest_run.explanation}\n\n{formatted_explanation}"
            else:
                latest_run.explanation = formatted_explanation

        # Record in cryptographic audit trail
        try:
            from core.audit import record_audit_event
            record_audit_event(
                action="screening_explanation",
                name=project_id,
                detail=f"Explanatory response submitted by {req.user_name}: {req.explanation[:120]}...",
                user=req.user_name,
                db=db
            )
        except Exception as e:
            logger.warning("Failed to record audit event: %s", e)

        db.commit()

        return {
            "status": "ok",
            "project_id": project_id,
            "message": "Explanation recorded successfully in audit trail.",
            "explanation": formatted_explanation
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/checks/{check_id}/feedback")
def submit_check_feedback(check_id: int, req: CheckFeedbackRequest):
    """
    Record verifier feedback on whether a flagged screening check was useful or a false positive.
    Updates the FraudCheck details and records a row in `ml_flag_feedbacks`.
    """
    db = SessionLocal()
    try:
        check = db.query(FraudCheck).filter(FraudCheck.id == check_id).first()
        if not check:
            raise HTTPException(status_code=404, detail=f"Screening check {check_id} not found.")

        # Update details JSON
        try:
            details = json.loads(check.details) if check.details else {}
        except Exception:
            details = {}

        details["feedback_useful"] = req.useful
        details["feedback_comments"] = req.comments
        details["feedback_recorded_at"] = datetime.utcnow().isoformat() + "Z"
        check.details = json.dumps(details)

        # Also persist to ml_flag_feedbacks table
        feedback_row = MLFlagFeedback(
            flag_name=check.validator,
            project_id=check.run.project_id if check.run else "UNKNOWN",
            user_id=req.user_id or 1,
            feedback="useful" if req.useful else "not_useful",
            comments=req.comments,
            created_at=datetime.utcnow()
        )
        db.add(feedback_row)
        db.commit()

        return {
            "status": "ok",
            "check_id": check_id,
            "validator": check.validator,
            "feedback": "useful" if req.useful else "not_useful",
            "message": "Verifier feedback recorded successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/check-project")
def check_project_legacy(req: LegacyFraudCheckRequest):
    """Legacy backward-compatible fraud detection check."""
    return run_fraud_detection(req.project_id, req.polygon_wkt or "", req.image_path or "")