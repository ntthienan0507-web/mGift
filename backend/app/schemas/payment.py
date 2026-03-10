import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.payment import PaymentMethod, PaymentStatus


# === Create ===

class PaymentCreate(BaseModel):
    order_id: uuid.UUID
    method: PaymentMethod


# === Callback (webhook from gateway) ===

class PaymentCallbackData(BaseModel):
    transaction_id: str
    status: PaymentStatus
    amount: float


# === Response ===

class PaymentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    method: PaymentMethod
    status: PaymentStatus
    amount: float
    transaction_id: str | None
    payment_url: str | None
    paid_at: datetime | None
    metadata_info: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
