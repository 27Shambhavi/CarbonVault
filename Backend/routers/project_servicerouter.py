from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import uuid
import os
import logging
from datetime import datetime

from credit_calculation.credits_module.db_models import Project, ProjectCredits, FundingDetails, NGO
from credit_calculation.credits_module.db import SessionLocal
from credit_calculation.credits_module.calculator import CreditCalculator
from credit_calculation.credits_module.geo_utils import wkt_to_geojson_and_area

logger = logging.getLogger(__name__)

# ✅ Create router (NOT FastAPI app)
router = APIRouter()

# Create folder for storing images
try:
    from core.config import UPLOAD_DIR
    UPLOAD_FOLDER = str(UPLOAD_DIR)
except ImportError:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Credit calculator instance
credit_calculator = CreditCalculator()


# ─────────────────────────────────────────────────────────────
# FRAUD / MRV SCORING (uses the fraud_detection_new module)
# ─────────────────────────────────────────────────────────────

def compute_project_scores(project, db=None):
    """
    Compute mrvScore, fraudRisk, and envScore for a project.

    MRV Score = 0.4*survival_rate + 0.3*density_score + 0.3*verification_quality
    ENV Score = biodiversity_impact + carbon_capture + land_restoration
    Fraud Risk = duplicate_images + geo_mismatch + unrealistic_growth + satellite_mismatch

    Returns dict with mrvScore (0-100), fraudRisk (0-100), envScore (0-100).
    """
    media_risk = 0.0
    has_gps = False
    gps_data = None
    geo_mismatch = 0.0

    # ── 1. Media / GPS check (geo mismatch for fraud) ──
    if project.evidence_image and os.path.isfile(project.evidence_image):
        try:
            from fraud_detection_new.app.utils.exif_utils import extract_lat_lon
            lat, lon = extract_lat_lon(project.evidence_image)
            if lat is not None and lon is not None:
                has_gps = True
                gps_data = {"lat": lat, "lon": lon}
                if project.latitude and project.longitude:
                    dist = abs(lat - project.latitude) + abs(lon - project.longitude)
                    if dist > 5:
                        geo_mismatch = 0.9
                        media_risk = 0.8
                    elif dist > 1:
                        geo_mismatch = 0.5
                        media_risk = 0.4
                    else:
                        geo_mismatch = 0.05
                        media_risk = 0.05
                else:
                    geo_mismatch = 0.3
                    media_risk = 0.2
            else:
                media_risk = 0.3
                geo_mismatch = 0.3
        except Exception as e:
            logger.debug("EXIF extraction failed for %s: %s", project.evidence_image, e)
            media_risk = 0.3
            geo_mismatch = 0.3
    else:
        media_risk = 0.4
        geo_mismatch = 0.4

    # ── 2. Ecological plausibility (density check → unrealistic growth) ──
    eco_risk = 0.0
    density_score = 80.0  # default good density score
    density_limits = {
        "bamboo": 2500, "eucalyptus": 1600, "teak": 1000,
        "neem": 800, "mangrove": 4000, "pine": 1500,
        "banyan": 200, "mixed": 1200,
        "seagrass": 6000, "salt_marsh": 3000,
    }
    if project.area_hectares and project.area_hectares > 0 and project.number_of_trees:
        density = project.number_of_trees / project.area_hectares
        max_d = density_limits.get((project.plantation_type or "").lower(), 1200)
        ratio = density / max_d if max_d > 0 else 1.0
        if ratio > 1.5:
            eco_risk = 0.8
            density_score = 20.0
        elif ratio > 1.0:
            eco_risk = 0.35
            density_score = 50.0
        elif ratio > 0.3:
            eco_risk = 0.0
            density_score = 90.0
        else:
            eco_risk = 0.1
            density_score = 60.0
    elif not project.number_of_trees or project.number_of_trees == 0:
        eco_risk = 0.1
        density_score = 50.0

    # ── 3. Temporal / survival check ──
    survival_rate = 80.0  # base survival rate
    temporal_risk = 0.0
    if project.start_date:
        days = (datetime.now().date() - project.start_date).days
        if days < 0:
            survival_rate = 30.0
            temporal_risk = 0.5
        elif days < 30:
            survival_rate = 70.0
            temporal_risk = 0.15
        elif days < 180:
            survival_rate = 75.0
            temporal_risk = 0.05
        elif days < 365:
            survival_rate = 85.0
        else:
            survival_rate = 90.0

    # Survival adjustments by plantation type maturity
    type_survival_bonus = {
        "mangrove": 5, "bamboo": 8, "teak": -2, "neem": 3, "pine": 0,
        "eucalyptus": 5, "banyan": -5, "mixed": 3,
    }
    survival_rate += type_survival_bonus.get((project.plantation_type or "").lower(), 0)
    survival_rate = max(10, min(99, survival_rate))

    verification_quality = 50.0
    if project.polygon_wkt and len(project.polygon_wkt.strip()) > 30 and "POLYGON" in project.polygon_wkt.upper():
        verification_quality += 25  # Good polygon
    elif project.polygon_wkt and "POLYGON" in project.polygon_wkt.upper():
        verification_quality += 15

    if has_gps:
        verification_quality += 15  # GPS in image
    if project.evidence_image and os.path.isfile(project.evidence_image or ""):
        verification_quality += 10  # Has evidence image
    verification_quality = max(10, min(99, verification_quality))

    # ── 4b. Shapely Polygon Overlap Check ──
    polygon_overlap_risk = 0.0
    max_overlap = 0.0
    if db and project.polygon_wkt and "POLYGON" in project.polygon_wkt.upper():
        try:
            from shapely.wkt import loads as shapely_loads
            new_poly = shapely_loads(project.polygon_wkt)
            if not new_poly.is_valid:
                new_poly = new_poly.buffer(0)
            
            # Get other projects
            # If project is already attached to session and has ID, exclude it, otherwise check all
            if getattr(project, "id", None):
                existing_projects = db.query(Project).filter(Project.id != project.id).all()
            else:
                existing_projects = db.query(Project).all()
                
            for p in existing_projects:
                if p.polygon_wkt and p.project_id != project.project_id:
                    try:
                        ex_poly = shapely_loads(p.polygon_wkt)
                        if not ex_poly.is_valid:
                            ex_poly = ex_poly.buffer(0)
                        intersection = new_poly.intersection(ex_poly)
                        if intersection.area > 0 and new_poly.area > 0:
                            ratio = intersection.area / new_poly.area
                            if ratio > max_overlap:
                                max_overlap = ratio
                    except Exception:
                        pass
                        
            if max_overlap > 0.8:
                polygon_overlap_risk = 0.95
            elif max_overlap > 0.2:
                polygon_overlap_risk = 0.70
            elif max_overlap > 0.05:
                polygon_overlap_risk = 0.40
        except Exception as e:
            logger.error(f"Shapely overlap check failed: {e}")
            polygon_overlap_risk = 0.3 # Fallback risk if WKT fails parsing

    # ── 5. FRAUD RISK (0-100, higher = riskier) ──
    # Based on: overlapping land (Shapely), geo mismatch (Exif), unrealistic density
    fraud_risk_raw = (
        0.35 * polygon_overlap_risk +   # highest weight for exact overlaps
        0.20 * geo_mismatch +
        0.20 * eco_risk +
        0.15 * media_risk +
        0.10 * temporal_risk
    )
    fraud_risk = round(fraud_risk_raw * 100)
    fraud_risk = max(1, min(99, fraud_risk))

    # ── 6. MRV SCORE (0-100, higher = better) ──
    # Formula: mrv = 0.4*survival + 0.3*density + 0.3*verification
    mrv_score = round(
        0.4 * survival_rate +
        0.3 * density_score +
        0.3 * verification_quality
    )
    mrv_score = max(10, min(99, mrv_score))

    # ── 7. ENV SCORE (0-100, higher = better) ──
    # Based on: biodiversity impact + carbon capture + land restoration
    biodiversity_impact = {
        "mangrove": 95, "mixed": 85, "bamboo": 70, "teak": 75,
        "neem": 72, "eucalyptus": 55, "banyan": 80, "pine": 50,
    }.get((project.plantation_type or "").lower(), 65)

    carbon_capture_rates = {
        "mangrove": 95, "bamboo": 85, "mixed": 80, "eucalyptus": 75,
        "teak": 60, "pine": 55, "neem": 50, "banyan": 45,
    }
    carbon_capture = carbon_capture_rates.get((project.plantation_type or "").lower(), 65)

    # Land restoration score based on area
    area = project.area_hectares or 0
    if area >= 1000:
        land_restoration = 90
    elif area >= 500:
        land_restoration = 80
    elif area >= 100:
        land_restoration = 70
    elif area >= 10:
        land_restoration = 60
    else:
        land_restoration = 40

    env_score = round(
        0.35 * biodiversity_impact +
        0.40 * carbon_capture +
        0.25 * land_restoration
    )
    # Penalize if eco_risk is high (unrealistic density lowers env trust)
    env_score = round(env_score * (1 - eco_risk * 0.3))
    env_score = max(10, min(99, env_score))

    return {
        "mrvScore": mrv_score,
        "fraudRisk": fraud_risk,
        "envScore": env_score,
        "gps": gps_data,
        "has_evidence": project.evidence_image is not None and os.path.isfile(project.evidence_image or ""),
        "breakdown": {
            "survival_rate": round(survival_rate, 1),
            "density_score": round(density_score, 1),
            "verification_quality": round(verification_quality, 1),
            "biodiversity_impact": biodiversity_impact,
            "carbon_capture": carbon_capture,
            "land_restoration": land_restoration,
            "geo_mismatch": round(geo_mismatch * 100, 1),
        },
    }


