"""
Shopping Cart API:
- GET    /cart/          → view cart with totals
- POST   /cart/          → add item (or increment if exists)
- PATCH  /cart/{item_id} → update quantity (0 = remove)
- DELETE /cart/{item_id} → remove item
- DELETE /cart/          → clear entire cart
- POST   /cart/checkout  → convert cart → order
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.address import Address
from app.models.cart import CartItem
from app.models.order import Order, OrderItem, OrderItemStatus, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.cart import CartCheckout, CartItemAdd, CartItemResponse, CartItemUpdate, CartResponse
from app.schemas.order import OrderResponse
from app.services.kafka_producer import send_event

router = APIRouter(prefix="/cart", tags=["cart"])


# ═══════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════

async def _get_cart_items(db: AsyncSession, user_id: uuid.UUID) -> list[CartItem]:
    result = await db.execute(
        select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.created_at)
    )
    return list(result.scalars().all())


def _build_cart_response(cart_items: list[CartItem]) -> CartResponse:
    items = [CartItemResponse.from_cart_item(ci) for ci in cart_items]
    total_amount = sum(item.subtotal for item in items)
    total_items = sum(item.quantity for item in items)
    unique_suppliers = len({ci.product.shop_id for ci in cart_items})
    return CartResponse(
        items=items,
        total_amount=total_amount,
        total_items=total_items,
        unique_suppliers=unique_suppliers,
    )


# ═══════════════════════════════════════════════════
# 1. GET /cart/ — View cart
# ═══════════════════════════════════════════════════

@router.get(
    "/",
    response_model=CartResponse,
    summary="Xem giỏ hàng",
    description="Lấy giỏ hàng hiện tại với tổng tiền, số lượng và số nhà cung cấp.",
)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's cart with calculated totals."""
    cart_items = await _get_cart_items(db, current_user.id)
    return _build_cart_response(cart_items)


# ═══════════════════════════════════════════════════
# 2. POST /cart/ — Add item to cart
# ═══════════════════════════════════════════════════

@router.post(
    "/",
    response_model=CartResponse,
    status_code=201,
    summary="Thêm vào giỏ hàng",
    description="Thêm sản phẩm vào giỏ. Nếu đã có sẽ tăng số lượng. Kiểm tra tồn kho.",
    responses={
        400: {"description": "Hết hàng hoặc không đủ tồn kho"},
        404: {"description": "Không tìm thấy sản phẩm"},
    },
)
async def add_to_cart(
    data: CartItemAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add item to cart. If product already in cart, increment quantity."""
    # Validate product exists and has stock
    result = await db.execute(select(Product).where(Product.id == data.product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.stock < data.quantity:
        raise HTTPException(status_code=400, detail=f"Product {product.name} out of stock")

    # Check if already in cart
    result = await db.execute(
        select(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.product_id == data.product_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        new_qty = existing.quantity + data.quantity
        if product.stock < new_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock. Available: {product.stock}, requested total: {new_qty}",
            )
        existing.quantity = new_qty
    else:
        cart_item = CartItem(
            user_id=current_user.id,
            product_id=data.product_id,
            quantity=data.quantity,
        )
        db.add(cart_item)

    await db.commit()

    cart_items = await _get_cart_items(db, current_user.id)
    return _build_cart_response(cart_items)


# ═══════════════════════════════════════════════════
# 3. PATCH /cart/{item_id} — Update quantity
# ═══════════════════════════════════════════════════

@router.patch(
    "/{item_id}",
    response_model=CartResponse,
    summary="Cập nhật số lượng",
    description="Cập nhật số lượng sản phẩm trong giỏ. Đặt quantity=0 để xóa.",
    responses={
        400: {"description": "Không đủ tồn kho"},
        404: {"description": "Không tìm thấy item trong giỏ"},
    },
)
async def update_cart_item(
    item_id: uuid.UUID,
    data: CartItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update cart item quantity. If quantity = 0, remove item."""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    cart_item = result.scalar_one_or_none()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    # Validate stock
    result = await db.execute(select(Product).where(Product.id == cart_item.product_id))
    product = result.scalar_one_or_none()
    if product and product.stock < data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stock. Available: {product.stock}",
        )

    cart_item.quantity = data.quantity
    await db.commit()

    cart_items = await _get_cart_items(db, current_user.id)
    return _build_cart_response(cart_items)


# ═══════════════════════════════════════════════════
# 4. DELETE /cart/{item_id} — Remove item
# ═══════════════════════════════════════════════════

