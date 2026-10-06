import os
import sys
import logging
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Setup path and config
sys.path.append(os.path.dirname(__file__))
from core.config import (
    DATABASE_URL, CORS_ORIGINS, UPLOAD_DIR, DEBUG, DEFAULT_DB_FILE
)

logging.basicConfig(level=logging.INFO if not DEBUG else logging.DEBUG)
logger = logging.getLogger("carbonvault")

# DB Models & Engine
from credit_calculation.credits_module.db_models import (
    Base, Project, NGO, CorporateRequest, Transaction, Wallet, ProjectCredits, FundingDetails
)
from credit_calculation.credits_module.db import engine, SessionLocal

# Import Routers
from routers.project_servicerouter import router as project_router
from routers.grs_router import router as grs_router
from routers.marketplace_router import router as marketplace_router
from routers.site_suitability.site_suitability_router import router as suitability_router
from fraud_detection_new.app.api.fraud_routes import router as fraud_router
from credit_calculation.credits_module.api import router as credit_router
from routers.payment_router import router as payment_router
from routers.esg_router import router as esg_router


def migrate_db():
    """Ensure all required columns exist in SQLite database."""
    if not DATABASE_URL.startswith("sqlite"):
        return

    # Extract db path from URL
    db_path = str(DEFAULT_DB_FILE)
    if not os.path.exists(db_path):
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    new_columns = [
        ("polygon_wkt", "TEXT"),
        ("mrv_score", "REAL"),
        ("fraud_risk", "REAL"),
        ("env_score", "REAL"),
        ("shadow_credits", "REAL"),
        ("evidence_image", "TEXT"),
        ("evidence_images", "TEXT"),
    ]

    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            logger.info("Added column projects.%s", col_name)
        except sqlite3.OperationalError:
            pass  # Column already exists

    conn.commit()
    conn.close()


