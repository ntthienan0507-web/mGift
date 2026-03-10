import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class OrderStatus(str, enum.Enum):
    PENDING = "pending"                        # Chờ NCC xác nhận
    WAITING_REPLACEMENT = "waiting_replacement" # Có NCC từ chối/timeout, chờ khách chọn lại
    ALL_CONFIRMED = "all_confirmed"            # Tất cả NCC đã accept
    DISPATCHING = "dispatching"                # Đang điều shipper lấy hàng
    PICKING_UP = "picking_up"                  # Shipper đang gom hàng từ NCC
    AT_WAREHOUSE = "at_warehouse"              # Tất cả đã về kho
    PACKING = "packing"                        # Đang đóng gói
    SHIPPING = "shipping"                      # Đang giao cho khách
    DELIVERED = "delivered"                     # Đã giao thành công
    CANCELLED = "cancelled"                    # Khách huỷ đơn


class OrderItemStatus(str, enum.Enum):
    REQUESTED = "requested"                    # Chờ NCC xác nhận
    CONFIRMED = "confirmed"                    # NCC đã accept
    REJECTED = "rejected"                      # NCC từ chối
    TIMEOUT = "timeout"                        # NCC quá hạn xác nhận
    REPLACED = "replaced"                      # Khách đã chọn sp thay thế
    PICKED_UP = "picked_up"                    # Shipper đã lấy từ NCC
    AT_WAREHOUSE = "at_warehouse"              # Đã về kho mGift
    CANCELLED = "cancelled"                    # Bị huỷ


class Order(Base):
    __tablename__ = "orders"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    recipient_name: Mapped[str] = mapped_column(String(255))
    recipient_phone: Mapped[str] = mapped_column(String(20))
    recipient_address: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Gift fields
    gift_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    gift_card_template: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gift_wrapping: Mapped[bool] = mapped_column(Boolean, default=False)

    # Shipping fields
    shipping_speed: Mapped[str | None] = mapped_column(String(20), nullable=True, default="standard")
    shipping_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    estimated_delivery: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", lazy="selectin")
    payment = relationship("Payment", back_populates="order", uselist=False, lazy="selectin")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"))
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shops.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[OrderItemStatus] = mapped_column(
        Enum(OrderItemStatus), default=OrderItemStatus.REQUESTED
    )
    supplier_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    replaced_by_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    supplier = relationship("Shop")
