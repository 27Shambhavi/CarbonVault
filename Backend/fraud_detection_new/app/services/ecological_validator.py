# app/services/ecological_validator.py
import logging
from sqlalchemy import text
from ..db.database import SessionLocal
from credit_calculation.credits_module.db_models import Project as UnifiedProject

logger = logging.getLogger(__name__)

# Max realistic tree density per hectare for each plant type
PLANT_DENSITY_LIMITS = {
    "mangrove":   4000,
    "mangroves":  4000,
    "seagrass":   6000,
    "seagrasses": 6000,
    "salt_marsh": 3000,
    "bamboo":     2500,
    "eucalyptus": 1600,
    "teak":       1000,
    "neem":       800,
    "pine":       1500,
    "banyan":     200,
    "mixed":      1200,
    "default":    2000,
}


def ecological_risk_check(project_id: str) -> dict:
    """
    Checks whether the declared tree density is ecologically plausible.
    Returns dict with plant_type, tree_density, and ecological_risk (0-1).
    """
    db = SessionLocal()
    try:
        # Check unified project model first
        project = db.query(UnifiedProject).filter(
            (UnifiedProject.project_id == project_id) | (UnifiedProject.id == project_id if str(project_id).isdigit() else False)
        ).first()

        if project:
            num_trees = project.number_of_trees
            area = project.area_hectares
            plant_type = project.plantation_type
        else:
            # Fallback raw query
            try:
                query = text("""
                    SELECT num_trees, area_hectare, plant_type
                    FROM projects
                    WHERE id = :project_id
                """)
                res = db.execute(query, {"project_id": project_id}).fetchone()
                if res:
                    num_trees, area, plant_type = res
                else:
                    return {"ecological_risk": 0.0, "message": "Project not found"}
            except Exception:
                return {"ecological_risk": 0.0, "message": "Project not found"}

        if not area or area <= 0:
            return {
                "ecological_risk": 0.8,
                "message": "Invalid area (zero or null)",
            }

        if not num_trees or num_trees < 0:
            return {
                "ecological_risk": 0.3,
                "message": "Invalid number of trees value",
            }

        density = num_trees / area
        plant_key = (plant_type or "").lower().strip()
        max_density = PLANT_DENSITY_LIMITS.get(plant_key, PLANT_DENSITY_LIMITS["default"])

        if density > max_density * 1.5:
            risk = 0.9
            message = f"Tree density ({density:.0f}/ha) far exceeds ecological maximum ({max_density}/ha)"
        elif density > max_density:
            risk = 0.4
            message = f"Tree density ({density:.0f}/ha) exceeds recommended maximum ({max_density}/ha)"
        else:
            risk = 0.0
            message = f"Tree density ({density:.0f}/ha) is within expected range"

        return {
            "plant_type": plant_type,
            "tree_density": round(density, 2),
            "max_recommended_density": max_density,
            "ecological_risk": risk,
            "message": message,
        }

    except Exception as e:
        logger.exception("ecological_risk_check failed")
        return {"ecological_risk": 0.0, "error": str(e)}

    finally:
        db.close()