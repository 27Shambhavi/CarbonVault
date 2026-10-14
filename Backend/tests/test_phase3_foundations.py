"""
CarbonVault Phase 3 Foundations Test Suite:
Validates core engineering foundations:
  - Typed settings module with production fail-fast invariants.
  - Alembic migrations and schema parity.
  - Request ID tracing and structured logging middleware.
  - Standard pagination and hard input limits.
  - Consistent error envelope format.
  - Background worker CLI task execution.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from main import app
from core.settings import Settings
from core.pagination import PaginationParams, paginate_query, MAX_PAGE_SIZE
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import Project
from worker import run_price_snapshot

client = TestClient(app)


def test_typed_settings_demo_mode_success():
    """Demo mode permits safe defaults with local SQLite."""
    demo_settings = Settings(APP_MODE="demo", DATABASE_URL="sqlite:///test.db")
    assert demo_settings.APP_MODE == "demo"
    assert "sqlite" in demo_settings.DATABASE_URL


def test_typed_settings_production_refusal_on_sqlite():
    """Production mode strictly forbids SQLite."""
    with pytest.raises(RuntimeError, match="Production settings validation failed"):
        Settings(
            APP_MODE="production",
            DATABASE_URL="sqlite:///test.db",
            JWT_SECRET="a" * 32,
            RAZORPAY_KEY_ID="rzp_live_test12345",
            RAZORPAY_KEY_SECRET="test_secret",
            PAYMENT_MODE="live",
            RAZORPAY_WEBHOOK_SECRET="test_wh"
        )


def test_typed_settings_production_refusal_on_weak_jwt():
    """Production mode strictly forbids weak or placeholder JWT secret."""
    with pytest.raises(RuntimeError, match="JWT_SECRET must be explicitly set"):
        Settings(
            APP_MODE="production",
            DATABASE_URL="postgresql://user:pass@localhost:5432/carbonvault",
            JWT_SECRET="short",
            RAZORPAY_KEY_ID="rzp_live_test12345",
            RAZORPAY_KEY_SECRET="test_secret",
            PAYMENT_MODE="live",
            RAZORPAY_WEBHOOK_SECRET="test_wh"
        )


def test_request_id_middleware_header_attachment():
    """Every request must be assigned an X-Request-ID header."""
    res = client.get("/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers["X-Request-ID"].startswith("req_")


def test_request_id_custom_preservation():
    """Client-supplied X-Request-ID should be propagated in response."""
    custom_id = "req_custom_trace_987654"
    res = client.get("/health", headers={"X-Request-ID": custom_id})
    assert res.status_code == 200
    assert res.headers.get("X-Request-ID") == custom_id


def test_pagination_params_input_limits():
    """Pagination must enforce maximum limits (max 100)."""
    p = PaginationParams.from_query(page=-5, size=9999)
    assert p.page == 1
    assert p.size == MAX_PAGE_SIZE

    db = SessionLocal()
    try:
        q = db.query(Project)
        paginated = paginate_query(q, page=1, size=10)
        assert "items" in paginated
        assert "total" in paginated
        assert "page" in paginated
        assert "size" in paginated
        assert paginated["size"] == 10
    finally:
        db.close()


def test_consistent_error_response_format():
    """Consistent error handler must return standard envelope."""
    # Invalid method on /health (POST not allowed)
    res = client.post("/health", json={})
    assert res.status_code == 405
    data = res.json()
    assert "error" in data
    assert "code" in data["error"]
    assert "message" in data["error"]
    assert "request_id" in data["error"]
    assert "detail" in data


def test_worker_price_snapshot_execution():
    """Worker price snapshot job runs successfully."""
    run_price_snapshot()
    # Confirm endpoint still serves valid pricing
    res = client.get("/pricing")
    assert res.status_code == 200
    data = res.json()
    assert data["final_price"] > 0
    assert len(data["history"]) > 0


def test_alembic_migrations_in_sync():
    """Alembic check confirms models and migrations are completely synchronized."""
    from alembic import command
    from alembic.config import Config

    old_cwd = os.getcwd()
    try:
        os.chdir(backend_dir)
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        # Ensure current head is applied, then check for any model-migration drift
        command.upgrade(alembic_cfg, "head")
        command.check(alembic_cfg)
    finally:
        os.chdir(old_cwd)
