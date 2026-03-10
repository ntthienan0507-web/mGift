import uuid

from pydantic import BaseModel, Field


class GiftBoxItem(BaseModel):
    product_id: uuid.UUID
    name: str
    price: float
    category_id: uuid.UUID | None = None


class GiftBoxSuggestRequest(BaseModel):
    items: list[GiftBoxItem] = Field(..., min_length=1)
    budget_remaining: float | None = Field(None, gt=0)
    occasion: str | None = None  # "birthday", "valentine", "thanks", ...


class SuggestedProduct(BaseModel):
    product_id: str
    name: str
    price: float
    description: str | None
    category_id: str | None
    shop_id: str
    images: list[dict] = []


class GiftBoxSuggestResponse(BaseModel):
    completeness: float  # 0.0 → 1.0
    status: str  # "starting" | "building" | "ready" | "complete"
    item_count: int
    max_items: int
    message: str | None  # AI-generated suggestion message
    suggestions: list[SuggestedProduct]
    should_suggest: bool  # FE dùng để ẩn/hiện suggestion UI
    total_spent: float
