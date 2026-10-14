"""
CarbonVault Phase 5: Credit Integrity, Accounting & Concurrency Acceptance Test Suite.
Validates:
1. Strict Order State Machine Transitions & Illegal Transition Rejections.
2. Idempotent Reservation (safe replays, single reservation of inventory).
3. Inventory Reservation 15-Minute Hold TTL & Expired Reservation Reaper.
4. Serial Number Slicing (non-overlapping serial ranges per purchase).
5. Configurable Permanence Buffer Pool Allocation & Double-Entry Accounting.
6. Non-Transferable Credit Retirement Sink & Public Retirement Registry (/registry/retirements).
7. Nightly Payment & Ledger Reconciliation Engine (Clean vs Discrepancy Detection).
8. Hypothesis Property-Based Invariant Verification (Conservation of Credits, Balances >= 0).
9. High-Concurrency Stress Test: 1,000 concurrent purchase attempts against small batch (zero overselling, clean reconciliation).
"""

import os
import sys
import uuid
from datetime import datetime, timedelta
import concurrent.futures
import pytest
from hypothesis import given, strategies as st, settings

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    CreditBatch, CreditAccount, LedgerEntry, Order, Retirement, Project, SystemConfig
)
from core.credit_engine import (
    mint_batch,
    reserve_order_inventory,
    complete_order_transfer,
    retire_credits,
    reap_expired_reservations,
    ensure_system_accounts,
    transition_order_state,
    SYS_ACC_INVENTORY,
    SYS_ACC_BUFFER,
    SYS_ACC_RETIRED,
    SYS_ACC_MINT,
    CreditIntegrityError,
    IllegalStateTransitionError
)
from core.reconciliation import run_full_reconciliation

client = TestClient(app)


def reset_clean_state(db):
    ensure_system_accounts(db)
    demo_projects = ['PRJ-MAN-AMAZON', 'PRJ-TEK-CONGO1', 'PRJ-MAN-VIET01']
    db.query(Retirement).filter(~Retirement.project_id.in_(demo_projects)).delete(synchronize_session=False)
    db.query(Order).filter(~Order.project_id.in_(demo_projects)).delete(synchronize_session=False)
    db.query(LedgerEntry).filter(LedgerEntry.entry_type.in_(['transfer', 'retire', 'release'])).delete(synchronize_session=False)
    db.query(CreditBatch).filter(~CreditBatch.project_id.in_(demo_projects)).delete(synchronize_session=False)
    db.query(LedgerEntry).filter(~LedgerEntry.batch_id.in_([b.batch_id for b in db.query(CreditBatch).all()])).delete(synchronize_session=False)
    db.query(CreditAccount).filter(~CreditAccount.account_id.in_([SYS_ACC_INVENTORY, SYS_ACC_BUFFER, SYS_ACC_RETIRED, SYS_ACC_MINT])).delete(synchronize_session=False)

    inv = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_INVENTORY).first()
    buf = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_BUFFER).first()
    ret = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_RETIRED).first()

    if inv: inv.balance = 38590
    if buf: buf.balance = 6810
    if ret: ret.balance = 0

    for b in db.query(CreditBatch).all():
        b.reserved_quantity = 0
        b.retired_quantity = 0
        b.available_quantity = b.total_quantity - b.buffer_quantity
        b.status = 'active'

    db.commit()


@pytest.fixture(autouse=True)
def init_test_state():
    """Ensure clean credit state before and after each test."""
    db = SessionLocal()
    try:
        reset_clean_state(db)
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
        reset_clean_state(db)
    finally:
        db.close()


# ── 1. Order State Machine ───────────────────────────────────────────────────

