import uuid

from pydantic import BaseModel


class ShopCreate(BaseModel):
    name: str
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None


class ShopUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class ShopResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    is_active: bool

    model_config = {"from_attributes": True}
