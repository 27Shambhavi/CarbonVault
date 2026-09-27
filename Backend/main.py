from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sys
import os
import logging

logger = logging.getLogger(__name__)

# Load .env BEFORE anything else
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
    print("[OK] .env loaded")
except ImportError:
    print("[WARN] python-dotenv not installed, using system env vars")

sys.path.append(os.path.dirname(__file__))

# Routers
print("Importing routers...")

from routers.project_servicerouter import router as project_router
print("[OK] project_router loaded")

from routers.grs_router import router as grs_router
print("[OK] grs_router loaded")

from routers.marketplace_router import router as marketplace_router
print("[OK] marketplace_router loaded")

from routers.site_suitability.site_suitability_router import router as suitability_router
print("[OK] suitability_router loaded")

from fraud_detection_new.app.api.fraud_routes import router as fraud_router
print("[OK] fraud_router loaded (fraud_detection_new)")

from credit_calculation.credits_module.api import router as credit_router
print("[OK] credit_router loaded")

from routers.payment_router import router as payment_router
print("[OK] payment_router loaded")

# DB (credits)
from credit_calculation.credits_module.db_models import Base, Project, NGO, CorporateRequest, Transaction, Wallet
from credit_calculation.credits_module.db import engine
import sqlite3

app = FastAPI(title="CarbonVault Unified API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def migrate_db():
    """Add new columns to existing tables if they don't exist (SQLite migration)."""
    db_path = os.path.join(os.path.dirname(__file__), "carbonvault.db")
    if not os.path.exists(db_path):
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # New columns to add to projects table
    new_columns = [
        ("polygon_wkt", "TEXT"),
        ("mrv_score", "REAL"),
        ("fraud_risk", "REAL"),
        ("env_score", "REAL"),
        ("shadow_credits", "REAL"),
        ("evidence_images", "TEXT"),
    ]

    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            print(f"  [OK] Added column projects.{col_name}")
        except sqlite3.OperationalError:
            pass  # Column already exists

    conn.commit()
    conn.close()


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    migrate_db()
    print("[OK] Database ready (with migrations)")

# Register all modules properly
app.include_router(project_router, prefix="/projects", tags=["Projects"])
app.include_router(grs_router, prefix="/grs", tags=["GRS"])
app.include_router(suitability_router, tags=["Site Suitability"])
app.include_router(marketplace_router, prefix="/marketplace", tags=["Marketplace"])

# IMPORTANT: credits already has prefix inside - DO NOT add again
app.include_router(credit_router, tags=["Credits"])

app.include_router(fraud_router, prefix="/fraud", tags=["Fraud Detection"])

# Payment / Razorpay
app.include_router(payment_router, prefix="/payment", tags=["Payment"])

# Serve uploaded evidence images as static files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {"message": "CarbonVault API running"}