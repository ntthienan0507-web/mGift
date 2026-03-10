import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PaymentMethod(str, enum.Enum):
    VNPAY = "vnpay"
    MOMO = "momo"
    BANK_TRANSFER = "bank_transfer"
    COD = "cod"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod))
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_info: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    order = relationship("Order", back_populates="payment")