# ─────────────────────────────────────────────────────────────
# CREDIT CALCULATION (triggered on approval)
# ─────────────────────────────────────────────────────────────

def calculate_and_store_credits(project, db):
    """
    Calculate carbon credits for a project using real CO₂ sequestration rates.
    Called automatically when admin approves a project.

    Updates Project.credits, Project.shadow_credits, Project.price
    and creates ProjectCredits + FundingDetails entries.
    """
    try:
        # Get MRV/fraud/env scores (use stored values or recompute)
        mrv = project.mrv_score or 80.0
        fraud = project.fraud_risk or 20.0
        env = project.env_score or 80.0

        # Run the full credit calculation pipeline
        result = credit_calculator.process_project_from_data(
            project_id=project.project_id,
            plantation_type=project.plantation_type or "mixed",
            area_hectares=project.area_hectares or 1.0,
            number_of_trees=project.number_of_trees or 0,
            mrv_score=mrv,
            fraud_risk=fraud,
            env_score=env,
        )

        # Update project with calculated credits
        project.credits = result["live_credit_data"]["verified_credits"]
        project.shadow_credits = result["shadow_credits_first_5_years"]
        project.price = result["funding_data"]["price_per_ton"]

        # Remove existing credit/funding entries for this project (in case of re-approval)
        db.query(ProjectCredits).filter(ProjectCredits.project_id == project.project_id).delete()
        db.query(FundingDetails).filter(FundingDetails.project_id == project.project_id).delete()

        # Save ProjectCredits entry
        credit_entry = ProjectCredits(
            project_id=project.project_id,
            total_shadow_credits=result["shadow_credits_first_5_years"],
            verified_credits=result["live_credit_data"]["verified_credits"],
            certificate_id=result["live_credit_data"]["certificate_id"],
            issuance_date=result["live_credit_data"]["issuance_date"],
            expiry_date=result["live_credit_data"]["expiry_date"],
        )
        db.add(credit_entry)

        # Save FundingDetails entry
        funding_entry = FundingDetails(
            project_id=project.project_id,
            price_per_ton=result["funding_data"]["price_per_ton"],
            ecosystem_multiplier=result["funding_data"]["ecosystem_multiplier"],
            total_funding=result["funding_data"]["total_funding"],
        )
        db.add(funding_entry)

        db.commit()
        logger.info(
            "Credits calculated for %s: verified=%.2f shadow=%.2f price=$%.2f",
            project.project_id, project.credits, project.shadow_credits, project.price
        )

        return result

    except Exception as e:
        logger.exception("Credit calculation failed for project %s", project.project_id)
        db.rollback()
        return None


