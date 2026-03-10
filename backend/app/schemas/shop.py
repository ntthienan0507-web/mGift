import uuid

from pydantic import BaseModel


class ShopCreate(BaseModel):
    name: str
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ShopUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool | None = None


class ShopResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class ShopCreateResponse(ShopResponse):
    """Response khi tạo shop - bao gồm api_key để NCC sử dụng."""
    api_key: str
