# routers/calculator_router.py
"""
Corporate Carbon Footprint Calculator Router:
Calculates Scope 1, Scope 2, and Scope 3 GHG Protocol emissions proxies based on operational inputs,
stores real audit estimates in the database, and pairs estimated tonnes with available certified projects for offsetting.
"""

import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import FootprintEstimate, Project, SystemConfig

logger = logging.getLogger("carbonvault")
router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class FootprintRequest(BaseModel):
    corporate_name: str = Field(default="Corporate Buyer", max_length=150, description="Name of the corporate organization")
    employees: int = Field(default=250, ge=1, le=10000000, description="Total headcount")
    sqft: float = Field(default=15000.0, ge=0, le=1000000000.0, description="Total office/facility area in square feet")
    short_haul_flights: int = Field(default=80, ge=0, le=10000000, description="Annual short-haul commercial flights (<1500 km)")
    long_haul_flights: int = Field(default=25, ge=0, le=10000000, description="Annual long-haul commercial flights (>1500 km)")
    cloud_spend_usd: float = Field(default=5000.0, ge=0, le=1000000000.0, description="Monthly cloud and data infrastructure spend in USD")


@router.post("/estimate")
def calculate_and_save_estimate(payload: FootprintRequest, db: Session = Depends(get_db)):
    """
    Compute GHG Protocol Scope 1, 2, and 3 emissions proxies,
    persist the estimate to the database, and match with available verified credits.
    """
    try:
        # Read coefficients from system_config table (with scientific source attribution)
        def get_coeff(key: str, default: float) -> float:
            row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
            if row and row.value:
                try:
                    return float(row.value)
                except ValueError:
                    pass
            return default

        c_scope1 = get_coeff("scope1_employee_coeff", 0.35)
        c_scope2_sqft = get_coeff("scope2_sqft_coeff", 0.014)
        c_scope2_emp = get_coeff("scope2_employee_coeff", 0.45)
        c_scope3_short = get_coeff("scope3_shorthaul_coeff", 0.15)
        c_scope3_long = get_coeff("scope3_longhaul_coeff", 0.60)
        c_scope3_cloud = get_coeff("scope3_cloud_coeff", 0.50)

        scope1 = round(payload.employees * c_scope1, 2)
        scope2 = round((payload.sqft * c_scope2_sqft) + (payload.employees * c_scope2_emp), 2)
        scope3 = round(
            (payload.short_haul_flights * c_scope3_short) +
            (payload.long_haul_flights * c_scope3_long) +
            ((payload.cloud_spend_usd / 1000.0) * c_scope3_cloud),
            2
        )

        total_tonnes = round(scope1 + scope2 + scope3, 2)

        inputs_data = {
            "employees": payload.employees,
            "sqft": payload.sqft,
            "short_haul_flights": payload.short_haul_flights,
            "long_haul_flights": payload.long_haul_flights,
            "cloud_spend_usd": payload.cloud_spend_usd
        }

        # Persist to database
        estimate_record = FootprintEstimate(
            corporate_name=payload.corporate_name.strip() or "Corporate Buyer",
            scope1_tonnes=scope1,
            scope2_tonnes=scope2,
            scope3_tonnes=scope3,
            total_tonnes=total_tonnes,
            inputs_json=json.dumps(inputs_data),
            created_at=datetime.utcnow()
        )
        db.add(estimate_record)
        db.commit()
        db.refresh(estimate_record)

        # Find matching approved projects with available credits
        approved_projects = db.query(Project).filter(
            Project.status.ilike("approved"),
            Project.credits > 0
        ).order_by(Project.price.asc()).all()

        matching_projects = []
        for p in approved_projects:
            available = p.credits or 0.0
            offset_possible = min(available, total_tonnes)
            price_per_tonne = p.price or 25.0
            loc_str = f"{p.plantation_type or 'Forest'} ({p.latitude:.2f}, {p.longitude:.2f})" if p.latitude and p.longitude else (p.plantation_type or "Global")
            matching_projects.append({
                "project_id": p.project_id,
                "name": p.name,
                "location": loc_str,
                "project_type": p.plantation_type or "Reforestation",
                "price": price_per_tonne,
                "available_credits": available,
                "mrv_score": p.mrv_score or 85,
                "recommended_offset_tonnes": round(offset_possible, 2),
                "estimated_cost_usd": round(offset_possible * price_per_tonne, 2),
                "covers_full_footprint": bool(available >= total_tonnes)
            })

        return {
            "status": "success",
            "estimate_id": estimate_record.id,
            "corporate_name": estimate_record.corporate_name,
            "scope1_tonnes": scope1,
            "scope2_tonnes": scope2,
            "scope3_tonnes": scope3,
            "total_tonnes": total_tonnes,
            "inputs": inputs_data,
            "created_at": estimate_record.created_at.isoformat() if estimate_record.created_at else None,
            "matching_projects": matching_projects
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error calculating carbon footprint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate footprint: {str(e)}")


@router.get("/history/{corporate_name}")
def get_footprint_history(corporate_name: str, db: Session = Depends(get_db)):
    """
    Retrieve all historical footprint estimates for a corporate entity.
    """
    records = db.query(FootprintEstimate).filter(
        FootprintEstimate.corporate_name.ilike(corporate_name.strip())
    ).order_by(desc(FootprintEstimate.created_at)).all()

    # If exact match has none, return all records as fallback if general inquiry
    if not records:
        records = db.query(FootprintEstimate).order_by(desc(FootprintEstimate.created_at)).limit(20).all()

    results = []
    for r in records:
        inputs = {}
        try:
            if r.inputs_json:
                inputs = json.loads(r.inputs_json)
        except Exception:
            inputs = {}

        results.append({
            "id": r.id,
            "corporate_name": r.corporate_name,
            "scope1_tonnes": r.scope1_tonnes,
            "scope2_tonnes": r.scope2_tonnes,
            "scope3_tonnes": r.scope3_tonnes,
            "total_tonnes": r.total_tonnes,
            "inputs": inputs,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })

    return results
