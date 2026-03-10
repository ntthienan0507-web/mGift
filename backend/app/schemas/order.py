import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.order import OrderItemStatus, OrderStatus


# === Create ===

class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(1, gt=0, description="Quantity must be greater than 0")


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(..., min_length=1, description="Order must have at least 1 item")
    address_id: uuid.UUID | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None
    recipient_address: str | None = None
    note: str | None = None
    gift_message: str | None = None
    gift_card_template: str | None = None
    gift_wrapping: bool = False
    shipping_speed: str = "standard"  # express | standard | economy

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_fields(cls, v: str | None, info) -> str | None:
        """Validation is done at the API level since we need DB access for address_id."""
        return v


# === Supplier respond ===

class SupplierRespondRequest(BaseModel):
    accepted: bool
    reject_reason: str | None = None


# === Replace item (khách chọn sp thay thế) ===

class ReplaceItemRequest(BaseModel):
    new_product_id: uuid.UUID
    quantity: int = Field(1, gt=0, description="Quantity must be greater than 0")


# === Cancel ===

class CancelOrderRequest(BaseModel):
    reason: str | None = None


# === Response ===

class OrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    supplier_id: uuid.UUID
    quantity: int
    unit_price: float
    status: OrderItemStatus
    supplier_deadline: datetime | None
    reject_reason: str | None
    replaced_by_item_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    status: OrderStatus
    total_amount: float
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    note: str | None
    cancel_reason: str | None
    gift_message: str | None
    gift_card_template: str | None
    gift_wrapping: bool
    shipping_speed: str | None
    shipping_fee: float
    estimated_delivery: datetime | None
    items: list[OrderItemResponse]
    created_at: datetime

    model_config = {"from_attributes": True}
