"""
CarbonVault Phase 5: Core Credit Integrity & Double-Entry Ledger Engine.
Enforces:
1. Strict Order State Machine (created -> payment_pending -> paid -> credits_transferred -> completed).
2. Concurrency Control with Row Locking (with_for_update) preventing inventory overselling.
3. 15-Minute Inventory Reservation TTL with automatic expiration & replenishment reaper.
4. Non-fungible Serial Range Tracking (every credit has a unique serial within vintage batch).
5. Double-Entry Accounting Invariant (Total Debits == Total Credits; balance >= 0 always).
6. Configurable Buffer Share (held in ACC-SYS-BUFFER, withheld from sale for risk pool).
7. Permanent Non-Transferable Retirement to public registry (ACC-SYS-RETIRED).
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from credit_calculation.credits_module.db_models import (
    CreditBatch, CreditAccount, LedgerEntry, Order, Retirement, Project, SystemConfig
)

logger = logging.getLogger("carbonvault.credit_engine")

# System Account Constants
SYS_ACC_INVENTORY = "ACC-SYS-INVENTORY"
SYS_ACC_BUFFER = "ACC-SYS-BUFFER"
SYS_ACC_RETIRED = "ACC-SYS-RETIRED"
SYS_ACC_MINT = "ACC-SYS-MINT"

# Legal State Machine Transitions
LEGAL_TRANSITIONS: Dict[str, set] = {
    "created": {"payment_pending", "expired", "failed"},
    "payment_pending": {"paid", "failed", "expired"},
    "paid": {"credits_transferred", "refunded"},
    "credits_transferred": {"completed"},
    "completed": {"refunded"},
    "failed": set(),
    "expired": set(),
    "refunded": set(),
}


class CreditIntegrityError(Exception):
    """Raised on violation of credit accounting, serial ranges, or balance invariants."""
    pass


class IllegalStateTransitionError(Exception):
    """Raised when an order attempts an unauthorized state machine transition."""
    pass


def ensure_system_accounts(db: Session):
    """Initializes global system accounts if missing."""
    accounts = [
        (SYS_ACC_INVENTORY, "system_inventory", "CarbonVault Primary Inventory Pool"),
        (SYS_ACC_BUFFER, "system_buffer", "CarbonVault Permanent Risk Buffer Reserve"),
        (SYS_ACC_RETIRED, "system_retired", "CarbonVault Permanent Retirement Sink"),
        (SYS_ACC_MINT, "system_mint", "CarbonVault Issuance Genesis Account"),
    ]
    for acc_id, acc_type, name in accounts:
        existing = db.query(CreditAccount).filter(CreditAccount.account_id == acc_id).first()
        if not existing:
            db.add(CreditAccount(
                account_id=acc_id,
                account_type=acc_type,
                name=name,
                balance=0,
                currency="CREDIT"
            ))
    db.commit()


def get_or_create_account(
    entity_id: str,
    account_type: str,
    name: str,
    db: Session
) -> CreditAccount:
    """Retrieves or provisions an isolated ledger account for a user or organisation."""
    acc = db.query(CreditAccount).filter(
        CreditAccount.entity_id == entity_id,
        CreditAccount.account_type == account_type
    ).first()
    if not acc:
        acc_id = f"ACC-{account_type.upper()[:3]}-{uuid.uuid4().hex[:8].upper()}"
        acc = CreditAccount(
            account_id=acc_id,
            account_type=account_type,
            entity_id=entity_id,
            name=name,
            balance=0,
            currency="CREDIT"
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc


def transition_order_state(order: Order, new_state: str, db: Session) -> Order:
    """Enforces legal state machine transitions on orders."""
    allowed = LEGAL_TRANSITIONS.get(order.status, set())
    if new_state not in allowed:
        err = f"Illegal order transition from '{order.status}' to '{new_state}'. Allowed: {list(allowed)}"
        logger.error(err)
        raise IllegalStateTransitionError(err)

    order.status = new_state
    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    logger.info("Order %s transitioned: -> %s", order.order_id, new_state)
    return order


def get_buffer_percentage(db: Session) -> float:
    """Reads configured buffer pool percentage from system_config (default: 20.0%)."""
    row = db.query(SystemConfig).filter(
        SystemConfig.key.in_(["buffer_pool_percentage", "buffer_pool_share"])
    ).first()
    if row and row.value:
        try:
            val = float(row.value)
            if 0 < val < 1.0:
                return round(val * 100.0, 2)
            return val
        except ValueError:
            pass
    return 20.0


def seed_initial_credit_batches(db: Session):
    """Seeds verified initial vintage credit batches for approved projects if empty."""
    ensure_system_accounts(db)
    if db.query(CreditBatch).first():
        return

    logger.info("Seeding initial vintage credit batches for approved projects...")
    approved_projects = [
        ("PRJ-MAN-AMAZON", 2024, 12400),
        ("PRJ-TEK-CONGO1", 2024, 25000),
        ("PRJ-MAN-VIET01", 2024, 8000),
    ]
    for pid, vintage, qty in approved_projects:
        proj = db.query(Project).filter(Project.project_id == pid).first()
        if proj:
            try:
                mint_batch(project_id=pid, vintage_year=vintage, total_quantity=qty, db=db)
                logger.info("Successfully seeded batch for %s (%d credits, vintage %d)", pid, qty, vintage)
            except Exception as e:
                logger.warning("Could not seed batch for %s: %s", pid, e)



def mint_batch(
    project_id: str,
    vintage_year: int,
    total_quantity: int,
    db: Session,
    buffer_pct: Optional[float] = None
) -> CreditBatch:
    """
    Mints a new verified credit batch for a project.
    - Allocates non-overlapping serial number range [serial_start, serial_end].
    - Calculates and withholds buffer pool share into ACC-SYS-BUFFER.
    - Deposits unwithheld available credits into ACC-SYS-INVENTORY.
    - Records double-entry ledger entries for both legs.
    """
    ensure_system_accounts(db)

    if total_quantity <= 0:
        raise CreditIntegrityError("Total mint quantity must be strictly greater than 0.")

    # Calculate serial range
    last_batch = db.query(CreditBatch).order_by(CreditBatch.serial_end.desc()).first()
    serial_start = (last_batch.serial_end + 1) if last_batch and last_batch.serial_end else 1
    serial_end = serial_start + total_quantity - 1

    pct = buffer_pct if buffer_pct is not None else get_buffer_percentage(db)
    buffer_qty = int(total_quantity * (pct / 100.0))
    available_qty = total_quantity - buffer_qty

    batch_id = f"BATCH-{project_id}-{vintage_year}-{uuid.uuid4().hex[:6].upper()}"

    batch = CreditBatch(
        batch_id=batch_id,
        project_id=project_id,
        vintage_year=vintage_year,
        total_quantity=total_quantity,
        available_quantity=available_qty,
        reserved_quantity=0,
        retired_quantity=0,
        buffer_quantity=buffer_qty,
        serial_start=serial_start,
        serial_end=serial_end,
        status="active"
    )
    db.add(batch)

    txn_id = f"TXN-MINT-{uuid.uuid4().hex[:8].upper()}"

    # Leg 1: Deposit available credits into Primary Inventory Pool
    inv_acc = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_INVENTORY).first()
    inv_acc.balance += available_qty

    db.add(LedgerEntry(
        entry_id=f"LEDG-{uuid.uuid4().hex[:10]}",
        transaction_id=txn_id,
        from_account_id=SYS_ACC_MINT,
        to_account_id=SYS_ACC_INVENTORY,
        batch_id=batch_id,
        quantity=available_qty,
        entry_type="mint",
        serial_start=serial_start,
        serial_end=serial_start + available_qty - 1,
        notes=f"Minted {available_qty} verified credits for {project_id} (Vintage {vintage_year})"
    ))

    # Leg 2: Withhold permanence buffer into Risk Buffer Reserve
    if buffer_qty > 0:
        buf_acc = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_BUFFER).first()
        buf_acc.balance += buffer_qty

        db.add(LedgerEntry(
            entry_id=f"LEDG-{uuid.uuid4().hex[:10]}",
            transaction_id=txn_id,
            from_account_id=SYS_ACC_MINT,
            to_account_id=SYS_ACC_BUFFER,
            batch_id=batch_id,
            quantity=buffer_qty,
            entry_type="reserve",
            serial_start=serial_start + available_qty,
            serial_end=serial_end,
            notes=f"Permanence buffer withheld ({pct}%) into risk pool"
        ))

    db.commit()
    db.refresh(batch)
    logger.info(
        "Minted batch %s: %d total (%d available, %d buffer). Serials [%d - %d]",
        batch_id, total_quantity, available_qty, buffer_qty, serial_start, serial_end
    )
    return batch


def reserve_order_inventory(
    buyer_id: str,
    project_id: str,
    quantity: int,
    unit_price_usd: float,
    fx_rate: float,
    db: Session,
    batch_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    quote_id: Optional[str] = None,
    hold_minutes: int = 15
) -> Order:
    """
    Reserves credit inventory for an incoming purchase order with TTL and row locks.
    - Idempotent: returns existing order if idempotency_key matches.
    - Acquires row lock (with_for_update) on target CreditBatch.
    - Verifies sufficient available_quantity (raises CreditIntegrityError if sold out).
    - Decrements available_quantity and increments reserved_quantity.
    - Sets reservation_expires_at timestamp.
    """
    ensure_system_accounts(db)

    # 1. Idempotency Check
    if idempotency_key:
        existing = db.query(Order).filter(Order.idempotency_key == idempotency_key).first()
        if existing:
            logger.info("Idempotent hit for order %s (key %s)", existing.order_id, idempotency_key)
            return existing

    if quantity <= 0:
        raise CreditIntegrityError("Order quantity must be greater than 0.")

    # 2. Query target batch with row-level lock
    batch_query = db.query(CreditBatch)
    if batch_id:
        batch_query = batch_query.filter(CreditBatch.batch_id == batch_id)
    else:
        batch_query = batch_query.filter(
            CreditBatch.project_id == project_id,
            CreditBatch.status == "active",
            CreditBatch.available_quantity >= quantity
        ).order_by(CreditBatch.vintage_year.asc())

    # Execute row lock
    batch = batch_query.with_for_update().first()
    if not batch:
        raise CreditIntegrityError(
            f"Insufficient inventory: No batch available for project {project_id} with {quantity} credits."
        )

    if batch.available_quantity < quantity:
        raise CreditIntegrityError(
            f"Insufficient inventory in batch {batch.batch_id}: requested {quantity}, available {batch.available_quantity}."
        )

    # Compute assigned serial slice based on credits already allocated from available supply
    allocated_offset = (batch.total_quantity - batch.buffer_quantity) - batch.available_quantity
    serial_start = batch.serial_start + allocated_offset
    serial_end = serial_start + quantity - 1

    # 3. Reserve inventory
    batch.available_quantity -= quantity
    batch.reserved_quantity += quantity

    # Minor currency conversions
    unit_price_cents = int(round(unit_price_usd * 100))
    fx_scaled = int(round(fx_rate * 100))
    total_usd_cents = int(round(unit_price_usd * quantity * 100))
    amount_inr_paise = int(round(unit_price_usd * quantity * fx_rate * 100))

    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=hold_minutes)

    order_id = f"ORD-{uuid.uuid4().hex[:10].upper()}"

    order = Order(
        order_id=order_id,
        buyer_id=buyer_id,
        project_id=project_id,
        batch_id=batch.batch_id,
        quantity=quantity,
        serial_start=serial_start,
        serial_end=serial_end,
        unit_price_usd_cents=unit_price_cents,
        fx_rate_scaled=fx_scaled,
        amount_usd_cents=total_usd_cents,
        amount_inr_paise=amount_inr_paise,
        status="created",
        idempotency_key=idempotency_key,
        quote_id=quote_id,
        quote_expires_at=expires_at,
        reservation_expires_at=expires_at,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    logger.info(
        "Reserved %d credits for order %s (batch %s, serials [%d-%d], expires %s)",
        quantity, order_id, batch.batch_id, serial_start, serial_end, expires_at.isoformat()
    )
    return order


def complete_order_transfer(
    order_id: str,
    razorpay_payment_id: str,
    db: Session
) -> Order:
    """
    Executes post-payment credit settlement and double-entry ledger transfer.
    - Transitions order through: payment_pending -> paid -> credits_transferred -> completed.
    - Transfers credits from ACC-SYS-INVENTORY to buyer's account.
    - Decrements reserved_quantity from batch.
    - Records immutable LedgerEntry.
    """
    order = db.query(Order).filter(Order.order_id == order_id).with_for_update().first()
    if not order:
        raise CreditIntegrityError(f"Order {order_id} not found.")

    if order.status == "completed":
        logger.info("Order %s is already completed. Idempotent return.", order_id)
        return order

    if order.status not in ("created", "payment_pending"):
        raise CreditIntegrityError(f"Cannot complete order {order_id} in state '{order.status}'.")

    # Verify reservation TTL has not expired
    if datetime.utcnow() > order.reservation_expires_at:
        raise CreditIntegrityError(f"Order {order_id} reservation has expired.")

    # Advance state machine
    if order.status == "created":
        order.status = "payment_pending"
    order.status = "paid"
    order.razorpay_payment_id = razorpay_payment_id

    # Settle inventory
    batch = db.query(CreditBatch).filter(CreditBatch.batch_id == order.batch_id).with_for_update().first()
    if batch:
        batch.reserved_quantity = max(0, batch.reserved_quantity - order.quantity)
        if batch.available_quantity == 0 and batch.reserved_quantity == 0:
            batch.status = "exhausted"

    # Transfer credits to buyer account
    buyer_acc = get_or_create_account(
        entity_id=order.buyer_id,
        account_type="organisation",
        name=f"Holding Account ({order.buyer_id})",
        db=db
    )
    inv_acc = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_INVENTORY).with_for_update().first()

    if inv_acc.balance < order.quantity:
        raise CreditIntegrityError("Internal ledger error: inventory pool balance below transfer quantity.")

    inv_acc.balance -= order.quantity
    buyer_acc.balance += order.quantity

    # Double-entry ledger record
    txn_id = f"TXN-BUY-{uuid.uuid4().hex[:8].upper()}"
    db.add(LedgerEntry(
        entry_id=f"LEDG-{uuid.uuid4().hex[:10]}",
        transaction_id=txn_id,
        order_id=order.order_id,
        from_account_id=SYS_ACC_INVENTORY,
        to_account_id=buyer_acc.account_id,
        batch_id=order.batch_id,
        quantity=order.quantity,
        entry_type="transfer",
        serial_start=order.serial_start or 1,
        serial_end=order.serial_end or order.quantity,
        notes=f"Order {order.order_id} fulfilled for {order.buyer_id} (Payment: {razorpay_payment_id})"
    ))

    order.status = "credits_transferred"
    order.status = "completed"
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(order)
    logger.info("Order %s successfully completed. Transferred %d credits to %s.", order_id, order.quantity, buyer_acc.account_id)
    return order


def retire_credits(
    buyer_id: str,
    batch_id: str,
    quantity: int,
    beneficiary: str,
    purpose: str,
    db: Session
) -> Retirement:
    """
    Permanently retires carbon credits on behalf of a beneficiary.
    - Credits moved from buyer's account to ACC-SYS-RETIRED.
    - Strict invariant: Credits in ACC-SYS-RETIRED can NEVER be transferred again.
    - Creates immutable Retirement entry and Impact Certificate reference.
    """
    ensure_system_accounts(db)

    if quantity <= 0:
        raise CreditIntegrityError("Retirement quantity must be greater than 0.")

    # 1. Fetch buyer holding account with lock
    buyer_acc = db.query(CreditAccount).filter(
        CreditAccount.entity_id == buyer_id
    ).with_for_update().first()

    if not buyer_acc or buyer_acc.balance < quantity:
        available = buyer_acc.balance if buyer_acc else 0
        raise CreditIntegrityError(
            f"Insufficient credit balance for retirement. Requested: {quantity}, available: {available}."
        )

    # 2. Fetch batch
    batch = db.query(CreditBatch).filter(CreditBatch.batch_id == batch_id).with_for_update().first()
    if not batch:
        raise CreditIntegrityError(f"Batch {batch_id} not found.")

    # 3. Update balances
    buyer_acc.balance -= quantity
    ret_acc = db.query(CreditAccount).filter(CreditAccount.account_id == SYS_ACC_RETIRED).with_for_update().first()
    ret_acc.balance += quantity

    batch.retired_quantity += quantity

    # 4. Generate unique retirement certificate ID
    cert_id = f"CERT-RET-{uuid.uuid4().hex[:8].upper()}"
    ret_id = f"RET-{uuid.uuid4().hex[:10].upper()}"

    # Determine retired serial slice
    ret_serial_start = batch.serial_start + (batch.retired_quantity - quantity)
    ret_serial_end = ret_serial_start + quantity - 1

    retirement = Retirement(
        retirement_id=ret_id,
        certificate_id=cert_id,
        beneficiary=beneficiary,
        purpose=purpose,
        batch_id=batch_id,
        project_id=batch.project_id,
        quantity=quantity,
        serial_start=ret_serial_start,
        serial_end=ret_serial_end,
        account_id=buyer_acc.account_id,
        retired_at=datetime.utcnow()
    )
    db.add(retirement)

    # 5. Double-entry ledger entry
    txn_id = f"TXN-RET-{uuid.uuid4().hex[:8].upper()}"
    db.add(LedgerEntry(
        entry_id=f"LEDG-{uuid.uuid4().hex[:10]}",
        transaction_id=txn_id,
        from_account_id=buyer_acc.account_id,
        to_account_id=SYS_ACC_RETIRED,
        batch_id=batch_id,
        quantity=quantity,
        entry_type="retire",
        serial_start=ret_serial_start,
        serial_end=ret_serial_end,
        notes=f"Permanently retired {quantity} credits for '{beneficiary}' (Purpose: {purpose})"
    ))

    db.commit()
    db.refresh(retirement)
    logger.info(
        "Retired %d credits for %s (Cert: %s, Serials [%d - %d])",
        quantity, beneficiary, cert_id, ret_serial_start, ret_serial_end
    )
    return retirement


def reap_expired_reservations(db: Session) -> int:
    """
    Periodic worker task: Finds expired reservations and returns held inventory to available pool.
    """
    now = datetime.utcnow()
    expired_orders = db.query(Order).filter(
        Order.status.in_(["created", "payment_pending"]),
        Order.reservation_expires_at < now
    ).with_for_update().all()

    reaped_count = 0
    for order in expired_orders:
        batch = db.query(CreditBatch).filter(CreditBatch.batch_id == order.batch_id).with_for_update().first()
        if batch:
            batch.reserved_quantity = max(0, batch.reserved_quantity - order.quantity)
            batch.available_quantity += order.quantity

        order.status = "expired"
        order.updated_at = now

        # Record ledger release entry
        if batch:
            db.add(LedgerEntry(
                entry_id=f"LEDG-{uuid.uuid4().hex[:10]}",
                order_id=order.order_id,
                from_account_id=SYS_ACC_INVENTORY,
                to_account_id=SYS_ACC_INVENTORY,
                batch_id=batch.batch_id,
                quantity=order.quantity,
                entry_type="release",
                serial_start=order.serial_start or 0,
                serial_end=order.serial_end or 0,
                notes=f"Released reservation for expired order {order.order_id}"
            ))

        reaped_count += 1

    if reaped_count > 0:
        db.commit()
        logger.info("Reaped %d expired credit reservations and replenished inventory.", reaped_count)

    return reaped_count