def seed_initial_data():
    """Seed initial projects, NGOs, and demo transactions if database is fresh."""
    db = SessionLocal()
    try:
        # Check if projects already exist
        if db.query(Project).first():
            return

        logger.info("Seeding initial demo data into CarbonVault database...")

        # 1. NGOs
        ngo_brazil = NGO(name="EcoGuard Brazil", email="contact@ecoguard.org")
        ngo_delta = NGO(name="Green Delta", email="info@greendelta.org")
        ngo_congo = NGO(name="CongoCare", email="ops@congocare.org")
        ngo_mekong = NGO(name="MekongGreen", email="mekong@mekonggreen.org")
        db.add_all([ngo_brazil, ngo_delta, ngo_congo, ngo_mekong])
        db.commit()
        db.refresh(ngo_brazil)
        db.refresh(ngo_delta)
        db.refresh(ngo_congo)
        db.refresh(ngo_mekong)

        # 2. Initial Projects with valid WKT polygons
        today = datetime.utcnow().date()
        p1 = Project(
            project_id="PRJ-MAN-AMAZON",
            ngo_id=ngo_brazil.id,
            name="Amazon Reforestation Initiative",
            latitude=-3.4653,
            longitude=-62.2159,
            area_hectares=4500.0,
            plantation_type="mixed",
            number_of_trees=180000,
            start_date=today.replace(month=1, day=15),
            status="approved",
            polygon_wkt="POLYGON((-62.2359 -3.4853, -62.1959 -3.4853, -62.1959 -3.4453, -62.2359 -3.4453, -62.2359 -3.4853))",
            mrv_score=94.0,
            fraud_risk=8.0,
            env_score=91.0,
            credits=12400.0,
            shadow_credits=43400.0,
            price=28.50,
            created_at=today
        )

        p2 = Project(
            project_id="PRJ-MAN-SUNDAR",
            ngo_id=ngo_delta.id,
            name="Sundarbans Mangrove Restoration",
            latitude=21.9497,
            longitude=88.9468,
            area_hectares=2100.0,
            plantation_type="mangrove",
            number_of_trees=95000,
            start_date=today.replace(month=3, day=10),
            status="pending",
            polygon_wkt="POLYGON((88.9268 21.9297, 88.9668 21.9297, 88.9668 21.9697, 88.9268 21.9697, 88.9268 21.9297))",
            mrv_score=87.0,
            fraud_risk=12.0,
            env_score=88.0,
            credits=8200.0,
            shadow_credits=28700.0,
            price=26.00,
            created_at=today
        )

        p3 = Project(
            project_id="PRJ-TEK-CONGO1",
            ngo_id=ngo_congo.id,
            name="Congo Basin Forest Shield",
            latitude=-0.2280,
            longitude=25.5560,
            area_hectares=7800.0,
            plantation_type="teak",
            number_of_trees=312000,
            start_date=today.replace(month=2, day=1),
            status="approved",
            polygon_wkt="POLYGON((25.5360 -0.2480, 25.5760 -0.2480, 25.5760 -0.2080, 25.5360 -0.2080, 25.5360 -0.2480))",
            mrv_score=91.0,
            fraud_risk=9.0,
            env_score=93.0,
            credits=22000.0,
            shadow_credits=77000.0,
            price=29.75,
            created_at=today
        )

        p4 = Project(
            project_id="PRJ-MAN-VIET01",
            ngo_id=ngo_mekong.id,
            name="Vietnamese Coastal Mangrove",
            latitude=9.5947,
            longitude=105.9740,
            area_hectares=900.0,
            plantation_type="mangrove",
            number_of_trees=54000,
            start_date=today.replace(month=4, day=5),
            status="approved",
            polygon_wkt="POLYGON((105.9540 9.5747, 105.9940 9.5747, 105.9940 9.6147, 105.9540 9.6147, 105.9540 9.5747))",
            mrv_score=88.0,
            fraud_risk=11.0,
            env_score=86.0,
            credits=6800.0,
            shadow_credits=23800.0,
            price=26.00,
            created_at=today
        )

        db.add_all([p1, p2, p3, p4])
        db.commit()

        # 3. Add Funding Details & Credits records
        for p in [p1, p3, p4]:
            funding = FundingDetails(
                project_id=p.project_id,
                price_per_ton=p.price,
                ecosystem_multiplier=1.15,
                total_funding=round((p.credits or 0) * (p.price or 25.0), 2)
            )
            credits_rec = ProjectCredits(
                project_id=p.project_id,
                total_shadow_credits=p.shadow_credits or 0.0,
                verified_credits=p.credits or 0.0,
                certificate_id=f"CV-2024-{p.project_id[-4:]}",
                issuance_date=today,
                expiry_date=today.replace(year=today.year + 5)
            )
            db.add_all([funding, credits_rec])

        # 4. Corporate Requests & Wallets
        req1 = CorporateRequest(
            corporate_name="Microsoft Sustainability",
            project_id=p1.project_id,
            offered_price=28.50,
            status="accepted",
            created_at=today
        )
        req2 = CorporateRequest(
            corporate_name="Google Carbon Team",
            project_id=p3.project_id,
            offered_price=29.75,
            status="accepted",
            created_at=today
        )
        db.add_all([req1, req2])

        # Wallets
        w1 = Wallet(
            corporate_name="Microsoft Sustainability",
            total_credits=15200.0,
            total_spent_inr=3625000.0,
            last_purchase_date=today
        )
        w2 = Wallet(
            corporate_name="Google Carbon Team",
            total_credits=28000.0,
            total_spent_inr=6950000.0,
            last_purchase_date=today
        )
        db.add_all([w1, w2])

        # Transactions
        t1 = Transaction(
            razorpay_order_id="order_demo_init01",
            razorpay_payment_id="pay_demo_init01",
            project_id=p1.project_id,
            project_name=p1.name,
            corporate_name="Microsoft Sustainability",
            quantity=2000.0,
            price_per_ton=28.50,
            amount_inr=475950.0,
            amount_usd=5700.0,
            status="completed",
            created_at=today
        )
        db.add(t1)
        db.commit()
        logger.info("[OK] Initial demo data seeded successfully")

    except Exception as e:
        db.rollback()
        logger.warning("Error seeding demo data: %s", e)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist, run migrations, seed data
    Base.metadata.create_all(bind=engine)
    migrate_db()
    seed_initial_data()
    logger.info("[OK] Database ready at: %s", DATABASE_URL)
    yield


app = FastAPI(
    title="CarbonVault Unified API",
    description="Carbon credit marketplace with satellite verification, ML site suitability, fraud checks, and payments.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware (allows configured dev and production origins + all Vercel deployments)
cors_origins = CORS_ORIGINS
if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Static file serving for uploads (evidence images)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include Routers
app.include_router(project_router, prefix="/projects", tags=["Projects"])
app.include_router(grs_router, prefix="/grs", tags=["GRS"])
app.include_router(suitability_router, tags=["Site Suitability"])
app.include_router(marketplace_router, prefix="/marketplace", tags=["Marketplace"])
app.include_router(credit_router, tags=["Credits"])
app.include_router(fraud_router, prefix="/fraud", tags=["Fraud Detection"])
app.include_router(payment_router, prefix="/payment", tags=["Payment"])
app.include_router(esg_router, prefix="/esg", tags=["ESG"])


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CarbonVault Unified API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}


if __name__ == "__main__":
    import uvicorn
    from core.config import API_HOST, API_PORT
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=DEBUG)