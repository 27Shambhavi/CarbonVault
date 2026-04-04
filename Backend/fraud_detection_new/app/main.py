# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.db.database import engine, Base
import app.db.models  # noqa: F401 — ensures all models are registered before create_all
from app.api.fraud_routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup if they don't exist yet
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Fraud Detection API",
    description="AI-powered fraud detection for cross-NGO reforestation projects",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/fraud", tags=["Fraud Detection"])


@app.get("/health")
def health():
    return {"status": "ok"}