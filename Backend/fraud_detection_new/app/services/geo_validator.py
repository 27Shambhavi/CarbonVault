# app/services/geo_validator.py
import logging
from ..db.database import SessionLocal
from ..db.spatial_queries import calculate_overlap, record_spatial_conflict

logger = logging.getLogger(__name__)


def spatial_risk_check(polygon_wkt: str, project_id=None) -> dict:
    """
    Checks whether the given polygon overlaps with any existing project land.

    Args:
        polygon_wkt:  WKT string, e.g. 'POLYGON((lon lat, ...))'
        project_id:   UUID of the project being checked (may be None for new projects)

    Returns dict with overlap_ratio and spatial_risk (0-1).
    """
    db = SessionLocal()
    try:
        overlaps = calculate_overlap(db, polygon_wkt)

        if not overlaps:
            return {"overlap_ratio": 0.0, "spatial_risk": 0.0, "conflicts": []}

        # Find the worst (maximum) overlap
        max_row = max(overlaps, key=lambda x: x[1] if x[1] is not None else 0)
        conflict_project_id = max_row[0]
        max_overlap = float(max_row[1]) if max_row[1] is not None else 0.0

        if max_overlap > 0.2:
            risk = 0.9
        elif max_overlap > 0.05:
            risk = 0.4
        else:
            risk = 0.0

        # Only record if significant overlap
        if max_overlap > 0.05:
            record_spatial_conflict(
                db,
                project_id=project_id,
                conflict_project_id=conflict_project_id,
                overlap_ratio=max_overlap,
            )

        all_conflicts = [
            {"conflict_project_id": str(row[0]), "overlap_ratio": float(row[1] or 0)}
            for row in overlaps
            if (row[1] or 0) > 0.05
        ]

        return {
            "overlap_ratio": round(max_overlap, 4),
            "spatial_risk": risk,
            "conflicts": all_conflicts,
        }

    except Exception as e:
        logger.exception("spatial_risk_check failed")
        return {"overlap_ratio": 0.0, "spatial_risk": 0.0, "error": str(e)}

    finally:
        db.close()