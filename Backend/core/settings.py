"""
Typed application settings module for CarbonVault (Phase 3).
Uses Pydantic BaseSettings to validate configuration at startup.
Refuses to start in production if critical secrets or production database are missing.
"""

import os
import logging
from pathlib import Path
from typing import List, Literal, Optional, Union
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_FILE = BASE_DIR / "carbon_vault.db"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BASE_DIR / ".env"), str(BASE_DIR.parent / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core environment mode
    APP_MODE: Literal["demo", "production", "staging", "test"] = Field(
        default="demo",
        description="Application running mode. Production enforces strict secrets and DB."
    )
    DEBUG: bool = Field(default=True, description="Enable debug logging and tracebacks")

    # Database
    DATABASE_URL: str = Field(default=DEFAULT_DB_URL, description="SQLAlchemy database connection URL")

    # Authentication
    JWT_SECRET: str = Field(
        default="carbonvault-sec-auth-key-32bytes-entropy-production-2026",
        description="Secret key for JWT generation and verification (minimum 32 bytes)"
    )
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24)  # 24 hours

    # Payments & Razorpay
    PAYMENT_MODE: Literal["test", "live"] = Field(default="test")
    RAZORPAY_KEY_ID: str = Field(default="")
    RAZORPAY_KEY_SECRET: str = Field(default="")
    RAZORPAY_WEBHOOK_SECRET: str = Field(default="")

    # CORS
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://final-carbon-vault.vercel.app",
        ]
    )

    # Server binding
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8000)

    # External APIs & Integrations
    SENTRY_DSN: Optional[str] = Field(default=None)
    SLOW_QUERY_THRESHOLD_MS: float = Field(default=500.0)
    SH_CLIENT_ID: str = Field(default="")
    SH_CLIENT_SECRET: str = Field(default="")
    INR_USD_RATE: float = Field(default=96.0)

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Optional[str]) -> str:
        if not v:
            return DEFAULT_DB_URL
        url = str(v).strip()
        # Render provides postgres://, SQLAlchemy requires postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            rel_path = url.replace("sqlite:///", "").lstrip("./")
            abs_db_path = (BASE_DIR / rel_path).resolve()
            url = f"sqlite:///{abs_db_path.as_posix()}"
        return url

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        default_origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://final-carbon-vault.vercel.app",
        ]
        if isinstance(v, list):
            return list(set(default_origins + [str(item).strip() for item in v if str(item).strip()]))
        if isinstance(v, str):
            extra = [item.strip() for item in v.split(",") if item.strip()]
            return list(set(default_origins + extra))
        return default_origins

    @model_validator(mode="after")
    def validate_production_and_payment_invariants(self) -> "Settings":
        # 1. Razorpay prefix validation
        if self.RAZORPAY_KEY_ID:
            if self.PAYMENT_MODE == "test" and self.RAZORPAY_KEY_ID.startswith("rzp_live_"):
                raise ValueError("Config mismatch: PAYMENT_MODE is 'test' but RAZORPAY_KEY_ID starts with 'rzp_live_'")
            if self.PAYMENT_MODE == "live" and self.RAZORPAY_KEY_ID.startswith("rzp_test_"):
                raise ValueError("Config mismatch: PAYMENT_MODE is 'live' but RAZORPAY_KEY_ID starts with 'rzp_test_'")

        # 2. Strict production enforcement
        if self.APP_MODE == "production":
            violations = []
            # Disallow SQLite in production
            if self.DATABASE_URL.startswith("sqlite"):
                violations.append("DATABASE_URL must be a managed PostgreSQL connection in production (SQLite is forbidden).")

            # Disallow weak or default JWT secrets
            default_placeholder = "carbonvault-sec-auth-key-32bytes-entropy-production-2026"
            if not self.JWT_SECRET or len(self.JWT_SECRET) < 32 or self.JWT_SECRET == default_placeholder:
                violations.append("JWT_SECRET must be explicitly set to a unique cryptographically secure secret (minimum 32 characters) in production.")

            # Require Razorpay credentials if payments are enabled
            if not self.RAZORPAY_KEY_ID or not self.RAZORPAY_KEY_SECRET:
                violations.append("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be defined in production.")

            if self.PAYMENT_MODE == "live" and not self.RAZORPAY_WEBHOOK_SECRET:
                violations.append("RAZORPAY_WEBHOOK_SECRET must be configured when PAYMENT_MODE is 'live'.")

            if violations:
                err_msg = "FATAL: Production settings validation failed:\n  • " + "\n  • ".join(violations)
                logger.critical(err_msg)
                raise RuntimeError(err_msg)

        return self


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings_for_tests(new_settings: Optional[Settings] = None) -> Settings:
    global _settings
    _settings = new_settings
    return get_settings()
