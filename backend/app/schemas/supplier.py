import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.order import OrderItemStatus


# === Product (without shop_id, auto-set from current_supplier) ===

class SupplierProductCreate(BaseModel):
    category_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    price: float = Field(..., gt=0, description="Price must be greater than 0")
    stock: int = Field(0, ge=0, description="Stock must be >= 0")
    metadata_info: dict | None = None


# === Order item response with recipient info ===

class SupplierOrderItemResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    quantity: int
    unit_price: float
    status: OrderItemStatus
    supplier_deadline: datetime | None
    reject_reason: str | None

    # Order-level info
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    order_created_at: datetime

    model_config = {"from_attributes": True}


# === Reject request ===

class SupplierRejectRequest(BaseModel):
    reason: str


# === Dashboard stats ===

class SupplierStatsResponse(BaseModel):
    total_products: int
    total_orders: int
    pending_orders: int
    revenue: float
    avg_rating: float | None
