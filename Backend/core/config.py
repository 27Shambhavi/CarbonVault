import os
import logging
from pathlib import Path
from typing import List
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Base directory for the backend (Backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env: first check Backend/.env, then root .env
_backend_env = BASE_DIR / ".env"
_root_env = BASE_DIR.parent / ".env"

if _backend_env.exists():
    load_dotenv(_backend_env)
    logger.info("Loaded .env from %s", _backend_env)
elif _root_env.exists():
    load_dotenv(_root_env)
    logger.info("Loaded .env from %s", _root_env)
else:
    logger.warning("No .env found, using system environment variables")

# Canonical SQLite database path (inside Backend/ directory)
DEFAULT_DB_FILE = BASE_DIR / "carbon_vault.db"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# Fix Render Postgres URL prefix (Render supplies postgres://, SQLAlchemy requires postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# If DATABASE_URL is a relative sqlite URL like "sqlite:///carbon_vault.db", resolve to absolute path in BASE_DIR
if DATABASE_URL.startswith("sqlite:///") and not DATABASE_URL.startswith("sqlite:////"):
    rel_path = DATABASE_URL.replace("sqlite:///", "").lstrip("./")
    abs_db_path = (BASE_DIR / rel_path).resolve()
    DATABASE_URL = f"sqlite:///{abs_db_path.as_posix()}"

# Razorpay credentials (safe test keys by default for hackathon/demo)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_SXyS0q18CPS1p1")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "9m0Tq4EB8zFLXKJUgzgmCy9I")

# CORS Origins
_default_cors = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://final-carbon-vault.vercel.app",
]

_env_cors = os.getenv("CORS_ORIGINS", "")
if _env_cors:
    extra_origins = [o.strip() for o in _env_cors.split(",") if o.strip()]
    CORS_ORIGINS = list(set(_default_cors + extra_origins))
else:
    CORS_ORIGINS = _default_cors

# Server
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

# Uploads directory
UPLOAD_DIR = (BASE_DIR / "uploads").resolve()
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Currency conversion
INR_USD_RATE = float(os.getenv("INR_USD_RATE", "96.0"))

# Copernicus / Sentinel Hub
SH_CLIENT_ID = os.getenv("SH_CLIENT_ID", "")
SH_CLIENT_SECRET = os.getenv("SH_CLIENT_SECRET", "")
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
SENTINEL_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
