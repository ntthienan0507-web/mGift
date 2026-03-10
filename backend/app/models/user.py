from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    fcm_token: Mapped[str | None] = mapped_column(String(500), nullable=True)

    orders = relationship("Order", back_populates="user", lazy="selectin")
    addresses = relationship("Address", back_populates="user", lazy="selectin")
