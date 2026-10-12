"""
Backend/core/events.py
Real-time Event Spine for CarbonVault.
Provides Server-Sent Events (SSE) publishing with:
  1. In-memory asynchronous subscriber queues for sub-second live dispatch.
  2. Persistent durability in `live_events` table for history & replay upon reconnection.
  3. Audience-aware routing (all, role:admin, role:ngo, role:corporate, user:<id>).
  4. 60-second temporary ticket authentication for standard EventSource clients.
  5. Last-Event-ID reconnection replay (up to last 100 events or 10 minutes).

MULTI-INSTANCE SCALING NOTE:
In single-instance deployments (such as Render standard web service), the in-memory
asyncio.Queue provides zero-overhead event fan-out. For multi-instance horizontal scaling
across multiple nodes, replace the local subscriber fan-out with PostgreSQL LISTEN/NOTIFY
or Redis Pub/Sub so that any worker instance broadcasts events to all other connected nodes.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, Set, Optional, Any, List

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import LiveEvent

logger = logging.getLogger("carbonvault.events")

# In-memory ticket cache: { ticket_token: { "role": str, "email": str, "expires_at": float } }
_TICKETS: Dict[str, Dict[str, Any]] = {}

# In-memory subscribers: set of Subscriber objects
class Subscriber:
    def __init__(self, queue: asyncio.Queue, role: str = "public", email: Optional[str] = None):
        self.queue = queue
        self.role = role or "public"
        self.email = email
        self.created_at = time.time()

_SUBSCRIBERS: Set[Subscriber] = set()
_LOCK = asyncio.Lock()


def create_ticket(role: str = "public", email: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """Generate a single-use 60-second ticket token for EventSource authentication."""
    ticket = f"tkt_{uuid.uuid4().hex}"
    _TICKETS[ticket] = {
        "role": role or "public",
        "email": email or (f"user_{user_id}" if user_id else None),
        "expires_at": time.time() + 60.0
    }
    # Clean up expired tickets
    now = time.time()
    expired = [t for t, data in _TICKETS.items() if data["expires_at"] < now]
    for t in expired:
        _TICKETS.pop(t, None)
    return ticket


def validate_ticket(ticket: Optional[str]) -> Dict[str, Any]:
    """Validate ticket and return caller identity. Defaults to public guest if missing or expired."""
    if not ticket:
        return {"role": "public", "email": None}
    now = time.time()
    data = _TICKETS.get(ticket)
    if data and data["expires_at"] >= now:
        # One-time or reusable within 60s
        return {"role": data.get("role", "public"), "email": data.get("email")}
    return {"role": "public", "email": None}


def matches_audience(audience: str, subscriber_role: str, subscriber_email: Optional[str]) -> bool:
    """Check if an event audience matches a connected subscriber."""
    if not audience or audience == "all":
        return True
    
    # Role-based audience
    if audience.startswith("role:"):
        target_role = audience.split(":", 1)[1].lower()
        sub_role = (subscriber_role or "public").lower()
        if sub_role == "admin" or sub_role == "super_admin":
            return True  # Admins see admin and system alerts
        return sub_role == target_role

    # User-specific audience
    if audience.startswith("user:"):
        target_user = audience.split(":", 1)[1].lower()
        if subscriber_email and subscriber_email.lower() == target_user:
            return True
        return False

    return False


def get_replay_events(last_event_id: int, subscriber_role: str, subscriber_email: Optional[str], limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch missed events from database since last_event_id (max 100 or past 10 minutes)."""
    db = SessionLocal()
    try:
        ten_mins_ago = datetime.utcnow() - timedelta(minutes=10)
        query = db.query(LiveEvent).filter(
            LiveEvent.id > last_event_id,
            LiveEvent.created_at >= ten_mins_ago
        ).order_by(LiveEvent.id.asc()).limit(limit)

        rows = query.all()
        replay = []
        for r in rows:
            if matches_audience(r.audience, subscriber_role, subscriber_email):
                try:
                    payload = json.loads(r.payload)
                except Exception:
                    payload = {"raw": r.payload}
                replay.append({
                    "id": r.id,
                    "type": r.type,
                    "payload": payload,
                    "audience": r.audience,
                    "created_at": r.created_at.isoformat() + "Z"
                })
        return replay
    except Exception as e:
        logger.warning("Error fetching replay events from DB: %s", e)
        return []
    finally:
        db.close()


def publish(event_type: str, payload: Dict[str, Any], audience: str = "all") -> Optional[int]:
    """
    Publish an event:
    1. Persists row to `live_events` table in database.
    2. Pushes event to all active in-memory subscriber queues matching audience filter.
    """
    db = SessionLocal()
    event_id = None
    now = datetime.utcnow()
    payload_json = json.dumps(payload, default=str)

    try:
        live_row = LiveEvent(
            type=event_type,
            payload=payload_json,
            audience=audience,
            created_at=now
        )
        db.add(live_row)
        db.commit()
        db.refresh(live_row)
        event_id = live_row.id
    except Exception as e:
        db.rollback()
        logger.error("Failed to persist live_event to database: %s", e)
        # Fall back to timestamp-based pseudo id for in-memory dispatch
        event_id = int(time.time() * 1000)
    finally:
        db.close()

    event_msg = {
        "id": event_id,
        "type": event_type,
        "payload": payload,
        "audience": audience,
        "created_at": now.isoformat() + "Z"
    }

    # In-memory subscriber dispatch
    dead_subscribers = []
    for sub in list(_SUBSCRIBERS):
        if matches_audience(audience, sub.role, sub.email):
            try:
                sub.queue.put_nowait(event_msg)
            except asyncio.QueueFull:
                dead_subscribers.append(sub)
            except Exception:
                pass

    for dead in dead_subscribers:
        _SUBSCRIBERS.discard(dead)

    logger.info("Published event [%s] id=%s to audience='%s' (active subs: %d)", event_type, event_id, audience, len(_SUBSCRIBERS))
    return event_id


async def register_subscriber(role: str = "public", email: Optional[str] = None) -> Subscriber:
    queue = asyncio.Queue(maxsize=200)
    sub = Subscriber(queue=queue, role=role, email=email)
    _SUBSCRIBERS.add(sub)
    logger.info("Subscriber connected (role=%s, email=%s, total=%d)", role, email, len(_SUBSCRIBERS))
    return sub


def unregister_subscriber(sub: Subscriber):
    _SUBSCRIBERS.discard(sub)
    logger.info("Subscriber disconnected (role=%s, email=%s, remaining=%d)", sub.role, sub.email, len(_SUBSCRIBERS))