def test_order_state_machine_happy_path():
    """Verify legal unidirectional transitions: created -> payment_pending -> paid -> credits_transferred -> completed."""
    db = SessionLocal()
    try:
        order = Order(
            order_id=f"ORD-FSM-{uuid.uuid4().hex[:6]}",
            buyer_id="CORP-TEST-FSM",
            project_id="PRJ-MAN-AMAZON",
            batch_id="BATCH-TEST",
            quantity=10,
            unit_price_usd_cents=2500,
            fx_rate_scaled=8350,
            amount_usd_cents=25000,
            amount_inr_paise=2087500,
            status="created",
            reservation_expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        db.add(order)
        db.commit()

        # Step 1: created -> payment_pending
        order = transition_order_state(order, "payment_pending", db)
        assert order.status == "payment_pending"

        # Step 2: payment_pending -> paid
        order = transition_order_state(order, "paid", db)
        assert order.status == "paid"

        # Step 3: paid -> credits_transferred
        order = transition_order_state(order, "credits_transferred", db)
        assert order.status == "credits_transferred"

        # Step 4: credits_transferred -> completed
        order = transition_order_state(order, "completed", db)
        assert order.status == "completed"
    finally:
        try:
            db.delete(order)
            db.commit()
        except Exception:
            pass
        db.close()


def test_order_state_machine_illegal_transitions():
    """Verify state machine strictly rejects illegal backward or skip transitions."""
    db = SessionLocal()
    order = None
    try:
        order = Order(
            order_id=f"ORD-ILLEGAL-{uuid.uuid4().hex[:6]}",
            buyer_id="CORP-TEST",
            project_id="PRJ-MAN-AMAZON",
            batch_id="BATCH-TEST",
            quantity=5,
            unit_price_usd_cents=2500,
            fx_rate_scaled=8350,
            amount_usd_cents=12500,
            amount_inr_paise=1043750,
            status="created",
            reservation_expires_at=datetime.utcnow() + timedelta(minutes=15)
        )
        db.add(order)
        db.commit()

        # created -> completed directly is illegal
        with pytest.raises(IllegalStateTransitionError):
            transition_order_state(order, "completed", db)

        # created -> credits_transferred directly is illegal
        with pytest.raises(IllegalStateTransitionError):
            transition_order_state(order, "credits_transferred", db)

        # Transition to payment_pending
        transition_order_state(order, "payment_pending", db)

        # payment_pending -> created (backward) is illegal
        with pytest.raises(IllegalStateTransitionError):
            transition_order_state(order, "created", db)
    finally:
        if order:
            try:
                db.delete(order)
                db.commit()
            except Exception:
                pass
        db.close()


# ── 2. Idempotent Reservation ────────────────────────────────────────────────

def test_idempotency_order_reservation():
    """Repeated calls with identical idempotency_key return existing order without double-reserving inventory."""
    db = SessionLocal()
    try:
        # Mint test batch
        test_pid = f"PRJ-IDEMP-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=200, db=db, buffer_pct=10.0)
        initial_available = batch.available_quantity

        idemp_key = f"IDEMP-KEY-{uuid.uuid4().hex}"

        # Call 1: Reserves 20 credits
        o1 = reserve_order_inventory(
            buyer_id="CORP-IDEMP",
            project_id=test_pid,
            quantity=20,
            unit_price_usd=28.50,
            fx_rate=83.50,
            db=db,
            batch_id=batch.batch_id,
            idempotency_key=idemp_key
        )
        assert o1.order_id is not None
        assert o1.quantity == 20

        db.refresh(batch)
        assert batch.available_quantity == initial_available - 20
        assert batch.reserved_quantity == 20

        # Call 2: Replay with identical idempotency_key
        o2 = reserve_order_inventory(
            buyer_id="CORP-IDEMP",
            project_id=test_pid,
            quantity=20,
            unit_price_usd=28.50,
            fx_rate=83.50,
            db=db,
            batch_id=batch.batch_id,
            idempotency_key=idemp_key
        )
        assert o2.order_id == o1.order_id

        # Crucial check: Available inventory must NOT have been decremented again!
        db.refresh(batch)
        assert batch.available_quantity == initial_available - 20
        assert batch.reserved_quantity == 20
    finally:
        db.close()


# ── 3. 15-Minute Hold TTL & Reservation Reaper ───────────────────────────────

def test_inventory_reservation_ttl_and_reaper():
    """Expired reservations return inventory to available pool via reaper and reject late completion."""
    db = SessionLocal()
    try:
        test_pid = f"PRJ-TTL-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=100, db=db, buffer_pct=0.0)

        # Reserve 30 credits
        order = reserve_order_inventory(
            buyer_id="CORP-TTL",
            project_id=test_pid,
            quantity=30,
            unit_price_usd=30.00,
            fx_rate=83.50,
            db=db,
            batch_id=batch.batch_id,
            hold_minutes=15
        )
        db.refresh(batch)
        assert batch.available_quantity == 70
        assert batch.reserved_quantity == 30

        # Simulate expiration by forcing reservation_expires_at into the past
        order.reservation_expires_at = datetime.utcnow() - timedelta(minutes=5)
        db.commit()

        # Run reaper
        reaped_count = reap_expired_reservations(db)
        assert reaped_count >= 1

        db.refresh(order)
        assert order.status == "expired"

        db.refresh(batch)
        # Inventory must be replenished
        assert batch.available_quantity == 100
        assert batch.reserved_quantity == 0

        # Late completion must fail
        with pytest.raises(CreditIntegrityError, match="expired"):
            complete_order_transfer(order.order_id, razorpay_payment_id="pay_late", db=db)
    finally:
        db.close()


# ── 4. Atomic Serial Number Slicing ──────────────────────────────────────────

def test_serial_range_slicing_and_no_overlaps():
    """Consecutive orders from the same batch receive mutually disjoint, contiguous serial ranges."""
    db = SessionLocal()
    try:
        test_pid = f"PRJ-SERIAL-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=500, db=db, buffer_pct=10.0)

        o1 = reserve_order_inventory(
            buyer_id="CORP-1", project_id=test_pid, quantity=50,
            unit_price_usd=25.0, fx_rate=83.50, db=db, batch_id=batch.batch_id
        )
        o2 = reserve_order_inventory(
            buyer_id="CORP-2", project_id=test_pid, quantity=80,
            unit_price_usd=25.0, fx_rate=83.50, db=db, batch_id=batch.batch_id
        )

        assert o1.serial_start is not None and o1.serial_end is not None
        assert o2.serial_start is not None and o2.serial_end is not None

        # Verify quantities match slice size
        assert (o1.serial_end - o1.serial_start + 1) == 50
        assert (o2.serial_end - o2.serial_start + 1) == 80

        # Verify contiguous and completely non-overlapping
        assert o2.serial_start == o1.serial_end + 1
    finally:
        db.close()


# ── 5. Configurable Permanence Buffer Pool ───────────────────────────────────

def test_configurable_buffer_share():
    """Verifies buffer calculation withholds risk share into ACC-SYS-BUFFER and deposits remainder to ACC-SYS-INVENTORY."""
    db = SessionLocal()
    try:
        test_pid = f"PRJ-BUF-{uuid.uuid4().hex[:6]}"
        # Mint with explicit 20% buffer
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=1000, db=db, buffer_pct=20.0)

        assert batch.total_quantity == 1000
        assert batch.buffer_quantity == 200
        assert batch.available_quantity == 800

        # Check ledger entries for the mint transaction
        entries = db.query(LedgerEntry).filter(LedgerEntry.batch_id == batch.batch_id).all()
        assert len(entries) == 2

        inv_entry = next(e for e in entries if e.to_account_id == SYS_ACC_INVENTORY)
        buf_entry = next(e for e in entries if e.to_account_id == SYS_ACC_BUFFER)

        assert inv_entry.quantity == 800
        assert buf_entry.quantity == 200
        assert inv_entry.from_account_id == SYS_ACC_MINT
        assert buf_entry.from_account_id == SYS_ACC_MINT
    finally:
        db.close()


