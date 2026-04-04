# app/config.py
"""
Central configuration — loads .env and exposes all settings.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# ── Load .env from the same directory as this file ──────────────────────
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
    logger.info("Loaded .env from %s", _env_path)
else:
    logger.warning(".env not found at %s — relying on system env vars", _env_path)

# ── Database ────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:vaibhav123@localhost:5432/cross_ngo",
)

# ── Sentinel Hub / CDSE ─────────────────────────────────────────────────
SH_CLIENT_ID = os.getenv("SH_CLIENT_ID", "")
SH_CLIENT_SECRET = os.getenv("SH_CLIENT_SECRET", "")

TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu"
    "/auth/realms/CDSE/protocol/openid-connect/token"
)

# CDSE-specific Process API (NOT services.sentinel-hub.com)
SENTINEL_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"