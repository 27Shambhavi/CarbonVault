# routers/payment_router.py
"""
Razorpay payment integration:
  POST /create-order  — creates Razorpay order (amount in INR → paise)
  POST /buy-credits   — verifies payment + stores transaction
  GET  /transactions/{company} — returns transactions for a corporate
  GET  /wallet/{company}       — returns wallet summary
"""

import os
import hmac
import hashlib
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, FundingDetails, Transaction, Wallet, ProjectCredits, CorporateRequest

# ── Razorpay SDK setup ──────────────────────────────────────────────────
# ── Razorpay SDK setup ──────────────────────────────────────────────────
try:
    from core.config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, INR_USD_RATE
except ImportError:
    RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_SXyS0q18CPS1p1")
    RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "9m0Tq4EB8zFLXKJUgzgmCy9I")
    INR_USD_RATE = float(os.getenv("INR_USD_RATE", "83.5"))

try:
    import razorpay

    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logger.info("[OK] Razorpay client initialized")
    else:
        razorpay_client = None
        logger.warning("Razorpay keys not set — payment will use fallback mode")

except ImportError:
    razorpay_client = None
    logger.warning("razorpay package not installed — payment will use fallback mode")


# ── Schemas ─────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount: float        # Amount in INR (NOT paise)
    currency: str = "INR"
    project_id: Optional[str] = None
    corporate_name: Optional[str] = None


class BuyCreditsRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    project_id: str
    corporate_name: str
    quantity: float      # tonnes of credits
    amount: float        # INR paid


# ── POST /create-order ──────────────────────────────────────────────────

@router.post("/create-order")
def create_order(req: CreateOrderRequest):
    """
    Create a Razorpay order.

    Frontend sends amount in INR (e.g., 83500 for ₹83,500).
    Backend converts to paise: amount_paise = int(amount * 100).
    NO double conversion.
    """
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    amount_paise = int(round(req.amount * 100))

    # Razorpay test mode has a hard per-transaction limit of ₹5,00,000 (50,000,000 paise)
    is_test_mode = (RAZORPAY_KEY_ID or "").startswith("rzp_test_")
    if is_test_mode and amount_paise > 50000000:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Razorpay Test Mode limit reached: The maximum single-order amount allowed in test mode is ₹5,00,000 (INR 5 Lakhs). "
                f"Your order total is ₹{req.amount:,.2f}. Please reduce the quantity (e.g., 25–50 tonnes) to complete a test payment."
            )
        )

    if razorpay_client:
        try:
            order_data = {
                "amount": amount_paise,
                "currency": req.currency,
                "payment_capture": 1,  # auto-capture
                "notes": {
                    "project_id": req.project_id or "",
                    "corporate_name": req.corporate_name or "",
                },
            }
            order = razorpay_client.order.create(data=order_data)
            logger.info("Razorpay order created: %s (₹%s)", order["id"], req.amount)
            return {
                "id": order["id"],
                "amount": order["amount"],       # paise
                "amount_inr": req.amount,         # INR for display
                "currency": order["currency"],
                "key_id": RAZORPAY_KEY_ID,        # safe to send — this is the public key
            }
        except Exception as e:
            logger.exception("Razorpay order creation failed: %s", e)
            error_msg = str(e)
            if hasattr(e, "error") and isinstance(e.error, dict):
                error_msg = e.error.get("description", error_msg)
            elif "Amount exceeds maximum amount allowed" in error_msg:
                error_msg = (
                    f"Razorpay limit reached: The amount ₹{req.amount:,.2f} exceeds the maximum permitted by your Razorpay account. "
                    f"In test mode, maximum order amount is ₹5,00,000."
                )
            status_code = 400 if ("limit" in error_msg.lower() or "amount" in error_msg.lower() or "exceeds" in error_msg.lower()) else 500
            raise HTTPException(status_code=status_code, detail=f"Payment gateway error: {error_msg}")
    else:
        # Fallback for demo/testing when Razorpay SDK not available
        import uuid
        fake_order_id = f"order_demo_{uuid.uuid4().hex[:12]}"
        logger.info("Demo order created: %s (₹%s)", fake_order_id, req.amount)
        return {
            "id": fake_order_id,
            "amount": amount_paise,
            "amount_inr": req.amount,
            "currency": req.currency,
            "key_id": RAZORPAY_KEY_ID or "rzp_test_demo",
            "demo_mode": True
        }


# ── POST /buy-credits ────────────────────────────────────────────────────

