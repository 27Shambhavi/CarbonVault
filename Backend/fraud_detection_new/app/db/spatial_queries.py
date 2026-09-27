# app/db/spatial_queries.py
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def calculate_overlap(session, polygon_wkt: str, project_id=None):
    """
    Returns rows of (conflict_project_id, overlap_ratio) for all projects
    whose land polygon intersects the given WKT polygon.

    Tries PostGIS first if supported; falls back to Shapely geometric calculation.
    """
    if not polygon_wkt or "POLYGON" not in polygon_wkt.upper():
        return []

    # 1. Try PostGIS query if database supports it
    try:
        query = text("""
            SELECT
                id,
                ST_Area(ST_Intersection(
                    land::geometry,
                    ST_GeomFromText(:polygon, 4326)
                )) /
                NULLIF(ST_Area(ST_GeomFromText(:polygon, 4326)), 0) AS overlap_ratio
            FROM projects
            WHERE ST_Intersects(
                land,
                ST_GeogFromText(:polygon)
            );
        """)
        result = session.execute(query, {"polygon": polygon_wkt})
        return result.fetchall()
    except Exception as e:
        logger.debug("PostGIS overlap query not available (%s), using Shapely fallback", e)

    # 2. Shapely fallback using the unified Project table
    try:
        from shapely.wkt import loads as shapely_loads
        from credit_calculation.credits_module.db_models import Project as UnifiedProject

        new_poly = shapely_loads(polygon_wkt.strip())
        if not new_poly.is_valid:
            new_poly = new_poly.buffer(0)

        existing = session.query(UnifiedProject).all()
        results = []

        for p in existing:
            if project_id and (p.project_id == project_id or str(p.id) == str(project_id)):
                continue
            if not p.polygon_wkt or "POLYGON" not in p.polygon_wkt.upper():
                continue
            try:
                ex_poly = shapely_loads(p.polygon_wkt.strip())
                if not ex_poly.is_valid:
                    ex_poly = ex_poly.buffer(0)
                intersection = new_poly.intersection(ex_poly)
                if new_poly.area > 0 and intersection.area > 0:
                    ratio = float(intersection.area / new_poly.area)
                    if ratio > 0.001:
                        results.append((p.project_id or str(p.id), ratio))
            except Exception:
                continue

        return results
    except Exception as e:
        logger.warning("Shapely overlap fallback calculation failed: %s", e)
        return []


def record_spatial_conflict(session, project_id, conflict_project_id, overlap_ratio: float):
    """
    Inserts a row into spatial_conflicts if table exists, otherwise logs conflict.
    """
    try:
        query = text("""
            INSERT INTO spatial_conflicts
                (id, project_id, conflict_project_id, overlap_ratio, created_at)
            VALUES
                (gen_random_uuid(), :project_id, :conflict_project_id, :overlap_ratio, NOW())
        """)
        session.execute(query, {
            "project_id": str(project_id) if project_id else None,
            "conflict_project_id": str(conflict_project_id),
            "overlap_ratio": overlap_ratio,
        })
        session.commit()
    except Exception as e:
        session.rollback()
        logger.debug("Could not record spatial conflict row: %s", e)