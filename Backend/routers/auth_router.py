"""
Backend/routers/auth_router.py
Enterprise Authentication & Role-Based Access Control (RBAC):
  - POST /auth/login: Validates bcrypt password hash, enforces rate limiting, logs audit, returns signed JWT.
  - POST /auth/register: Creates user with hashed password, registers NGO/Corporate entity, records audit log & welcome notif.
  - GET /auth/me: Returns current authenticated user claims refreshed from DB.
  - Dependency require_role(roles): Validates JWT bearer token, eliminating forged headers.
"""

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import jwt
import bcrypt
from fastapi import APIRouter, HTTPException, Depends, Header, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
try:
    from pydantic import EmailStr
except Exception:
    EmailStr = str
from sqlalchemy.orm import Session
from sqlalchemy import func

from credit_calculation.credits_module.db import get_db
from credit_calculation.credits_module.db_models import User, NGO, Wallet, AuditLog, Notification
try:
    from core.config import JWT_SECRET, APP_MODE
except Exception:
    JWT_SECRET = os.getenv("JWT_SECRET", "carbonvault-jwt-secret-2026")
    APP_MODE = os.getenv("APP_MODE", "demo")

logger = logging.getLogger("carbonvault.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# In-memory IP rate limiter: max 5 attempts per IP per 60 seconds
LOGIN_ATTEMPTS: Dict[str, List[float]] = {}
MAX_LOGIN_ATTEMPTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60.0


def check_login_rate_limit(client_ip: str):
    now = time.time()
    attempts = LOGIN_ATTEMPTS.get(client_ip, [])
    # Filter attempts within the sliding window
    recent_attempts = [ts for ts in attempts if now - ts < RATE_LIMIT_WINDOW_SECONDS]
    LOGIN_ATTEMPTS[client_ip] = recent_attempts
    if len(recent_attempts) >= MAX_LOGIN_ATTEMPTS:
        logger.warning("Rate limit exceeded for IP %s on /auth/login", client_ip)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 1 minute before trying again."
        )
    recent_attempts.append(now)


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=150)
    password: str = Field(..., max_length=128)


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="ngo", max_length=20)  # 'ngo' | 'corporate'
    # Optional NGO fields
    organization_name: Optional[str] = Field(None, max_length=150)
    country: Optional[str] = Field(None, max_length=100)
    registration_number: Optional[str] = Field(None, max_length=100)
    # Optional Corporate fields
    company_name: Optional[str] = Field(None, max_length=150)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=200)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user: User) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": str(user.id),
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "admin_role": getattr(user, "admin_role", None),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization token.")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Extract authenticated User from JWT token. Raises 401 for unauthenticated callers."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a valid Bearer token."
        )
    token = credentials.credentials
    claims = decode_access_token(token)
    email = claims.get("email") or claims.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    
    # Lookup by email or by user id
    if str(email).isdigit():
        user = db.query(User).filter(User.id == int(email)).first()
    else:
        user = db.query(User).filter(func.lower(User.email) == str(email).strip().lower()).first()
        
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")
    return user


def require_role(allowed_roles: List[str]):
    """
    Enforces role check via server-verified JWT token.
    Completely replaces client-sent forged X-Admin-Role headers.
    """
    def dependency(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
        db: Session = Depends(get_db)
    ) -> User:
        if not credentials or not credentials.credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required. Provide a valid Bearer token."
            )
        token = credentials.credentials
        claims = decode_access_token(token)
        user_role = claims.get("role", "public")
        effective_role = "admin" if user_role in ("admin", "super_admin", "approver") else user_role

        # Check if user role matches allowed roles
        has_role = (
            user_role in allowed_roles
            or effective_role in allowed_roles
            or (effective_role == "admin" and ("super_admin" in allowed_roles or "admin" in allowed_roles))
            or "any" in allowed_roles
            or (effective_role == "buyer" and "corporate" in allowed_roles)
            or (effective_role == "corporate" and "buyer" in allowed_roles)
        )
        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {allowed_roles}, your role: {user_role}"
            )

        email = claims.get("email") or claims.get("sub")
        if str(email).isdigit():
            user = db.query(User).filter(User.id == int(email)).first()
        else:
            user = db.query(User).filter(func.lower(User.email) == str(email).strip().lower()).first()

        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    return dependency


def log_auth_attempt(db: Session, email: str, detail: str, action: str = "auth_login"):
    try:
        from core.audit import record_audit_event
        record_audit_event(
            action=action,
            name=email,
            detail=detail,
            user=email,
            db=db,
        )
    except Exception as e:
        logger.warning("Could not persist audit log for auth attempt: %s", e)
        db.rollback()


@router.post("/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user with bcrypt password verification, rate-limit check, and audit logging."""
    from core.rate_limiter import rate_limit_auth
    rate_limit_auth(request)

    email_clean = req.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()

    demo_passwords = {
        "admin@carbonvault.com": "admin123",
        "approver@carbonvault.com": "approver123",
        "verifier@carbonvault.com": "verifier123",
        "contact@ecoguard.org": "ngo123",
        "carbon@microsoft.com": "corp123",
        "sustainability@google.com": "corp123",
        "guest@carbonvault.com": "guest123",
    }

    if not user:
        log_auth_attempt(db, email_clean, detail="user_not_found")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Verify password
    is_valid = False
    if user.password_hash:
        is_valid = verify_password(req.password, user.password_hash)
    elif email_clean in demo_passwords and req.password == demo_passwords[email_clean]:
        # Transparently backfill password hash for seeded accounts
        user.password_hash = hash_password(req.password)
        db.commit()
        is_valid = True

    if not is_valid:
        log_auth_attempt(db, email_clean, detail="invalid_password")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if getattr(user, "status", "active") == "suspended":
        log_auth_attempt(db, email_clean, detail="account_suspended")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended. Please contact platform administration.")

    # Successful login
    log_auth_attempt(db, email_clean, detail="success")

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": JWT_EXPIRATION_HOURS * 3600,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "admin_role": getattr(user, "admin_role", None),
            "projects": user.projects or 0,
            "credits": user.credits or 0.0,
            "status": user.status or "active"
        }
    }


