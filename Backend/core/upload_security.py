"""
CarbonVault Phase 4: Secure Upload Pipeline
Enforces:
- Hard 5MB file size limit (HTTP 413)
- Magic-byte validation (strictly JPEG, PNG, WebP; rejects SVG, HTML, executables, polyglots)
- Pillow re-encoding to strip EXIF metadata and hidden payloads
- Maximum dimension checks (8000x8000 limit) to prevent decompression bombs
- Random UUID filename generation to prevent path traversal and file collisions
"""

import io
import uuid
import logging
from typing import Tuple
from PIL import Image
from fastapi import HTTPException

from core.settings import get_settings

logger = logging.getLogger("carbonvault.upload_security")
settings = get_settings()

MAX_IMAGE_DIMENSION = 8000  # Prevents decompression bomb attacks
FORBIDDEN_SIGNATURES = [
    b"<script",
    b"<?php",
    b"<html",
    b"<!doctype",
    b"<svg",
    b"<?xml",
    b"eval(",
]


def check_magic_bytes(header: bytes) -> str:
    """
    Validates the binary header against known image magic bytes.
    Returns format string: 'JPEG', 'PNG', or 'WEBP'.
    Raises HTTPException 400 on unrecognized format.
    """
    if len(header) < 12:
        raise HTTPException(
            status_code=400,
            detail="Invalid image upload: file header too short."
        )

    # JPEG: FF D8 FF
    if header.startswith(b"\xff\xd8\xff"):
        return "JPEG"

    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"

    # WebP: RIFF .... WEBP
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "WEBP"

    raise HTTPException(
        status_code=400,
        detail="Unsupported or invalid file format. Only JPEG, PNG, and WebP images are allowed."
    )


def validate_and_sanitize_image(
    file_bytes: bytes,
    original_filename: str = ""
) -> Tuple[bytes, str, str]:
    """
    Executes deep validation and re-encoding on uploaded image bytes.

    Returns:
        (sanitized_bytes, random_filename, mime_type)
    """
    # 1. Size Limit Check
    max_size = settings.MAX_UPLOAD_SIZE_BYTES
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {max_size // (1024 * 1024)}MB."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Cannot upload an empty file.")

    # 2. Magic-Byte Validation
    detected_format = check_magic_bytes(file_bytes[:16])

    # 3. Polyglot / Script Injection Check in header and trailer
    sample = file_bytes[:1024].lower() + file_bytes[-1024:].lower()
    for sig in FORBIDDEN_SIGNATURES:
        if sig in sample:
            logger.warning("Detected forbidden signature in upload: %s", sig)
            raise HTTPException(
                status_code=400,
                detail="Malicious or disguised file format detected. Upload rejected."
            )

    # 4. Pillow Parsing, Verification, and Re-Encoding
    try:
        # First pass: verify image stream
        verify_img = Image.open(io.BytesIO(file_bytes))
        verify_img.verify()
    except Exception as e:
        logger.warning("Pillow verify failed on upload: %s", e)
        raise HTTPException(status_code=400, detail="Corrupted or invalid image structure.")

    try:
        # Second pass: re-open to load pixel data
        img = Image.open(io.BytesIO(file_bytes))

        # Check bounds
        width, height = img.size
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            raise HTTPException(
                status_code=400,
                detail=f"Image dimensions ({width}x{height}) exceed maximum allowed {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}."
            )

        # Re-encode to clean WebP, stripping EXIF and comments
        if img.mode in ("RGBA", "LA", "P"):
            clean_img = img.convert("RGBA")
        else:
            clean_img = img.convert("RGB")

        out_buffer = io.BytesIO()
        clean_img.save(out_buffer, format="WEBP", quality=85, method=4)
        sanitized_bytes = out_buffer.getvalue()

        # 5. Cryptographically random filename
        random_name = f"{uuid.uuid4().hex}.webp"
        mime_type = "image/webp"

        return sanitized_bytes, random_name, mime_type

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to sanitize image: %s", e)
        raise HTTPException(status_code=500, detail="Failed to safely process uploaded image.")