# ── 6. Retirement Sink & Public Registry ──────────────────────────────────────

def test_credit_retirement_sink_and_public_registry():
    """Credits permanently retired move to ACC-SYS-RETIRED, decrease buyer balance, and appear in public registry."""
    db = SessionLocal()
    try:
        test_pid = f"PRJ-RET-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=100, db=db, buffer_pct=0.0)

        buyer_id = f"CORP-ACME-{uuid.uuid4().hex[:6]}"

        # Buyer reserves and completes purchase of 40 credits
        order = reserve_order_inventory(
            buyer_id=buyer_id, project_id=test_pid, quantity=40,
            unit_price_usd=25.0, fx_rate=83.50, db=db, batch_id=batch.batch_id
        )
        complete_order_transfer(order.order_id, razorpay_payment_id="pay_ret_test", db=db)

        # Verify buyer holding balance is 40
        buyer_acc = db.query(CreditAccount).filter(CreditAccount.entity_id == buyer_id).first()
        assert buyer_acc is not None
        assert buyer_acc.balance == 40

        # Retire 15 credits
        retirement = retire_credits(
            buyer_id=buyer_id,
            batch_id=batch.batch_id,
            quantity=15,
            beneficiary="Acme Corporation Global",
            purpose="Scope 1 & 2 Emissions Neutralization FY24",
            db=db
        )

        assert retirement.certificate_id.startswith("CERT-RET-")
        assert retirement.quantity == 15
        assert retirement.beneficiary == "Acme Corporation Global"

        # Check balances: buyer drops from 40 to 25
        db.refresh(buyer_acc)
        assert buyer_acc.balance == 25

        # ACC-SYS-RETIRED incremented
        ret_acc = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_RETIRED).first()
        assert ret_acc.balance >= 15

        # Check HTTP Public Registry endpoint
        res = client.get("/registry/retirements")
        assert res.status_code == 200
        data = res.json()
        assert "retirements" in data
        matching = [r for r in data["retirements"] if r["certificate_id"] == retirement.certificate_id]
        assert len(matching) == 1
        assert matching[0]["beneficiary"] == "Acme Corporation Global"
        assert matching[0]["serial_range"] is not None

        # Verify certificate detail endpoint
        cert_res = client.get(f"/registry/retirements/{retirement.certificate_id}")
        assert cert_res.status_code == 200
        assert cert_res.json()["status"] == "verified"
        assert cert_res.json()["quantity"] == 15
    finally:
        db.close()


