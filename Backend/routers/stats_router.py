"""
Backend/routers/stats_router.py
Provides dynamic statistics computed directly from the database:
  - GET /stats/overview?role=...&period=30d:
    Returns {value, previous, delta_pct, as_of} per KPI computed from real DB data.
    The UI renders the trend arrow only when `previous` is not null.
  - GET /public/stats:
    Returns live platform aggregates for public landing & login pages.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from credit_calculation.credits_module.db import get_db
from credit_calculation.credits_module.db_models import (
    Project, FundingDetails, Transaction, Wallet, ProjectCredits, NGO,
    AuditLog, Certificate, User
)

router = APIRouter(tags=["Statistics"])


def compute_delta(current: float, previous: Optional[float]) -> Optional[float]:
    if previous is None or previous == 0:
        return None
    return round(((current - previous) / previous) * 100.0, 1)


@router.get("/stats/overview")
def get_stats_overview(
    role: str = Query("admin"),
    period: str = Query("30d"),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Computes real KPIs and their previous-period comparisons from the database.
    Eliminates all hardcoded '+12%' or '-4%' constants.
    """
    now = datetime.utcnow()
    days = 30
    if period.endswith("d"):
        try:
            days = int(period[:-1])
        except ValueError:
            days = 30
    cutoff = now - timedelta(days=days)
    as_of = now.isoformat() + "Z"

    def is_before(val) -> bool:
        if not val:
            return False
        if isinstance(val, datetime):
            return val < cutoff
        from datetime import date as d_type
        if isinstance(val, d_type):
            return val < cutoff.date()
        return False

    if role == "admin":
        # 1. Total Credits Minted
        approved_all = db.query(Project).filter(Project.status == "approved").all()
        current_credits = sum(p.credits or 0 for p in approved_all)

        # Estimate previous period credits from projects created before cutoff
        prev_projects = [p for p in approved_all if is_before(p.created_at)]
        prev_credits = sum(p.credits or 0 for p in prev_projects) if prev_projects else None

        # 2. Active Projects
        current_active = len(approved_all)
        prev_active = len(prev_projects) if prev_projects else None

        # 3. Pending Reviews
        pending_all = db.query(Project).filter(Project.status == "pending").all()
        current_pending = len(pending_all)
        prev_pending = sum(1 for p in pending_all if is_before(p.created_at)) if len(pending_all) > 1 else None

        # 4. Flagged for Fraud
        all_projects = db.query(Project).all()
        current_flagged = sum(1 for p in all_projects if (p.fraud_risk or 0) > 50)
        prev_flagged = sum(1 for p in all_projects if (p.fraud_risk or 0) > 50 and is_before(p.created_at)) if all_projects else None

        # 5. Approval Rate
        decided = sum(1 for p in all_projects if p.status in ("approved", "rejected"))
        approval_rate = round((current_active / decided * 100.0), 1) if decided > 0 else 100.0

        return {
            "role": "admin",
            "period": period,
            "as_of": as_of,
            "kpis": {
                "total_credits": {
                    "value": round(current_credits, 1),
                    "previous": round(prev_credits, 1) if prev_credits is not None else None,
                    "delta_pct": compute_delta(current_credits, prev_credits),
                    "label": "Total Credits Minted",
                    "unit": "tCO₂e"
                },
                "active_projects": {
                    "value": current_active,
                    "previous": prev_active,
                    "delta_pct": compute_delta(current_active, prev_active),
                    "label": "Active Projects",
                    "unit": "projects"
                },
                "pending_reviews": {
                    "value": current_pending,
                    "previous": prev_pending,
                    "delta_pct": compute_delta(current_pending, prev_pending),
                    "label": "Pending Reviews",
                    "unit": "reviews"
                },
                "fraud_flags": {
                    "value": current_flagged,
                    "previous": prev_flagged,
                    "delta_pct": compute_delta(current_flagged, prev_flagged),
                    "label": "Fraud Flags",
                    "unit": "flags"
                },
                "approval_rate": {
                    "value": approval_rate,
                    "previous": None,
                    "delta_pct": None,
                    "label": "Approval Rate",
                    "unit": "%"
                }
            }
        }

    elif role == "ngo":
        # Find NGO by email or default first
        ngo = None
        if email:
            ngo = db.query(NGO).filter(NGO.email == email).first()
        if not ngo:
            ngo = db.query(NGO).first()

        ngo_id = ngo.id if ngo else 1
        ngo_projects = db.query(Project).filter(Project.ngo_id == ngo_id).all()
        approved = [p for p in ngo_projects if p.status == "approved"]
        credits_minted = sum(p.credits or 0 for p in approved)
        prev_approved = [p for p in approved if is_before(p.created_at)]
        prev_credits = sum(p.credits or 0 for p in prev_approved) if prev_approved else None

        funding_rows = db.query(FundingDetails).filter(
            FundingDetails.project_id.in_([p.project_id for p in approved])
        ).all()
        total_funding = sum(f.total_funding or 0 for f in funding_rows)

        return {
            "role": "ngo",
            "period": period,
            "as_of": as_of,
            "kpis": {
                "verified_credits": {
                    "value": round(credits_minted, 1),
                    "previous": round(prev_credits, 1) if prev_credits is not None else None,
                    "delta_pct": compute_delta(credits_minted, prev_credits),
                    "label": "Verified Credits",
                    "unit": "tCO₂e"
                },
                "active_projects": {
                    "value": len(approved),
                    "previous": len(prev_approved) if prev_approved else None,
                    "delta_pct": compute_delta(len(approved), len(prev_approved) if prev_approved else None),
                    "label": "Active Projects",
                    "unit": "projects"
                },
                "total_funding": {
                    "value": round(total_funding, 2),
                    "previous": None,
                    "delta_pct": None,
                    "label": "Total Funding Received",
                    "unit": "USD"
                }
            }
        }

    else:
        # Corporate or public
        corp_name = email or "Microsoft Sustainability"
        wallet = db.query(Wallet).filter(Wallet.corporate_name == corp_name).first()
        total_credits = wallet.total_credits if wallet else 0.0
        total_spent = wallet.total_spent_inr if wallet else 0.0

        return {
            "role": role,
            "period": period,
            "as_of": as_of,
            "kpis": {
                "credits_retired": {
                    "value": round(total_credits, 1),
                    "previous": None,
                    "delta_pct": None,
                    "label": "Credits Held / Retired",
                    "unit": "tCO₂e"
                },
                "total_spent_inr": {
                    "value": round(total_spent, 2),
                    "previous": None,
                    "delta_pct": None,
                    "label": "Capital Deployed",
                    "unit": "INR"
                }
            }
        }


