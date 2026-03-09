import uuid

from pydantic import BaseModel


class ProductCreate(BaseModel):
    shop_id: uuid.UUID
    name: str
    description: str | None = None
    price: float
    stock: int = 0
    metadata_info: dict | None = None


class ProductImageResponse(BaseModel):
    id: uuid.UUID
    url: str
    position: int

    model_config = {"from_attributes": True}


class ProductResponse(BaseModel):
    id: uuid.UUID
    shop_id: uuid.UUID
    name: str
    description: str | None
    price: float
    stock: int
    metadata_info: dict | None
    images: list[ProductImageResponse] = []

    model_config = {"from_attributes": True}


class AISearchRequest(BaseModel):
    query: str
    limit: int = 5
