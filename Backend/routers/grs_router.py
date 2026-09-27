# grs_engine.py

from pydantic import BaseModel
from typing import Dict
import math

from fastapi import APIRouter
router = APIRouter()

# -------------------------
# In-Memory Database
# -------------------------

corporates: Dict[str, dict] = {
    "Microsoft Sustainability": {
        "GRS": 88.5,
        "Badge": "Platinum",
        "Breakdown": {"Impact Score": 92.0, "Quality Score": 89.5, "Commitment Score": 85.0, "Credibility Score": 87.0}
    },
    "Google Carbon Team": {
        "GRS": 84.2,
        "Badge": "Gold",
        "Breakdown": {"Impact Score": 88.0, "Quality Score": 85.0, "Commitment Score": 80.0, "Credibility Score": 83.5}
    },
    "HSBC Green Finance": {
        "GRS": 76.8,
        "Badge": "Gold",
        "Breakdown": {"Impact Score": 79.0, "Quality Score": 77.0, "Commitment Score": 75.0, "Credibility Score": 76.0}
    },
    "Shell Renewables": {
        "GRS": 68.4,
        "Badge": "Silver",
        "Breakdown": {"Impact Score": 70.0, "Quality Score": 69.0, "Commitment Score": 65.0, "Credibility Score": 69.0}
    }
}


# -------------------------
# Input Model
# -------------------------

class CorporateImpact(BaseModel):
    company_name: str

    # Climate Impact
    total_carbon_funded: float
    avg_survival_probability: float
    avg_project_suitability: float
    avg_project_risk: float

    # Governance
    years_committed: int
    transparency_score: float
    verification_score: float


# -------------------------
# Core GRS Formula (Unbiased)
# -------------------------

def calculate_grs(data: CorporateImpact):

    # 1️⃣ Effective Climate Impact
    effective_carbon = (
        data.total_carbon_funded *
        data.avg_survival_probability
    )

    # Log scaling removes size bias
    impact_score = min(math.log1p(effective_carbon) / 12, 1) * 100

    # 2️⃣ Project Quality
    quality_score = (
        (data.avg_project_suitability / 100) * 0.6 +
        (1 - data.avg_project_risk) * 0.4
    ) * 100

    # 3️⃣ Long-Term Commitment
    commitment_score = min(data.years_committed / 15, 1) * 100

    # 4️⃣ Transparency & Verification
    credibility_score = (
        data.transparency_score * 0.5 +
        data.verification_score * 0.5
    )

    # Final Weighted Score
    grs = (
        impact_score * 0.35 +
        quality_score * 0.25 +
        commitment_score * 0.20 +
        credibility_score * 0.20
    )

    breakdown = {
        "Impact Score": round(impact_score, 2),
        "Quality Score": round(quality_score, 2),
        "Commitment Score": round(commitment_score, 2),
        "Credibility Score": round(credibility_score, 2)
    }

    return round(grs, 2), breakdown


# -------------------------
# Badge Logic
# -------------------------

def badge_from_score(score):

    if score >= 85:
        return "Platinum"
    elif score >= 70:
        return "Gold"
    elif score >= 55:
        return "Silver"
    elif score >= 40:
        return "Bronze"
    else:
        return "Starter"


# -------------------------
# Leaderboard Builder
# -------------------------

def build_leaderboard():

    sorted_companies = sorted(
        corporates.items(),
        key=lambda x: x[1]["GRS"],
        reverse=True
    )

    leaderboard = []

    rank = 1
    for company, data in sorted_companies:
        leaderboard.append({
            "Rank": rank,
            "Company": company,
            "GRS": data["GRS"],
            "Badge": data["Badge"]
        })
        rank += 1

    return leaderboard


# -------------------------
# API Endpoints
# -------------------------

@router.post("/calculate-grs")
def compute_grs(data: CorporateImpact):

    score, breakdown = calculate_grs(data)
    badge = badge_from_score(score)

    # Save / Update company
    corporates[data.company_name] = {
        "GRS": score,
        "Badge": badge,
        "Breakdown": breakdown
    }

    return {
        "Company": data.company_name,
        "Green Reputation Score": score,
        "Badge": badge,
        "Breakdown": breakdown,
        "Message": "GRS calculated successfully. Use /leaderboard to view rankings."
    }


@router.get("/leaderboard")
def get_leaderboard():
    return build_leaderboard()

print("GRS router loaded")