"""
CI Gate Script: Check that SQLAlchemy models and Alembic migrations are completely in sync.
Also verifies that an empty database migrates cleanly to head.
Exits with code 0 if up to date, non-zero if schema changes are detected without migrations.
"""

import sys
import os
import tempfile
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

    # 1. Check clean migration on a completely empty database
    print("[CHECK] [CarbonVault CI Gate] Verifying fresh empty database migrates to head from scratch...")
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    try:
        empty_cfg = Config(str(backend_dir / "alembic.ini"))
        empty_cfg.set_main_option("sqlalchemy.url", f"sqlite:///{Path(tmp_db_path).as_posix()}")
        command.upgrade(empty_cfg, "head")
        command.check(empty_cfg)
        print("[PASS] Fresh empty database successfully migrated to head with zero schema diffs.")
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except OSError:
                pass

    # 2. Check target database
    alembic_cfg = Config(str(backend_dir / "alembic.ini"))
    print("[CHECK] [CarbonVault CI Gate] Verifying target database upgrade and model parity...")
    command.upgrade(alembic_cfg, "head")
    command.check(alembic_cfg)
    print("[PASS] Schema & migrations are perfectly in sync. No unmigrated changes detected.")
    sys.exit(0)
except Exception as e:
    print(f"[FAIL] Alembic migration check failed: {e}")
    sys.exit(1)
