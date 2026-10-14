import os
import logging
from pathlib import Path
from typing import List
from .settings import get_settings, BASE_DIR, DEFAULT_DB_FILE, DEFAULT_DB_URL

logger = logging.getLogger(__name__)

# Initialize typed settings (validates environment invariants)
settings = get_settings()

# Canonical paths and database URLs
DATABASE_URL = settings.DATABASE_URL

# Razorpay credentials
PAYMENT_MODE = settings.PAYMENT_MODE
RAZORPAY_KEY_ID = settings.RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET = settings.RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET = settings.RAZORPAY_WEBHOOK_SECRET

# JWT & Authentication
JWT_SECRET = settings.JWT_SECRET

# Application Mode
APP_MODE = settings.APP_MODE

# CORS Origins
CORS_ORIGINS = settings.CORS_ORIGINS

# Server
API_HOST = settings.API_HOST
API_PORT = settings.API_PORT
DEBUG = settings.DEBUG

# Uploads directory
UPLOAD_DIR = (BASE_DIR / "uploads").resolve()
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Currency conversion
INR_USD_RATE = settings.INR_USD_RATE

# Copernicus / Sentinel Hub
SH_CLIENT_ID = settings.SH_CLIENT_ID
SH_CLIENT_SECRET = settings.SH_CLIENT_SECRET
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
SENTINEL_PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
