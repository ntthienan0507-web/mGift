import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderItemStatus, OrderStatus


# === Create ===

class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = 1


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    note: str | None = None


# === Supplier respond ===

class SupplierRespondRequest(BaseModel):
    accepted: bool
    reject_reason: str | None = None


# === Replace item (khách chọn sp thay thế) ===

class ReplaceItemRequest(BaseModel):
    new_product_id: uuid.UUID
    quantity: int = 1


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
    items: list[OrderItemResponse]
    created_at: datetime

    model_config = {"from_attributes": True}
