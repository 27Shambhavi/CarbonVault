# credits_module/api.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from .models import MLProjectInput
from .calculator import CreditCalculator
from .db import SessionLocal
from .db_models import ProjectCredits, FundingDetails, Project

router = APIRouter(prefix="/credits")
calculator = CreditCalculator()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("Credits router loaded")

@router.post("/process")
def process_credits(
    ml_input: MLProjectInput,
    verification_score: float,
    market_price_per_ton: float,
    db: Session = Depends(get_db)
):
    try:
        result = calculator.process_project(
            ml_input,
            verification_score,
            market_price_per_ton
        )

        # Save Credits
        credit_entry = ProjectCredits(
            project_id=result["project_id"],
            total_shadow_credits=result["shadow_credits_first_5_years"],
            verified_credits=result["live_credit_data"]["verified_credits"],
            certificate_id=result["live_credit_data"]["certificate_id"],
            issuance_date=result["live_credit_data"]["issuance_date"],
            expiry_date=result["live_credit_data"]["expiry_date"]
        )

        db.add(credit_entry)

        # Save Funding
        funding_entry = FundingDetails(
            project_id=result["project_id"],
            price_per_ton=result["funding_data"]["price_per_ton"],
            ecosystem_multiplier=result["funding_data"]["ecosystem_multiplier"],
            total_funding=result["funding_data"]["total_funding"]
        )

        db.add(funding_entry)

        # Update Project with credits and price
        project = db.query(Project).filter(Project.project_id == result["project_id"]).first()
        if project:
            project.credits = result["live_credit_data"]["verified_credits"]
            project.price = result["funding_data"]["price_per_ton"]

        db.commit()

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))