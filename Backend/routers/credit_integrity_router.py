"""
CarbonVault Phase 5: Credit Integrity & Retirement Registry Router.
Exposes endpoints for:
1. Credit Batches & Vintage Serial Inventory (/credits/batches).
2. Order Reservation with 15-Minute Hold TTL & Row Locking (/credits/order).
3. Order Settlement & Double-Entry Ledger Transfer (/credits/complete-order).
4. Non-Transferable Credit Retirement (/credits/retire).
5. Public Retirement Registry (/registry/retirements).
6. Ledger Accounts & Transactions (/credits/accounts/{entity_id}).
7. System-wide Ledger & Payment Reconciliation (/reconciliation/status).
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    CreditBatch, CreditAccount, LedgerEntry, Order, Retirement, Project
)
from core.credit_engine import (
    reserve_order_inventory,
    complete_order_transfer,
    retire_credits,
    reap_expired_reservations,
    ensure_system_accounts,
    SYS_ACC_INVENTORY,
    SYS_ACC_BUFFER,
    SYS_ACC_RETIRED,
    CreditIntegrityError,
    IllegalStateTransitionError
)
from core.reconciliation import run_full_reconciliation

logger = logging.getLogger("carbonvault.credit_router")
router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Pydantic Request Models ──────────────────────────────────────────────────

class OrderCreateRequest(BaseModel):
    buyer_id: str = Field(..., description="Unique corporate/user identifier")
    project_id: str = Field(..., description="Project ID to reserve credits from")
    quantity: int = Field(..., gt=0, le=1_000_000, description="Number of whole tonnes/credits")
    unit_price_usd: float = Field(..., gt=0, description="Locked unit price in USD")
    fx_rate: float = Field(..., gt=0, description="Locked INR/USD reference FX rate")
    batch_id: Optional[str] = Field(None, description="Optional specific batch to purchase from")
    quote_id: Optional[str] = Field(None, description="Optional associated payment quote ID")
    idempotency_key: Optional[str] = Field(None, description="Client idempotency key")
    hold_minutes: Optional[int] = Field(15, ge=1, le=60, description="Reservation TTL hold window in minutes")


class OrderCompleteRequest(BaseModel):
    order_id: str = Field(..., description="Order ID to settle")
    razorpay_payment_id: str = Field(..., description="Confirmed Razorpay payment identifier")


class RetirementRequest(BaseModel):
    buyer_id: str = Field(..., description="Corporate entity holding the credits")
    batch_id: str = Field(..., description="Source batch ID from which credits are retired")
    quantity: int = Field(..., gt=0, description="Number of credits to permanently retire")
    beneficiary: str = Field(..., min_length=2, max_length=255, description="Beneficiary entity or individual")
    purpose: str = Field(..., min_length=2, max_length=500, description="Environmental claim or ESG offsetting purpose")


# ── Credit Batches & Inventory ───────────────────────────────────────────────

@router.get("/credits/batches")
def list_batches(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Lists all verified vintage credit batches with serial ranges and buffer allocations."""
    query = db.query(CreditBatch)
    if project_id:
        query = query.filter(CreditBatch.project_id == project_id)
    if status:
        query = query.filter(CreditBatch.status == status)

    batches = query.order_by(CreditBatch.vintage_year.desc(), CreditBatch.created_at.desc()).all()

    results = []
    for b in batches:
        proj = db.query(Project).filter(Project.project_id == b.project_id).first()
        results.append({
            "batch_id": b.batch_id,
            "project_id": b.project_id,
            "project_name": proj.name if proj else b.project_id,
            "vintage_year": b.vintage_year,
            "total_quantity": b.total_quantity,
            "available_quantity": b.available_quantity,
            "reserved_quantity": b.reserved_quantity,
            "retired_quantity": b.retired_quantity,
            "buffer_quantity": b.buffer_quantity,
            "serial_start": b.serial_start,
            "serial_end": b.serial_end,
            "serial_range": f"{b.serial_start:08d} - {b.serial_end:08d}",
            "status": b.status,
            "created_at": b.created_at.isoformat() + "Z" if b.created_at else None
        })
    return {"batches": results, "count": len(results)}