@router.delete(
    "/{item_id}",
    response_model=CartResponse,
    summary="Xóa sản phẩm khỏi giỏ",
    description="Xóa một sản phẩm khỏi giỏ hàng.",
    responses={404: {"description": "Không tìm thấy item trong giỏ"}},
)
async def remove_cart_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a single item from the cart."""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    cart_item = result.scalar_one_or_none()
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    await db.delete(cart_item)
    await db.commit()

    cart_items = await _get_cart_items(db, current_user.id)
    return _build_cart_response(cart_items)


# ═══════════════════════════════════════════════════
# 5. DELETE /cart/ — Clear entire cart
# ═══════════════════════════════════════════════════

@router.delete(
    "/",
    response_model=CartResponse,
    summary="Xóa toàn bộ giỏ hàng",
    description="Xóa tất cả sản phẩm trong giỏ hàng.",
)
async def clear_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove all items from the cart."""
    await db.execute(
        delete(CartItem).where(CartItem.user_id == current_user.id)
    )
    await db.commit()

    return CartResponse(items=[], total_amount=0, total_items=0, unique_suppliers=0)


# ═══════════════════════════════════════════════════
# 6. POST /cart/checkout — Convert cart to order
# ═══════════════════════════════════════════════════

@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=201,
    summary="Thanh toán giỏ hàng",
    description="Chuyển giỏ hàng thành đơn hàng. Kiểm tra tồn kho, tính phí ship và gói quà, sau đó xóa giỏ.",
    responses={
        400: {"description": "Giỏ hàng trống hoặc thiếu thông tin người nhận"},
        404: {"description": "Không tìm thấy địa chỉ hoặc sản phẩm"},
    },
)
async def checkout(
    data: CartCheckout,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convert cart items into an order, then clear the cart."""
    cart_items = await _get_cart_items(db, current_user.id)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Resolve recipient info from address_id or direct fields
    recipient_name = data.recipient_name
    recipient_phone = data.recipient_phone
    recipient_address = data.recipient_address

    if data.address_id:
        addr_result = await db.execute(
            select(Address).where(Address.id == data.address_id, Address.user_id == current_user.id)
        )
        address = addr_result.scalar_one_or_none()
        if not address:
            raise HTTPException(status_code=404, detail="Address not found")

        recipient_name = address.recipient_name
        recipient_phone = address.recipient_phone
        parts = [address.address_line]
        if address.ward:
            parts.append(address.ward)
        if address.district:
            parts.append(address.district)
        parts.append(address.city)
        recipient_address = ", ".join(parts)
    else:
        if not recipient_name or not recipient_phone or not recipient_address:
            raise HTTPException(
                status_code=400,
                detail="Either address_id or (recipient_name, recipient_phone, recipient_address) must be provided",
            )

    # Validate stock and build order items
    total = 0.0
    order_items = []
    deadline = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES
    )

    for ci in cart_items:
        result = await db.execute(select(Product).where(Product.id == ci.product_id))
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {ci.product_id} no longer exists")
        if product.stock < ci.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Product {product.name} out of stock (available: {product.stock}, requested: {ci.quantity})",
            )

        product.stock -= ci.quantity
        subtotal = float(product.price) * ci.quantity
        total += subtotal

        order_items.append(
            OrderItem(
                product_id=product.id,
                supplier_id=product.shop_id,
                quantity=ci.quantity,
                unit_price=float(product.price),
                status=OrderItemStatus.REQUESTED,
                supplier_deadline=deadline,
            )
        )

    # Calculate shipping fee based on speed
    from app.services.shipping import ShippingSpeed, _get_speed_multipliers
    try:
        speed = ShippingSpeed(data.shipping_speed)
    except ValueError:
        speed = ShippingSpeed.STANDARD
    _, fee_mult = _get_speed_multipliers(speed)

    unique_suppliers = {oi.supplier_id for oi in order_items}
    shipping_fee = settings.SHIPPING_FEE_BASE + settings.SHIPPING_FEE_PER_SUPPLIER * len(unique_suppliers)
    shipping_fee = int(shipping_fee * fee_mult)
    total += shipping_fee

    # Gift wrapping fee
    if data.gift_wrapping:
        total += settings.GIFT_WRAPPING_FEE

    # Estimated delivery based on speed
    delivery_days = {ShippingSpeed.EXPRESS: 1, ShippingSpeed.STANDARD: 3, ShippingSpeed.ECONOMY: 5}
    estimated_delivery = datetime.now(timezone.utc) + timedelta(days=delivery_days.get(speed, 3))

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        total_amount=total,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        recipient_address=recipient_address,
        note=data.note,
        gift_message=data.gift_message,
        gift_card_template=data.gift_card_template,
        gift_wrapping=data.gift_wrapping,
        shipping_speed=data.shipping_speed,
        shipping_fee=shipping_fee,
        estimated_delivery=estimated_delivery,
    )
    db.add(order)
    await db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    # Clear cart
    await db.execute(
        delete(CartItem).where(CartItem.user_id == current_user.id)
    )

    await db.commit()
    await db.refresh(order)

    # Fire event
    await send_event("orders", {
        "type": "ORDER_CREATED",
        "order_id": str(order.id),
        "user_id": str(current_user.id),
        "source": "cart_checkout",
    })

    logger.info(f"Cart checkout → Order {order.id} created for user {current_user.id}")

    return order
