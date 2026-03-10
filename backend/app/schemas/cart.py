import uuid

from pydantic import BaseModel, Field


# === Input schemas ===

class CartItemAdd(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(1, gt=0, description="Quantity must be greater than 0")


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")


# === Checkout schema ===

class CartCheckout(BaseModel):
    address_id: uuid.UUID | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None
    recipient_address: str | None = None
    note: str | None = None
    gift_message: str | None = None
    gift_card_template: str | None = None
    gift_wrapping: bool = False
    shipping_speed: str = "standard"  # express | standard | economy


# === Response schemas ===

class CartItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    product_price: float
    product_image: str | None = None
    quantity: int
    subtotal: float

    model_config = {"from_attributes": True}

    @classmethod
    def from_cart_item(cls, cart_item) -> "CartItemResponse":
        product = cart_item.product
        first_image = product.images[0].url if product.images else None
        return cls(
            id=cart_item.id,
            product_id=product.id,
            product_name=product.name,
            product_price=float(product.price),
            product_image=first_image,
            quantity=cart_item.quantity,
            subtotal=float(product.price) * cart_item.quantity,
        )


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    total_amount: float
    total_items: int
    unique_suppliers: int
