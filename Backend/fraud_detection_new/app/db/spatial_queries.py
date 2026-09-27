# app/db/spatial_queries.py
from sqlalchemy import text


def calculate_overlap(session, polygon_wkt: str):
    """
    Returns rows of (project_id, overlap_ratio) for all projects
    whose land polygon intersects the given WKT polygon.

    Uses ST_Intersects + ratio calculation via ST_Intersection.
    Geography type is used throughout — ST_Area on geography returns m².
    """
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


def record_spatial_conflict(session, project_id, conflict_project_id, overlap_ratio: float):
    """
    Inserts a row into spatial_conflicts.
    project_id may be NULL (new project not yet persisted).
    """
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