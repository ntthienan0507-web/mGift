import os
import uuid

import aioboto3
from fastapi import UploadFile
from loguru import logger

from app.core.config import settings

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

# Kiểm tra S3 credentials hợp lệ
_use_s3 = (
    settings.AWS_ACCESS_KEY_ID
    and settings.AWS_SECRET_ACCESS_KEY
    and not settings.AWS_ACCESS_KEY_ID.startswith("your-")
)

if _use_s3:
    session = aioboto3.Session(
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
else:
    session = None
    logger.warning("AWS S3 not configured → fallback to local file storage")

LOCAL_UPLOAD_DIR = "/app/uploads"


async def upload_image(file: UploadFile, folder: str = "products") -> str:
    """Upload image to S3 or local storage, return the public URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise ValueError(f"File type not allowed: {file.content_type}. Use JPEG, PNG or WebP.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise ValueError("File too large. Max 5MB.")

    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"

    if _use_s3 and session:
        key = f"{folder}/{filename}"
        async with session.client("s3") as s3:
            await s3.put_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
                Body=content,
                ContentType=file.content_type,
            )
        url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
        logger.info(f"Uploaded image to S3: {url}")
    else:
        upload_dir = os.path.join(LOCAL_UPLOAD_DIR, folder)
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(content)
        url = f"/uploads/{folder}/{filename}"
        logger.info(f"Saved image locally: {url}")

    return url


async def delete_image(url: str) -> None:
    """Delete image from S3 or local storage by URL."""
    if url.startswith("/uploads/"):
        # Local file
        filepath = os.path.join(LOCAL_UPLOAD_DIR, url.removeprefix("/uploads/"))
        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Deleted local image: {filepath}")
        return

    if not _use_s3 or not session:
        return

    prefix = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/"
    if not url.startswith(prefix):
        return
    key = url[len(prefix):]

    async with session.client("s3") as s3:
        await s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
    logger.info(f"Deleted S3 image: {key}")