@router.get("/credits/batches/{batch_id}")
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    """Fetches full breakdown of an individual credit batch."""
    b = db.query(CreditBatch).filter(CreditBatch.batch_id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found.")

    proj = db.query(Project).filter(Project.project_id == b.project_id).first()
    return {
        "batch_id": b.batch_id,
        "project_id": b.project_id,
        "project_name": proj.name if proj else b.project_id,
        "vintage_year": b.vintage_year,
        "total_quantity": b.total_quantity,
        "available_quantity": b.available_quantity,
        "reserved_quantity": b.reserved_quantity,
        "retired_quantity": b.retired_quantity,
        "buffer_quantity": b.buffer_quantity,
        "serial_start": b.serial_start,
        "serial_end": b.serial_end,
        "serial_range": f"{b.serial_start:08d} - {b.serial_end:08d}",
        "status": b.status,
        "created_at": b.created_at.isoformat() + "Z" if b.created_at else None
    }


# ── Orders & Inventory Reservation ───────────────────────────────────────────

@router.post("/credits/order")
def create_credit_order(
    req: OrderCreateRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db)
):
    """
    Reserves credit inventory with 15-minute hold TTL and database row-level locking.
    Prevents overselling under concurrent load. Locks price and FX rate.
    """
    idempotency_key = idempotency_key_header or req.idempotency_key

    try:
        order = reserve_order_inventory(
            buyer_id=req.buyer_id,
            project_id=req.project_id,
            quantity=req.quantity,
            unit_price_usd=req.unit_price_usd,
            fx_rate=req.fx_rate,
            db=db,
            batch_id=req.batch_id,
            idempotency_key=idempotency_key,
            quote_id=req.quote_id,
            hold_minutes=req.hold_minutes or 15
        )
        return {
            "status": "reserved",
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "project_id": order.project_id,
            "batch_id": order.batch_id,
            "quantity": order.quantity,
            "serial_start": order.serial_start,
            "serial_end": order.serial_end,
            "serial_range": f"{order.serial_start:08d} - {order.serial_end:08d}" if order.serial_start else None,
            "unit_price_usd": order.unit_price_usd_cents / 100.0,
            "fx_rate": order.fx_rate_scaled / 100.0,
            "amount_usd": order.amount_usd_cents / 100.0,
            "amount_inr": order.amount_inr_paise / 100.0,
            "order_status": order.status,
            "reservation_expires_at": order.reservation_expires_at.isoformat() + "Z" if order.reservation_expires_at else None,
            "idempotency_key": order.idempotency_key
        }
    except CreditIntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error creating credit order: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal error reserving inventory: {e}")


@router.post("/credits/complete-order")
def complete_order(req: OrderCompleteRequest, db: Session = Depends(get_db)):
    """
    Executes post-payment credit settlement and double-entry ledger transfer.
    Moves credits from ACC-SYS-INVENTORY to buyer's verified account.
    """
    try:
        order = complete_order_transfer(
            order_id=req.order_id,
            razorpay_payment_id=req.razorpay_payment_id,
            db=db
        )
        return {
            "status": "completed",
            "order_id": order.order_id,
            "buyer_id": order.buyer_id,
            "batch_id": order.batch_id,
            "quantity": order.quantity,
            "serial_start": order.serial_start,
            "serial_end": order.serial_end,
            "serial_range": f"{order.serial_start:08d} - {order.serial_end:08d}" if order.serial_start else None,
            "amount_inr": order.amount_inr_paise / 100.0,
            "razorpay_payment_id": order.razorpay_payment_id,
            "order_status": order.status,
            "updated_at": order.updated_at.isoformat() + "Z" if order.updated_at else None
        }
    except CreditIntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IllegalStateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.error("Error completing credit order: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal error completing order: {e}")