@router.get("/public/stats")
def get_public_stats(db: Session = Depends(get_db)):
    """
    Real public metrics computed dynamically from database tables.
    Single source of truth used across LoginPage, Impact Stats, and Dashboards.
    Computes: credits issued, active projects, audits conducted, certificates, fraud flags, approval rate.
    """
    total_projects = db.query(Project).count()
    approved_projects = db.query(Project).filter(Project.status == "approved").all()
    credits_issued = sum(p.credits or 0 for p in approved_projects)
    active_projects_count = len(approved_projects)
    
    audits_conducted = db.query(AuditLog).count()
    certificates_issued = db.query(Certificate).count()
    
    # Fraud flags identified
    fraud_flags = db.query(Project).filter(Project.fraud_risk > 15.0).count()
    
    # Real approval rate
    approval_rate = round((active_projects_count / total_projects * 100.0), 1) if total_projects > 0 else 0.0
    
    # Organizations
    ngos_count = db.query(NGO).count()
    corps_count = db.query(User).filter(User.role == "corporate").count()
    total_orgs = ngos_count + corps_count

    funding_rows = db.query(FundingDetails).all()
    total_funding = sum(f.total_funding or 0 for f in funding_rows)
    txns = db.query(Transaction).all()
    total_tx_usd = sum(t.amount_usd or 0 for t in txns)

    return {
        "credits_issued": round(credits_issued, 0),
        "total_tonnes_sequestered": round(credits_issued, 0),
        "active_projects": active_projects_count,
        "verified_projects_count": active_projects_count,
        "total_projects": total_projects,
        "audits_conducted": audits_conducted,
        "certificates_issued": certificates_issued,
        "fraud_flags": fraud_flags,
        "approval_rate_pct": approval_rate,
        "active_organisations": total_orgs,
        "active_ngos_count": ngos_count,
        "corporate_buyers_count": corps_count,
        "total_capital_deployed_usd": round(total_funding + total_tx_usd, 0),
        "as_of": datetime.utcnow().isoformat() + "Z",
        "source": "CarbonVault Verified Ledger Database"
    }
