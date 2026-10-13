"""
Backend/routers/realtime_router.py
Server-Sent Events (SSE) router providing:
  - POST /realtime/ticket: Generates short-lived 60-second authentication ticket for EventSource.
  - GET /realtime/stream: SSE stream with audience filtering, 15s heartbeats, and Last-Event-ID replay.
"""

import asyncio
import json
import logging
from typing import Optional
from fastapi import APIRouter, Query, Header, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.events import (
    create_ticket, validate_ticket, register_subscriber,
    unregister_subscriber, get_replay_events
)

logger = logging.getLogger("carbonvault.realtime")
router = APIRouter(prefix="/realtime", tags=["Real-time Stream"])


class TicketRequest(BaseModel):
    role: Optional[str] = "public"
    email: Optional[str] = None
    user_id: Optional[str] = None


@router.post("/ticket")
async def issue_realtime_ticket(req: Optional[TicketRequest] = None):
    """
    Issue a 60-second temporary ticket for standard browser EventSource.
    EventSource cannot send custom HTTP authorization headers, so ticket authentication is used.
    """
    role = req.role if req else "public"
    email = req.email if req else None
    user_id = req.user_id if req else None

    ticket = create_ticket(role=role, email=email, user_id=user_id)
    return {
        "ticket": ticket,
        "expires_in": 60,
        "role": role,
        "stream_url": f"/realtime/stream?ticket={ticket}"
    }


@router.get("/stream")
async def realtime_stream(
    request: Request,
    ticket: Optional[str] = Query(None),
    last_event_id: Optional[int] = Query(None),
    header_last_id: Optional[str] = Header(None, alias="Last-Event-ID")
):
    """
    Real-time Server-Sent Events stream:
      - Sends 15-second heartbeats (: heartbeat) to prevent proxy timeouts.
      - Replays missed events if Last-Event-ID or last_event_id is provided.
      - Filters published events by audience according to ticket identity.
      - Cache-Control: no-cache, X-Accel-Buffering: no for immediate delivery through reverse proxies.
    """
    # Authenticate via ticket (or fallback to public)
    auth = validate_ticket(ticket)
    sub_role = auth.get("role", "public")
    sub_email = auth.get("email")

    # Determine last event id for replay
    replay_id = last_event_id
    if replay_id is None and header_last_id:
        try:
            replay_id = int(header_last_id)
        except ValueError:
            replay_id = None

    sub = await register_subscriber(role=sub_role, email=sub_email)

    async def event_generator():
        try:
            # Flush initial connection comment immediately to bypass reverse proxy buffering
            yield ": connected\n\n"

            # 1. Replay missed events if requested
            if replay_id is not None and replay_id >= 0:
                replayed = get_replay_events(replay_id, sub_role, sub_email)
                for ev in replayed:
                    yield f"id: {ev['id']}\nevent: {ev['type']}\ndata: {json.dumps(ev['payload'])}\n\n"

            # 2. Main event loop with 15s heartbeat
            while True:
                # Check client disconnection
                if await request.is_disconnected():
                    break

                try:
                    event = await asyncio.wait_for(sub.queue.get(), timeout=15.0)
                    yield f"id: {event['id']}\nevent: {event['type']}\ndata: {json.dumps(event['payload'])}\n\n"
                except asyncio.TimeoutError:
                    # Send comment heartbeat to maintain connection
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unregister_subscriber(sub)

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)


@router.get("/events")
def get_recent_events(
    since_id: Optional[int] = Query(0),
    role: Optional[str] = Query("public"),
    email: Optional[str] = Query(None),
    limit: Optional[int] = Query(50)
):
    """
    HTTP polling fallback for environments where persistent SSE is disabled or blocked.
    Replays missed events from `live_events` table up to `limit`.
    """
    events = get_replay_events(last_event_id=since_id or 0, subscriber_role=role or "public", subscriber_email=email, limit=limit or 50)
    return {"events": events}
