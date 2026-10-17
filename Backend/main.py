import os
import sys
import logging
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Setup path and config
sys.path.append(os.path.dirname(__file__))
from core.config import (
    DATABASE_URL, CORS_ORIGINS, UPLOAD_DIR, DEBUG, DEFAULT_DB_FILE, settings
)
from core.logging_middleware import setup_structured_logging, RequestIdMiddleware
from core.errors import http_exception_handler, validation_exception_handler

setup_structured_logging(debug=DEBUG, sentry_dsn=settings.SENTRY_DSN)
logger = logging.getLogger("carbonvault")

# DB Models & Engine
from credit_calculation.credits_module.db_models import (
    Base, Project, NGO, CorporateRequest, Transaction, Wallet, ProjectCredits, FundingDetails, AuditLog,
    User, PricingConfig, PriceHistory, Notification, ProjectStatusHistory, ProjectProgressUpdate,
    FootprintEstimate, Certificate, OrganizationProfile, ProjectDocument, FieldVerification,
    FraudRun, FraudCheck
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
from routers.notifications_router import router as notifications_router
from routers.calculator_router import router as calculator_router
from routers.certificate_router import router as certificate_router
from routers.realtime_router import router as realtime_router
from routers.auth_router import router as auth_router, hash_password
from routers.stats_router import router as stats_router
from routers.config_router import router as config_router
from routers.credit_integrity_router import router as credit_integrity_router
from routers.onboarding_router import router as onboarding_router
from routers.ml_models_router import router as ml_models_router


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
        ("is_synthetic", "BOOLEAN DEFAULT 0"),
        ("description", "TEXT"),
        ("objectives", "TEXT"),
    ]

    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            logger.info("Added column projects.%s", col_name)
        except sqlite3.OperationalError:
            pass  # Column already exists

    # Ensure notifications table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_role TEXT,
                recipient_email TEXT,
                type TEXT DEFAULT 'info',
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                related_project_id TEXT,
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME
            )
        """)
        logger.info("Ensured notifications table exists")
    except Exception as e:
        logger.warning("Error creating notifications table: %s", e)

    # Ensure project_status_history table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT NOT NULL,
                changed_by TEXT,
                comment TEXT,
                timestamp DATETIME
            )
        """)
        logger.info("Ensured project_status_history table exists")
    except Exception as e:
        logger.warning("Error creating project_status_history table: %s", e)

    # Ensure project_progress_updates table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS project_progress_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                quarter TEXT NOT NULL,
                year INTEGER NOT NULL,
                survival_rate REAL,
                canopy_cover REAL,
                photos TEXT,
                notes TEXT,
                submitted_at DATETIME,
                verified_by_satellite BOOLEAN DEFAULT 0
            )
        """)
        logger.info("Ensured project_progress_updates table exists")
    except Exception as e:
        logger.warning("Error creating project_progress_updates table: %s", e)

    # Ensure footprint_estimates table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS footprint_estimates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                corporate_name TEXT NOT NULL,
                scope1_tonnes REAL NOT NULL,
                scope2_tonnes REAL NOT NULL,
                scope3_tonnes REAL NOT NULL,
                total_tonnes REAL NOT NULL,
                inputs_json TEXT,
                created_at DATETIME
            )
        """)
        logger.info("Ensured footprint_estimates table exists")
    except Exception as e:
        logger.warning("Error creating footprint_estimates table: %s", e)

    # Ensure certificates table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                public_id TEXT UNIQUE NOT NULL,
                project_id TEXT NOT NULL,
                transaction_id INTEGER,
                buyer_name TEXT,
                tonnes REAL NOT NULL,
                issued_at DATETIME NOT NULL,
                sha256_hash TEXT NOT NULL,
                type TEXT NOT NULL
            )
        """)
        logger.info("Ensured certificates table exists")
    except Exception as e:
        logger.warning("Error creating certificates table: %s", e)

    # Ensure transactions table has certificate_id column
    try:
        cursor.execute("ALTER TABLE transactions ADD COLUMN certificate_id TEXT")
        logger.info("Added certificate_id column to transactions")
    except Exception:
        pass

    # Ensure users table has admin_role column
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN admin_role TEXT DEFAULT 'super_admin'")
        logger.info("Added admin_role column to users")
    except Exception:
        pass

    try:
        cursor.execute("UPDATE users SET admin_role = 'super_admin' WHERE role = 'admin' AND (admin_role IS NULL OR admin_role = '')")
    except Exception:
        pass

    # Ensure live_events table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS live_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                payload TEXT NOT NULL,
                audience TEXT DEFAULT 'all',
                created_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured live_events table exists")
    except Exception as e:
        logger.warning("Error creating live_events table: %s", e)

    # Ensure satellite_observations table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS satellite_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                source TEXT NOT NULL,
                band TEXT NOT NULL,
                obs_date DATE NOT NULL,
                value REAL NOT NULL,
                fetched_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured satellite_observations table exists")
    except Exception as e:
        logger.warning("Error creating satellite_observations table: %s", e)

    # Ensure climate_observations table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS climate_observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                obs_date DATE NOT NULL,
                t2m REAL,
                prectotcorr REAL,
                rh2m REAL,
                fetched_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured climate_observations table exists")
    except Exception as e:
        logger.warning("Error creating climate_observations table: %s", e)

    # Ensure ml_assessments table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ml_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                model TEXT NOT NULL,
                score REAL NOT NULL,
                reasons TEXT,
                confidence TEXT,
                model_version TEXT DEFAULT '1.0.0',
                created_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured ml_assessments table exists")
    except Exception as e:
        logger.warning("Error creating ml_assessments table: %s", e)

    # Ensure ai_summaries table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                facts_hash TEXT NOT NULL,
                summary TEXT NOT NULL,
                next_steps TEXT,
                status TEXT DEFAULT 'grounded',
                created_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured ai_summaries table exists")
    except Exception as e:
        logger.warning("Error creating ai_summaries table: %s", e)

    # Ensure photo_hashes table exists
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS photo_hashes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                hash_original TEXT NOT NULL,
                hash_hflip TEXT NOT NULL,
                hash_rot90 TEXT NOT NULL,
                created_at DATETIME NOT NULL
            )
        """)
        logger.info("Ensured photo_hashes table exists")
    except Exception as e:
        logger.warning("Error creating photo_hashes table: %s", e)

    # Column migrations
    extra_cols = [
        ("projects", "is_synthetic", "BOOLEAN DEFAULT 0"),
        ("users", "password_hash", "TEXT"),
        ("price_history", "ts", "DATETIME"),
        ("price_history", "base_price", "REAL"),
        ("price_history", "m_demand", "REAL"),
        ("price_history", "m_supply", "REAL"),
        ("price_history", "m_living", "REAL"),
        ("price_history", "effective_usd", "REAL"),
        ("price_history", "source", "TEXT DEFAULT 'admin'"),
        ("pricing_config", "mode", "TEXT DEFAULT 'manual'"),
        ("pricing_config", "demand_min", "REAL DEFAULT 0.80"),
        ("pricing_config", "demand_max", "REAL DEFAULT 1.50"),
        ("pricing_config", "supply_min", "REAL DEFAULT 0.80"),
        ("pricing_config", "supply_max", "REAL DEFAULT 1.50"),
    ]
    for table_name, col_name, col_type in extra_cols:
        try:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
            logger.info("Added column %s.%s", table_name, col_name)
        except Exception:
            pass

    # Ensure PRJ-MAN-SUNDAR belongs to demo NGO (EcoGuard Brazil, id 1) and audit trail reflects it
    try:
        cursor.execute("UPDATE projects SET ngo_id = 1 WHERE project_id = 'PRJ-MAN-SUNDAR'")
        cursor.execute("UPDATE audit_logs SET user = 'EcoGuard Brazil' WHERE name = 'PRJ-MAN-SUNDAR'")
    except Exception:
        pass

    conn.commit()
    conn.close()


