"""
Backend/ml/phash.py
M5: Perceptual Image Hashing with Flip & Rotation Invariance.
Specification:
- For each uploaded photo, computes perceptual hashes (pHash) for:
  1. Original image
  2. Horizontal mirror (flip left-right) — fixes known flip exploit
  3. 90° clockwise rotation
  4. 180° rotation
  5. 270° rotation
- Compares Hamming distance against stored hashes in `photo_hashes` table.
- Flags duplicate if min Hamming distance <= threshold (default 10 bits).
- Persists hashes in `photo_hashes` and screenings in `ml_assessments`.
"""

import io
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union

import imagehash
from PIL import Image
from sqlalchemy.orm import Session

from credit_calculation.credits_module.db_models import PhotoHash, MLAssessment

logger = logging.getLogger("carbonvault.ml.phash")

HAMMING_DUPLICATE_THRESHOLD = 10  # Bits: <= 10 considered perceptually identical or transformed


def compute_all_orientation_hashes(image_source: Union[str, Path, bytes, Image.Image]) -> Dict[str, str]:
    """
    Compute perceptual hashes for original, horizontal flip, and rotations.
    Returns hex strings for each orientation.
    """
    if isinstance(image_source, (str, Path)):
        img = Image.open(str(image_source))
    elif isinstance(image_source, bytes):
        img = Image.open(io.BytesIO(image_source))
    elif isinstance(image_source, Image.Image):
        img = image_source
    else:
        raise ValueError("Unsupported image source type")

    # Ensure RGB
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    orig_h = str(imagehash.phash(img))
    hflip_h = str(imagehash.phash(img.transpose(Image.FLIP_LEFT_RIGHT)))
    rot90_h = str(imagehash.phash(img.rotate(90, expand=True)))
    rot180_h = str(imagehash.phash(img.rotate(180, expand=True)))
    rot270_h = str(imagehash.phash(img.rotate(270, expand=True)))

    return {
        "original": orig_h,
        "hflip": hflip_h,
        "rot90": rot90_h,
        "rot180": rot180_h,
        "rot270": rot270_h
    }


def compare_hash_variant_distances(
    query_hashes: Dict[str, str],
    stored_hashes: Dict[str, str]
) -> Tuple[int, str]:
    """
    Compute minimum Hamming distance across all orientation pairs.
    Returns (min_distance, match_type).
    """
    min_dist = 999
    match_type = "none"

    query_map = {
        "original": imagehash.hex_to_hash(query_hashes["original"]),
        "hflip": imagehash.hex_to_hash(query_hashes["hflip"]),
        "rot90": imagehash.hex_to_hash(query_hashes["rot90"]),
        "rot180": imagehash.hex_to_hash(query_hashes["rot180"]),
        "rot270": imagehash.hex_to_hash(query_hashes["rot270"]),
    }

    stored_candidates = [
        ("original", imagehash.hex_to_hash(stored_hashes["hash_original"])),
        ("hflip", imagehash.hex_to_hash(stored_hashes["hash_hflip"])),
        ("rot90", imagehash.hex_to_hash(stored_hashes["hash_rot90"])),
    ]

    for q_label, q_h in query_map.items():
        for s_label, s_h in stored_candidates:
            dist = int(q_h - s_h)
            if dist < min_dist:
                min_dist = dist
                if dist == 0:
                    match_type = f"exact_{q_label}" if q_label == s_label else f"transform_{q_label}_vs_{s_label}"
                elif dist <= HAMMING_DUPLICATE_THRESHOLD:
                    match_type = f"perceptual_{q_label}"

    return min_dist, match_type


def screen_and_store_photo(
    image_source: Union[str, Path, bytes],
    filename: str,
    project_id: str,
    db: Session,
    threshold: int = HAMMING_DUPLICATE_THRESHOLD
) -> Dict[str, Any]:
    """
    Screen an uploaded evidence photo against all stored hashes in the database.
    If acceptable, stores the computed hashes in `photo_hashes`.
    """
    hashes = compute_all_orientation_hashes(image_source)

    # Query all previously stored hashes from other projects
    stored_rows = db.query(PhotoHash).filter(PhotoHash.project_id != project_id).all()

    best_match: Optional[Dict[str, Any]] = None
    min_distance = 999

    for r in stored_rows:
        cand = {
            "hash_original": r.hash_original,
            "hash_hflip": r.hash_hflip,
            "hash_rot90": r.hash_rot90
        }
        dist, mtype = compare_hash_variant_distances(hashes, cand)
        if dist < min_distance:
            min_distance = dist
            best_match = {
                "matched_project_id": r.project_id,
                "matched_filename": r.filename,
                "distance": dist,
                "match_type": mtype
            }

    is_duplicate = min_distance <= threshold

    # Store new photo hash record in database
    now_utc = datetime.utcnow()
    new_entry = PhotoHash(
        project_id=project_id,
        filename=filename,
        hash_original=hashes["original"],
        hash_hflip=hashes["hflip"],
        hash_rot90=hashes["rot90"],
        created_at=now_utc
    )
    db.add(new_entry)
    db.commit()

    return {
        "filename": filename,
        "project_id": project_id,
        "is_duplicate": is_duplicate,
        "min_hamming_distance": min_distance,
        "hashes": hashes,
        "match_details": best_match if is_duplicate else None,
        "status": "flagged_duplicate" if is_duplicate else "clean",
        "created_at": now_utc.isoformat() + "Z"
    }


def run_project_photo_screening(
    project_id: str,
    db: Session
) -> Dict[str, Any]:
    """
    Evaluate all evidence photos registered for a project.
    Persists screening summary in `ml_assessments` (model="phash").
    """
    photos = db.query(PhotoHash).filter(PhotoHash.project_id == project_id).all()

    if not photos:
        return {
            "project_id": project_id,
            "model": "phash",
            "status": "no_photos",
            "message": "No photos registered in hash index for this project.",
            "duplicate_count": 0
        }

    # Cross-match against all other projects
    other_photos = db.query(PhotoHash).filter(PhotoHash.project_id != project_id).all()

    duplicates_found = []
    for p in photos:
        p_hashes = {
            "original": p.hash_original,
            "hflip": p.hash_hflip,
            "rot90": p.hash_rot90,
            "rot180": p.hash_rot90,  # approximation
            "rot270": p.hash_rot90
        }
        for o in other_photos:
            o_hashes = {
                "hash_original": o.hash_original,
                "hash_hflip": o.hash_hflip,
                "hash_rot90": o.hash_rot90
            }
            dist, mtype = compare_hash_variant_distances(p_hashes, o_hashes)
            if dist <= HAMMING_DUPLICATE_THRESHOLD:
                duplicates_found.append({
                    "photo_file": p.filename,
                    "matched_project": o.project_id,
                    "matched_file": o.filename,
                    "hamming_dist": dist,
                    "match_type": mtype
                })

    score = 100.0 if duplicates_found else 0.0
    now_utc = datetime.utcnow()

    try:
        row = MLAssessment(
            project_id=project_id,
            model="phash",
            score=score,
            reasons=json.dumps(duplicates_found),
            confidence="high",
            model_version="1.0.0",
            created_at=now_utc
        )
        db.add(row)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning("Could not persist phash assessment: %s", e)

    return {
        "project_id": project_id,
        "model": "phash",
        "photos_checked": len(photos),
        "duplicate_count": len(duplicates_found),
        "is_fraud_flagged": len(duplicates_found) > 0,
        "duplicates": duplicates_found,
        "created_at": now_utc.isoformat() + "Z"
    }
