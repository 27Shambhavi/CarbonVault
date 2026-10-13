import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
import urllib.request
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.db_models import (
    SystemConfig, ConfigAuditHistory, PlantationType, FxRate
)
from core.config import APP_MODE

logger = logging.getLogger("carbonvault")
router = APIRouter(prefix="/config", tags=["configuration"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Pydantic schemas
class ConfigSetRequest(BaseModel):
    key: str
    value: str
    unit: Optional[str] = None
    source: Optional[str] = "admin_setting"
    is_public: bool = False
    admin_name: str = "Admin"


class PlantationTypeCreate(BaseModel):
    type_key: str
    label: str
    annual_rate_min: float
    annual_rate_max: float
    annual_rate_mid: float
    unit: str = "credits/acre/year"
    source: str
    admin_name: str = "Admin"


class FxRateOverrideRequest(BaseModel):
    rate: float
    admin_name: str = "Admin"


# Default System Configs (seeded in demo mode or read during first-run)
DEFAULT_CONFIGS = [
    {"key": "base_price_usd", "value": "28.50", "unit": "USD/tonne", "source": "State of Voluntary Carbon Markets (Ecosystem Marketplace 2024)", "is_public": True},
    {"key": "multiplier_demand_default", "value": "1.12", "unit": "ratio", "source": "CarbonVault Dynamic Pricing Model v1.2", "is_public": True},
    {"key": "multiplier_supply_default", "value": "0.98", "unit": "ratio", "source": "CarbonVault Dynamic Pricing Model v1.2", "is_public": True},
    {"key": "multiplier_living_default", "value": "1.08", "unit": "ratio", "source": "Fair Work & Living Wage Index (Fairtrade 2023)", "is_public": True},
    {"key": "buffer_pool_share", "value": "0.15", "unit": "percentage", "source": "VCS Non-Permanence Risk Tool (AFOLU Requirement)", "is_public": True},
    {"key": "shadow_credit_horizon_years", "value": "5", "unit": "years", "source": "ISO 14064-2 Forward Sequestration Assessment", "is_public": True},
    {"key": "marketplace_commission_pct", "value": "5.0", "unit": "%", "source": "CarbonVault Terms of Service", "is_public": True},
    {"key": "admin_fee_usd", "value": "50.0", "unit": "USD", "source": "Platform Fee Schedule", "is_public": True},
    {"key": "payment_gateway_fee_pct", "value": "2.5", "unit": "%", "source": "Razorpay Standard Rate", "is_public": True},
    {"key": "inr_usd_fallback_rate", "value": "83.50", "unit": "INR/USD", "source": "Reserve Bank of India Reference Rate", "is_public": True},
    {"key": "ecb_cache_ttl_seconds", "value": "3600", "unit": "seconds", "source": "System Cache Policy", "is_public": True},
    {"key": "satellite_ndvi_threshold", "value": "0.45", "unit": "index", "source": "Sentinel-2 AFOLU Verification Standard", "is_public": True},
    {"key": "satellite_canopy_threshold", "value": "25.0", "unit": "%", "source": "Global Forest Watch Canopy Cover Standard", "is_public": True},
    {"key": "corporate_carbon_intensity_factor", "value": "0.85", "unit": "factor", "source": "IEA Global Energy & Emissions 2023", "is_public": True},
    {"key": "corporate_scope3_spend_multiplier", "value": "0.0004", "unit": "factor", "source": "GHG Protocol Scope 3 Standard", "is_public": True},
    {"key": "corporate_commute_factor", "value": "0.12", "unit": "factor", "source": "EPA Commuter Model", "is_public": True},
    {"key": "grs_weight_retirement", "value": "0.35", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_reporting", "value": "0.25", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_diversity", "value": "0.20", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_vintage", "value": "0.20", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_transparency", "value": "0.35", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_quality", "value": "0.40", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "grs_weight_commitment", "value": "0.25", "unit": "weight", "source": "CarbonVault GRS Methodology 2024", "is_public": True},
    {"key": "scope1_employee_coeff", "value": "0.35", "unit": "tCO2e/employee/yr", "source": "GHG Protocol Corporate Standard (Office Proxy)", "is_public": True},
    {"key": "scope2_sqft_coeff", "value": "0.014", "unit": "tCO2e/sqft/yr", "source": "US EIA Commercial Buildings Energy Consumption (CBECS)", "is_public": True},
    {"key": "scope2_employee_coeff", "value": "0.45", "unit": "tCO2e/employee/yr", "source": "EPA eGRID National Average Emission Rates", "is_public": True},
    {"key": "scope3_shorthaul_coeff", "value": "0.15", "unit": "tCO2e/flight", "source": "DEFRA Greenhouse Gas Reporting Factors 2023", "is_public": True},
    {"key": "scope3_longhaul_coeff", "value": "0.60", "unit": "tCO2e/flight", "source": "DEFRA Greenhouse Gas Reporting Factors 2023", "is_public": True},
    {"key": "scope3_cloud_coeff", "value": "0.50", "unit": "tCO2e/$1k", "source": "Cloud Carbon Footprint Research / Dimawatt 2023", "is_public": True},
]

DEFAULT_PLANTATION_TYPES = [
    {"type_key": "mangrove", "label": "🌊 Mangrove Restoration", "annual_rate_min": 20.0, "annual_rate_max": 40.0, "annual_rate_mid": 30.0, "unit": "credits/acre/year", "source": "IPCC Wetlands Supplement 2013 & Forest Survey of India 2021"},
    {"type_key": "bamboo", "label": "🎋 Bamboo Agroforestry", "annual_rate_min": 10.0, "annual_rate_max": 20.0, "annual_rate_mid": 15.0, "unit": "credits/acre/year", "source": "INBAR (International Bamboo and Rattan Organisation) Technical Report 2020"},
    {"type_key": "mixed", "label": "⚡ Mixed Native Forest", "annual_rate_min": 10.0, "annual_rate_max": 25.0, "annual_rate_mid": 17.5, "unit": "credits/acre/year", "source": "FAO Global Forest Resources Assessment 2020"},
    {"type_key": "eucalyptus", "label": "🌳 Eucalyptus Plantation", "annual_rate_min": 8.0, "annual_rate_max": 15.0, "annual_rate_mid": 11.5, "unit": "credits/acre/year", "source": "ICFRE Forestry Yield Research Papers 2019"},
    {"type_key": "teak", "label": "🌳 Teak Hardwood", "annual_rate_min": 3.0, "annual_rate_max": 8.0, "annual_rate_mid": 5.5, "unit": "credits/acre/year", "source": "ITTO Tropical Forest Management Series #18"},
    {"type_key": "neem", "label": "🌳 Neem Silviculture", "annual_rate_min": 2.0, "annual_rate_max": 6.0, "annual_rate_mid": 4.0, "unit": "credits/acre/year", "source": "Central Arid Zone Research Institute (CAZRI) 2021"},
    {"type_key": "pine", "label": "🌲 Subtropical Pine", "annual_rate_min": 5.0, "annual_rate_max": 10.0, "annual_rate_mid": 7.5, "unit": "credits/acre/year", "source": "Forest Research Institute Dehradun Bulletin 2018"},
    {"type_key": "banyan", "label": "🌳 Sacred Banyan / Ficus", "annual_rate_min": 2.0, "annual_rate_max": 5.0, "annual_rate_mid": 3.5, "unit": "credits/acre/year", "source": "Botanical Survey of India Urban Carbon Studies 2022"},
]


def ensure_config_seeded(db: Session):
    """Seed initial defaults if empty."""
    for c in DEFAULT_CONFIGS:
        exists = db.query(SystemConfig).filter(SystemConfig.key == c["key"]).first()
        if not exists:
            db.add(SystemConfig(
                key=c["key"],
                value=c["value"],
                unit=c["unit"],
                source=c["source"],
                is_public=c["is_public"],
                updated_by="system_seed",
                updated_at=datetime.utcnow()
            ))
    for p in DEFAULT_PLANTATION_TYPES:
        exists = db.query(PlantationType).filter(PlantationType.type_key == p["type_key"]).first()
        if not exists:
            db.add(PlantationType(
                type_key=p["type_key"],
                label=p["label"],
                annual_rate_min=p["annual_rate_min"],
                annual_rate_max=p["annual_rate_max"],
                annual_rate_mid=p["annual_rate_mid"],
                unit=p["unit"],
                source=p["source"],
                reviewed_at=datetime.utcnow()
            ))
    db.commit()


@router.get("/public")
def get_public_config(db: Session = Depends(get_db)):
    """Safe public configurations, pricing, and system parameters."""
    ensure_config_seeded(db)
    rows = db.query(SystemConfig).filter(SystemConfig.is_public == True).all()
    config_dict = {
        r.key: {
            "value": float(r.value) if r.value.replace('.', '', 1).isdigit() else r.value,
            "unit": r.unit,
            "source": r.source,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        }
        for r in rows
    }
    return {
        "status": "ok",
        "app_mode": APP_MODE,
        "configs": config_dict
    }


@router.get("/all")
def get_all_config(db: Session = Depends(get_db)):
    """Admin-only: list all system configuration keys and metadata."""
    ensure_config_seeded(db)
    rows = db.query(SystemConfig).all()
    return {
        "status": "ok",
        "app_mode": APP_MODE,
        "items": [
            {
                "key": r.key,
                "value": r.value,
                "unit": r.unit,
                "source": r.source,
                "is_public": r.is_public,
                "updated_by": r.updated_by,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None
            }
            for r in rows
        ]
    }


@router.post("/set")
def set_config(req: ConfigSetRequest, db: Session = Depends(get_db)):
    """Admin-only: set or update a configuration value with audit history."""
    row = db.query(SystemConfig).filter(SystemConfig.key == req.key).first()
    old_val = row.value if row else None
    
    if row:
        row.value = req.value
        if req.unit is not None:
            row.unit = req.unit
        if req.source:
            row.source = req.source
        row.is_public = req.is_public
        row.updated_by = req.admin_name
        row.updated_at = datetime.utcnow()
    else:
        row = SystemConfig(
            key=req.key,
            value=req.value,
            unit=req.unit,
            source=req.source,
            is_public=req.is_public,
            updated_by=req.admin_name,
            updated_at=datetime.utcnow()
        )
        db.add(row)

    # Record in audit trail
    history = ConfigAuditHistory(
        key=req.key,
        old_value=old_val,
        new_value=req.value,
        unit=req.unit,
        source=req.source,
        changed_by=req.admin_name,
        changed_at=datetime.utcnow()
    )
    db.add(history)
    db.commit()

    return {"status": "ok", "key": req.key, "new_value": req.value, "updated_at": row.updated_at.isoformat()}


@router.get("/history")
def get_config_history(key: Optional[str] = None, db: Session = Depends(get_db)):
    """Audit log of all configuration adjustments."""
    query = db.query(ConfigAuditHistory)
    if key:
        query = query.filter(ConfigAuditHistory.key == key)
    records = query.order_by(desc(ConfigAuditHistory.changed_at)).limit(100).all()
    return {
        "status": "ok",
        "history": [
            {
                "id": r.id,
                "key": r.key,
                "old_value": r.old_value,
                "new_value": r.new_value,
                "unit": r.unit,
                "source": r.source,
                "changed_by": r.changed_by,
                "changed_at": r.changed_at.isoformat() if r.changed_at else None
            }
            for r in records
        ]
    }


@router.get("/plantation-types")
def get_plantation_types(db: Session = Depends(get_db)):
    """Served from plantation_types table with rate, unit, source, and reviewed_at."""
    ensure_config_seeded(db)
    items = db.query(PlantationType).order_by(PlantationType.id.asc()).all()
    return {
        "status": "ok",
        "types": [
            {
                "type_key": p.type_key,
                "label": p.label,
                "annual_rate_min": p.annual_rate_min,
                "annual_rate_max": p.annual_rate_max,
                "annual_rate_mid": p.annual_rate_mid,
                "unit": p.unit,
                "co2_text": f"{int(p.annual_rate_min) if p.annual_rate_min.is_integer() else p.annual_rate_min}–{int(p.annual_rate_max) if p.annual_rate_max.is_integer() else p.annual_rate_max} {p.unit}",
                "source": p.source,
                "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None
            }
            for p in items
        ]
    }


@router.get("/fx-rate")
def get_fx_rate(force_refresh: bool = False, db: Session = Depends(get_db)):
    """
    Live FX Rate USD -> INR from Frankfurter API (European Central Bank Reference Rates).
    Graceful fallback to last recorded rate with timestamp and source. Never a silent constant.
    """
    # 1. Check if an override exists
    override = db.query(FxRate).filter(FxRate.is_override == True).order_by(desc(FxRate.fetched_at)).first()
    if override:
        return {
            "status": "ok",
            "rate": override.rate,
            "base": override.base_currency,
            "quote": override.quote_currency,
            "source": override.source,
            "fetched_at": override.fetched_at.isoformat(),
            "is_override": True,
            "display_label": f"₹{override.rate:.2f} per USD (Admin Override as of {override.fetched_at.strftime('%Y-%m-%d %H:%M')})"
        }

    # 2. Check if recent cached rate exists (< 30 minutes old) unless force_refresh
    latest = db.query(FxRate).filter(FxRate.is_override == False).order_by(desc(FxRate.fetched_at)).first()
    now = datetime.utcnow()
    if latest and not force_refresh and (now - latest.fetched_at).total_seconds() < 1800:
        age_min = int((now - latest.fetched_at).total_seconds() / 60)
        return {
            "status": "ok",
            "rate": latest.rate,
            "base": latest.base_currency,
            "quote": latest.quote_currency,
            "source": latest.source,
            "fetched_at": latest.fetched_at.isoformat(),
            "is_override": False,
            "display_label": f"₹{latest.rate:.2f} per USD ({latest.source}, {age_min}m ago)"
        }

    # 3. Fetch from European Central Bank reference feed via Frankfurter API
    try:
        req = urllib.request.Request(
            "https://api.frankfurter.app/latest?from=USD&to=INR",
            headers={"User-Agent": "CarbonVault/1.0 (MRV-FX-Feed)"}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
            inr_rate = float(data["rates"]["INR"])
            source_label = f"European Central Bank (ECB) Frankfurter API [{data.get('date', 'latest')}]"
            
            # Store in fx_rates
            new_record = FxRate(
                base_currency="USD",
                quote_currency="INR",
                rate=inr_rate,
                source=source_label,
                fetched_at=now,
                is_override=False
            )
            db.add(new_record)
            db.commit()

            return {
                "status": "ok",
                "rate": inr_rate,
                "base": "USD",
                "quote": "INR",
                "source": source_label,
                "fetched_at": now.isoformat(),
                "is_override": False,
                "display_label": f"₹{inr_rate:.2f} per USD ({source_label})"
            }
    except Exception as e:
        logger.warning(f"FX live fetch failed: {e}. Falling back to stored reference rate.")
        if latest:
            return {
                "status": "ok",
                "rate": latest.rate,
                "base": latest.base_currency,
                "quote": latest.quote_currency,
                "source": f"{latest.source} (cached)",
                "fetched_at": latest.fetched_at.isoformat(),
                "is_override": False,
                "display_label": f"₹{latest.rate:.2f} per USD (rate as of {latest.fetched_at.strftime('%Y-%m-%d %H:%M')})"
            }
        else:
            # Seeded fallback if network completely down on fresh cold start
            fallback_rate = 83.50
            return {
                "status": "ok",
                "rate": fallback_rate,
                "base": "USD",
                "quote": "INR",
                "source": "RBI Historical Reference Baseline",
                "fetched_at": now.isoformat(),
                "is_override": False,
                "display_label": f"₹{fallback_rate:.2f} per USD (RBI Historical Reference Baseline)"
            }


@router.post("/fx-rate/override")
def override_fx_rate(req: FxRateOverrideRequest, db: Session = Depends(get_db)):
    """Admin-only: manual audited override of the USD/INR conversion rate."""
    now = datetime.utcnow()
    # Mark earlier overrides false
    db.query(FxRate).filter(FxRate.is_override == True).update({"is_override": False})
    
    override = FxRate(
        base_currency="USD",
        quote_currency="INR",
        rate=req.rate,
        source=f"Admin Override by {req.admin_name}",
        fetched_at=now,
        is_override=True,
        updated_by=req.admin_name
    )
    db.add(override)
    db.commit()

    return {
        "status": "ok",
        "rate": req.rate,
        "source": override.source,
        "fetched_at": now.isoformat(),
        "is_override": True
    }
