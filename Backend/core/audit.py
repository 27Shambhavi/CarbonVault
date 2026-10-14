"""
CarbonVault Phase 4: Cryptographic Append-Only Audit Log with Hash Chain.
Guarantees tamper-evidence and non-repudiation.
Each audit entry contains:
  - prev_hash: SHA256 of the prior audit record (or 64 zeros for Genesis block)
  - hash: SHA256(prev_hash | action | name | detail | user | timestamp)
Database updates and deletes are blocked.
A verification function validates the unbroken cryptographic integrity of the ledger.
"""

import hashlib
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from credit_calculation.credits_module.db_models import AuditLog

logger = logging.getLogger("carbonvault.audit")
GENESIS_HASH = "0" * 64


def calculate_audit_hash(prev_hash: str, action: str, name: str, detail: str, user: str, timestamp_iso: str) -> str:
    """Computes deterministic SHA256 hash for an audit record."""
    raw = f"{prev_hash}|{action or ''}|{name or ''}|{detail or ''}|{user or ''}|{timestamp_iso}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def record_audit_event(
    action: str,
    name: str,
    detail: str,
    user: str,
    db: Session,
    timestamp: Optional[datetime] = None
) -> AuditLog:
    """
    Creates and records a cryptographically linked audit event in the append-only ledger.
    """
    ts = timestamp or datetime.utcnow()
    ts_iso = ts.isoformat()

    # Query last audit entry to retrieve previous hash
    last_entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    if last_entry and last_entry.hash:
        prev_hash = last_entry.hash
    else:
        prev_hash = GENESIS_HASH

    current_hash = calculate_audit_hash(prev_hash, action, name, detail, user, ts_iso)

    entry = AuditLog(
        action=action,
        name=name,
        detail=detail,
        user=user,
        timestamp=ts,
        prev_hash=prev_hash,
        hash=current_hash
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def verify_audit_hash_chain(db: Session) -> Dict[str, Any]:
    """
    Verifies the entire cryptographic hash chain from Genesis to Head.
    Reports whether the ledger is intact or identifies the exact ID where tampering occurred.
    """
    entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not entries:
        return {
            "status": "empty",
            "verified": True,
            "total_records": 0,
            "message": "Audit ledger is empty."
        }

    expected_prev = GENESIS_HASH

    for idx, entry in enumerate(entries):
        # 1. Verify link to previous entry
        if entry.prev_hash != expected_prev:
            return {
                "status": "broken",
                "verified": False,
                "broken_at_id": entry.id,
                "record_index": idx,
                "action": entry.action,
                "reason": "Previous hash link broken (unauthorized insertion or deletion)",
                "expected_prev_hash": expected_prev,
                "found_prev_hash": entry.prev_hash,
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None
            }

        # 2. Verify integrity of current entry hash
        ts_iso = entry.timestamp.isoformat() if entry.timestamp else ""
        expected_hash = calculate_audit_hash(
            entry.prev_hash,
            entry.action,
            entry.name,
            entry.detail,
            entry.user,
            ts_iso
        )

        if entry.hash != expected_hash:
            return {
                "status": "broken",
                "verified": False,
                "broken_at_id": entry.id,
                "record_index": idx,
                "action": entry.action,
                "reason": "Hash mismatch (data modification or tampering detected)",
                "expected_hash": expected_hash,
                "found_hash": entry.hash,
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None
            }

        expected_prev = entry.hash

    return {
        "status": "intact",
        "verified": True,
        "total_records": len(entries),
        "genesis_hash": GENESIS_HASH,
        "head_hash": entries[-1].hash if entries else GENESIS_HASH,
        "message": f"Cryptographic integrity verified across all {len(entries)} audit ledger records."
    }


def ensure_audit_chain_hashed(db: Session):
    """Backfills hashes for legacy or seeded records so the chain is unbroken."""
    entries = db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    if not entries:
        return

    expected_prev = GENESIS_HASH
    updated = False

    for entry in entries:
        ts_iso = entry.timestamp.isoformat() if entry.timestamp else ""
        computed = calculate_audit_hash(
            expected_prev,
            entry.action,
            entry.name,
            entry.detail,
            entry.user,
            ts_iso
        )
        if entry.prev_hash != expected_prev or entry.hash != computed:
            # Bypass SQLAlchemy listener for backfill of legacy data
            db.execute(
                AuditLog.__table__.update()
                .where(AuditLog.id == entry.id)
                .values(prev_hash=expected_prev, hash=computed)
            )
            updated = True
        expected_prev = computed

    if updated:
        db.commit()
        logger.info(f"Backfilled cryptographic hash chain for {len(entries)} audit logs.")