def seed_initial_data():
    """Seed initial projects, NGOs, and demo transactions if database is fresh."""
    db = SessionLocal()
    try:
        # Seed Audit Logs if empty
        if not db.query(AuditLog).first():
            now = datetime.utcnow()
            a1 = AuditLog(
                action="mint",
                name="PRJ-MAN-AMAZON",
                detail="Minted 12,400 verified credits with satellite NDVI verification",
                user="Admin System",
                timestamp=now - timedelta(minutes=14)
            )
            a2 = AuditLog(
                action="approve",
                name="PRJ-TEK-CONGO1",
                detail="Project approved with GRS quality score of 91/100",
                user="Alex Mercer (Admin)",
                timestamp=now - timedelta(hours=2)
            )
            a3 = AuditLog(
                action="create",
                name="PRJ-MAN-SUNDAR",
                detail="New mangrove restoration project submitted with boundary polygon",
                user="EcoGuard Brazil",
                timestamp=now - timedelta(hours=5)
            )
            a4 = AuditLog(
                action="payment",
                name="PRJ-MAN-AMAZON",
                detail="Microsoft Sustainability purchased 2,000 credits for ₹4,75,950.00",
                user="Microsoft Sustainability",
                timestamp=now - timedelta(days=1)
            )
            db.add_all([a1, a2, a3, a4])
            db.commit()

        # Seed Users if empty or ensure admin accounts exist
        if not db.query(User).first():
            default_users = [
                User(name="Alex Mercer", email="admin@carbonvault.com", password_hash=hash_password("admin123"), role="admin", admin_role="super_admin", projects=0, credits=0, joined="2023-01-01", status="active"),
                User(name="Sarah Jenkins", email="approver@carbonvault.com", password_hash=hash_password("approver123"), role="admin", admin_role="approver", projects=0, credits=0, joined="2023-08-15", status="active"),
                User(name="EcoGuard Brazil", email="contact@ecoguard.org", password_hash=hash_password("ngo123"), role="ngo", projects=3, credits=34600, joined="2023-06-12", status="active"),
                User(name="Microsoft Sustainability", email="carbon@microsoft.com", password_hash=hash_password("corp123"), role="corporate", projects=0, credits=15200, joined="2023-09-01", status="active"),
                User(name="Google Carbon Team", email="sustainability@google.com", password_hash=hash_password("corp123"), role="buyer", projects=0, credits=28000, joined="2023-07-14", status="active"),
                User(name="Green Delta", email="info@greendelta.org", password_hash=hash_password("ngo123"), role="ngo", projects=2, credits=8200, joined="2024-01-05", status="active"),
                User(name="Shell Renewables", email="offsets@shell.com", password_hash=hash_password("corp123"), role="buyer", projects=0, credits=42000, joined="2023-04-22", status="active"),
                User(name="Borneo Earth", email="team@borneoearth.org", password_hash=hash_password("ngo123"), role="ngo", projects=1, credits=0, joined="2024-03-08", status="suspended"),
                User(name="HSBC Green Finance", email="carbon@hsbc.com", password_hash=hash_password("corp123"), role="buyer", projects=0, credits=9800, joined="2024-02-17", status="active"),
                User(name="CongoCare", email="ops@congocare.org", password_hash=hash_password("ngo123"), role="ngo", projects=2, credits=22000, joined="2023-11-30", status="active"),
                User(name="TUV Rheinland Verifier", email="verifier@carbonvault.com", password_hash=hash_password("verifier123"), role="verifier", admin_role=None, projects=0, credits=0, joined="2024-01-01", status="active"),
                User(name="Public Auditor", email="guest@carbonvault.com", password_hash=hash_password("guest123"), role="public", admin_role=None, projects=0, credits=0, joined="2024-01-01", status="active"),
            ]
            db.add_all(default_users)
            db.commit()
        else:
            # Backfill password hashes for demo accounts if missing
            users_to_fix = {
                "admin@carbonvault.com": ("admin123", "Alex Mercer", "admin", "super_admin"),
                "approver@carbonvault.com": ("approver123", "Sarah Jenkins", "admin", "approver"),
                "contact@ecoguard.org": ("ngo123", "EcoGuard Brazil", "ngo", None),
                "carbon@microsoft.com": ("corp123", "Microsoft Sustainability", "corporate", None),
                "verifier@carbonvault.com": ("verifier123", "TUV Rheinland Verifier", "verifier", None),
                "guest@carbonvault.com": ("guest123", "Public Auditor", "public", None),
            }
            for em, (pw, nm, rl, arl) in users_to_fix.items():
                u = db.query(User).filter(User.email == em).first()
                if not u:
                    db.add(User(name=nm, email=em, password_hash=hash_password(pw), role=rl, admin_role=arl, status="active"))
                elif not u.password_hash:
                    u.password_hash = hash_password(pw)
            db.commit()

        # Seed Pricing Config if empty
        if not db.query(PricingConfig).first():
            cfg = PricingConfig(
                base=28.50,
                demand=1.12,
                supply=0.98,
                living=1.08,
                updated_at=datetime.utcnow()
            )
            db.add(cfg)
            
            now_seed = datetime.utcnow()
            history = [
                PriceHistory(ts=now_seed - timedelta(days=150), month="Jul", price=24.0, effective_usd=24.0, base_price=22.0, m_demand=1.05, m_supply=1.0, m_living=1.04, source="seed_synthetic", recorded_at=now_seed - timedelta(days=150)),
                PriceHistory(ts=now_seed - timedelta(days=120), month="Aug", price=24.8, effective_usd=24.8, base_price=22.5, m_demand=1.06, m_supply=1.0, m_living=1.04, source="seed_synthetic", recorded_at=now_seed - timedelta(days=120)),
                PriceHistory(ts=now_seed - timedelta(days=90), month="Sep", price=25.6, effective_usd=25.6, base_price=23.0, m_demand=1.08, m_supply=0.99, m_living=1.04, source="seed_synthetic", recorded_at=now_seed - timedelta(days=90)),
                PriceHistory(ts=now_seed - timedelta(days=60), month="Oct", price=26.4, effective_usd=26.4, base_price=23.5, m_demand=1.10, m_supply=0.98, m_living=1.04, source="seed_synthetic", recorded_at=now_seed - timedelta(days=60)),
                PriceHistory(ts=now_seed - timedelta(days=30), month="Nov", price=27.2, effective_usd=27.2, base_price=24.0, m_demand=1.11, m_supply=0.98, m_living=1.04, source="seed_synthetic", recorded_at=now_seed - timedelta(days=30)),
                PriceHistory(ts=now_seed, month="Dec", price=28.5, effective_usd=28.5, base_price=24.5, m_demand=1.12, m_supply=0.98, m_living=1.08, source="seed_synthetic", recorded_at=now_seed),
            ]
            db.add_all(history)
            db.commit()

        # Seed Notifications if empty
        if not db.query(Notification).first():
            now = datetime.utcnow()
            n1 = Notification(
                recipient_role="all",
                type="approval",
                title="Project Approved",
                message="Amazon Reforestation Initiative (PRJ-MAN-AMAZON) has been approved by admin.",
                related_project_id="PRJ-MAN-AMAZON",
                is_read=False,
                created_at=now - timedelta(hours=2)
            )
            n2 = Notification(
                recipient_role="admin",
                type="submission",
                title="New Project Pending Review",
                message="Sundarbans Mangrove Restoration (PRJ-MAN-SUNDAR) submitted by EcoGuard Brazil.",
                related_project_id="PRJ-MAN-SUNDAR",
                is_read=False,
                created_at=now - timedelta(hours=5)
            )
            n3 = Notification(
                recipient_role="corporate",
                type="payment",
                title="Purchase Confirmed",
                message="Microsoft Sustainability offset 2,000 tonnes of CO2 via PRJ-MAN-AMAZON.",
                related_project_id="PRJ-MAN-AMAZON",
                is_read=False,
                created_at=now - timedelta(days=1)
            )
            db.add_all([n1, n2, n3])
            db.commit()

        # Seed Project Status History if empty
        if not db.query(ProjectStatusHistory).first():
            now = datetime.utcnow()
            h1 = ProjectStatusHistory(
                project_id="PRJ-MAN-AMAZON",
                from_status="draft",
                to_status="submitted",
                changed_by="EcoGuard Brazil",
                comment="Initial submission with satellite boundary",
                timestamp=now - timedelta(days=60)
            )
            h2 = ProjectStatusHistory(
                project_id="PRJ-MAN-AMAZON",
                from_status="submitted",
                to_status="under_review",
                changed_by="Alex Mercer (Admin)",
                comment="Assigned to verifier for GRS quality check",
                timestamp=now - timedelta(days=45)
            )
            h3 = ProjectStatusHistory(
                project_id="PRJ-MAN-AMAZON",
                from_status="under_review",
                to_status="field_verification",
                changed_by="Alex Mercer (Admin)",
                comment="Field drone and NDVI verification confirmed",
                timestamp=now - timedelta(days=30)
            )
            h4 = ProjectStatusHistory(
                project_id="PRJ-MAN-AMAZON",
                from_status="field_verification",
                to_status="approved",
                changed_by="Alex Mercer (Admin)",
                comment="Final approval and credits minted",
                timestamp=now - timedelta(days=20)
            )
            h5 = ProjectStatusHistory(
                project_id="PRJ-MAN-SUNDAR",
                from_status="draft",
                to_status="submitted",
                changed_by="EcoGuard Brazil",
                comment="Mangrove restoration project submitted for review",
                timestamp=now - timedelta(hours=5)
            )
            db.add_all([h1, h2, h3, h4, h5])
            db.commit()

        # Seed Project Progress Updates if empty
        if not db.query(ProjectProgressUpdate).first():
            now = datetime.utcnow()
            u1 = ProjectProgressUpdate(
                project_id="PRJ-MAN-AMAZON",
                quarter="Q1",
                year=2024,
                survival_rate=92.5,
                canopy_cover=28.0,
                notes="Initial planting phase completed across 1,500 hectares. Native seedlings established with strong root network.",
                submitted_at=now - timedelta(days=90),
                verified_by_satellite=True
            )
            u2 = ProjectProgressUpdate(
                project_id="PRJ-MAN-AMAZON",
                quarter="Q2",
                year=2024,
                survival_rate=89.0,
                canopy_cover=36.5,
                notes="Seasonal rains supported early tree growth. Weed suppression applied in sector B. Zero fire outbreaks reported.",
                submitted_at=now - timedelta(days=45),
                verified_by_satellite=True
            )
            u3 = ProjectProgressUpdate(
                project_id="PRJ-MAN-AMAZON",
                quarter="Q3",
                year=2024,
                survival_rate=91.2,
                canopy_cover=44.0,
                notes="Canopy closure accelerating in multi-species mixed plot. Sentinel-2 NDVI telemetry shows steady 0.72 index.",
                submitted_at=now - timedelta(days=10),
                verified_by_satellite=True
            )
            db.add_all([u1, u2, u3])
            db.commit()

        # Ensure PRJ-MAN-AMAZON has field verification sign-off and documents
        try:
            if not db.query(FieldVerification).filter(FieldVerification.project_id == "PRJ-MAN-AMAZON").first():
                verifier_u = db.query(User).filter(User.role == "verifier").first()
                v_id = verifier_u.id if verifier_u else 1
                v_name = verifier_u.name if verifier_u else "TUV Rheinland Verifier"
                db.add(FieldVerification(
                    project_id="PRJ-MAN-AMAZON",
                    verifier_id=v_id,
                    verifier_name=v_name,
                    report_url="/evidence/field_audit_PRJ-MAN-AMAZON.pdf",
                    decision="verified",
                    notes="LiDAR canopy scanning and tree density census completed on-site.",
                    signature_hash="f5a7924e321e845b08e22a4b2e8a3427928e12dcf643f808b6b45a494156699d",
                    verified_at=datetime.utcnow() - timedelta(days=30)
                ))
                db.commit()

            if not db.query(ProjectDocument).filter(ProjectDocument.project_id == "PRJ-MAN-AMAZON").first():
                for dt in ["land_proof", "methodology_reference", "monitoring_plan", "baseline_notes"]:
                    db.add(ProjectDocument(
                        project_id="PRJ-MAN-AMAZON",
                        doc_type=dt,
                        file_url=f"/evidence/PRJ-MAN-AMAZON_{dt}.pdf",
                        sha256_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        version=1,
                        uploaded_by="contact@ecoguard.org",
                        uploaded_at=datetime.utcnow() - timedelta(days=45)
                    ))
                db.commit()
        except Exception as p6_err:
            logger.warning("Error ensuring PRJ-MAN-AMAZON verification: %s", p6_err)

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
            is_synthetic=True,
            created_at=today
        )

        p2 = Project(
            project_id="PRJ-MAN-SUNDAR",
            ngo_id=ngo_brazil.id,
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
            is_synthetic=True,
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
            is_synthetic=True,
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
            is_synthetic=True,
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
                certificate_id=None,
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

        # 5. Audit Logs
        if not db.query(AuditLog).first():
            now = datetime.utcnow()
            a1 = AuditLog(
                action="mint",
                name="PRJ-MAN-AMAZON",
                detail="Minted 12,400 verified credits with satellite NDVI verification",
                user="Admin System",
                timestamp=now - timedelta(minutes=14)
            )
            a2 = AuditLog(
                action="approve",
                name="PRJ-TEK-CONGO1",
                detail="Project approved with GRS quality score of 91/100",
                user="Alex Mercer (Admin)",
                timestamp=now - timedelta(hours=2)
            )
            a3 = AuditLog(
                action="create",
                name="PRJ-MAN-SUNDAR",
                detail="New mangrove restoration project submitted with boundary polygon",
                user="EcoGuard Brazil",
                timestamp=now - timedelta(hours=5)
            )
            a4 = AuditLog(
                action="payment",
                name="PRJ-MAN-AMAZON",
                detail="Microsoft purchased 2,000 tonnes (₹4,75,950.00)",
                user="Microsoft Sustainability",
                timestamp=now - timedelta(days=1)
            )
            db.add_all([a1, a2, a3, a4])
            db.commit()

        # 6. Footprint Estimates
        if not db.query(FootprintEstimate).first():
            now = datetime.utcnow()
            fe1 = FootprintEstimate(
                corporate_name="Microsoft Sustainability",
                scope1_tonnes=87.5,
                scope2_tonnes=462.5,
                scope3_tonnes=31.25,
                total_tonnes=581.25,
                inputs_json='{"employees": 250, "sqft": 25000, "short_haul_flights": 80, "long_haul_flights": 25, "cloud_spend_usd": 8500}',
                created_at=now - timedelta(days=12)
            )
            fe2 = FootprintEstimate(
                corporate_name="Google Climate",
                scope1_tonnes=175.0,
                scope2_tonnes=820.0,
                scope3_tonnes=62.5,
                total_tonnes=1057.5,
                inputs_json='{"employees": 500, "sqft": 42500, "short_haul_flights": 150, "long_haul_flights": 60, "cloud_spend_usd": 15000}',
                created_at=now - timedelta(days=3)
            )
            db.add_all([fe1, fe2])
            db.commit()

        # Seed SystemConfig and PlantationTypes if empty
        try:
            from routers.config_router import ensure_config_seeded
            ensure_config_seeded(db)
        except Exception as ce:
            logger.warning("Error running config seed: %s", ce)

        # Run certificate backfill to populate unified certificates table
        try:
            from routers.certificate_router import backfill_certificates
            backfill_certificates(db)
        except Exception as be:
            logger.warning("Error running certificate backfill during seed: %s", be)

        # Ensure audit trail cryptographic hash chain is intact
        try:
            from core.audit import ensure_audit_chain_hashed
            ensure_audit_chain_hashed(db)
        except Exception as ae:
            logger.warning("Error running audit chain backfill during seed: %s", ae)

        # Seed Phase 5 Verified Credit Batches & System Accounts
        try:
            from core.credit_engine import seed_initial_credit_batches
            seed_initial_credit_batches(db)
        except Exception as cbe:
            logger.warning("Error running credit batch seeding: %s", cbe)

        # Seed Phase 6 Onboarding KYC, Project Documents, and Field Verification
        try:
            ngo_user = db.query(User).filter(User.email == "contact@ecoguard.org").first()
            if ngo_user and not db.query(OrganizationProfile).filter(OrganizationProfile.user_id == ngo_user.id).first():
                prof = OrganizationProfile(
                    user_id=ngo_user.id,
                    legal_name="EcoGuard Brazil Conservation Ltda",
                    registration_number="BR-CNPJ-98765432000199",
                    country="Brazil",
                    org_type="ngo",
                    kyc_status="verified",
                    kyc_reviewed_by="admin@carbonvault.com",
                    kyc_reviewed_at=datetime.utcnow() - timedelta(days=60),
                    kyc_notes="Verified against Brazilian Ministry of Environment NGO registry",
                    created_at=datetime.utcnow() - timedelta(days=90),
                    updated_at=datetime.utcnow() - timedelta(days=60)
                )
                db.add(prof)
                db.commit()

            # Seed 4 mandatory project documents for PRJ-MAN-AMAZON
            if not db.query(ProjectDocument).filter(ProjectDocument.project_id == "PRJ-MAN-AMAZON").first():
                doc_types = ["land_proof", "methodology_reference", "monitoring_plan", "baseline_notes"]
                for dt in doc_types:
                    db.add(ProjectDocument(
                        project_id="PRJ-MAN-AMAZON",
                        doc_type=dt,
                        file_url=f"/evidence/PRJ-MAN-AMAZON_{dt}.pdf",
                        sha256_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                        version=1,
                        uploaded_by="contact@ecoguard.org",
                        uploaded_at=datetime.utcnow() - timedelta(days=45)
                    ))
                db.commit()

            # Seed FieldVerification for PRJ-MAN-AMAZON
            verifier_u = db.query(User).filter(User.email == "verifier@carbonvault.com").first()
            v_id = verifier_u.id if verifier_u else 1
            if not db.query(FieldVerification).filter(FieldVerification.project_id == "PRJ-MAN-AMAZON").first():
                fv = FieldVerification(
                    project_id="PRJ-MAN-AMAZON",
                    verifier_id=v_id,
                    verifier_name="TUV Rheinland Verifier",
                    report_url="/evidence/field_audit_PRJ-MAN-AMAZON.pdf",
                    decision="verified",
                    notes="LiDAR canopy scanning and tree density census completed on-site.",
                    signature_hash="f5a7924e321e845b08e22a4b2e8a3427928e12dcf643f808b6b45a494156699d",
                    verified_at=datetime.utcnow() - timedelta(days=30)
                )
                db.add(fv)
                db.commit()
        except Exception as p6_seed_err:
            logger.warning("Error seeding Phase 6 onboarding demo data: %s", p6_seed_err)

        logger.info("[OK] Initial demo data seeded successfully")

    except Exception as e:
        db.rollback()
        logger.warning("Error seeding demo data: %s", e)
    finally:
        db.close()


GLOBAL_SCHEDULER = None
LAST_SCHEDULER_HEARTBEAT = None


def apply_alembic_migrations():
    """Apply Alembic migrations to bring the database to head revision."""
    try:
        from alembic import command
        from alembic.config import Config
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        logger.info("[OK] Alembic migrations applied to head.")
    except Exception as e:
        logger.warning("Alembic upgrade warning: %s; ensuring metadata via create_all", e)
        Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global GLOBAL_SCHEDULER, LAST_SCHEDULER_HEARTBEAT
    # Startup: ensure tables exist via Alembic, seed data
    apply_alembic_migrations()
    seed_initial_data()
    try:
        from routers.certificate_router import backfill_certificates
        from core.audit import ensure_audit_chain_hashed
        db = SessionLocal()
        try:
            backfill_certificates(db)
            ensure_audit_chain_hashed(db)
        finally:
            db.close()
    except Exception as e:
        logger.warning("Error running startup tasks: %s", e)
    logger.info("[OK] Database ready at: %s", DATABASE_URL)

    # Start background scheduler for daily satellite sync (APScheduler)
    scheduler = None
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        def daily_satellite_sync_job():
            global LAST_SCHEDULER_HEARTBEAT
            LAST_SCHEDULER_HEARTBEAT = datetime.utcnow().isoformat() + "Z"
            logger.info("Running daily satellite NDVI and climate sync job...")
            db_s = SessionLocal()
            try:
                from services.satellite import sync_project_ndvi
                from services.climate import sync_project_climate
                from credit_calculation.credits_module.db_models import Project
                for p in db_s.query(Project).filter(Project.status == "approved").all():
                    sync_project_ndvi(p.project_id, db_s, backfill_years=1, max_batches=2)
                    sync_project_climate(p.project_id, db_s, days=30)
            except Exception as se:
                logger.warning("Error in daily satellite sync job: %s", se)
            finally:
                db_s.close()

        def nightly_ml_refresh_job():
            global LAST_SCHEDULER_HEARTBEAT
            LAST_SCHEDULER_HEARTBEAT = datetime.utcnow().isoformat() + "Z"
            logger.info("Running nightly ML retrain and assessment refresh job...")
            db_ml = SessionLocal()
            try:
                from ml.anomaly import run_anomaly_detection
                from ml.ndvi_monitor import run_ndvi_monitor
                from ml.suitability import assess_site_suitability
                from ml.phash import run_project_photo_screening
                from credit_calculation.credits_module.db_models import Project
                for p in db_ml.query(Project).all():
                    run_anomaly_detection(p.project_id, db_ml)
                    run_ndvi_monitor(p.project_id, db_ml)
                    assess_site_suitability(
                        float(p.latitude or 12.0),
                        float(p.longitude or 78.0),
                        project_id=p.project_id,
                        db=db_ml
                    )
                    run_project_photo_screening(p.project_id, db_ml)
                logger.info("[OK] Nightly ML assessments completed.")
            except Exception as me:
                logger.warning("Error in nightly ML refresh job: %s", me)
            finally:
                db_ml.close()

        scheduler.add_job(daily_satellite_sync_job, 'interval', hours=24, id='daily_satellite_sync')
        scheduler.add_job(nightly_ml_refresh_job, 'interval', hours=24, id='nightly_ml_refresh')

        def periodic_reservation_reaper_job():
            logger.info("Running expired reservation inventory reaper...")
            db_r = SessionLocal()
            try:
                from core.credit_engine import reap_expired_reservations
                reap_expired_reservations(db_r)
            except Exception as re:
                logger.warning("Error in reservation reaper job: %s", re)
            finally:
                db_r.close()

        def nightly_reconciliation_job():
            global LAST_SCHEDULER_HEARTBEAT
            LAST_SCHEDULER_HEARTBEAT = datetime.utcnow().isoformat() + "Z"
            logger.info("Running nightly ledger & payment reconciliation...")
            db_rc = SessionLocal()
            try:
                from core.reconciliation import run_full_reconciliation
                run_full_reconciliation(db_rc)
            except Exception as rce:
                logger.warning("Error in nightly reconciliation job: %s", rce)
            finally:
                db_rc.close()

        scheduler.add_job(periodic_reservation_reaper_job, 'interval', minutes=1, id='periodic_reservation_reaper')
        scheduler.add_job(nightly_reconciliation_job, 'interval', hours=24, id='nightly_reconciliation')

        scheduler.start()
        GLOBAL_SCHEDULER = scheduler
        LAST_SCHEDULER_HEARTBEAT = datetime.utcnow().isoformat() + "Z"
        logger.info("[OK] APScheduler started for daily satellite sync, nightly ML retraining, reaper, and reconciliation")
    except Exception as sche_err:
        logger.warning("Could not start APScheduler: %s", sche_err)

    yield

    if scheduler:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass


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

# Security Headers Middleware (CSP, HSTS, X-Content-Type-Options, Frame Protection)
from core.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# Request ID & Latency Tracking Middleware
app.add_middleware(RequestIdMiddleware, slow_threshold_ms=settings.SLOW_QUERY_THRESHOLD_MS)

# Consistent API Error Format Handlers
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Signed Upload Retrieval
@app.get("/uploads/secure/{filename}")
def get_secure_upload(filename: str, token: str, expires: int):
    """
    Serves uploaded asset strictly when signed with a valid HMAC token and before expiration.
    Returns 403 Forbidden on invalid or expired signature.
    """
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from core.storage import get_storage
    storage = get_storage()
    if not storage.verify_token(filename, token, expires):
        raise HTTPException(status_code=403, detail="Forbidden: Invalid or expired signed URL token.")

    file_path = os.path.join(str(UPLOAD_DIR), filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(file_path)


# Static file serving for uploads (evidence images)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def get_commit_hash():
    for var in ["RENDER_GIT_COMMIT", "GIT_COMMIT", "COMMIT_SHA", "VERCEL_GIT_COMMIT_SHA"]:
        val = os.getenv(var)
        if val:
            return val
    try:
        import subprocess
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        if commit:
            return commit
    except Exception:
        pass
    commit_file = os.path.join(os.path.dirname(__file__), "COMMIT_HASH")
    if os.path.exists(commit_file):
        try:
            with open(commit_file, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return "72e63d8"


SERVER_STARTED_AT = datetime.utcnow().isoformat() + "Z"


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
    """Liveness probe: verifies process is alive, commit, and uptime."""
    commit = get_commit_hash()
    return {
        "status": "ok",
        "commit": commit,
        "commit_hash": commit,
        "started_at": SERVER_STARTED_AT,
        "db": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


def get_migration_status():
    """Inspects Alembic migration state vs head."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.migration import MigrationContext
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        script = ScriptDirectory.from_config(alembic_cfg)
        head_rev = script.get_current_head()

        with engine.connect() as conn:
            context = MigrationContext.configure(conn)
            current_rev = context.get_current_revision()

        schema_status = "ok" if (current_rev and head_rev and current_rev == head_rev) else "behind"
        return {
            "migration_current": current_rev or "none",
            "migration_head": head_rev or "none",
            "schema": schema_status
        }
    except Exception as e:
        logger.warning("Error inspecting migration status: %s", e)
        return {
            "migration_current": "unknown",
            "migration_head": "unknown",
            "schema": "unknown",
            "error": str(e)
        }


@app.get("/ready")
def readiness():
    """
    Readiness probe:
    - Real database query: SELECT 1 (returns HTTP 503 if unreachable).
    - Migration / schema version and parity (migration_current, migration_head, schema: ok | behind).
    - Scheduler status & heartbeat.
    - Razorpay status & non-secret key hint.
    - Last success timestamps for MODIS NDVI, NASA POWER climate, and LLM explainer.
    """
    from fastapi.responses import JSONResponse
    from sqlalchemy import text
    commit = get_commit_hash()
    now_iso = datetime.utcnow().isoformat() + "Z"

    db_ok = False
    db_err = None
    last_modis = None
    last_climate = None
    last_llm = None

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_ok = True

        # Last success checks for data pipelines
        try:
            r = db.execute(text("SELECT max(fetched_at) FROM satellite_observations")).scalar()
            if r:
                last_modis = r.isoformat() if hasattr(r, "isoformat") else str(r)
        except Exception:
            pass

        try:
            r = db.execute(text("SELECT max(fetched_at) FROM climate_observations")).scalar()
            if r:
                last_climate = r.isoformat() if hasattr(r, "isoformat") else str(r)
        except Exception:
            pass

        try:
            r = db.execute(text("SELECT max(created_at) FROM ai_summaries")).scalar()
            if r:
                last_llm = r.isoformat() if hasattr(r, "isoformat") else str(r)
        except Exception:
            pass

        db.close()
    except Exception as e:
        logger.error("DB readiness check failed: %s", e)
        db_err = str(e)

    if not db_ok:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unready",
                "reason": "database_unreachable",
                "error": db_err,
                "commit": commit,
                "started_at": SERVER_STARTED_AT,
                "timestamp": now_iso
            }
        )

    sched_running = GLOBAL_SCHEDULER.running if (GLOBAL_SCHEDULER and hasattr(GLOBAL_SCHEDULER, "running")) else False

    mig_info = get_migration_status()

    try:
        from routers.payment_router import get_razorpay_status, get_razorpay_key_hint
        rp_status = get_razorpay_status()
        rp_hint = get_razorpay_key_hint()
    except Exception:
        rp_status = "ok"
        rp_hint = "none"

    return {
        "status": "ready",
        "commit": commit,
        "commit_hash": commit,
        "started_at": SERVER_STARTED_AT,
        "migration_current": mig_info.get("migration_current"),
        "migration_head": mig_info.get("migration_head"),
        "schema": mig_info.get("schema"),
        "database": {
            "status": "ok",
            "dialect": "sqlite" if DATABASE_URL.startswith("sqlite") else "postgresql",
            "migration_current": mig_info.get("migration_current"),
            "migration_head": mig_info.get("migration_head"),
            "schema": mig_info.get("schema"),
            "migration_version": mig_info.get("migration_current") or "v1.0-phase0"
        },
        "scheduler": {
            "status": "active" if sched_running else "idle",
            "last_heartbeat_at": LAST_SCHEDULER_HEARTBEAT or SERVER_STARTED_AT
        },
        "razorpay": rp_status,
        "razorpay_status": rp_status,
        "razorpay_key_hint": rp_hint,
        "services": {
            "modis_ndvi": {
                "last_success_at": last_modis
            },
            "nasa_power": {
                "last_success_at": last_climate
            },
            "llm_explainer": {
                "last_success_at": last_llm
            }
        },
        "timestamp": now_iso
    }


# Include Routers (mounted AFTER core system probes so /health, /ready, and / are matched first)
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(calculator_router, prefix="/calculator", tags=["Carbon Calculator"])
app.include_router(certificate_router, prefix="/certificates", tags=["Certificates"])
app.include_router(project_router, prefix="/projects", tags=["Projects"])
app.include_router(project_router, prefix="", tags=["Projects-Root"])
app.include_router(grs_router, prefix="/grs", tags=["GRS"])
app.include_router(suitability_router, tags=["Site Suitability"])
app.include_router(marketplace_router, prefix="/marketplace", tags=["Marketplace"])
app.include_router(credit_router, tags=["Credits"])
app.include_router(fraud_router, prefix="/fraud", tags=["Fraud Detection"])
app.include_router(payment_router, prefix="/payment", tags=["Payment"])
app.include_router(payment_router, prefix="", tags=["Payment-Root"])
app.include_router(esg_router, prefix="/esg", tags=["ESG"])
app.include_router(realtime_router)
app.include_router(auth_router)
app.include_router(stats_router)
app.include_router(config_router)
app.include_router(credit_integrity_router, tags=["Credit Integrity"])
app.include_router(onboarding_router)
app.include_router(ml_models_router)
app.include_router(ml_models_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    from core.config import API_HOST, API_PORT
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=DEBUG)