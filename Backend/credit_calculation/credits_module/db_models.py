# credits_module/db_models.py

from sqlalchemy import Column, Integer, Float, String, Date, Text, ForeignKey
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
    created_at = Column(Date)

    project = relationship("Project")


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    corporate_name = Column(String, unique=True, index=True)
    total_credits = Column(Float, default=0)
    total_spent_inr = Column(Float, default=0)
    last_purchase_date = Column(Date, nullable=True)