import uuid

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    shop_id: uuid.UUID
    category_id: uuid.UUID | None = None
    name: str
    description: str | None = None
    price: float = Field(..., gt=0, description="Price must be greater than 0")
    stock: int = Field(0, ge=0, description="Stock must be >= 0")
    metadata_info: dict | None = None


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    url: str
    position: int

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id: uuid.UUID
    shop_id: uuid.UUID
    category_id: uuid.UUID | None = None
    name: str
    description: str | None
    price: float
    stock: int
    metadata_info: dict | None
    category_name: str | None = None
    images: list[ProductImageResponse] = []
    avg_rating: float | None = None
    review_count: int = 0

    model_config = {"from_attributes": True}

    @classmethod
    def from_product(cls, product) -> "ProductResponse":
        data = cls.model_validate(product)
        if product.category:
            data.category_name = product.category.name
        # Compute review stats from loaded reviews
        if hasattr(product, "reviews") and product.reviews:
            visible_reviews = [r for r in product.reviews if r.is_visible]
            data.review_count = len(visible_reviews)
            if visible_reviews:
                data.avg_rating = round(
                    sum(r.rating for r in visible_reviews) / len(visible_reviews), 2
                )
        return data


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(None, gt=0, description="Price must be greater than 0")
    stock: int | None = Field(None, ge=0, description="Stock must be >= 0")
    category_id: uuid.UUID | None = None
    metadata_info: dict | None = None


class AISearchRequest(BaseModel):
    query: str
    limit: int = 5
