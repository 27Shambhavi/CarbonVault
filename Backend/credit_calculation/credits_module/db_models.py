from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .db import Base


class NGO(Base):
    __tablename__ = "ngos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    email = Column(String, nullable=True)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, unique=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngos.id"), index=True)
    name = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    area_hectares = Column(Float)
    plantation_type = Column(String)
    number_of_trees = Column(Integer)
    start_date = Column(Date)
    status = Column(String, default="pending")  # pending, approved, rejected
    evidence_image = Column(String)  # path to image
    evidence_images = Column(Text, nullable=True)  # JSON or comma-separated paths
    polygon_wkt = Column(Text, nullable=True)  # WKT polygon of plantation area

    # Scores (persisted on creation, updated on fraud checks)
    mrv_score = Column(Float, nullable=True)
    fraud_risk = Column(Float, nullable=True)
    env_score = Column(Float, nullable=True)

    # Credits (calculated on approval)
    credits = Column(Float, nullable=True)           # verified credits
    shadow_credits = Column(Float, nullable=True)    # 5-year shadow projection
    price = Column(Float, nullable=True)             # price per credit in USD
    created_at = Column(Date)

    # Synthetic data flag
    is_synthetic = Column(Boolean, default=False)

    # Relationships
    ngo = relationship("NGO")


class ProjectCredits(Base):
    __tablename__ = "project_credits"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    total_shadow_credits = Column(Float)
    verified_credits = Column(Float)
    certificate_id = Column(String)
    issuance_date = Column(Date)
    expiry_date = Column(Date)

    # Relationship
    project = relationship("Project")


class FundingDetails(Base):
    __tablename__ = "funding_details"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    price_per_ton = Column(Float)
    ecosystem_multiplier = Column(Float)
    total_funding = Column(Float)

    # Relationship
    project = relationship("Project")


class CorporateRequest(Base):
    __tablename__ = "corporate_requests"

    id = Column(Integer, primary_key=True, index=True)
    corporate_name = Column(String)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    offered_price = Column(Float)
    status = Column(String, default="pending")  # pending, accepted, rejected
    created_at = Column(Date)

    # Relationship
    project = relationship("Project")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    project_name = Column(String)
    corporate_name = Column(String, index=True)
    quantity = Column(Float)           # tonnes of credits
    price_per_ton = Column(Float)
    amount_inr = Column(Float)
    amount_usd = Column(Float)
    status = Column(String, default="completed")
    certificate_id = Column(String, nullable=True, index=True)
    created_at = Column(Date)

    project = relationship("Project")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    corporate_name = Column(String, unique=True, index=True)
    total_credits = Column(Float, default=0)
    total_spent_inr = Column(Float, default=0)
    last_purchase_date = Column(Date, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String)  # create, approve, reject, mint, payment
    name = Column(String)    # Project ID or reference
    detail = Column(Text)
    user = Column(String)
    timestamp = Column(DateTime)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    role = Column(String)  # 'admin', 'ngo', 'buyer'
    admin_role = Column(String, default="super_admin")  # 'super_admin' or 'approver'
    projects = Column(Integer, default=0)
    credits = Column(Float, default=0.0)
    status = Column(String, default="active")  # 'active', 'suspended'
    joined = Column(String)  # e.g. '2024-01-15'


class PricingConfig(Base):
    __tablename__ = "pricing_config"

    id = Column(Integer, primary_key=True, index=True)
    base = Column(Float, default=28.50)
    demand = Column(Float, default=1.12)
    supply = Column(Float, default=0.98)
    living = Column(Float, default=1.08)
    mode = Column(String, default="manual")  # 'manual' or 'auto'
    demand_min = Column(Float, default=0.80)
    demand_max = Column(Float, default=1.50)
    supply_min = Column(Float, default=0.80)
    supply_max = Column(Float, default=1.50)
    updated_at = Column(DateTime)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    ts = Column(DateTime, index=True, nullable=True)
    base_price = Column(Float, nullable=True)
    m_demand = Column(Float, nullable=True)
    m_supply = Column(Float, nullable=True)
    m_living = Column(Float, nullable=True)
    effective_usd = Column(Float, nullable=True)
    source = Column(String, default="admin", nullable=True)
    # Legacy fields
    month = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    recorded_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_role = Column(String, nullable=True, index=True)  # 'admin', 'ngo', 'corporate', or 'all'
    recipient_email = Column(String, nullable=True, index=True)
    type = Column(String, default="info")  # 'approval', 'submission', 'mint', 'payment', 'warning', 'info'
    title = Column(String)
    message = Column(Text)
    related_project_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime)


class ProjectStatusHistory(Base):
    __tablename__ = "project_status_history"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    from_status = Column(String)
    to_status = Column(String)
    changed_by = Column(String)
    comment = Column(Text, nullable=True)
    timestamp = Column(DateTime)

    project = relationship("Project")


