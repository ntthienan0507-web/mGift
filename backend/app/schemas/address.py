import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class AddressCreate(BaseModel):
    label: str = Field(..., max_length=100, description="Tên gợi nhớ, vd: Nhà riêng, Công ty")
    recipient_name: str = Field(..., max_length=255)
    recipient_phone: str = Field(..., max_length=20)
    address_line: str = Field(..., description="Địa chỉ chi tiết")
    ward: str | None = Field(None, max_length=100, description="Phường/Xã")
    district: str | None = Field(None, max_length=100, description="Quận/Huyện")
    city: str = Field(..., max_length=100, description="Tỉnh/Thành phố")
    latitude: float | None = Field(None, description="Vĩ độ")
    longitude: float | None = Field(None, description="Kinh độ")
    is_default: bool = False

    @field_validator("recipient_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^\+?[0-9]{7,15}$", v):
            raise ValueError("Phone must be 7-15 digits, optionally starting with +")
        return v


class AddressUpdate(BaseModel):
    label: str | None = Field(None, max_length=100)
    recipient_name: str | None = Field(None, max_length=255)
    recipient_phone: str | None = Field(None, max_length=20)
    address_line: str | None = None
    ward: str | None = None
    district: str | None = None
    city: str | None = Field(None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool | None = None

    @field_validator("recipient_phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is not None and not re.match(r"^\+?[0-9]{7,15}$", v):
            raise ValueError("Phone must be 7-15 digits, optionally starting with +")
        return v


class AddressResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    label: str
    recipient_name: str
    recipient_phone: str
    address_line: str
    ward: str | None
    district: str | None
    city: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool
    created_at: datetime

    model_config = {"from_attributes": True}
