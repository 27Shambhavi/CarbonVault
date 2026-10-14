"""
CarbonVault Phase 4: Object Storage Adapter (S3 / Cloudflare R2) & Signed URLs.
Provides seamless storage abstraction:
- Cloud: Stores in AWS S3 or Cloudflare R2 bucket with presigned GET URLs with TTL.
- Fallback / Local: Stores in local upload directory and enforces cryptographic
  HMAC-SHA256 signed tokens with expiration on GET requests.
"""

import os
import time
import hmac
import hashlib
import logging
from typing import Optional
from pathlib import Path

from core.settings import get_settings
from core.config import UPLOAD_DIR

logger = logging.getLogger("carbonvault.storage")
settings = get_settings()


class StorageService:
    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.endpoint_url = settings.S3_ENDPOINT_URL
        self.access_key = settings.S3_ACCESS_KEY_ID
        self.secret_key = settings.S3_SECRET_ACCESS_KEY
        self.region = settings.S3_REGION
        self.default_ttl = settings.S3_SIGNED_URL_TTL_SECONDS
        self.is_cloud = bool(self.bucket and self.access_key and self.secret_key)

        self._s3_client = None
        if self.is_cloud:
            try:
                import boto3
                client_kwargs = {
                    "aws_access_key_id": self.access_key,
                    "aws_secret_access_key": self.secret_key,
                    "region_name": self.region,
                }
                if self.endpoint_url:
                    client_kwargs["endpoint_url"] = self.endpoint_url
                self._s3_client = boto3.client("s3", **client_kwargs)
                logger.info("StorageService initialized with S3/R2 bucket: %s", self.bucket)
            except Exception as e:
                logger.warning("Could not initialize S3 client: %s; falling back to local signed storage", e)
                self.is_cloud = False

    def upload_file(self, file_bytes: bytes, filename: str, content_type: str = "image/webp") -> str:
        """
        Uploads binary bytes to storage.
        Returns the object key / filename.
        """
        if self.is_cloud and self._s3_client:
            key = f"uploads/{filename}"
            self._s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
            )
            logger.info("Uploaded %s to S3 bucket %s", key, self.bucket)
            return filename

        # Fallback local filesystem storage
        target_path = Path(UPLOAD_DIR) / filename
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        logger.info("Uploaded %s to local storage", filename)
        return filename

    def get_signed_url(self, filename: str, ttl_seconds: Optional[int] = None) -> str:
        """
        Generates a time-limited signed URL for secure asset retrieval.
        """
        ttl = ttl_seconds or self.default_ttl

        if self.is_cloud and self._s3_client:
            try:
                key = f"uploads/{filename}"
                url = self._s3_client.generate_presigned_url(
                    ClientMethod="get_object",
                    Params={"Bucket": self.bucket, "Key": key},
                    ExpiresIn=ttl,
                )
                return url
            except Exception as e:
                logger.error("Failed to generate S3 presigned URL: %s", e)

        # Fallback cryptographic HMAC-signed token
        expiry = int(time.time()) + ttl
        token = self.generate_token(filename, expiry)
        return f"/uploads/secure/{filename}?token={token}&expires={expiry}"

    def generate_token(self, filename: str, expires: int) -> str:
        """Creates HMAC-SHA256 signature token for local URL signing."""
        secret = settings.JWT_SECRET.encode("utf-8")
        payload = f"{filename}:{expires}".encode("utf-8")
        return hmac.new(secret, payload, hashlib.sha256).hexdigest()[:32]

    def verify_token(self, filename: str, token: str, expires: int) -> bool:
        """Verifies HMAC signature and expiration timestamp."""
        now = int(time.time())
        if now > expires:
            logger.warning("Expired access token for %s", filename)
            return False

        expected = self.generate_token(filename, expires)
        return hmac.compare_digest(token, expected)


_storage: Optional[StorageService] = None


def get_storage() -> StorageService:
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
