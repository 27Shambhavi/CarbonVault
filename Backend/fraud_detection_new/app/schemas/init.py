"""
SurrealDB schema definitions.

Run this once at startup or via `python -m app.db.schema_init`
to ensure all tables and indexes exist.

SurrealDB is schemaless by default, but we define explicit fields
using DEFINE TABLE / DEFINE FIELD for type safety and indexing.
"""

SCHEMA_STATEMENTS = [

    # ------------------------------------------------------------------
    # projects
    # ------------------------------------------------------------------
    """
    DEFINE TABLE projects SCHEMAFULL;
    """,
    """
    DEFINE FIELD ngo_id          ON projects TYPE string;
    """,
    """
    DEFINE FIELD area_hectare    ON projects TYPE float;
    """,
    """
    DEFINE FIELD plantation_date ON projects TYPE datetime;
    """,
    """
    DEFINE FIELD plant_type      ON projects TYPE string;
    """,
    """
    DEFINE FIELD num_trees       ON projects TYPE float;
    """,
    # Polygon stored as GeoJSON polygon string; SurrealDB supports
    # geometry types natively — store as object for ST-style checks.
    """
    DEFINE FIELD land_geojson    ON projects TYPE string;
    """,
    # Bounding box corners for lightweight overlap pre-filter
    """
    DEFINE FIELD bbox_min_lat    ON projects TYPE float;
    """,
    """
    DEFINE FIELD bbox_min_lon    ON projects TYPE float;
    """,
    """
    DEFINE FIELD bbox_max_lat    ON projects TYPE float;
    """,
    """
    DEFINE FIELD bbox_max_lon    ON projects TYPE float;
    """,

    # ------------------------------------------------------------------
    # spatial_conflicts
    # ------------------------------------------------------------------
    """
    DEFINE TABLE spatial_conflicts SCHEMAFULL;
    """,
    """
    DEFINE FIELD project_id          ON spatial_conflicts TYPE string;
    """,
    """
    DEFINE FIELD conflict_project_id ON spatial_conflicts TYPE string;
    """,
    """
    DEFINE FIELD overlap_ratio       ON spatial_conflicts TYPE float;
    """,
    """
    DEFINE FIELD created_at          ON spatial_conflicts TYPE datetime
                                      VALUE $before OR time::now();
    """,

    # ------------------------------------------------------------------
    # ndvi_records
    # ------------------------------------------------------------------
    """
    DEFINE TABLE ndvi_records SCHEMAFULL;
    """,
    """
    DEFINE FIELD project_id        ON ndvi_records TYPE string;
    """,
    """
    DEFINE FIELD observation_date  ON ndvi_records TYPE datetime;
    """,
    """
    DEFINE FIELD avg_ndvi          ON ndvi_records TYPE float;
    """,
    """
    DEFINE FIELD created_at        ON ndvi_records TYPE datetime
                                    VALUE $before OR time::now();
    """,

    # ------------------------------------------------------------------
    # media_records  (stores perceptual hashes for duplicate detection)
    # ------------------------------------------------------------------
    """
    DEFINE TABLE media_records SCHEMAFULL;
    """,
    """
    DEFINE FIELD project_id  ON media_records TYPE string;
    """,
    """
    DEFINE FIELD file_hash   ON media_records TYPE string;
    """,
    """
    DEFINE FIELD created_at  ON media_records TYPE datetime
                              VALUE $before OR time::now();
    """,

    # ------------------------------------------------------------------
    # Indexes for common lookups
    # ------------------------------------------------------------------
    """
    DEFINE INDEX idx_ndvi_project    ON ndvi_records    FIELDS project_id;
    """,
    """
    DEFINE INDEX idx_media_project   ON media_records   FIELDS project_id;
    """,
    """
    DEFINE INDEX idx_conflict_proj   ON spatial_conflicts FIELDS project_id;
    """,
]


async def init_schema():
    """Call this once on application startup."""
    from app.db.database import get_db
    db = await get_db()
    try:
        for stmt in SCHEMA_STATEMENTS:
            await db.query(stmt.strip())
        print("[schema] SurrealDB schema initialised successfully.")
    finally:
        await db.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_schema())