@router.get("/demo-accounts")
def get_demo_accounts():
    """
    Returns public demo accounts for 1-click test fill in development / demo mode.
    Returns 404 in production mode.
    """
    if str(APP_MODE).strip().lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo accounts endpoint is disabled in production mode."
        )
    return {
        "status": "ok",
        "demo_accounts": [
            {
                "role": "admin",
                "label": "Admin",
                "name": "Alex Mercer",
                "email": "admin@carbonvault.com",
                "password": "admin123",
                "description": "Runs the platform and makes project review decisions with verifier sign-off.",
                "permissions": "Platform health, KYC review, users, pricing, payments & reconciliation, Review Queue oversight & project decisions, ML retraining, audit."
            },
            {
                "role": "verifier",
                "label": "Verifier",
                "name": "Marcus Vance",
                "email": "verifier@carbonvault.com",
                "password": "verifier123",
                "description": "Verifies sites in the field and signs off.",
                "permissions": "On-site field verification, ISO 14064-3 determination, ground truth photo sign-off."
            },
            {
                "role": "ngo",
                "label": "NGO",
                "name": "EcoGuard Brazil",
                "email": "contact@ecoguard.org",
                "password": "ngo123",
                "description": "Registers projects and receives funding.",
                "permissions": "Project registration wizard, evidence upload, telemetry tracking, developer payouts."
            },
            {
                "role": "corporate",
                "label": "Corporate",
                "name": "Microsoft Sustainability",
                "email": "carbon@microsoft.com",
                "password": "corp123",
                "description": "Buys and retires credits.",
                "permissions": "Carbon credit marketplace, live FX quotes, Razorpay checkout, retirement certificates."
            }
        ]
    }


@router.post("/register")
def register(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """
    Allow public self-registration for both NGO and Corporate organizations.
    - Stores bcrypt password_hash
    - Creates corresponding entity record in ngos or wallets
    - Issues a welcome notification
    - Logs audit trail entry: action='auth_register'
    """
    from core.rate_limiter import rate_limit_auth
    rate_limit_auth(request)

    email_clean = req.email.strip().lower()
    existing_user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    role_clean = req.role.strip().lower()
    if role_clean not in ["ngo", "corporate"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'ngo' or 'corporate'."
        )

    # 1. Create User
    new_user = User(
        name=req.full_name.strip(),
        email=email_clean,
        password_hash=hash_password(req.password),
        role=role_clean,
        projects=0,
        credits=0.0,
        status="active",
        joined=datetime.utcnow().strftime("%Y-%m-%d")
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 2. Register Organization / Corporate Wallet
    if role_clean == "ngo":
        org_name = (req.organization_name or req.full_name).strip()
        existing_ngo = db.query(NGO).filter(
            (func.lower(NGO.email) == email_clean) | (func.lower(NGO.name) == func.lower(org_name))
        ).first()
        if not existing_ngo:
            ngo_rec = NGO(name=org_name, email=email_clean)
            db.add(ngo_rec)
            db.commit()
        elif not existing_ngo.email:
            existing_ngo.email = email_clean
            db.commit()
    elif role_clean == "corporate":
        corp_name = (req.company_name or req.full_name).strip()
        existing_wallet = db.query(Wallet).filter(Wallet.corporate_name == corp_name).first()
        if not existing_wallet:
            wallet_rec = Wallet(
                corporate_name=corp_name,
                total_credits=0.0,
                total_spent_inr=0.0,
                last_purchase_date=None
            )
            db.add(wallet_rec)
            db.commit()

    # 3. Create Welcome Notification
    notif = Notification(
        recipient_role=role_clean,
        recipient_email=email_clean,
        type="info",
        title="Welcome to CarbonVault!",
        message=f"Welcome {req.full_name}! Your {role_clean.upper()} account has been verified and is ready for use.",
        is_read=False,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()

    # 4. Audit Log
    log_auth_attempt(db, email_clean, detail=f"role={role_clean}", action="auth_register")

    # Issue initial token for immediate login
    token = create_access_token(new_user)

    return {
        "status": "ok",
        "message": "Account created successfully.",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role,
            "admin_role": None,
            "projects": 0,
            "credits": 0.0,
            "status": "active"
        }
    }


@router.get("/me")
def get_current_user_profile(user: User = Depends(get_current_user)):
    """Validates JWT from Authorization header and returns fresh user profile from DB."""
    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "admin_role": getattr(user, "admin_role", None),
            "projects": user.projects or 0,
            "credits": user.credits or 0.0,
            "status": user.status or "active"
        },
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "admin_role": getattr(user, "admin_role", None),
        "projects": user.projects or 0,
        "credits": user.credits or 0.0,
        "status": user.status or "active"
    }