# -------------------------
# Generate Project ID
# -------------------------

def _map_payload_for_project(p: Project, ngo_name: str) -> Optional[dict]:
    """
    One map feature: GeoJSON polygon + areas. Skips rows without valid geometry.
    """
    poly, sqm, ha = wkt_to_geojson_and_area(p.polygon_wkt)
    if poly is None:
        return None
    return {
        "id": p.project_id,
        "name": p.name,
        "ngo_name": ngo_name,
        "polygon": poly,
        "area": {
            "sq_meters": sqm,
            "hectares": ha,
        },
        "status": (p.status or "pending").lower(),
    }


def generate_project_id(plantation_type):
    eco_map = {
        "bamboo": "BAM",
        "eucalyptus": "EUC",
        "teak": "TEK",
        "neem": "NEM",
        "mangrove": "MAN",
        "pine": "PIN",
        "banyan": "BAN",
        "mixed": "MIX",
        # Legacy
        "seagrass": "SEA",
        "salt_marsh": "SAL",
    }

    prefix = eco_map.get(plantation_type.lower(), "GEN")
    unique_part = str(uuid.uuid4())[:6].upper()

    return f"PRJ-{prefix}-{unique_part}"


# -------------------------
# Create Project API
# -------------------------

@router.post("/create-project")
async def create_project(
    project_name: str = Form(...),
    ngo_name: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    plantation_type: str = Form(...),
    area_hectares: float = Form(...),
    number_of_trees: int = Form(...),
    start_date: str = Form(...),
    polygon_wkt: str = Form(...),  # MANDATORY polygon of plantation area
    evidence_image: UploadFile = File(...)
):
    db = SessionLocal()
    try:
        # Validate polygon
        polygon_clean = polygon_wkt.strip()
        if not polygon_clean or "POLYGON" not in polygon_clean.upper():
            raise HTTPException(
                status_code=400,
                detail="polygon_wkt must be a valid WKT POLYGON, e.g. POLYGON((lon1 lat1, lon2 lat2, ...))"
            )

        # Find or create NGO
        ngo = db.query(NGO).filter(NGO.name == ngo_name).first()
        if not ngo:
            ngo = NGO(name=ngo_name)
            db.add(ngo)
            db.commit()
            db.refresh(ngo)

        # Generate Project ID
        project_id = generate_project_id(plantation_type)

        # Save Image — unique filename to prevent overwriting
        file_extension = evidence_image.filename.split(".")[-1]
        unique_suffix = str(uuid.uuid4())[:8]
        file_name = f"{project_id}_{unique_suffix}.{file_extension}"
        file_path = os.path.join(UPLOAD_FOLDER, file_name)

        with open(file_path, "wb") as buffer:
            content = await evidence_image.read()
            buffer.write(content)

        # Validate date
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        except:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        # Validate plantation type
        valid_types = ["bamboo", "eucalyptus", "teak", "neem", "mangrove", "pine", "banyan", "mixed"]
        pt = plantation_type.lower().strip()
        if pt not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid plantation_type. Must be one of: {', '.join(valid_types)}"
            )

        # Save to DB
        new_project = Project(
            project_id=project_id,
            ngo_id=ngo.id,
            name=project_name,
            latitude=latitude,
            longitude=longitude,
            area_hectares=area_hectares,
            plantation_type=pt,
            number_of_trees=number_of_trees,
            start_date=start_date_obj,
            evidence_image=file_path,
            polygon_wkt=polygon_clean,
            created_at=datetime.now().date()
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)

        # Compute fraud scores and store them (pass db for overlap check)
        scores = compute_project_scores(new_project, db)
        new_project.mrv_score = scores["mrvScore"]
        new_project.fraud_risk = scores["fraudRisk"]
        new_project.env_score = scores["envScore"]
        db.commit()

        # Also try running the full fraud detection module if available
        fraud_result = None
        try:
            from fraud_detection_new.app.services.fraud_service import run_fraud_detection
            fraud_result = run_fraud_detection(project_id, polygon_clean, file_path)
            logger.info("Full fraud detection result: %s", fraud_result)
        except Exception as e:
            logger.debug("Full fraud detection not available: %s", e)

        # Response
        return {
            "project_id": project_id,
            "project_name": project_name,
            "ngo_name": ngo_name,
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "plantation_type": pt,
            "area_hectares": area_hectares,
            "number_of_trees": number_of_trees,
            "start_date": start_date,
            "polygon_wkt": polygon_clean,
            "status": "pending",
            "mrvScore": scores["mrvScore"],
            "fraudRisk": scores["fraudRisk"],
            "envScore": scores["envScore"],
            "fraud_detection": fraud_result,
            "message": "Project submitted successfully. Awaiting admin approval."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# -------------------------
# List Projects for NGO
# -------------------------

@router.get("/projects")
def get_projects(ngo_id: int):
    db = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.ngo_id == ngo_id).all()
        result = []
        for p in projects:
            # Get credits if available
            credits_entry = db.query(ProjectCredits).filter(ProjectCredits.project_id == p.project_id).first()
            credits = credits_entry.verified_credits if credits_entry else p.credits or 0
            shadow = credits_entry.total_shadow_credits if credits_entry else p.shadow_credits or 0
            # Get funding
            funding_entry = db.query(FundingDetails).filter(FundingDetails.project_id == p.project_id).first()
            price = funding_entry.price_per_ton if funding_entry else p.price or 0
            total_funding = funding_entry.total_funding if funding_entry else 0
            # Use stored scores
            mrv = p.mrv_score
            fraud = p.fraud_risk
            env = p.env_score
            # Build evidence image URL
            img_url = None
            if p.evidence_image and os.path.isfile(p.evidence_image):
                img_url = "/uploads/" + os.path.basename(p.evidence_image)
            pgj, psqm, pha = wkt_to_geojson_and_area(p.polygon_wkt)
            result.append({
                "project_id": p.project_id,
                "name": p.name,
                "location": f"{p.latitude}, {p.longitude}",
                "latitude": p.latitude,
                "longitude": p.longitude,
                "area_hectares": p.area_hectares,
                "plantation_type": p.plantation_type,
                "number_of_trees": p.number_of_trees,
                "status": p.status,
                "credits": credits,
                "shadow_credits": shadow,
                "price_per_ton": price,
                "total_funding": total_funding,
                "mrvScore": mrv,
                "fraudRisk": fraud,
                "envScore": env,
                "evidence_image": img_url,
                "polygon_wkt": p.polygon_wkt,
                "polygon": pgj,
                "polygon_area_sq_meters": psqm,
                "polygon_area_hectares": pha,
            })
        return result
    finally:
        db.close()


