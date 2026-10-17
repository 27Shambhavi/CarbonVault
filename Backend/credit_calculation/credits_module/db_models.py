from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Text, ForeignKey, Boolean, BigInteger
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
    prev_hash = Column(String, nullable=True, index=True)
    hash = Column(String, nullable=True, index=True)


from sqlalchemy import event

@event.listens_for(AuditLog, "before_update")
def block_audit_log_update(mapper, connection, target):
    raise PermissionError("Audit logs are cryptographically immutable. UPDATE operations are forbidden.")

@event.listens_for(AuditLog, "before_delete")
def block_audit_log_delete(mapper, connection, target):
    raise PermissionError("Audit logs are cryptographically immutable. DELETE operations are forbidden.")


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


# -------------------------
# Phase 5: Credit Integrity & Double-Entry Ledger Models
# -------------------------

class CreditBatch(Base):
    __tablename__ = "credit_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    vintage_year = Column(Integer, nullable=False, index=True)
    total_quantity = Column(Integer, nullable=False)          # Total minted (integer tonnes)
    available_quantity = Column(Integer, nullable=False)      # Available for sale
    reserved_quantity = Column(Integer, default=0, nullable=False) # Reserved under pending orders with TTL
    retired_quantity = Column(Integer, default=0, nullable=False)  # Permanently retired
    buffer_quantity = Column(Integer, default=0, nullable=False)   # Withheld for risk buffer pool
    serial_start = Column(Integer, nullable=False)
    serial_end = Column(Integer, nullable=False)
    status = Column(String, default="active", nullable=False) # 'active', 'exhausted', 'revoked'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project")


