from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer, default=1000)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    processing_hours: Mapped[float] = mapped_column(Float, default=4.0)