@router.post("/buy-credits")
def buy_credits(req: BuyCreditsRequest):
    """
    Called after Razorpay payment success.

    1. Verify payment signature
    2. Store transaction in DB
    3. Update wallet balance
    4. Return confirmation
    """
    # 1. Verify signature (skip for demo orders)
    if not req.razorpay_order_id.startswith("order_demo_"):
        if razorpay_client and RAZORPAY_KEY_SECRET:
            try:
                razorpay_client.utility.verify_payment_signature({
                    "razorpay_order_id": req.razorpay_order_id,
                    "razorpay_payment_id": req.razorpay_payment_id,
                    "razorpay_signature": req.razorpay_signature,
                })
                logger.info("Payment signature verified for order %s", req.razorpay_order_id)
            except razorpay.errors.SignatureVerificationError:
                raise HTTPException(status_code=400, detail="Payment signature verification failed")
        else:
            # Manual HMAC verification
            if RAZORPAY_KEY_SECRET:
                message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
                expected = hmac.new(
                    RAZORPAY_KEY_SECRET.encode(),
                    message.encode(),
                    hashlib.sha256
                ).hexdigest()
                if expected != req.razorpay_signature:
                    raise HTTPException(status_code=400, detail="Payment signature mismatch")

    # 2. Store transaction
    db = SessionLocal()
    try:
        # Check project exists
        project = db.query(Project).filter(Project.project_id == req.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get price per ton from project
        funding = db.query(FundingDetails).filter(
            FundingDetails.project_id == req.project_id
        ).first()
        price_per_ton = funding.price_per_ton if funding else project.price or 12.0

        # Deduct purchased credits from project and ProjectCredits
        if project.credits is not None:
            project.credits = max(0.0, float(project.credits) - float(req.quantity))

        project_credits = db.query(ProjectCredits).filter(ProjectCredits.project_id == req.project_id).first()
        if project_credits and project_credits.verified_credits is not None:
            project_credits.verified_credits = max(0.0, float(project_credits.verified_credits) - float(req.quantity))

        # Update matching pending CorporateRequest to completed if exists
        corp_req = db.query(CorporateRequest).filter(
            CorporateRequest.project_id == req.project_id,
            CorporateRequest.corporate_name == req.corporate_name,
            CorporateRequest.status == "pending"
        ).first()
        if corp_req:
            corp_req.status = "completed"

        # Create transaction record
        txn = Transaction(
            razorpay_order_id=req.razorpay_order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            project_id=req.project_id,
            project_name=project.name,
            corporate_name=req.corporate_name,
            quantity=req.quantity,
            price_per_ton=price_per_ton,
            amount_inr=req.amount,
            amount_usd=round(req.amount / float(os.getenv("INR_USD_RATE", "83.5")), 2),
            status="completed",
            created_at=datetime.now().date(),
        )
        db.add(txn)

        # Update or create wallet
        wallet = db.query(Wallet).filter(
            Wallet.corporate_name == req.corporate_name
        ).first()
        if wallet:
            wallet.total_credits = (wallet.total_credits or 0) + req.quantity
            wallet.total_spent_inr = (wallet.total_spent_inr or 0) + req.amount
            wallet.last_purchase_date = datetime.now().date()
        else:
            wallet = Wallet(
                corporate_name=req.corporate_name,
                total_credits=req.quantity,
                total_spent_inr=req.amount,
                last_purchase_date=datetime.now().date(),
            )
            db.add(wallet)

        db.commit()

        # Record audit log
        try:
            from credit_calculation.credits_module.db_models import AuditLog
            audit_entry = AuditLog(
                action="payment",
                name=req.project_id,
                detail=f"{req.corporate_name} purchased {req.quantity:,.0f} credits of '{project.name}' for ₹{req.amount:,.2f}",
                user=req.corporate_name,
                timestamp=datetime.utcnow()
            )
            db.add(audit_entry)
            db.commit()
        except Exception as e:
            logger.warning("Failed to record audit log for payment: %s", e)

        logger.info(
            "Transaction recorded: %s bought %.2f credits of %s for ₹%.2f",
            req.corporate_name, req.quantity, req.project_id, req.amount
        )

        return {
            "message": "Payment successful — credits added to wallet",
            "transaction_id": txn.id,
            "project_id": req.project_id,
            "project_name": project.name,
            "quantity": req.quantity,
            "amount_inr": req.amount,
            "corporate_name": req.corporate_name,
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("buy_credits failed")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# ── GET /transactions/{company} ──────────────────────────────────────────

@router.get("/transactions/{company}")
def get_transactions(company: str):
    """Get all transactions for a corporate buyer."""
    db = SessionLocal()
    try:
        txns = db.query(Transaction).filter(
            Transaction.corporate_name == company
        ).order_by(Transaction.id.desc()).all()

        return [
            {
                "id": t.id,
                "date": str(t.created_at) if t.created_at else None,
                "project_id": t.project_id,
                "project_name": t.project_name,
                "quantity": t.quantity,
                "price_per_ton": t.price_per_ton,
                "amount_inr": t.amount_inr,
                "amount_usd": t.amount_usd,
                "status": t.status,
                "razorpay_payment_id": t.razorpay_payment_id,
            }
            for t in txns
        ]
    finally:
        db.close()


# ── GET /wallet/{company} ────────────────────────────────────────────────

@router.get("/wallet/{company}")
def get_wallet(company: str):
    """Get wallet summary for a corporate buyer."""
    db = SessionLocal()
    try:
        wallet = db.query(Wallet).filter(Wallet.corporate_name == company).first()
        if not wallet:
            return {
                "corporate_name": company,
                "total_credits": 0,
                "total_spent_inr": 0,
                "total_spent_usd": 0,
                "last_purchase_date": None,
            }
        inr_rate = float(os.getenv("INR_USD_RATE", "83.5"))
        return {
            "corporate_name": wallet.corporate_name,
            "total_credits": wallet.total_credits or 0,
            "total_spent_inr": wallet.total_spent_inr or 0,
            "total_spent_usd": round((wallet.total_spent_inr or 0) / inr_rate, 2),
            "last_purchase_date": str(wallet.last_purchase_date) if wallet.last_purchase_date else None,
        }
    finally:
        db.close()


print("[OK] payment_router loaded")
