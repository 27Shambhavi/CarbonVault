# app/db/models.py
import uuid
from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography

from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ngo_id         = Column(UUID(as_uuid=True), nullable=False)
    land           = Column(Geography(geometry_type="POLYGON", srid=4326))
    area_hectare   = Column(Float)
    plantation_date = Column(Date)
    plant_type     = Column(String)
    num_trees      = Column(Float)


class SpatialConflict(Base):
    __tablename__ = "spatial_conflicts"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id          = Column(UUID(as_uuid=True), nullable=True)
    conflict_project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    overlap_ratio       = Column(Float, nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())


class NdviRecord(Base):
    __tablename__ = "ndvi_records"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id       = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    observation_date = Column(Date, nullable=False)
    avg_ndvi         = Column(Float, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class MediaRecord(Base):
    __tablename__ = "media_records"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    file_hash  = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())