# -------------------------
# NGO Dashboard Summary
# -------------------------

@router.get("/dashboard/{ngo_id}")
def get_dashboard(ngo_id: int):
    db = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.ngo_id == ngo_id).all()
        approved_projects = [p for p in projects if p.status == "approved"]
        total_credits = sum(p.credits or 0 for p in approved_projects)
        total_shadow = sum(p.shadow_credits or 0 for p in approved_projects)
        total_funds = 0
        corporates = set()
        for p in approved_projects:
            funding_entry = db.query(FundingDetails).filter(FundingDetails.project_id == p.project_id).first()
            if funding_entry:
                total_funds += funding_entry.total_funding
        # Get corporate buyers
        from credit_calculation.credits_module.db_models import CorporateRequest
        for p in approved_projects:
            reqs = db.query(CorporateRequest).filter(
                CorporateRequest.project_id == p.project_id,
                CorporateRequest.status == "accepted"
            ).all()
            for r in reqs:
                corporates.add(r.corporate_name)

        return {
            "total_projects": len(projects),
            "active_projects": len(approved_projects),
            "total_credits": round(total_credits, 2),
            "total_shadow_credits": round(total_shadow, 2),
            "total_funding": round(total_funds, 2),
            "corporates_involved": list(corporates)
        }
    finally:
        db.close()


