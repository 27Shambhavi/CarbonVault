"""
Geospatial helpers: WKT → GeoJSON, geodesic area (WGS84) for plantation polygons.
Used by map APIs and admin project payloads. Polygons remain stored as WKT on Project.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from pyproj import Geod
    from shapely import wkt as shapely_wkt
    from shapely.geometry import mapping, shape
    from shapely.ops import orient

    _GEOD = Geod(ellps="WGS84")
    _HAS_GEO = True
except ImportError as e:  # pragma: no cover
    logger.warning("geo_utils: shapely/pyproj not available: %s", e)
    _GEOD = None
    _HAS_GEO = False


def parse_polygon_from_wkt(wkt_str: Optional[str]):
    """Return a Shapely geometry (Polygon or MultiPolygon) or None."""
    if not _HAS_GEO or not wkt_str or not isinstance(wkt_str, str):
        return None
    s = wkt_str.strip()
    if "POLYGON" not in s.upper():
        return None
    try:
        g = shapely_wkt.loads(s)
        if g.is_empty:
            return None
        if g.geom_type not in ("Polygon", "MultiPolygon"):
            return None
        if not g.is_valid:
            g = g.buffer(0)
        return g
    except Exception as ex:
        logger.debug("WKT parse failed: %s", ex)
        return None


def geometry_to_geojson(g) -> Optional[Dict[str, Any]]:
    if g is None:
        return None
    try:
        return mapping(g)
    except Exception:
        return None


def geodesic_area_sqm_hectares(g) -> Tuple[Optional[float], Optional[float]]:
    """
    Ellipsoidal area in m² and hectares (absolute value).
    """
    if not _HAS_GEO or g is None:
        return None, None
    try:
        oriented = orient(g, sign=1.0)
        sqm, _perim = _GEOD.geometry_area_perimeter(oriented)
        sqm = abs(float(sqm))
        ha = sqm / 10000.0
        return round(sqm, 2), round(ha, 4)
    except Exception as ex:
        logger.debug("geodesic area failed: %s", ex)
        return None, None


def wkt_to_geojson_and_area(
    wkt_str: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[float], Optional[float]]:
    """From DB WKT: GeoJSON geometry dict, area_sqm, area_hectares."""
    g = parse_polygon_from_wkt(wkt_str)
    if g is None:
        return None, None, None
    gj = geometry_to_geojson(g)
    sqm, ha = geodesic_area_sqm_hectares(g)
    return gj, sqm, ha


def geojson_dict_to_area(geojson_geom: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """Compute geodesic area from a GeoJSON geometry dict (e.g. for validation)."""
    if not _HAS_GEO or not geojson_geom:
        return None, None
    try:
        g = shape(geojson_geom)
        return geodesic_area_sqm_hectares(g)
    except Exception:
        return None, None
