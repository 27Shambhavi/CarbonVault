# credits_module/db.py

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

try:
    from core.config import DATABASE_URL
except ImportError:
    from pathlib import Path
    _base = Path(__file__).resolve().parent.parent.parent
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(_base / 'carbon_vault.db').as_posix()}")

# Fix Render postgres:// prefix if loaded without core.config
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()