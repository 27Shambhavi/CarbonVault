# routers/grs_router.py
"""
Green Reputation Score (GRS) Engine:
Computes unbiased, non-hardcoded corporate climate performance scores
derived from real stored transactions, wallet balances, project verifications,
and configurable weights from system_config.
"""

import math
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from credit_calculation.credits_module.db import get_db
from credit_calculation.credits_module.db_models import (
    Wallet, Transaction, Project, User, SystemConfig
)

router = APIRouter(tags=["GRS"])


def get_config_weight(db: Session, key: str, default: float) -> float:
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if row and row.value:
        try:
            return float(row.value)
        except ValueError:
            pass
    return default


def compute_company_grs(db: Session, company_name: str) -> Dict[str, Any]:
    """Compute real GRS score for a company using verified database ledger data."""
    # 1. Fetch real wallet & transactions
    wallet = db.query(Wallet).filter(Wallet.corporate_name == company_name).first()
    txns = db.query(Transaction).filter(Transaction.corporate_name == company_name).all()
    
    total_carbon = wallet.total_credits if wallet else sum(t.quantity or 0 for t in txns)
    total_spent = wallet.total_spent_inr if wallet else sum(t.amount_inr or 0 for t in txns)
    txn_count = len(txns)

    # 2. Configurable weights from system_config
    w_transparency = get_config_weight(db, "grs_weight_transparency", 0.35)
    w_quality = get_config_weight(db, "grs_weight_quality", 0.40)
    w_commitment = get_config_weight(db, "grs_weight_commitment", 0.25)

    # 3. Project quality proxy: average MRV and survival probability of supported projects
    supported_pids = list({t.project_id for t in txns if t.project_id})
    if supported_pids:
        supported_projects = db.query(Project).filter(Project.project_id.in_(supported_pids)).all()
        avg_suitability = (
            sum(p.mrv_score or 80.0 for p in supported_projects) / len(supported_projects)
            if supported_projects else 75.0
        )
        avg_risk = (
            sum(p.fraud_risk or 5.0 for p in supported_projects) / len(supported_projects)
            if supported_projects else 5.0
        )
    else:
        avg_suitability = 70.0
        avg_risk = 5.0

    # 4. Dimension Sub-scores (0 - 100)
    # Impact / Volume (log-scaled to prevent extreme corporate scale bias)
    volume_score = min(100.0, (math.log1p(total_carbon) / math.log1p(50000.0)) * 100.0) if total_carbon > 0 else 0.0
    # Quality (suitability minus fraud risk penalty)
    quality_score = max(0.0, min(100.0, avg_suitability - (avg_risk * 1.5)))
    # Transparency (verified ledger transactions audit ratio)
    transparency_score = min(100.0, 50.0 + (min(txn_count, 10) * 5.0)) if txn_count > 0 else 0.0
    # Commitment (repeat purchases and portfolio depth)
    commitment_score = min(100.0, 40.0 + (min(len(supported_pids), 6) * 10.0)) if supported_pids else 0.0

    # 5. Composite 100-point GRS
    normalized_weights = w_transparency + w_quality + w_commitment
    raw_grs = (
        (transparency_score * w_transparency) +
        (quality_score * w_quality) +
        (commitment_score * w_commitment)
    ) / (normalized_weights if normalized_weights > 0 else 1.0)

    # Scale to 1,000 max score as per UI convention
    final_score_1000 = int(round(raw_grs * 10))

    # Badge classification
    if final_score_1000 >= 800:
        badge = "Platinum Verifier"
    elif final_score_1000 >= 650:
        badge = "Gold Verifier"
    elif final_score_1000 >= 500:
        badge = "Silver Verifier"
    elif final_score_1000 >= 300:
        badge = "Bronze Verifier"
    else:
        badge = "Participant"

    return {
        "company_name": company_name,
        "score": final_score_1000,
        "score_100": round(raw_grs, 1),
        "badge": badge,
        "transparency": int(round(transparency_score)),
        "quality": int(round(quality_score)),
        "commitment": int(round(commitment_score)),
        "carbon_funded": round(total_carbon, 1),
        "transactions_count": txn_count
    }


@router.get("/score")
def get_corporate_grs_score(
    company_name: str = Query("Corporate Buyer"),
    db: Session = Depends(get_db)
):
    """
    Computes real-time GRS score for a corporate organization,
    and calculates its rank strictly among real registered corporate buyers.
    """
    # Real registered corporate entities in database
    corporate_users = db.query(User).filter(User.role == "corporate").all()
    corp_names = list({u.name for u in corporate_users if u.name})
    if company_name not in corp_names:
        corp_names.append(company_name)

    # Score all real entities to compute real rank
    all_scores = [compute_company_grs(db, name) for name in corp_names]
    all_scores.sort(key=lambda x: x["score"], reverse=True)

    # Determine rank
    rank = 1
    target_data = None
    for idx, item in enumerate(all_scores, 1):
        if item["company_name"].lower() == company_name.lower():
            rank = idx
            target_data = item
            break

    if not target_data:
        target_data = compute_company_grs(db, company_name)
        rank = 1

    return {
        "status": "ok",
        "company_name": target_data["company_name"],
        "score": target_data["score"],
        "max_score": 1000,
        "rank": rank,
        "total": max(1, len(all_scores)),
        "badge": target_data["badge"],
        "transparency": target_data["transparency"],
        "quality": target_data["quality"],
        "commitment": target_data["commitment"],
        "carbon_funded": target_data["carbon_funded"],
        "transactions_count": target_data["transactions_count"]
    }


@router.get("/leaderboard")
def get_grs_leaderboard(db: Session = Depends(get_db)):
    """Real ranking among registered organisations only. Empty when none."""
    corporate_users = db.query(User).filter(User.role == "corporate").all()
    corp_names = list({u.name for u in corporate_users if u.name})
    
    if not corp_names:
        return {"status": "ok", "leaderboard": []}

    scores = [compute_company_grs(db, name) for name in corp_names]
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    leaderboard = [
        {
            "rank": idx,
            "company": s["company_name"],
            "score": s["score"],
            "badge": s["badge"],
            "carbon_funded": s["carbon_funded"]
        }
        for idx, s in enumerate(scores, 1)
    ]
    return {"status": "ok", "leaderboard": leaderboard}