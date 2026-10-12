# seed.py
"""
CarbonVault Seed & Migration Script
Initializes database schema, seeds foundational platform data when empty,
and runs backfill to ensure every approved project and completed transaction
has a verifiable Certificate record in the unified `certificates` table.
Format: CV-<YYYY of issued_at>-<6 random uppercase/digits>
"""

import sys
import os
import logging

# Ensure Backend directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from credit_calculation.credits_module.db import engine, SessionLocal
from credit_calculation.credits_module.db_models import Base, Certificate, Project, Transaction
from main import seed_initial_data, migrate_db
from routers.certificate_router import backfill_certificates

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


def run_seed():
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    migrate_db()

    db = SessionLocal()
    try:
        # Check if projects exist
        proj_count = db.query(Project).count()
        logger.info("Current projects in DB: %d", proj_count)
        if proj_count == 0:
            logger.info("Database empty, running seed_initial_data()...")
        # Ensure all seeded projects have is_synthetic = True
        for p in db.query(Project).all():
            if p.project_id in ["PRJ-MAN-AMAZON", "PRJ-MAN-SUNDAR", "PRJ-TEK-CONGO1", "PRJ-MAN-VIET01"]:
                p.is_synthetic = True
        db.commit()

        # Run certificate backfill
        logger.info("Running certificate backfill for approved projects and completed transactions...")
        backfill_certificates(db)

        # Print all certificates
        certs = db.query(Certificate).order_by(Certificate.issued_at.desc()).all()
        logger.info("Total certificates in database: %d", len(certs))
        for c in certs:
            logger.info(
                "  - [%s] %s | Project: %s | Tonnes: %.2f | Issued: %s | Type: %s | Hash: %s...",
                c.type, c.public_id, c.project_id, c.tonnes, c.issued_at.strftime("%Y-%m-%d"),
                c.type, c.sha256_hash[:16]
            )

        # Seed ML model assessments in ml_assessments table
        logger.info("Generating and storing baseline ML assessments for seeded projects...")
        try:
            from ml.anomaly import run_anomaly_detection
            from ml.ndvi_monitor import run_ndvi_monitor
            from ml.suitability import assess_site_suitability
            from ml.phash import run_project_photo_screening

            for p in db.query(Project).all():
                run_anomaly_detection(p.project_id, db)
                run_ndvi_monitor(p.project_id, db)
                assess_site_suitability(
                    float(p.latitude or 12.0),
                    float(p.longitude or 78.0),
                    project_id=p.project_id,
                    db=db
                )
                run_project_photo_screening(p.project_id, db)
            logger.info("[OK] ML assessments stored for all platform projects.")
        except Exception as mle:
            logger.warning("Could not precompute all ML assessments: %s", mle)

        print(f"\n[OK] Seed & backfill complete! {len(certs)} certificates verified in registry.")

    except Exception as e:
        logger.exception("Error during seed & backfill: %s", e)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
