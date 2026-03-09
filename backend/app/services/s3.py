import uuid

import aioboto3
from fastapi import UploadFile
from loguru import logger

from app.core.config import settings

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB

session = aioboto3.Session(
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    region_name=settings.AWS_REGION,
)


async def upload_image(file: UploadFile, folder: str = "products") -> str:
    """Upload image to S3 and return the public URL."""
    if file.content_type not in ALLOWED_TYPES:
        raise ValueError(f"File type not allowed: {file.content_type}. Use JPEG, PNG or WebP.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise ValueError("File too large. Max 5MB.")

    ext = file.content_type.split("/")[-1]
    if ext == "jpeg":
        ext = "jpg"
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"

    async with session.client("s3") as s3:
        await s3.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=content,
            ContentType=file.content_type,
        )

    url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
    logger.info(f"Uploaded image: {url}")
    return url


async def delete_image(url: str) -> None:
    """Delete image from S3 by URL."""
    prefix = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/"
    if not url.startswith(prefix):
        return
    key = url[len(prefix):]

    async with session.client("s3") as s3:
        await s3.delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
    logger.info(f"Deleted image: {key}")
