import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.cart import CartItem
from app.models.product import Product
from app.models.user import User
from app.models.wishlist import WishlistItem
from app.schemas.wishlist import WishlistAdd, WishlistCheckResponse, WishlistItemResponse

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get(
    "/",
    response_model=list[WishlistItemResponse],
    summary="Danh sách yêu thích",
    description="Lấy tất cả sản phẩm trong danh sách yêu thích, sắp xếp mới nhất trước.",
)
async def list_wishlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all items in the current user's wishlist."""
    result = await db.execute(
        select(WishlistItem)
        .where(WishlistItem.user_id == current_user.id)
        .order_by(WishlistItem.created_at.desc())
    )
    items = result.scalars().all()
    return [WishlistItemResponse.from_wishlist_item(item) for item in items]


@router.post(
    "/",
    response_model=WishlistItemResponse,
    summary="Thêm vào yêu thích",
    description="Thêm sản phẩm vào danh sách yêu thích. Idempotent: trả về item hiện có nếu đã thêm.",
    responses={404: {"description": "Không tìm thấy sản phẩm"}},
)
async def add_to_wishlist(
    data: WishlistAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a product to wishlist. Idempotent: returns existing item if already added."""
    # Validate product exists
    product_result = await db.execute(
        select(Product).where(Product.id == data.product_id)
    )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if already in wishlist
    existing = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == data.product_id,
        )
    )
    item = existing.scalar_one_or_none()
    if item:
        return WishlistItemResponse.from_wishlist_item(item)

    # Create new wishlist item
    item = WishlistItem(user_id=current_user.id, product_id=data.product_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return WishlistItemResponse.from_wishlist_item(item)


@router.delete(
    "/{product_id}",
    status_code=204,
    summary="Xóa khỏi yêu thích",
    description="Xóa sản phẩm khỏi danh sách yêu thích theo product_id.",
    responses={404: {"description": "Sản phẩm không có trong danh sách yêu thích"}},
)
async def remove_from_wishlist(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a product from wishlist by product_id."""
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not in wishlist")

    await db.delete(item)
    await db.commit()


@router.get(
    "/check/{product_id}",
    response_model=WishlistCheckResponse,
    summary="Kiểm tra yêu thích",
    description="Kiểm tra sản phẩm có trong danh sách yêu thích hay không.",
)
async def check_wishlist(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if a product is in the user's wishlist."""
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )
    item = result.scalar_one_or_none()
    return WishlistCheckResponse(in_wishlist=item is not None)


@router.post(
    "/{product_id}/to-cart",
    summary="Chuyển sang giỏ hàng",
    description="Chuyển sản phẩm từ yêu thích sang giỏ hàng. Xóa khỏi wishlist và thêm vào cart.",
    responses={
        400: {"description": "Sản phẩm hết hàng"},
        404: {"description": "Sản phẩm không có trong danh sách yêu thích"},
    },
)
async def move_to_cart(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move an item from wishlist to cart. Removes from wishlist and adds to cart."""
    # Find wishlist item
    result = await db.execute(
        select(WishlistItem).where(
            WishlistItem.user_id == current_user.id,
            WishlistItem.product_id == product_id,
        )
    )
    wishlist_item = result.scalar_one_or_none()
    if not wishlist_item:
        raise HTTPException(status_code=404, detail="Item not in wishlist")

    # Validate product is in stock
    product = wishlist_item.product
    if product.stock <= 0:
        raise HTTPException(status_code=400, detail="Product is out of stock")

    # Add to cart (or increment quantity if already in cart)
    cart_result = await db.execute(
        select(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.product_id == product_id,
        )
    )
    cart_item = cart_result.scalar_one_or_none()
    if cart_item:
        cart_item.quantity += 1
    else:
        cart_item = CartItem(user_id=current_user.id, product_id=product_id, quantity=1)
        db.add(cart_item)

    # Remove from wishlist
    await db.delete(wishlist_item)
    await db.commit()

    return {"ok": True, "message": "Moved to cart"}
