# app/schemas/fraud_schema.py
from pydantic import BaseModel, Field
from typing import Optional


class FraudCheckRequest(BaseModel):
    project_id:  str = Field(..., description="UUID of the project to check")
    polygon_wkt: str = Field(..., description="WKT polygon of the project land, e.g. POLYGON((...))")
    image_path:  str = Field(..., description="Absolute path to the uploaded image file")


class RiskDetail(BaseModel):
    risk: Optional[float] = None
    message: Optional[str] = None
    error: Optional[str] = None

    class Config:
        extra = "allow"   # allow additional fields from each validator


class FraudCheckResponse(BaseModel):
    integrity_score: float = Field(..., ge=0, le=1)
    risk_score:      float = Field(..., ge=0, le=1)
    risk_level:      str   = Field(..., pattern="^(LOW|MEDIUM|HIGH)$")
    details: dict