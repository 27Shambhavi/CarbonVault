# app/config.py
"""
Central configuration for fraud detection — synchronised with core.config.
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from core.config import DATABASE_URL, SH_CLIENT_ID, SH_CLIENT_SECRET, TOKEN_URL, SENTINEL_PROCESS_URL
except ImportError:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
    
    _base = Path(__file__).resolve().parent.parent.parent
    DEFAULT_DB = f"sqlite:///{(_base / 'carbon_vault.db').as_posix()}"
    DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB)
    SH_CLIENT_ID = os.getenv("SH_CLIENT_ID", "")
    SH_CLIENT_SECRET = os.getenv("SH_CLIENT_SECRET", "")
    TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    SENTINEL_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"