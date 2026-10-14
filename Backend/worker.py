"""
CarbonVault Phase 3: Standalone Background Worker & Scheduled Tasks CLI.
Can be executed as a Render Cron Job, Kubernetes CronJob, or standalone background daemon.
Usage:
    python worker.py --job satellite-sync
    python worker.py --job ml-refresh
    python worker.py --job price-snapshot
    python worker.py --job all
    python worker.py --daemon
"""

import sys
import os
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path

# Ensure Backend is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from core.logging_middleware import setup_structured_logging
from core.config import settings
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project, PricingConfig, PriceHistory

setup_structured_logging(debug=settings.DEBUG, sentry_dsn=settings.SENTRY_DSN)
logger = logging.getLogger("carbonvault.worker")


def run_satellite_sync():
    """Sync real MODIS NDVI observations and NASA POWER agroclimate data for approved projects."""
    logger.info("Starting scheduled satellite and climate observation sync...")
    db = SessionLocal()
    try:
        from services.satellite import sync_project_ndvi
        from services.climate import sync_project_climate

        approved = db.query(Project).filter(Project.status == "approved").all()
        logger.info(f"Found {len(approved)} approved projects to sync.")
        for p in approved:
            try:
                sync_project_ndvi(p.project_id, db, backfill_years=1, max_batches=2)
                sync_project_climate(p.project_id, db, days=30)
                logger.info(f"Synced project {p.project_id}")
            except Exception as e:
                logger.warning(f"Error syncing satellite data for {p.project_id}: {e}")
        logger.info("[OK] Satellite sync completed successfully.")
    finally:
        db.close()


def run_ml_refresh():
    """Run nightly ML assessment pipeline (M1-M5) for all projects."""
    logger.info("Starting scheduled ML retraining and assessment refresh...")
    db = SessionLocal()
    try:
        from ml.anomaly import run_anomaly_detection
        from ml.ndvi_monitor import run_ndvi_monitor
        from ml.suitability import assess_site_suitability
        from ml.phash import run_project_photo_screening

        projects = db.query(Project).all()
        logger.info(f"Processing ML models for {len(projects)} projects.")
        for p in projects:
            try:
                run_anomaly_detection(p.project_id, db)
                run_ndvi_monitor(p.project_id, db)
                assess_site_suitability(
                    float(p.latitude or 12.0),
                    float(p.longitude or 78.0),
                    project_id=p.project_id,
                    db=db,
                )
                run_project_photo_screening(p.project_id, db)
            except Exception as e:
                logger.warning(f"Error evaluating ML models for {p.project_id}: {e}")
        logger.info("[OK] ML refresh completed successfully.")
    finally:
        db.close()


def run_price_snapshot():
    """Record current automated dynamic pricing snapshot into PriceHistory."""
    logger.info("Taking dynamic carbon credit price snapshot...")
    db = SessionLocal()
    try:
        cfg = db.query(PricingConfig).first()
        if not cfg:
            cfg = PricingConfig(base=28.50, demand=1.12, supply=0.98, living=1.08, mode="auto")
            db.add(cfg)
            db.commit()

        effective = round(float(cfg.base) * float(cfg.demand) * float(cfg.supply) * float(cfg.living), 2)
        snapshot = PriceHistory(
            ts=datetime.utcnow(),
            base_price=float(cfg.base),
            m_demand=float(cfg.demand),
            m_supply=float(cfg.supply),
            m_living=float(cfg.living),
            effective_usd=effective,
            source="worker_snapshot",
            month=datetime.utcnow().strftime("%b %Y"),
            price=effective,
            recorded_at=datetime.utcnow()
        )
        db.add(snapshot)
        db.commit()
        logger.info(f"[OK] Stored price snapshot: effective=${effective:.2f} USD")
    finally:
        db.close()


def run_reconciliation():
    """Run nightly reconciliation audit for credit batches, accounts, and payments."""
    logger.info("Starting scheduled ledger and payment reconciliation audit...")
    db = SessionLocal()
    try:
        from core.reconciliation import run_full_reconciliation
        report = run_full_reconciliation(db)
        if report.get("status") == "clean":
            logger.info("[OK] Nightly reconciliation PASSED. Ledger is consistent.")
        else:
            logger.critical("[ALERT] Nightly reconciliation detected anomalies: %s", report.get("discrepancies"))
    finally:
        db.close()


def run_reap_reservations():
    """Reap expired order inventory reservations and return them to the available pool."""
    logger.info("Starting expired inventory reservation reaper...")
    db = SessionLocal()
    try:
        from core.credit_engine import reap_expired_reservations
        reaped = reap_expired_reservations(db)
        logger.info(f"[OK] Reaped {reaped} expired reservations.")
    finally:
        db.close()


def run_all_jobs():
    logger.info("Running all scheduled batch worker jobs...")
    run_satellite_sync()
    run_ml_refresh()
    run_price_snapshot()
    run_reap_reservations()
    run_reconciliation()
    logger.info("[OK] All scheduled worker jobs finished.")


def run_daemon():
    """Run in continuous daemon mode using APScheduler."""
    from apscheduler.schedulers.blocking import BlockingScheduler
    logger.info("Starting standalone worker daemon...")
    scheduler = BlockingScheduler()

    # Schedule jobs
    scheduler.add_job(run_satellite_sync, 'interval', hours=24, id='satellite_sync')
    scheduler.add_job(run_ml_refresh, 'interval', hours=12, id='ml_refresh')
    scheduler.add_job(run_price_snapshot, 'interval', hours=6, id='price_snapshot')
    scheduler.add_job(run_reap_reservations, 'interval', minutes=1, id='reap_reservations')
    scheduler.add_job(run_reconciliation, 'interval', hours=24, id='nightly_reconciliation')

    # Run immediate initial snapshot
    run_price_snapshot()
    run_reap_reservations()

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Worker daemon shutting down.")


def main():
    parser = argparse.ArgumentParser(description="CarbonVault Worker CLI")
    parser.add_argument(
        "--job",
        choices=["satellite-sync", "ml-refresh", "price-snapshot", "reconcile", "reap-reservations", "all"],
        help="Execute a specific batch job once and exit",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run continuously as a background scheduler daemon",
    )

    args = parser.parse_args()

    if args.daemon:
        run_daemon()
    elif args.job == "satellite-sync":
        run_satellite_sync()
    elif args.job == "ml-refresh":
        run_ml_refresh()
    elif args.job == "price-snapshot":
        run_price_snapshot()
    elif args.job == "reconcile":
        run_reconciliation()
    elif args.job == "reap-reservations":
        run_reap_reservations()
    elif args.job == "all":
        run_all_jobs()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