@router.get("/credits/orders/{order_id}")
def get_order(order_id: str, db: Session = Depends(get_db)):
    """Fetches real-time status and details of an order."""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found.")

    return {
        "order_id": order.order_id,
        "buyer_id": order.buyer_id,
        "project_id": order.project_id,
        "batch_id": order.batch_id,
        "quantity": order.quantity,
        "serial_start": order.serial_start,
        "serial_end": order.serial_end,
        "serial_range": f"{order.serial_start:08d} - {order.serial_end:08d}" if order.serial_start else None,
        "unit_price_usd": order.unit_price_usd_cents / 100.0,
        "fx_rate": order.fx_rate_scaled / 100.0,
        "amount_usd": order.amount_usd_cents / 100.0,
        "amount_inr": order.amount_inr_paise / 100.0,
        "status": order.status,
        "razorpay_payment_id": order.razorpay_payment_id,
        "created_at": order.created_at.isoformat() + "Z" if order.created_at else None,
        "reservation_expires_at": order.reservation_expires_at.isoformat() + "Z" if order.reservation_expires_at else None
    }


# ── Retirements & Public Registry ────────────────────────────────────────────

@router.post("/credits/retire")
def execute_retirement(req: RetirementRequest, db: Session = Depends(get_db)):
    """
    Permanently retires carbon credits on behalf of a beneficiary.
    Credits are moved to ACC-SYS-RETIRED and can NEVER be transferred or sold again.
    Produces an immutable Retirement certificate recorded in the public registry.
    """
    try:
        ret = retire_credits(
            buyer_id=req.buyer_id,
            batch_id=req.batch_id,
            quantity=req.quantity,
            beneficiary=req.beneficiary,
            purpose=req.purpose,
            db=db
        )
        return {
            "status": "retired",
            "retirement_id": ret.retirement_id,
            "certificate_id": ret.certificate_id,
            "beneficiary": ret.beneficiary,
            "purpose": ret.purpose,
            "batch_id": ret.batch_id,
            "project_id": ret.project_id,
            "quantity": ret.quantity,
            "serial_start": ret.serial_start,
            "serial_end": ret.serial_end,
            "serial_range": f"{ret.serial_start:08d} - {ret.serial_end:08d}",
            "retired_at": ret.retired_at.isoformat() + "Z",
            "registry_url": f"/registry/retirements/{ret.certificate_id}"
        }
    except CreditIntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error executing retirement: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal error executing retirement: {e}")


