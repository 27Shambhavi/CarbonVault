# app/api/fraud_routes.py
"""
FastAPI router for fraud detection endpoints.
"""
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field
from ..services.fraud_service import run_fraud_detection

router = APIRouter()


class FraudCheckRequest(BaseModel):
    project_id:  str = Field(..., description="ID or UUID of the project to check")
    polygon_wkt: Optional[str] = Field("", description="WKT polygon, e.g. POLYGON((...)) ")
    image_path:  Optional[str] = Field("", description="Path or filename of the uploaded image file")


@router.post("/check-project")
def check_project(req: FraudCheckRequest):
    """Run all fraud validators and return aggregated risk score."""
    return run_fraud_detection(req.project_id, req.polygon_wkt or "", req.image_path or "")