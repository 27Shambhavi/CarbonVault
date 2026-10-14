"""
CI Gate Script: Check that SQLAlchemy models and Alembic migrations are completely in sync.
Exits with code 0 if up to date, non-zero if schema changes are detected without migrations.
"""

import sys
import os
from pathlib import Path

# Set up paths
repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "Backend"

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

os.chdir(backend_dir)

try:
    from alembic import command
    from alembic.config import Config

    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    print("[CHECK] [CarbonVault CI Gate] Verifying Alembic migrations vs SQLAlchemy models...")
    command.check(alembic_cfg)
    print("[PASS] Schema & migrations are perfectly in sync. No unmigrated changes detected.")
    sys.exit(0)
except Exception as e:
    print(f"[FAIL] Alembic migration check failed: {e}")
    sys.exit(1)
