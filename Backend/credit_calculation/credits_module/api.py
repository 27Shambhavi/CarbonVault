# credits_module/api.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime, date
import uuid

from .models import MLProjectInput
from .calculator import CreditCalculator
from .db import SessionLocal
from .db_models import ProjectCredits, FundingDetails, Project, Wallet, Transaction

router = APIRouter(prefix="/credits")
calculator = CreditCalculator()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MintCreditsRequest(BaseModel):
    project_id: str
    credits: float
    certificate_id: Optional[str] = None


class TransferCreditsRequest(BaseModel):
    from_entity: str
    to_entity: str
    quantity: float
    project_id: Optional[str] = None


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


@router.get("/balance/{corporate}")
def get_credit_balance(corporate: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.corporate_name == corporate).first()
    if not wallet:
        return {
            "corporate_name": corporate,
            "total_credits": 0.0,
            "total_spent_inr": 0.0,
            "last_purchase_date": None
        }
    return {
        "corporate_name": wallet.corporate_name,
        "total_credits": wallet.total_credits or 0.0,
        "total_spent_inr": wallet.total_spent_inr or 0.0,
        "last_purchase_date": str(wallet.last_purchase_date) if wallet.last_purchase_date else None
    }


@router.post("/mint")
def mint_credits(req: MintCreditsRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.project_id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from routers.certificate_router import generate_certificate_public_id, compute_certificate_hash
    from credit_calculation.credits_module.db_models import Certificate, NGO

    now_dt = datetime.utcnow()
    ngo = db.query(NGO).filter(NGO.id == project.ngo_id).first() if project.ngo_id else None
    beneficiary = ngo.name if ngo else "Registered Project Developer"

    existing_cert = db.query(Certificate).filter(
        Certificate.project_id == project.project_id,
        Certificate.type == "project_verification"
    ).first()

    if existing_cert:
        existing_cert.tonnes = (existing_cert.tonnes or 0.0) + float(req.credits)
        existing_cert.sha256_hash = compute_certificate_hash(
            existing_cert.public_id, project.project_id, existing_cert.tonnes, existing_cert.issued_at, beneficiary
        )
        cert_id = existing_cert.public_id
    else:
        cert_id = req.certificate_id or generate_certificate_public_id(now_dt)
        cert_hash = compute_certificate_hash(
            cert_id, project.project_id, float(req.credits), now_dt, beneficiary
        )
        new_cert = Certificate(
            public_id=cert_id,
            project_id=project.project_id,
            transaction_id=None,
            buyer_name=None,
            tonnes=float(req.credits),
            issued_at=now_dt,
            sha256_hash=cert_hash,
            type="project_verification"
        )
        db.add(new_cert)

    today = now_dt.date()

    credit_entry = db.query(ProjectCredits).filter(ProjectCredits.project_id == req.project_id).first()
    if credit_entry:
        credit_entry.verified_credits = (credit_entry.verified_credits or 0.0) + req.credits
        credit_entry.certificate_id = cert_id
    else:
        credit_entry = ProjectCredits(
            project_id=req.project_id,
            total_shadow_credits=req.credits * 3.5,
            verified_credits=req.credits,
            certificate_id=cert_id,
            issuance_date=today,
            expiry_date=today.replace(year=today.year + 5)
        )
        db.add(credit_entry)

    project.credits = (project.credits or 0.0) + req.credits
    db.commit()

    return {
        "message": f"Successfully minted {req.credits} credits",
        "project_id": req.project_id,
        "total_credits": project.credits,
        "certificate_id": cert_id
    }


@router.post("/transfer")
def transfer_credits(req: TransferCreditsRequest, db: Session = Depends(get_db)):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than 0")

    from_wallet = db.query(Wallet).filter(Wallet.corporate_name == req.from_entity).first()
    if not from_wallet or (from_wallet.total_credits or 0.0) < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient credit balance in source wallet")

    to_wallet = db.query(Wallet).filter(Wallet.corporate_name == req.to_entity).first()
    if not to_wallet:
        to_wallet = Wallet(corporate_name=req.to_entity, total_credits=0.0, total_spent_inr=0.0)
        db.add(to_wallet)

    from_wallet.total_credits = (from_wallet.total_credits or 0.0) - req.quantity
    to_wallet.total_credits = (to_wallet.total_credits or 0.0) + req.quantity

    # Record transfer transaction
    txn = Transaction(
        razorpay_order_id=f"txfr_{uuid.uuid4().hex[:10]}",
        razorpay_payment_id=f"txfr_{uuid.uuid4().hex[:10]}",
        project_id=req.project_id or "TRANSFER",
        project_name=f"Transfer: {req.from_entity} -> {req.to_entity}",
        corporate_name=req.to_entity,
        quantity=req.quantity,
        price_per_ton=0.0,
        amount_inr=0.0,
        amount_usd=0.0,
        status="completed",
        created_at=datetime.utcnow().date()
    )
    db.add(txn)
    db.commit()

    return {
        "message": f"Transferred {req.quantity} credits from {req.from_entity} to {req.to_entity}",
        "from_entity": req.from_entity,
        "from_balance": from_wallet.total_credits,
        "to_entity": req.to_entity,
        "to_balance": to_wallet.total_credits
    }