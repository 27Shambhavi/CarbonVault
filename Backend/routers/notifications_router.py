import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from credit_calculation.credits_module.db import get_db
from credit_calculation.credits_module.db_models import Notification

logger = logging.getLogger("carbonvault.notifications")
router = APIRouter()


def format_time_ago(dt: Optional[datetime]) -> str:
    """Format a datetime into a human-readable relative time string."""
    if not dt:
        return "recently"
    now = datetime.utcnow()
    diff = now - dt
    seconds = int(diff.total_seconds())

    if seconds < 0:
        return "just now"
    if seconds < 60:
        return f"{seconds}s ago" if seconds > 5 else "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 30:
        return f"{days}d ago"
    months = days // 30
    return f"{months}mo ago"


def create_notification(
    db: Session,
    title: str,
    message: str,
    type: str = "info",
    recipient_role: Optional[str] = None,
    recipient_email: Optional[str] = None,
    related_project_id: Optional[str] = None,
) -> Notification:
    """Helper to dispatch a persistent notification into the database."""
    try:
        notif = Notification(
            title=title,
            message=message,
            type=type,
            recipient_role=recipient_role,
            recipient_email=recipient_email,
            related_project_id=related_project_id,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        logger.info("Notification created [%s]: %s (role=%s)", type, title, recipient_role)
        return notif
    except Exception as e:
        db.rollback()
        logger.error("Failed to create notification: %s", e)
        return None


@router.get("", response_model=List[dict])
@router.get("/", response_model=List[dict])
def list_notifications(
    role: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve dynamic notifications filtered by recipient role/email."""
    query = db.query(Notification)

    # Filter by recipient role/all
    conditions = []
    if role:
        conditions.append(or_(
            Notification.recipient_role == role,
            Notification.recipient_role == "all",
            Notification.recipient_role == None
        ))
    if email:
        conditions.append(or_(
            Notification.recipient_email == email,
            Notification.recipient_email == None
        ))
    if conditions:
        query = query.filter(and_(*conditions))

    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = query.order_by(desc(Notification.created_at)).limit(limit).all()

    return [
        {
            "id": n.id,
            "type": n.type or "info",
            "title": n.title,
            "message": n.message,
            "related_project_id": n.related_project_id,
            "read": bool(n.is_read),
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "time": format_time_ago(n.created_at),
        }
        for n in notifications
    ]


@router.get("/unread-count")
def get_unread_count(
    role: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get the count of unread notifications for a user/role."""
    query = db.query(Notification).filter(Notification.is_read == False)

    conditions = []
    if role:
        conditions.append(or_(
            Notification.recipient_role == role,
            Notification.recipient_role == "all",
            Notification.recipient_role == None
        ))
    if email:
        conditions.append(or_(
            Notification.recipient_email == email,
            Notification.recipient_email == None
        ))
    if conditions:
        query = query.filter(and_(*conditions))

    count = query.count()
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Mark a specific notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok", "id": notification_id, "read": True}


@router.post("/mark-all-read")
def mark_all_read(
    role: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Mark all matching notifications as read."""
    query = db.query(Notification).filter(Notification.is_read == False)

    conditions = []
    if role:
        conditions.append(or_(
            Notification.recipient_role == role,
            Notification.recipient_role == "all",
            Notification.recipient_role == None
        ))
    if email:
        conditions.append(or_(
            Notification.recipient_email == email,
            Notification.recipient_email == None
        ))
    if conditions:
        query = query.filter(and_(*conditions))

    updated_count = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "ok", "updated_count": updated_count}