class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(String, unique=True, index=True, nullable=False) # e.g. ACC-SYS-INVENTORY, ACC-SYS-BUFFER, ACC-SYS-RETIRED, ACC-ORG-1
    account_type = Column(String, nullable=False, index=True) # 'system_inventory', 'system_buffer', 'system_retired', 'user', 'organisation'
    entity_id = Column(String, nullable=True, index=True)     # user_id or organisation identifier
    name = Column(String, nullable=False)
    balance = Column(Integer, default=0, nullable=False)      # Invariant: balance >= 0
    currency = Column(String, default="CREDIT", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entry_id = Column(String, unique=True, index=True, nullable=False) # LEDG-uuid
    transaction_id = Column(String, index=True, nullable=True)        # Links dual legs of double-entry
    order_id = Column(String, index=True, nullable=True)
    from_account_id = Column(String, ForeignKey("credit_accounts.account_id"), index=True, nullable=False)
    to_account_id = Column(String, ForeignKey("credit_accounts.account_id"), index=True, nullable=False)
    batch_id = Column(String, ForeignKey("credit_batches.batch_id"), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)                        # Integer tonnes (> 0)
    entry_type = Column(String, nullable=False, index=True)           # 'mint', 'reserve', 'release', 'transfer', 'retire', 'reverse'
    serial_start = Column(Integer, nullable=False)
    serial_end = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    from_account = relationship("CreditAccount", foreign_keys=[from_account_id])
    to_account = relationship("CreditAccount", foreign_keys=[to_account_id])
    batch = relationship("CreditBatch")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(String, unique=True, index=True, nullable=False) # ORD-uuid
    buyer_id = Column(String, index=True, nullable=False)              # User email or org name
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    batch_id = Column(String, ForeignKey("credit_batches.batch_id"), index=True, nullable=True)
    quantity = Column(Integer, nullable=False)                         # Integer tonnes
    serial_start = Column(Integer, nullable=True)
    serial_end = Column(Integer, nullable=True)
    unit_price_usd_cents = Column(Integer, nullable=False)             # In cents (e.g. 2850 = $28.50)
    fx_rate_scaled = Column(Integer, nullable=False)                   # Scaled x100 integer representation of reference FX rate
    amount_inr_paise = Column(BigInteger, nullable=False)              # Amount in minor units (paise)
    amount_usd_cents = Column(Integer, nullable=False)                 # Amount in minor units (cents)
    status = Column(String, default="created", nullable=False, index=True)
    # State transitions: created -> payment_pending -> paid -> credits_transferred -> completed; failed, expired, refunded
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    quote_id = Column(String, nullable=True)
    quote_expires_at = Column(DateTime, nullable=True)
    reservation_expires_at = Column(DateTime, nullable=False, index=True) # 15-minute inventory hold TTL
    razorpay_order_id = Column(String, nullable=True, index=True)
    razorpay_payment_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project")
    batch = relationship("CreditBatch")


class Retirement(Base):
    __tablename__ = "retirements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    retirement_id = Column(String, unique=True, index=True, nullable=False) # RET-uuid
    certificate_id = Column(String, unique=True, index=True, nullable=False)
    beneficiary = Column(String, index=True, nullable=False)
    purpose = Column(Text, nullable=False)
    batch_id = Column(String, ForeignKey("credit_batches.batch_id"), index=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    serial_start = Column(Integer, nullable=False)
    serial_end = Column(Integer, nullable=False)
    account_id = Column(String, ForeignKey("credit_accounts.account_id"), index=True, nullable=False)
    retired_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("CreditAccount")
    batch = relationship("CreditBatch")
    project = relationship("Project")


class OrganizationProfile(Base):
    __tablename__ = "organization_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    legal_name = Column(String, index=True, nullable=False)
    registration_number = Column(String, index=True, nullable=False)
    country = Column(String, nullable=False)
    org_type = Column(String, nullable=False)  # 'ngo' | 'corporate'
    kyc_status = Column(String, default="pending", nullable=False)  # 'pending', 'verified', 'rejected'
    kyc_reviewed_by = Column(String, nullable=True)
    kyc_reviewed_at = Column(DateTime, nullable=True)
    kyc_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User")


class OrganizationDocument(Base):
    __tablename__ = "organization_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_profile_id = Column(Integer, ForeignKey("organization_profiles.id"), index=True, nullable=False)
    doc_type = Column(String, nullable=False)  # 'incorporation', 'tax_id', 'board_resolution', 'identity_proof'
    file_url = Column(String, nullable=False)
    sha256_checksum = Column(String, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    org_profile = relationship("OrganizationProfile")


class ProjectDocument(Base):
    __tablename__ = "project_documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    doc_type = Column(String, nullable=False)  # 'land_proof', 'methodology_reference', 'monitoring_plan', 'baseline_notes'
    file_url = Column(String, nullable=False)
    sha256_checksum = Column(String, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    uploaded_by = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project")


class FieldVerification(Base):
    __tablename__ = "field_verifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    verifier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    verifier_name = Column(String, nullable=False)
    report_url = Column(String, nullable=False)
    decision = Column(String, nullable=False)  # 'verified', 'rejected'
    notes = Column(Text, nullable=True)
    signature_hash = Column(String, nullable=False)
    verified_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    verifier = relationship("User")
    project = relationship("Project")


class MLFlagFeedback(Base):
    __tablename__ = "ml_flag_feedbacks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    flag_name = Column(String, index=True, nullable=False)
    project_id = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    feedback = Column(String, nullable=False)  # 'useful', 'not_useful'
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String, default="pending", nullable=False)  # 'pending', 'processed', 'cancelled'
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    payout_id = Column(String, unique=True, index=True, nullable=False)  # PAY-uuid
    ngo_id = Column(Integer, ForeignKey("ngos.id"), index=True, nullable=False)
    amount_inr = Column(Float, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    status = Column(String, default="pending", nullable=False)  # 'pending', 'settled', 'failed'
    bank_account_last4 = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    reference_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    settled_at = Column(DateTime, nullable=True)

    ngo = relationship("NGO")


class FraudRun(Base):
    __tablename__ = "fraud_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(String, ForeignKey("projects.project_id"), index=True, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    overall_status = Column(String, default="running", nullable=False)  # 'consistent', 'needs_attention', 'manual_review', 'running', 'error'
    risk_index = Column(Float, nullable=True)  # 0.0 to 1.0
    model_version = Column(String, default="v2.1", nullable=False)
    trigger = Column(String, default="submission", nullable=False)  # 'submission', 'upload', 'edit', 'manual_rerun'
    explanation = Column(Text, nullable=True)

    project = relationship("Project")
    checks = relationship("FraudCheck", back_populates="run", cascade="all, delete-orphan")


class FraudCheck(Base):
    __tablename__ = "fraud_checks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("fraud_runs.id"), index=True, nullable=False)
    validator = Column(String, index=True, nullable=False)  # 'geo_boundary', 'photo_gps_exif', 'perceptual_hash', 'satellite_ndvi', 'ecological_isolation'
    status = Column(String, nullable=False)  # 'pass', 'warn', 'fail', 'not_checked', 'error'
    score = Column(Float, nullable=True)  # 0.0 to 1.0 (or None if not_checked)
    details = Column(Text, nullable=True)  # JSON-encoded details
    evidence_refs = Column(Text, nullable=True)  # JSON-encoded array of file paths / references
    reason = Column(Text, nullable=True)  # explanatory message, mandatory if not_checked or error

    run = relationship("FraudRun", back_populates="checks")