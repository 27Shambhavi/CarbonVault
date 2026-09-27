# app/services/Media_Validator.py
"""
Media validation: GPS geo-check, duplicate detection, and image integrity.
Works across PostgreSQL + PostGIS and SQLite with Shapely.
"""
import os
import logging
from sqlalchemy import text
from pathlib import Path

from ..db.database import SessionLocal
from ..utils.image_hash import compute_image_hash, hashes_are_similar
from ..utils.exif_utils import extract_lat_lon
from credit_calculation.credits_module.db_models import Project as UnifiedProject

logger = logging.getLogger(__name__)


def _resolve_image_path(image_path: str) -> str:
    """Resolve image path to an absolute path if given relative."""
    if not image_path:
        return ""
    p = Path(image_path)
    if p.is_file():
        return str(p.resolve())
    
    # Try resolving in Backend/uploads
    backend_uploads = Path(__file__).resolve().parent.parent.parent / "uploads" / p.name
    if backend_uploads.is_file():
        return str(backend_uploads.resolve())

    return image_path


# ─────────────────────────────────────────────
# GEO CHECK: Is the photo taken inside the project area?
# ─────────────────────────────────────────────

def media_geo_risk_check(project_id: str, image_path: str) -> dict:
    """
    Checks whether the GPS location embedded in the image lies
    inside the project's registered land polygon or close to project coordinates.

    Returns dict with media_risk (0-1), message, and gps location.
    """
    resolved_path = _resolve_image_path(image_path)
    db = SessionLocal()
    try:
        # 1. Extract GPS from image EXIF
        lat, lon = extract_lat_lon(resolved_path)

        if lat is None:
            logger.info("No GPS EXIF in image: %s (using safe risk assessment)", resolved_path)
            return {
                "media_risk": 0.25,
                "message": "No GPS metadata found in image (moderate risk)",
                "gps": None,
                "inside_project_area": None,
            }

        logger.info("Image GPS: lat=%.6f, lon=%.6f", lat, lon)

        # 2. Find project in unified table
        project = db.query(UnifiedProject).filter(
            (UnifiedProject.project_id == project_id) | (UnifiedProject.id == project_id if str(project_id).isdigit() else False)
        ).first()

        inside = False
        dist_km = None

        if project and project.polygon_wkt and "POLYGON" in project.polygon_wkt.upper():
            try:
                from shapely.wkt import loads as shapely_loads
                from shapely.geometry import Point
                poly = shapely_loads(project.polygon_wkt.strip())
                if not poly.is_valid:
                    poly = poly.buffer(0)
                pt = Point(lon, lat)
                inside = poly.contains(pt) or poly.touches(pt)
            except Exception as e:
                logger.debug("Shapely point-in-polygon failed: %s", e)

        # Also check proximity to project lat/long if available
        if project and project.latitude and project.longitude:
            # Approximate Euclidean distance in degrees
            deg_dist = ((lat - project.latitude)**2 + (lon - project.longitude)**2)**0.5
            dist_km = deg_dist * 111.32
            if not inside and dist_km < 5.0:
                inside = True  # Within 5km buffer of project coordinates

        if inside:
            risk = 0.05
            msg = "Image coordinates verified within project boundary"
        elif dist_km is not None and dist_km < 25.0:
            risk = 0.35
            msg = f"Image coordinates near project area ({dist_km:.1f} km away)"
        else:
            risk = 0.85
            msg = "Image coordinates lie OUTSIDE registered project boundary"

        return {
            "media_risk": risk,
            "message": msg,
            "gps": {"lat": lat, "lon": lon},
            "inside_project_area": inside,
            "distance_km": round(dist_km, 2) if dist_km is not None else None,
        }

    except Exception as e:
        logger.exception("media_geo_risk_check failed for project %s", project_id)
        return {"media_risk": 0.2, "error": str(e), "gps": None}

    finally:
        db.close()


# ─────────────────────────────────────────────
# STORE: Save image hash for a project
# ─────────────────────────────────────────────

def store_media(project_id: str, image_path: str) -> dict:
    """Computes perceptual hash of an image."""
    try:
        resolved = _resolve_image_path(image_path)
        file_hash = compute_image_hash(resolved)
        return {"message": "Image hashed successfully", "file_hash": file_hash}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# DUPLICATE CHECK: Detect reused/duplicate images
# ─────────────────────────────────────────────

def media_risk_check(project_id: str) -> dict:
    """Checks whether images are duplicates across projects."""
    db = SessionLocal()
    try:
        project = db.query(UnifiedProject).filter(
            (UnifiedProject.project_id == project_id) | (UnifiedProject.id == project_id if str(project_id).isdigit() else False)
        ).first()

        if not project or not project.evidence_image:
            return {"media_risk": 0.0, "message": "No evidence image to check"}

        img_path = _resolve_image_path(project.evidence_image)
        if not os.path.isfile(img_path):
            return {"media_risk": 0.1, "message": "Evidence image file not located"}

        current_hash = compute_image_hash(img_path)
        all_projects = db.query(UnifiedProject).filter(UnifiedProject.project_id != project.project_id).all()
        duplicates = 0

        for other in all_projects:
            if other.evidence_image:
                other_path = _resolve_image_path(other.evidence_image)
                if os.path.isfile(other_path):
                    try:
                        other_hash = compute_image_hash(other_path)
                        if hashes_are_similar(current_hash, other_hash, threshold=8):
                            duplicates += 1
                    except Exception:
                        pass

        risk = 0.85 if duplicates > 0 else 0.05
        return {
            "media_risk": risk,
            "duplicate_images": duplicates,
            "file_hash": current_hash,
            "message": f"Found {duplicates} duplicate images across projects" if duplicates else "Unique image verified",
        }
    except Exception as e:
        logger.exception("media_risk_check failed")
        return {"media_risk": 0.0, "error": str(e)}
    finally:
        db.close()