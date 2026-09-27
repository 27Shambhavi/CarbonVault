# app/services/ecological_validator.py
import logging
from sqlalchemy import text
from ..db.database import SessionLocal

logger = logging.getLogger(__name__)

# Max realistic tree density per hectare for each plant type
PLANT_DENSITY_LIMITS = {
    "mangroves":  4000,
    "seagrasses": 6000,
    "salt_marsh": 3000,
    "default":    3000,
}


def ecological_risk_check(project_id: str) -> dict:
    """
    Checks whether the declared tree density is ecologically plausible.
    Returns dict with plant_type, tree_density, and ecological_risk (0-1).
    """
    db = SessionLocal()
    try:
        query = text("""
            SELECT num_trees, area_hectare, plant_type
            FROM projects
            WHERE id = :project_id
        """)
        result = db.execute(query, {"project_id": project_id}).fetchone()

        if not result:
            return {"ecological_risk": 0.0, "message": "Project not found"}

        num_trees, area, plant_type = result

        if not area or area <= 0:
            return {
                "ecological_risk": 1.0,
                "message": "Invalid area (zero or null)",
            }

        if not num_trees or num_trees < 0:
            return {
                "ecological_risk": 0.5,
                "message": "Invalid num_trees value",
            }

        density = num_trees / area
        plant_key = (plant_type or "").lower().strip()
        max_density = PLANT_DENSITY_LIMITS.get(plant_key, PLANT_DENSITY_LIMITS["default"])

        if density > max_density * 1.5:
            risk = 0.9
            message = "Tree density far exceeds ecological maximum"
        elif density > max_density:
            risk = 0.4
            message = "Tree density exceeds recommended maximum"
        else:
            risk = 0.0
            message = "Tree density within expected range"

        return {
            "plant_type": plant_type,
            "tree_density": round(density, 2),
            "max_allowed_density": max_density,
            "ecological_risk": risk,
            "message": message,
        }

    except Exception as e:
        logger.exception("ecological_risk_check failed for project %s", project_id)
        return {"ecological_risk": 0.0, "error": str(e)}

    finally:
        db.close()