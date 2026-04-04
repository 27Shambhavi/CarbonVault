# core/spacetimedb_bridge.py
"""
SpacetimeDB real-time event bridge.

PostgreSQL = source of truth (storage, transactions)
SpacetimeDB = real-time layer (live updates, streaming analytics, fraud signals)

Data Flow:
  1. Store data -> PostgreSQL (via SQLAlchemy)
  2. Publish event -> SpacetimeDB (via this bridge)
  3. Frontend reads: static from PostgreSQL APIs, live from SpacetimeDB stream

When SpacetimeDB is not available, events queue in-memory and can be
replayed when connection is restored.
"""
import logging
import json
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)

# In-memory event queue (fallback when SpacetimeDB not connected)
_event_queue = deque(maxlen=1000)
_spacetime_connected = False


def publish_event(event_type: str, data: dict):
    """
    Publish an event to SpacetimeDB real-time layer.

    Event types:
      - credit_purchased: when a corporate buys credits
      - project_approved: when admin approves a project
      - project_created: when NGO submits a project
      - fraud_detected: when fraud risk > 50%
      - wallet_updated: when wallet balance changes
      - price_changed: when admin updates pricing

    Args:
        event_type: one of the event types above
        data: event payload dict
    """
    event = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    if _spacetime_connected:
        try:
            _push_to_spacetime(event)
            logger.info("SpacetimeDB event published: %s", event_type)
            return True
        except Exception as e:
            logger.warning("SpacetimeDB push failed, queueing: %s", e)

    # Queue for later replay
    _event_queue.append(event)
    logger.debug("Event queued (%d in queue): %s", len(_event_queue), event_type)
    return False


def _push_to_spacetime(event: dict):
    """
    Push event to SpacetimeDB.

    TODO: Replace with actual SpacetimeDB client when deployed.
    SpacetimeDB requires:
      1. Install: `curl -sSf https://install.spacetimedb.com | sh`
      2. Create module: `spacetime init --lang=rust carbonvault_realtime`
      3. Publish: `spacetime publish carbonvault_realtime`
      4. Connect via WebSocket client

    For now this is a stub that logs the event.
    """
    logger.info("SpacetimeDB event: %s -> %s", event["type"], json.dumps(event["data"])[:200])


def get_queued_events(limit: int = 100) -> list:
    """Return recent queued events for debugging / replay."""
    return list(_event_queue)[-limit:]


def get_queue_size() -> int:
    return len(_event_queue)


# Convenience functions for common events

def on_credit_purchased(project_id: str, corporate_name: str, quantity: float, amount_inr: float):
    publish_event("credit_purchased", {
        "project_id": project_id,
        "corporate_name": corporate_name,
        "quantity": quantity,
        "amount_inr": amount_inr,
    })


def on_project_approved(project_id: str, credits: float, price_per_ton: float):
    publish_event("project_approved", {
        "project_id": project_id,
        "credits": credits,
        "price_per_ton": price_per_ton,
    })


def on_project_created(project_id: str, ngo_name: str, plantation_type: str):
    publish_event("project_created", {
        "project_id": project_id,
        "ngo_name": ngo_name,
        "plantation_type": plantation_type,
    })


def on_fraud_detected(project_id: str, fraud_risk: float, details: dict):
    publish_event("fraud_detected", {
        "project_id": project_id,
        "fraud_risk": fraud_risk,
        "details": details,
    })
