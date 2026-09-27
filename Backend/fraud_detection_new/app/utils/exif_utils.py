# app/utils/exif_utils.py
"""
Extract GPS coordinates from image EXIF metadata.

Key fixes applied:
  - Uses public image.getexif() API instead of deprecated _getexif()
  - Handles modern Pillow IFDRational and legacy tuple formats
  - Falls back to exifread library for broader format support
  - Validates coordinate ranges
  - Comprehensive error logging
"""
import logging
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

logger = logging.getLogger(__name__)


def _get_gps_from_pillow(image_path: str) -> dict | None:
    """
    Extract GPS tags using Pillow's public getexif() API.
    Handles both modern IFDRational and legacy tuple-of-fractions formats.
    """
    try:
        image = Image.open(image_path)
    except Exception as e:
        logger.error("Cannot open image %s: %s", image_path, e)
        return None

    # ── Method 1: Modern Pillow (>= 8.x) — use get_ifd() ──────────
    try:
        exif = image.getexif()
        if exif:
            # GPSInfo tag id is 0x8825 = 34853
            gps_ifd = exif.get_ifd(34853)
            if gps_ifd:
                gps_data = {GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
                if "GPSLatitude" in gps_data and "GPSLongitude" in gps_data:
                    logger.debug("GPS found via getexif().get_ifd(): %s", gps_data)
                    return gps_data
    except Exception as e:
        logger.debug("get_ifd approach failed: %s", e)

    # ── Method 2: Legacy Pillow — iterate _getexif() tags ──────────
    try:
        exif_data = image._getexif()
        if exif_data:
            for tag_id, value in exif_data.items():
                if TAGS.get(tag_id) == "GPSInfo":
                    gps_data = {GPSTAGS.get(k, k): v for k, v in value.items()}
                    if "GPSLatitude" in gps_data:
                        logger.debug("GPS found via _getexif(): %s", gps_data)
                        return gps_data
    except Exception as e:
        logger.debug("_getexif approach failed: %s", e)

    return None


def _get_gps_from_exifread(image_path: str) -> dict | None:
    """
    Fallback: extract GPS using the exifread library.
    This handles a wider range of JPEG/TIFF formats.
    """
    try:
        import exifread
    except ImportError:
        logger.debug("exifread not installed — skipping fallback")
        return None

    try:
        with open(image_path, "rb") as f:
            tags = exifread.process_file(f, details=False)

        lat_tag = tags.get("GPS GPSLatitude")
        lon_tag = tags.get("GPS GPSLongitude")
        lat_ref = tags.get("GPS GPSLatitudeRef")
        lon_ref = tags.get("GPS GPSLongitudeRef")

        if lat_tag and lon_tag:
            return {
                "GPSLatitude": lat_tag.values,
                "GPSLongitude": lon_tag.values,
                "GPSLatitudeRef": str(lat_ref) if lat_ref else "N",
                "GPSLongitudeRef": str(lon_ref) if lon_ref else "E",
                "_source": "exifread",
            }
    except Exception as e:
        logger.debug("exifread extraction failed: %s", e)

    return None


def _dms_to_degrees(dms_value) -> float:
    """
    Convert GPS DMS (degrees, minutes, seconds) to decimal degrees.
    Handles:
      - Modern Pillow IFDRational (plain float)
      - Legacy tuple-of-fractions ((num, den), ...)
      - exifread Ratio objects
    """
    def to_float(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            pass
        # Legacy: tuple (numerator, denominator)
        try:
            return v[0] / v[1]
        except (TypeError, IndexError, ZeroDivisionError):
            pass
        # exifread Ratio
        try:
            return v.num / v.den
        except (AttributeError, ZeroDivisionError):
            pass
        raise ValueError(f"Cannot convert GPS value to float: {v!r}")

    d, m, s = dms_value
    return to_float(d) + to_float(m) / 60 + to_float(s) / 3600


def extract_lat_lon(image_path: str) -> tuple[float | None, float | None]:
    """
    Extract (latitude, longitude) from image EXIF GPS data.

    Tries Pillow first, then falls back to exifread.
    Returns (None, None) if GPS data is absent or malformed.
    """
    logger.info("Extracting GPS from: %s", image_path)

    # Try Pillow first, then exifread fallback
    gps = _get_gps_from_pillow(image_path)
    if not gps:
        gps = _get_gps_from_exifread(image_path)
    if not gps:
        logger.warning("No GPS data found in image: %s", image_path)
        return None, None

    try:
        lat = _dms_to_degrees(gps["GPSLatitude"])
        lon = _dms_to_degrees(gps["GPSLongitude"])
    except (KeyError, TypeError, ZeroDivisionError, ValueError) as e:
        logger.error("GPS conversion failed: %s (data=%s)", e, gps)
        return None, None

    # Apply hemisphere references
    if gps.get("GPSLatitudeRef", "N") != "N":
        lat = -lat
    if gps.get("GPSLongitudeRef", "E") != "E":
        lon = -lon

    # Validate ranges
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        logger.error("GPS coordinates out of range: lat=%s, lon=%s", lat, lon)
        return None, None

    logger.info("GPS extracted: lat=%.6f, lon=%.6f", lat, lon)
    return round(lat, 6), round(lon, 6)