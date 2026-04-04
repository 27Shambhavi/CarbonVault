# app/utils/image_hash.py
from PIL import Image
import imagehash


def compute_image_hash(image_path: str) -> str:
    """Compute perceptual (pHash) for an image. Returns hex string."""
    img = Image.open(image_path)
    return str(imagehash.phash(img))


def hashes_are_similar(hash1: str, hash2: str, threshold: int = 10) -> bool:
    """
    Returns True if two pHash strings are perceptually similar.
    threshold=10 allows minor crops/resizes; lower = stricter.
    """
    h1 = imagehash.hex_to_hash(hash1)
    h2 = imagehash.hex_to_hash(hash2)
    return (h1 - h2) <= threshold