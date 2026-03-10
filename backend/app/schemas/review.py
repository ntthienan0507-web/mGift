import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    product_id: uuid.UUID
    order_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: str | None = None


class ReviewUpdate(BaseModel):
    rating: int | None = Field(None, ge=1, le=5, description="Rating from 1 to 5")
    comment: str | None = None


class ReviewResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    product_id: uuid.UUID
    order_id: uuid.UUID
    rating: int
    comment: str | None
    is_visible: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_review(cls, review) -> "ReviewResponse":
        return cls(
            id=review.id,
            user_id=review.user_id,
            user_name=review.user.full_name if review.user else "Unknown",
            product_id=review.product_id,
            order_id=review.order_id,
            rating=review.rating,
            comment=review.comment,
            is_visible=review.is_visible,
            created_at=review.created_at,
        )


class ProductRatingResponse(BaseModel):
    product_id: uuid.UUID
    avg_rating: float
    review_count: int
    rating_distribution: dict[int, int]