@router.get("/registry/retirements")
def get_public_retirement_registry(
    project_id: Optional[str] = None,
    beneficiary: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """
    Public Retirement Registry: Transparent public ledger of all permanently retired credits.
    Displays unique serial ranges, beneficiaries, project origin, and impact certificates.
    """
    query = db.query(Retirement)
    if project_id:
        query = query.filter(Retirement.project_id == project_id)
    if beneficiary:
        query = query.filter(Retirement.beneficiary.ilike(f"%{beneficiary}%"))

    retirements = query.order_by(Retirement.retired_at.desc()).limit(limit).all()

    items = []
    total_tonnes_retired = 0
    for r in retirements:
        total_tonnes_retired += r.quantity
        proj = db.query(Project).filter(Project.project_id == r.project_id).first()
        items.append({
            "retirement_id": r.retirement_id,
            "certificate_id": r.certificate_id,
            "beneficiary": r.beneficiary,
            "purpose": r.purpose,
            "project_id": r.project_id,
            "project_name": proj.name if proj else r.project_id,
            "batch_id": r.batch_id,
            "quantity": r.quantity,
            "serial_start": r.serial_start,
            "serial_end": r.serial_end,
            "serial_range": f"{r.serial_start:08d} - {r.serial_end:08d}",
            "retired_at": r.retired_at.isoformat() + "Z" if r.retired_at else None
        })

    return {
        "registry": "CarbonVault Public Retirement Registry",
        "total_records": len(items),
        "total_tonnes_retired": total_tonnes_retired,
        "retirements": items
    }


@router.get("/registry/retirements/{certificate_id}")
def get_retirement_certificate(certificate_id: str, db: Session = Depends(get_db)):
    """Public certificate verification endpoint for a specific retirement."""
    r = db.query(Retirement).filter(
        (Retirement.certificate_id == certificate_id) |
        (Retirement.retirement_id == certificate_id)
    ).first()

    if not r:
        raise HTTPException(status_code=404, detail=f"Retirement certificate {certificate_id} not found in public registry.")

    proj = db.query(Project).filter(Project.project_id == r.project_id).first()
    batch = db.query(CreditBatch).filter(CreditBatch.batch_id == r.batch_id).first()

    return {
        "status": "verified",
        "certificate_id": r.certificate_id,
        "retirement_id": r.retirement_id,
        "beneficiary": r.beneficiary,
        "purpose": r.purpose,
        "project_id": r.project_id,
        "project_name": proj.name if proj else r.project_id,
        "vintage_year": batch.vintage_year if batch else None,
        "quantity": r.quantity,
        "serial_start": r.serial_start,
        "serial_end": r.serial_end,
        "serial_range": f"{r.serial_start:08d} - {r.serial_end:08d}",
        "retired_at": r.retired_at.isoformat() + "Z" if r.retired_at else None,
        "registry_sink_account": SYS_ACC_RETIRED,
        "permanence_guarantee": "Permanent and non-transferable."
    }


# ── Accounts & Ledger ────────────────────────────────────────────────────────

@router.get("/credits/accounts/{entity_id}")
def get_entity_account(entity_id: str, db: Session = Depends(get_db)):
    """Retrieves credit ledger account balance and recent double-entry movements."""
    acc = db.query(CreditAccount).filter(
        (CreditAccount.entity_id == entity_id) |
        (CreditAccount.account_id == entity_id)
    ).first()

    if not acc:
        raise HTTPException(status_code=404, detail=f"Credit account for entity '{entity_id}' not found.")

    recent_entries = db.query(LedgerEntry).filter(
        (LedgerEntry.from_account_id == acc.account_id) |
        (LedgerEntry.to_account_id == acc.account_id)
    ).order_by(desc(LedgerEntry.timestamp)).limit(20).all()

    entries_data = []
    for e in recent_entries:
        direction = "in" if e.to_account_id == acc.account_id else "out"
        entries_data.append({
            "entry_id": e.entry_id,
            "transaction_id": e.transaction_id,
            "direction": direction,
            "quantity": e.quantity,
            "entry_type": e.entry_type,
            "from_account_id": e.from_account_id,
            "to_account_id": e.to_account_id,
            "serial_start": e.serial_start,
            "serial_end": e.serial_end,
            "notes": e.notes,
            "timestamp": e.timestamp.isoformat() + "Z" if e.timestamp else None
        })

    return {
        "account_id": acc.account_id,
        "entity_id": acc.entity_id,
        "account_type": acc.account_type,
        "name": acc.name,
        "balance": acc.balance,
        "currency": acc.currency,
        "created_at": acc.created_at.isoformat() + "Z" if acc.created_at else None,
        "recent_ledger_entries": entries_data
    }


@router.get("/credits/ledger")
def get_ledger(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    """Returns platform double-entry audit ledger entries."""
    entries = db.query(LedgerEntry).order_by(desc(LedgerEntry.timestamp)).limit(limit).all()
    results = []
    for e in entries:
        results.append({
            "entry_id": e.entry_id,
            "transaction_id": e.transaction_id,
            "order_id": e.order_id,
            "from_account_id": e.from_account_id,
            "to_account_id": e.to_account_id,
            "batch_id": e.batch_id,
            "quantity": e.quantity,
            "entry_type": e.entry_type,
            "serial_start": e.serial_start,
            "serial_end": e.serial_end,
            "notes": e.notes,
            "timestamp": e.timestamp.isoformat() + "Z" if e.timestamp else None
        })
    return {"entries": results, "count": len(results)}


# ── Reconciliation & Reservation Maintenance ─────────────────────────────────

@router.get("/reconciliation/status")
def get_reconciliation_status(db: Session = Depends(get_db)):
    """Runs a live reconciliation check and returns full integrity report."""
    report = run_full_reconciliation(db)
    return report


@router.post("/reconciliation/run")
def trigger_reconciliation(db: Session = Depends(get_db)):
    """Admin-triggered end-to-end reconciliation run."""
    report = run_full_reconciliation(db)
    return report


@router.post("/credits/reap-expired")
def trigger_reap_expired(db: Session = Depends(get_db)):
    """Triggers immediate release of expired inventory holds."""
    reaped = reap_expired_reservations(db)
    return {"status": "ok", "reaped_reservations": reaped}
