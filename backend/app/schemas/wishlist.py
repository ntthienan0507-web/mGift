import uuid
from datetime import datetime

from pydantic import BaseModel


class WishlistAdd(BaseModel):
    product_id: uuid.UUID


class WishlistItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_price: float
    product_image: str | None = None
    in_stock: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_wishlist_item(cls, item) -> "WishlistItemResponse":
        product = item.product
        first_image = product.images[0].url if product.images else None
        return cls(
            id=item.id,
            product_id=product.id,
            product_name=product.name,
            product_price=float(product.price),
            product_image=first_image,
            in_stock=product.stock > 0,
            created_at=item.created_at,
        )


class WishlistCheckResponse(BaseModel):
    in_wishlist: bool
