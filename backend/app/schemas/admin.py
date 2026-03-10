import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.order import OrderStatus
from app.schemas.product import ProductImageResponse


class AdminStatsResponse(BaseModel):
    total_users: int
    total_shops: int
    total_products: int
    total_orders: int
    total_revenue: float


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    avatar_url: str | None
    is_admin: bool
    google_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    is_admin: bool | None = None
    email: str | None = None


class AdminShopResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    contact_email: str | None
    contact_phone: str | None
    address: str | None
    is_active: bool
    api_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminShopUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class AdminProductResponse(BaseModel):
    id: uuid.UUID
    shop_id: uuid.UUID
    shop_name: str | None = None
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    name: str
    description: str | None
    price: float
    stock: int
    images: list[ProductImageResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminOrderItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str | None = None
    supplier_id: uuid.UUID
    supplier_name: str | None = None
    quantity: int
    unit_price: float
    status: str
    supplier_deadline: datetime | None
    reject_reason: str | None

    model_config = {"from_attributes": True}


class AdminOrderResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_email: str | None = None
    status: OrderStatus
    total_amount: float
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    note: str | None
    gift_message: str | None = None
    shipping_speed: str | None = None
    shipping_fee: float
    estimated_delivery: datetime | None = None
    item_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminOrderDetailResponse(AdminOrderResponse):
    items: list[AdminOrderItemResponse] = []
    payment_status: str | None = None
    payment_method: str | None = None
