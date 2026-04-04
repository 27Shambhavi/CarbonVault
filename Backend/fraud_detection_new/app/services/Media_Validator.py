# app/services/Media_Validator.py
"""
Media validation: GPS geo-check, duplicate detection, and image integrity.

Key fixes applied:
  - Relative imports for package compatibility
  - Structured output with media_risk, message, gps fields
  - Logging for debugging
"""
import logging
from sqlalchemy import text

from ..db.database import SessionLocal
from ..utils.image_hash import compute_image_hash, hashes_are_similar
from ..utils.exif_utils import extract_lat_lon

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# GEO CHECK: Is the photo taken inside the project area?
# ─────────────────────────────────────────────

def media_geo_risk_check(project_id: str, image_path: str) -> dict:
    """
    Checks whether the GPS location embedded in the image lies
    inside the project's registered land polygon.

    Returns dict with media_risk (0-1), message, and gps location.
    """
    db = SessionLocal()
    try:
        # 1. Extract GPS from image EXIF
        lat, lon = extract_lat_lon(image_path)

        if lat is None:
            logger.warning("No GPS data in image: %s", image_path)
            return {
                "media_risk": 0.5,
                "message": "No GPS data found in image",
                "gps": None,
            }

        logger.info("Image GPS: lat=%.6f, lon=%.6f", lat, lon)

        # 2. Check if point is inside the project polygon.
        #    Cast geography -> geometry for ST_Contains.
        check_query = text("""
            SELECT ST_Contains(
                land::geometry,
                ST_SetSRID(ST_Point(:lon, :lat), 4326)
            )
            FROM projects
            WHERE id = :project_id
        """)

        row = db.execute(check_query, {
            "project_id": project_id,
            "lat": lat,
            "lon": lon,
        }).fetchone()

        if not row:
            return {
                "media_risk": 0.0,
                "message": "Project not found",
                "gps": {"lat": lat, "lon": lon},
            }

        inside = bool(row[0])
        risk = 0.0 if inside else 0.9

        logger.info("Image %s project area (risk=%.1f)", "INSIDE" if inside else "OUTSIDE", risk)

        return {
            "media_risk": risk,
            "message": "Image within project area" if inside else "Image OUTSIDE project area",
            "gps": {"lat": lat, "lon": lon},
            "inside_project_area": inside,
        }

    except Exception as e:
        logger.exception("media_geo_risk_check failed for project %s", project_id)
        return {"media_risk": 0.0, "error": str(e), "gps": None}

    finally:
        db.close()


# ─────────────────────────────────────────────
# STORE: Save image hash for a project
# ─────────────────────────────────────────────

def store_media(project_id: str, image_path: str) -> dict:
    """
    Computes the perceptual hash of an image and stores it in media_records.
    Call this when a new image is uploaded for a project.
    """
    db = SessionLocal()
    try:
        file_hash = compute_image_hash(image_path)

        query = text("""
            INSERT INTO media_records (id, project_id, file_hash, created_at)
            VALUES (gen_random_uuid(), :project_id, :file_hash, NOW())
        """)
        db.execute(query, {"project_id": project_id, "file_hash": file_hash})
        db.commit()

        return {"message": "Image stored successfully", "file_hash": file_hash}

    except Exception as e:
        db.rollback()
        logger.exception("store_media failed")
        return {"error": str(e)}

    finally:
        db.close()


# ─────────────────────────────────────────────
# DUPLICATE CHECK: Detect reused/duplicate images
# ─────────────────────────────────────────────

def media_risk_check(project_id: str) -> dict:
    """
    Checks whether any images uploaded for this project are duplicates
    (identical or perceptually similar pHash).
    """
    db = SessionLocal()
    try:
        query = text("""
            SELECT file_hash
            FROM media_records
            WHERE project_id = :project_id
        """)
        results = db.execute(query, {"project_id": project_id}).fetchall()

        if not results:
            return {"media_risk": 0.0, "message": "No images uploaded"}

        hashes = [row[0] for row in results]
        duplicates = 0

        for i in range(len(hashes)):
            for j in range(i + 1, len(hashes)):
                if hashes_are_similar(hashes[i], hashes[j], threshold=10):
                    duplicates += 1

        risk = 0.7 if duplicates > 0 else 0.0

        return {
            "media_risk": risk,
            "duplicate_images": duplicates,
            "total_images": len(hashes),
        }

    except Exception as e:
        logger.exception("media_risk_check failed")
        return {"media_risk": 0.0, "error": str(e)}

    finally:
        db.close()