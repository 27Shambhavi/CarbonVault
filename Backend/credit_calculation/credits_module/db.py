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

# SQLite needs check_same_thread=False; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()