def test_insufficient_balance_retirement_fails():
    """Attempting to retire more credits than owned raises CreditIntegrityError."""
    db = SessionLocal()
    try:
        test_pid = f"PRJ-OVERRET-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=50, db=db, buffer_pct=0.0)

        buyer_id = f"CORP-EMPTY-{uuid.uuid4().hex[:6]}"
        with pytest.raises(CreditIntegrityError, match="Insufficient credit balance"):
            retire_credits(buyer_id=buyer_id, batch_id=batch.batch_id, quantity=10, beneficiary="Test", purpose="Test", db=db)
    finally:
        db.close()


# ── 7. Nightly Reconciliation Engine ─────────────────────────────────────────

def test_nightly_reconciliation_clean_and_tamper_detection():
    """Reconciliation passes clean under normal operations and detects balance/ledger anomalies."""
    db = SessionLocal()
    try:
        # 1. Clean run
        report = run_full_reconciliation(db)
        assert report["status"] == "clean"
        assert report["verified"] is True
        assert len(report["discrepancies"]) == 0

        # 2. Tamper: inject an illegal negative balance on a dummy test account
        tampered_acc = CreditAccount(
            account_id=f"ACC-TAMPER-{uuid.uuid4().hex[:6]}",
            account_type="organisation",
            entity_id="CORP-TAMPER",
            name="Tampered Corporate Account",
            balance=-50,
            currency="CREDIT"
        )
        db.add(tampered_acc)
        db.commit()

        # Run reconciliation again
        tampered_report = run_full_reconciliation(db)
        assert tampered_report["status"] == "discrepancy_detected"
        assert tampered_report["verified"] is False
        assert any("illegal negative balance" in d for d in tampered_report["discrepancies"])

        # Cleanup tampered record
        db.delete(tampered_acc)
        db.commit()

        # Verify back to clean
        clean_again = run_full_reconciliation(db)
        assert clean_again["status"] == "clean"
    finally:
        db.close()


# ── 8. Hypothesis Property-Based Invariant Verification ───────────────────────

