# credits_module/db_models.py

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
    updated_at = Column(DateTime)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String)
    price = Column(Float)
    recorded_at = Column(DateTime)


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