class ProjectProgressUpdate(Base):
    __tablename__ = "project_progress_updates"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True)
    quarter = Column(String)  # 'Q1', 'Q2', 'Q3', 'Q4'
    year = Column(Integer)
    survival_rate = Column(Float, nullable=True)  # e.g. 88.5%
    canopy_cover = Column(Float, nullable=True)   # e.g. 42.0%
    photos = Column(Text, nullable=True)          # image path or JSON list
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime)
    verified_by_satellite = Column(Boolean, default=False)

    project = relationship("Project")


class FootprintEstimate(Base):
    __tablename__ = "footprint_estimates"

    id = Column(Integer, primary_key=True, index=True)
    corporate_name = Column(String, index=True)
    scope1_tonnes = Column(Float)
    scope2_tonnes = Column(Float)
    scope3_tonnes = Column(Float)
    total_tonnes = Column(Float)
    inputs_json = Column(Text)
    created_at = Column(DateTime)


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String, unique=True, index=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, index=True)
    buyer_name = Column(String, nullable=True)
    tonnes = Column(Float, nullable=False)
    issued_at = Column(DateTime, nullable=False)
    sha256_hash = Column(String, nullable=False)
    type = Column(String, nullable=False)  # "project_verification" or "purchase"

    # Relationships
    project = relationship("Project")
    transaction = relationship("Transaction")


class LiveEvent(Base):
    __tablename__ = "live_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    type = Column(String, index=True, nullable=False)
    payload = Column(Text, nullable=False)  # JSON-encoded payload
    audience = Column(String, default="all", index=True, nullable=False)
    created_at = Column(DateTime, nullable=False)


class SatelliteObservation(Base):
    __tablename__ = "satellite_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    source = Column(String, nullable=False)  # e.g. "MODIS MOD13Q1"
    band = Column(String, nullable=False)    # e.g. "250m_16_days_NDVI"
    obs_date = Column(Date, index=True, nullable=False)
    value = Column(Float, nullable=False)
    fetched_at = Column(DateTime, nullable=False)

    project = relationship("Project")


class ClimateObservation(Base):
    __tablename__ = "climate_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    obs_date = Column(Date, index=True, nullable=False)
    t2m = Column(Float, nullable=True)         # Temperature at 2m (deg C)
    prectotcorr = Column(Float, nullable=True) # Precipitation (mm/day)
    rh2m = Column(Float, nullable=True)        # Relative Humidity at 2m (%)
    fetched_at = Column(DateTime, nullable=False)

    project = relationship("Project")


class MLAssessment(Base):
    __tablename__ = "ml_assessments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    model = Column(String, index=True, nullable=False)  # "anomaly", "ndvi_monitor", "suitability", "phash"
    score = Column(Float, nullable=False)
    reasons = Column(Text, nullable=True)               # JSON array of reasons/features
    confidence = Column(String, nullable=True)          # "low", "medium", "high"
    model_version = Column(String, default="1.0.0")
    created_at = Column(DateTime, nullable=False)

    project = relationship("Project")


class AISummary(Base):
    __tablename__ = "ai_summaries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    facts_hash = Column(String, index=True, nullable=False)
    summary = Column(Text, nullable=False)
    next_steps = Column(Text, nullable=True)             # JSON array
    status = Column(String, default="grounded")          # "grounded", "fallback", "rejected"
    created_at = Column(DateTime, nullable=False)

    project = relationship("Project")


class PhotoHash(Base):
    __tablename__ = "photo_hashes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    filename = Column(String, nullable=False)
    hash_original = Column(String, nullable=False)
    hash_hflip = Column(String, nullable=False)
    hash_rot90 = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)

    project = relationship("Project")


class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
    unit = Column(String, nullable=True)
    source = Column(String, nullable=True)
    is_public = Column(Boolean, default=False)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ConfigAuditHistory(Base):
    __tablename__ = "config_audit_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String, index=True, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=False)
    unit = Column(String, nullable=True)
    source = Column(String, nullable=True)
    changed_by = Column(String, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)


class PlantationType(Base):
    __tablename__ = "plantation_types"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    type_key = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=False)
    annual_rate_min = Column(Float, nullable=False)
    annual_rate_max = Column(Float, nullable=False)
    annual_rate_mid = Column(Float, nullable=False)
    unit = Column(String, default="credits/acre/year")
    source = Column(String, nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow)


class FxRate(Base):
    __tablename__ = "fx_rates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    base_currency = Column(String, default="USD", nullable=False)
    quote_currency = Column(String, default="INR", nullable=False)
    rate = Column(Float, nullable=False)
    source = Column(String, nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow, index=True)
    is_override = Column(Boolean, default=False)
    updated_by = Column(String, nullable=True)


class PaymentQuote(Base):
    __tablename__ = "payment_quotes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    quote_id = Column(String, unique=True, index=True, nullable=False)
    project_id = Column(String, nullable=False)
    corporate_name = Column(String, nullable=True)
    quantity = Column(Float, nullable=False)
    unit_price_usd = Column(Float, nullable=False)
    price_source = Column(String, nullable=False)
    fx_rate = Column(Float, nullable=False)
    fx_as_of = Column(DateTime, nullable=False)
    total_usd = Column(Float, nullable=False)
    total_inr = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)