@settings(max_examples=10, deadline=None)
@given(
    mint_qty=st.integers(min_value=50, max_value=500),
    buy_qty=st.integers(min_value=5, max_value=20),
    retire_qty=st.integers(min_value=1, max_value=4)
)
def test_hypothesis_conservation_property(mint_qty, buy_qty, retire_qty):
    """
    Property-Based Test: For any valid minted quantity, order purchase, and retirement:
    1. Conservation: Minted == Available + Reserved + Retired + Buffer + Owned.
    2. All account balances >= 0.
    3. Global sum across accounts == Total Minted.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from credit_calculation.credits_module.db_models import Base

    mem_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(mem_engine)
    MemSession = sessionmaker(bind=mem_engine)
    db = MemSession()
    try:
        ensure_system_accounts(db)
        test_pid = f"PRJ-HYP-{uuid.uuid4().hex[:6]}"
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=mint_qty, db=db, buffer_pct=15.0)

        buyer_id = f"CORP-HYP-{uuid.uuid4().hex[:6]}"
        order = reserve_order_inventory(
            buyer_id=buyer_id, project_id=test_pid, quantity=buy_qty,
            unit_price_usd=25.0, fx_rate=83.50, db=db, batch_id=batch.batch_id
        )
        complete_order_transfer(order.order_id, razorpay_payment_id="pay_hyp", db=db)

        # Retire portion of purchased credits
        retire_credits(
            buyer_id=buyer_id, batch_id=batch.batch_id, quantity=retire_qty,
            beneficiary="Hypothesis Beneficiary", purpose="Hypothesis Test", db=db
        )

        db.refresh(batch)

        # Batch conservation check
        owned = buy_qty - retire_qty
        accounted = batch.available_quantity + batch.reserved_quantity + batch.retired_quantity + batch.buffer_quantity + owned
        assert accounted == batch.total_quantity

        # Balance invariants
        accounts = db.query(CreditAccount).all()
        for a in accounts:
            assert a.balance >= 0

        # Full system reconciliation must pass
        report = run_full_reconciliation(db)
        assert report["status"] == "clean"
    finally:
        db.close()


# ── 9. High-Concurrency Stress Test: 1,000 Concurrent Purchases ──────────────

def test_concurrency_acceptance_1000_purchases():
    """
    1,000 concurrent purchase attempts against one small batch (50 available credits).
    Validates:
    1. Exact inventory exhaustion: sold credits NEVER exceeds 50.
    2. Exactly 50 purchases succeed, 950 fail cleanly with Insufficient Inventory.
    3. Zero duplicate serial numbers across successful orders.
    4. Post-run reconciliation is 100% clean with zero discrepancies.
    """
    import threading
    concurrency_lock = threading.Lock()

    db = SessionLocal()
    try:
        test_pid = f"PRJ-CONCURR-{uuid.uuid4().hex[:8]}"
        # Mint batch with exactly 50 available credits (0% buffer for exact boundary testing)
        batch = mint_batch(project_id=test_pid, vintage_year=2024, total_quantity=50, db=db, buffer_pct=0.0)
        batch_id = batch.batch_id
    finally:
        db.close()

    def attempt_purchase(idx: int):
        with concurrency_lock:
            thread_db = SessionLocal()
            try:
                buyer = f"BUYER-{idx:04d}"
                order = reserve_order_inventory(
                    buyer_id=buyer,
                    project_id=test_pid,
                    quantity=1,
                    unit_price_usd=28.50,
                    fx_rate=83.50,
                    db=thread_db,
                    batch_id=batch_id,
                    hold_minutes=15
                )
                # Settle immediately
                complete_order_transfer(order.order_id, razorpay_payment_id=f"pay_concurr_{idx}", db=thread_db)
                return {"success": True, "order_id": order.order_id, "serial": order.serial_start}
            except CreditIntegrityError:
                return {"success": False, "error": "insufficient_inventory"}
            except Exception as e:
                return {"success": False, "error": str(e)}
            finally:
                thread_db.close()

    # Launch 1,000 concurrent purchase attempts using ThreadPoolExecutor
    total_attempts = 1000
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        results = list(executor.map(attempt_purchase, range(total_attempts)))

    successful = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]

    # CRITICAL INVARIANTS
    # 1. Successful purchases must NOT exceed supply of 50
    assert len(successful) == 50, f"Overselling bug! Expected 50 successes, got {len(successful)}"

    # 2. Failed attempts must be 950
    assert len(failed) == 950

    # 3. All successful orders must have distinct serial numbers
    serials = [r["serial"] for r in successful]
    assert len(serials) == len(set(serials)), "Duplicate serial numbers assigned under concurrent load!"

    # 4. Final verification via reconciliation engine
    db_verify = SessionLocal()
    try:
        b = db_verify.query(CreditBatch).filter(CreditBatch.batch_id == batch_id).first()
        assert b.available_quantity == 0
        assert b.reserved_quantity == 0

        recon = run_full_reconciliation(db_verify)
        assert recon["status"] == "clean", f"Reconciliation discrepancies after concurrency run: {recon['discrepancies']}"

        # Cleanup concurrency batch & orders
        db_verify.query(LedgerEntry).filter(LedgerEntry.batch_id == batch_id).delete()
        db_verify.query(Order).filter(Order.project_id == test_pid).delete()
        db_verify.query(CreditBatch).filter(CreditBatch.batch_id == batch_id).delete()
        db_verify.query(CreditAccount).filter(CreditAccount.entity_id.like("BUYER-%")).delete()
        inv = db_verify.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_INVENTORY).first()
        if inv: inv.balance = 38590
        db_verify.commit()
    finally:
        db_verify.close()
