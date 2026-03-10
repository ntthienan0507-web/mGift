import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.order import Order, OrderItem, OrderStatus
from app.models.review import Review
from app.models.user import User
from app.schemas.review import (
    ProductRatingResponse,
    ReviewCreate,
    ReviewResponse,
    ReviewUpdate,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


# ═══════════════════════════════════════════════════
# 1. Create review
# ═══════════════════════════════════════════════════

@router.post(
    "/",
    response_model=ReviewResponse,
    status_code=201,
    summary="Tạo đánh giá",
    description="Tạo đánh giá cho sản phẩm. Đơn hàng phải đã giao và chứa sản phẩm đó.",
    responses={
        400: {"description": "Đơn chưa giao, sản phẩm không thuộc đơn, hoặc đã đánh giá rồi"},
        404: {"description": "Không tìm thấy đơn hàng"},
    },
)
async def create_review(
    data: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a review. User must own the order, order must contain the product, and order must be DELIVERED."""
    # Validate order belongs to user
    order_result = await db.execute(
        select(Order).where(Order.id == data.order_id, Order.user_id == current_user.id)
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Order must be delivered
    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Can only review products from delivered orders")

    # Order must contain the product
    item_result = await db.execute(
        select(OrderItem).where(
            OrderItem.order_id == data.order_id,
            OrderItem.product_id == data.product_id,
        )
    )
    order_item = item_result.scalar_one_or_none()
    if not order_item:
        raise HTTPException(status_code=400, detail="This product is not part of the specified order")

    # Check for duplicate review
    existing_result = await db.execute(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.product_id == data.product_id,
            Review.order_id == data.order_id,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already reviewed this product for this order")

    review = Review(
        user_id=current_user.id,
        product_id=data.product_id,
        order_id=data.order_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    # Load user relationship for response
    result = await db.execute(
        select(Review).where(Review.id == review.id).options(selectinload(Review.user))
    )
    review = result.scalar_one()

    return ReviewResponse.from_review(review)


# ═══════════════════════════════════════════════════
# 2. List reviews for a product (public)
# ═══════════════════════════════════════════════════

@router.get(
    "/product/{product_id}",
    response_model=list[ReviewResponse],
    summary="Đánh giá của sản phẩm",
    description="Lấy danh sách đánh giá công khai của một sản phẩm, có phân trang.",
)
async def list_product_reviews(
    product_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """List visible reviews for a product, paginated."""
    result = await db.execute(
        select(Review)
        .where(Review.product_id == product_id, Review.is_visible.is_(True))
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    reviews = result.scalars().all()
    return [ReviewResponse.from_review(r) for r in reviews]


# ═══════════════════════════════════════════════════
# 3. Get aggregate rating stats for a product
# ═══════════════════════════════════════════════════

@router.get(
    "/product/{product_id}/rating",
    response_model=ProductRatingResponse,
    summary="Thống kê đánh giá sản phẩm",
    description="Trả về điểm trung bình, tổng số đánh giá và phân bố sao (1-5) của sản phẩm.",
)
async def get_product_rating(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get average rating, review count, and rating distribution for a product."""
    # Aggregate stats
    stats_result = await db.execute(
        select(
            func.coalesce(func.avg(Review.rating), 0).label("avg_rating"),
            func.count(Review.id).label("review_count"),
        ).where(Review.product_id == product_id, Review.is_visible.is_(True))
    )
    row = stats_result.one()
    avg_rating = float(row.avg_rating)
    review_count = row.review_count

    # Rating distribution
    dist_result = await db.execute(
        select(Review.rating, func.count(Review.id))
        .where(Review.product_id == product_id, Review.is_visible.is_(True))
        .group_by(Review.rating)
    )
    distribution = {i: 0 for i in range(1, 6)}
    for rating_val, count in dist_result.all():
        distribution[rating_val] = count

    return ProductRatingResponse(
        product_id=product_id,
        avg_rating=round(avg_rating, 2),
        review_count=review_count,
        rating_distribution=distribution,
    )


# ═══════════════════════════════════════════════════
# 4. List current user's reviews
# ═══════════════════════════════════════════════════

@router.get(
    "/me",
    response_model=list[ReviewResponse],
    summary="Đánh giá của tôi",
    description="Lấy tất cả đánh giá của người dùng đang đăng nhập.",
)
async def list_my_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all reviews by the current user."""
    result = await db.execute(
        select(Review)
        .where(Review.user_id == current_user.id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()
    return [ReviewResponse.from_review(r) for r in reviews]


# ═══════════════════════════════════════════════════
# 5. Update own review
# ═══════════════════════════════════════════════════

@router.patch(
    "/{review_id}",
    response_model=ReviewResponse,
    summary="Sửa đánh giá",
    description="Sửa đánh giá của chính mình (chỉ rating và comment).",
    responses={
        403: {"description": "Chỉ được sửa đánh giá của mình"},
        404: {"description": "Không tìm thấy đánh giá"},
    },
)
async def update_review(
    review_id: uuid.UUID,
    data: ReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update own review (only comment and rating)."""
    result = await db.execute(
        select(Review).where(Review.id == review_id).options(selectinload(Review.user))
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your own reviews")

    if data.rating is not None:
        review.rating = data.rating
    if data.comment is not None:
        review.comment = data.comment

    await db.commit()
    await db.refresh(review)

    # Re-load with user relationship
    result = await db.execute(
        select(Review).where(Review.id == review.id).options(selectinload(Review.user))
    )
    review = result.scalar_one()

    return ReviewResponse.from_review(review)


# ═══════════════════════════════════════════════════
# 6. Delete own review
# ═══════════════════════════════════════════════════

@router.delete(
    "/{review_id}",
    status_code=204,
    summary="Xóa đánh giá",
    description="Xóa đánh giá của chính mình.",
    responses={
        403: {"description": "Chỉ được xóa đánh giá của mình"},
        404: {"description": "Không tìm thấy đánh giá"},
    },
)
async def delete_review(
    review_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete own review."""
    result = await db.execute(
        select(Review).where(Review.id == review_id)
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")

    await db.delete(review)
    await db.commit()