# -------------------------
# Update Project Status (Admin) — AUTO-CALCULATES CREDITS ON APPROVAL
# -------------------------

@router.patch("/projects/{project_id}/status")
def update_project_status(project_id: str, status: str):
    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        project.status = status
        db.commit()

        credit_result = None

        # If approved, auto-calculate credits
        if status == "approved":
            credit_result = calculate_and_store_credits(project, db)
            db.refresh(project)

        # Build response with updated data
        credits_entry = db.query(ProjectCredits).filter(ProjectCredits.project_id == project.project_id).first()
        funding_entry = db.query(FundingDetails).filter(FundingDetails.project_id == project.project_id).first()

        return {
            "message": f"Project status updated to {status}",
            "project_id": project.project_id,
            "status": status,
            "credits": project.credits or 0,
            "shadow_credits": project.shadow_credits or 0,
            "price_per_ton": project.price or 0,
            "total_funding": funding_entry.total_funding if funding_entry else 0,
            "certificate_id": credits_entry.certificate_id if credits_entry else None,
            "credit_calculation": credit_result,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# -------------------------
# All Projects (Admin)
# -------------------------

@router.get("/all-projects")
def get_all_projects():
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        result = []
        for p in projects:
            credits_entry = db.query(ProjectCredits).filter(ProjectCredits.project_id == p.project_id).first()
            credits = credits_entry.verified_credits if credits_entry else p.credits or 0
            shadow = credits_entry.total_shadow_credits if credits_entry else p.shadow_credits or 0
            funding_entry = db.query(FundingDetails).filter(FundingDetails.project_id == p.project_id).first()
            price = funding_entry.price_per_ton if funding_entry else p.price or 0
            total_funding = funding_entry.total_funding if funding_entry else 0
            ngo = db.query(NGO).filter(NGO.id == p.ngo_id).first()
            # Use stored scores
            mrv = p.mrv_score
            fraud = p.fraud_risk
            env = p.env_score
            # Build evidence image URL
            img_url = None
            if p.evidence_image and os.path.isfile(p.evidence_image):
                img_url = "/uploads/" + os.path.basename(p.evidence_image)
            pgj, psqm, pha = wkt_to_geojson_and_area(p.polygon_wkt)
            result.append({
                "project_id": p.project_id,
                "name": p.name,
                "ngo": ngo.name if ngo else "Unknown",
                "location": f"{p.latitude}, {p.longitude}",
                "lat": p.latitude,
                "lng": p.longitude,
                "area_hectares": p.area_hectares,
                "plantation_type": p.plantation_type,
                "number_of_trees": p.number_of_trees,
                "status": p.status,
                "credits": credits,
                "shadow_credits": shadow,
                "price_per_ton": price,
                "total_funding": total_funding,
                "start_date": str(p.start_date) if p.start_date else None,
                "created_at": str(p.created_at) if p.created_at else None,
                "mrvScore": mrv,
                "fraudRisk": fraud,
                "envScore": env,
                "evidence_image": img_url,
                "polygon_wkt": p.polygon_wkt,
                "polygon": pgj,
                "polygon_area_sq_meters": psqm,
                "polygon_area_hectares": pha,
            })
        return result
    finally:
        db.close()


# -------------------------
# Map: approved polygons (public / corporate) or per-NGO footprints
# -------------------------


@router.get("/map")
def get_projects_map(ngo_id: Optional[int] = None):
    """
    Approved projects with valid polygons (global). If ngo_id is set, returns all
    projects for that NGO (any status) so the NGO dashboard can show pending footprints too.
    """
    db = SessionLocal()
    try:
        q = db.query(Project)
        if ngo_id is not None:
            q = q.filter(Project.ngo_id == ngo_id)
        else:
            q = q.filter(Project.status == "approved")
        rows: List[Project] = q.all()
        out = []
        for p in rows:
            ngo = db.query(NGO).filter(NGO.id == p.ngo_id).first()
            ngo_name = ngo.name if ngo else "Unknown"
            item = _map_payload_for_project(p, ngo_name)
            if item:
                out.append(item)
        return {"projects": out}
    finally:
        db.close()


# -------------------------
# Map: pending only (admin queue)
# -------------------------


@router.get("/pending")
def get_projects_pending_map():
    """Pending projects with polygons — for admin map overlay (yellow styling on client)."""
    db = SessionLocal()
    try:
        rows = db.query(Project).filter(Project.status == "pending").all()
        out = []
        for p in rows:
            ngo = db.query(NGO).filter(NGO.id == p.ngo_id).first()
            ngo_name = ngo.name if ngo else "Unknown"
            item = _map_payload_for_project(p, ngo_name)
            if item:
                out.append(item)
        return {"projects": out}
    finally:
        db.close()