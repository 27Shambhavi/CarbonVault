# marketplace_router.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from credit_calculation.credits_module.db_models import Project, ProjectCredits, FundingDetails, CorporateRequest
from credit_calculation.credits_module.db import SessionLocal

router = APIRouter()


class BuyRequest(BaseModel):
    corporate_name: str
    project_id: str
    offered_price: float


@router.get("/requests/{ngo_id}")
def get_buy_requests(ngo_id: int):
    db = SessionLocal()
    try:
        # Get approved projects for NGO
        projects = db.query(Project).filter(Project.ngo_id == ngo_id, Project.status == "approved").all()
        project_ids = [p.project_id for p in projects]
        # Get requests
        requests = db.query(CorporateRequest).filter(CorporateRequest.project_id.in_(project_ids)).all()
        result = []
        for req in requests:
            project = db.query(Project).filter(Project.project_id == req.project_id).first()
            result.append({
                "id": req.id,
                "buyer": req.corporate_name,
                "project_id": req.project_id,
                "project_name": project.name if project else "Unknown",
                "tons": project.credits or 0,
                "price_per_ton": req.offered_price,
                "total": (project.credits or 0) * req.offered_price,
                "status": req.status
            })
        return result
    finally:
        db.close()


@router.post("/request")
def create_buy_request(request: BuyRequest):
    db = SessionLocal()
    try:
        # Check if project is approved
        project = db.query(Project).filter(Project.project_id == request.project_id, Project.status == "approved").first()
        if not project:
            raise HTTPException(status_code=400, detail="Project not approved or not found")
        new_request = CorporateRequest(
            corporate_name=request.corporate_name,
            project_id=request.project_id,
            offered_price=request.offered_price
        )
        db.add(new_request)
        db.commit()
        return {"message": "Request created"}
    finally:
        db.close()


@router.post("/accept/{request_id}")
def accept_request(request_id: int):
    db = SessionLocal()
    try:
        request = db.query(CorporateRequest).filter(CorporateRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        request.status = "accepted"
        # Simulate payment: update funding
        project = db.query(Project).filter(Project.project_id == request.project_id).first()
        if project:
            funding = FundingDetails(
                project_id=request.project_id,
                price_per_ton=request.offered_price,
                ecosystem_multiplier=1.0,
                total_funding=(project.credits or 0) * request.offered_price
            )
            db.add(funding)
        db.commit()
        return {"message": "Request accepted, payment simulated"}
    finally:
        db.close()


@router.get("/listings")
def get_marketplace_listings():
    """Get all approved projects as marketplace listings for corporate buyers."""
    db = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.status == "approved").all()
        result = []
        for p in projects:
            credits_entry = db.query(ProjectCredits).filter(ProjectCredits.project_id == p.project_id).first()
            credits = credits_entry.verified_credits if credits_entry else p.credits or 0
            funding_entry = db.query(FundingDetails).filter(FundingDetails.project_id == p.project_id).first()
            price = funding_entry.price_per_ton if funding_entry else p.price or 25.0
            from credit_calculation.credits_module.db_models import NGO
            ngo = db.query(NGO).filter(NGO.id == p.ngo_id).first()
            result.append({
                "id": p.project_id,
                "name": p.name,
                "type": p.plantation_type.replace("_", " ").title() if p.plantation_type else "Reforestation",
                "location": f"{p.latitude}, {p.longitude}",
                "credits": credits,
                "area": p.area_hectares,
                "price": price,
                "ngo": ngo.name if ngo else "Unknown",
                "verified": 85,
            })
        return result
    finally:
        db.close()


print("Marketplace router loaded")