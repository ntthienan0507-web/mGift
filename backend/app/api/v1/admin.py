"""
Admin API
─────────
Platform-wide administration endpoints.
All endpoints require admin privileges via get_admin_user dependency.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.models.category import Category
from app.models.order import Order, OrderItem, OrderItemStatus, OrderStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.schemas.admin import (
    AdminOrderDetailResponse,
    AdminOrderItemResponse,
    AdminOrderResponse,
    AdminProductResponse,
    AdminShopResponse,
    AdminShopUpdate,
    AdminStatsResponse,
    AdminUserResponse,
    AdminUserUpdate,
)
from app.services.kafka_producer import send_event
from app.services.push import push_order_update, push_to_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# ═══════════════════════════════════════════════════
# 1. PLATFORM STATS
# ═══════════════════════════════════════════════════

@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Platform-wide statistics",
    description="Get total users, shops, products, orders, and revenue across the platform.",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Return platform-wide dashboard stats."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_shops = (await db.execute(select(func.count(Shop.id)))).scalar() or 0
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0

    revenue_result = await db.execute(select(func.sum(Order.total_amount)))
    total_revenue = float(revenue_result.scalar() or 0)

    return AdminStatsResponse(
        total_users=total_users,
        total_shops=total_shops,
        total_products=total_products,
        total_orders=total_orders,
        total_revenue=total_revenue,
    )


# ═══════════════════════════════════════════════════
# 2. USER MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/users",
    response_model=list[AdminUserResponse],
    summary="List all users",
    description="List all users with pagination and optional search by email or name.",
)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by email or full_name"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all users with optional search."""
    query = select(User)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserResponse,
    summary="Update user",
    description="Toggle is_admin or update user fields.",
    responses={404: {"description": "User not found"}},
)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update user fields (including is_admin toggle)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


# ═══════════════════════════════════════════════════
# 3. SHOP MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/shops",
    response_model=list[AdminShopResponse],
    summary="List all shops",
    description="List all shops (including inactive) with pagination.",
)
async def list_shops(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all shops including inactive ones."""
    result = await db.execute(
        select(Shop).order_by(Shop.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.patch(
    "/shops/{shop_id}",
    response_model=AdminShopResponse,
    summary="Update shop",
    description="Activate/deactivate shop or update other fields.",
    responses={404: {"description": "Shop not found"}},
)
async def update_shop(
    shop_id: uuid.UUID,
    data: AdminShopUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update shop fields (including is_active toggle)."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(shop, field, value)

    await db.commit()
    await db.refresh(shop)
    return shop


@router.delete(
    "/shops/{shop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete shop",
    description="Permanently delete a shop and its associated data.",
    responses={404: {"description": "Shop not found"}},
)
async def delete_shop(
    shop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Delete a shop."""
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    await db.delete(shop)
    await db.commit()


# ═══════════════════════════════════════════════════
# 4. PRODUCT MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/products",
    response_model=list[AdminProductResponse],
    summary="List all products",
    description="List all products with pagination, search by name, and optional shop filter.",
)
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="Search by product name"),
    shop_id: uuid.UUID | None = Query(None, description="Filter by shop"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all products with optional search and shop filter."""
    query = (
        select(Product, Shop.name.label("shop_name"), Category.name.label("category_name"))
        .outerjoin(Shop, Product.shop_id == Shop.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .options(selectinload(Product.images))
    )

    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    if shop_id:
        query = query.where(Product.shop_id == shop_id)

    query = query.order_by(Product.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)

    products = []
    for row in result.all():
        product = row[0]
        shop_name = row[1]
        category_name = row[2]
        products.append(
            AdminProductResponse(
                id=product.id,
                shop_id=product.shop_id,
                shop_name=shop_name,
                category_id=product.category_id,
                category_name=category_name,
                name=product.name,
                description=product.description,
                price=float(product.price),
                stock=product.stock,
                images=product.images,
                created_at=product.created_at,
            )
        )

    return products


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete product",
    description="Permanently delete a product.",
    responses={404: {"description": "Product not found"}},
)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Delete a product."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)
    await db.commit()


# ═══════════════════════════════════════════════════
# 5. ORDER MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/orders",
    response_model=list[AdminOrderResponse],
    summary="List all orders",
    description="List all orders with pagination and optional status filter.",
)
async def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: OrderStatus | None = Query(None, alias="status", description="Filter by order status"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all orders with optional status filter."""
    query = (
        select(
            Order,
            User.email.label("user_email"),
            func.count(OrderItem.id).label("item_count"),
        )
        .outerjoin(User, Order.user_id == User.id)
        .outerjoin(OrderItem, OrderItem.order_id == Order.id)
        .group_by(Order.id, User.email)
    )

    if status_filter is not None:
        query = query.where(Order.status == status_filter)

    query = query.order_by(Order.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)

    orders = []
    for row in result.all():
        order = row[0]
        user_email = row[1]
        item_count = row[2]
        orders.append(
            AdminOrderResponse(
                id=order.id,
                user_id=order.user_id,
                user_email=user_email,
                status=order.status,
                total_amount=float(order.total_amount),
                recipient_name=order.recipient_name,
                recipient_phone=order.recipient_phone,
                recipient_address=order.recipient_address,
                note=order.note,
                shipping_fee=float(order.shipping_fee),
                item_count=item_count,
                created_at=order.created_at,
            )
        )

    return orders


@router.get(
    "/orders/{order_id}",
    response_model=AdminOrderDetailResponse,
    summary="Chi tiết đơn hàng (admin)",
    description="Xem chi tiết đơn hàng, danh sách items, trạng thái thanh toán.",
)
async def get_order_detail(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get user email
    user_result = await db.execute(select(User.email).where(User.id == order.user_id))
    user_email = user_result.scalar_one_or_none()

    # Get items with product + supplier names
    items_result = await db.execute(
        select(OrderItem).where(OrderItem.order_id == order_id)
    )
    items = []
    for item in items_result.scalars().all():
        prod_result = await db.execute(select(Product.name).where(Product.id == item.product_id))
        prod_name = prod_result.scalar_one_or_none()
        shop_result = await db.execute(select(Shop.name).where(Shop.id == item.supplier_id))
        shop_name = shop_result.scalar_one_or_none()
        items.append(AdminOrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=prod_name,
            supplier_id=item.supplier_id,
            supplier_name=shop_name,
            quantity=item.quantity,
            unit_price=float(item.unit_price),
            status=item.status.value,
            supplier_deadline=item.supplier_deadline,
            reject_reason=item.reject_reason,
        ))

    # Payment info
    pay_result = await db.execute(select(Payment).where(Payment.order_id == order_id))
    payment = pay_result.scalar_one_or_none()

    return AdminOrderDetailResponse(
        id=order.id,
        user_id=order.user_id,
        user_email=user_email,
        status=order.status,
        total_amount=float(order.total_amount),
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        recipient_address=order.recipient_address,
        note=order.note,
        gift_message=order.gift_message,
        shipping_speed=order.shipping_speed,
        shipping_fee=float(order.shipping_fee),
        estimated_delivery=order.estimated_delivery,
        item_count=len(items),
        created_at=order.created_at,
        items=items,
        payment_status=payment.status.value if payment else None,
        payment_method=payment.method.value if payment else None,
    )


# ═══════════════════════════════════════════════════
# 6. ORDER FULFILLMENT (Admin actions)
# ═══════════════════════════════════════════════════

# Allowed transitions for order status
_FULFILLMENT_TRANSITIONS: dict[OrderStatus, list[OrderStatus]] = {
    OrderStatus.ALL_CONFIRMED: [OrderStatus.DISPATCHING],
    OrderStatus.DISPATCHING: [OrderStatus.PICKING_UP],
    OrderStatus.PICKING_UP: [OrderStatus.AT_WAREHOUSE],
    OrderStatus.AT_WAREHOUSE: [OrderStatus.PACKING],
    OrderStatus.PACKING: [OrderStatus.SHIPPING],
    OrderStatus.SHIPPING: [OrderStatus.DELIVERED],
}

_STATUS_PUSH_MESSAGES = {
    OrderStatus.DISPATCHING: "Đang điều shipper lấy hàng từ NCC",
    OrderStatus.PICKING_UP: "Shipper đang gom hàng từ các NCC",
    OrderStatus.AT_WAREHOUSE: "Hàng đã về kho mGift, đang kiểm tra",
    OrderStatus.PACKING: "Đơn hàng đang được đóng gói tinh tế",
    OrderStatus.SHIPPING: "Đơn hàng đang giao đến bạn!",
    OrderStatus.DELIVERED: "Đơn hàng đã giao thành công! Cảm ơn bạn!",
}


@router.post(
    "/orders/{order_id}/advance",
    summary="Chuyển trạng thái đơn hàng",
    description="""
Chuyển đơn hàng sang bước tiếp theo trong quy trình fulfillment.
Flow: all_confirmed → dispatching → picking_up → at_warehouse → packing → shipping → delivered.
Khi delivered + COD → tự động hoàn thành thanh toán.
    """,
)
async def advance_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Move order to next fulfillment step. Auto-completes COD payment on delivery."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed_next = _FULFILLMENT_TRANSITIONS.get(order.status)
    if not allowed_next:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể chuyển tiếp từ trạng thái '{order.status.value}'",
        )

    new_status = allowed_next[0]
    old_status = order.status
    order.status = new_status

    # Update all active items status to match order phase
    items_result = await db.execute(
        select(OrderItem).where(
            OrderItem.order_id == order_id,
            OrderItem.status.notin_([
                OrderItemStatus.REJECTED, OrderItemStatus.TIMEOUT,
                OrderItemStatus.REPLACED, OrderItemStatus.CANCELLED,
            ]),
        )
    )
    active_items = items_result.scalars().all()

    # Map order status → item status
    item_status_map = {
        OrderStatus.PICKING_UP: OrderItemStatus.CONFIRMED,
        OrderStatus.AT_WAREHOUSE: OrderItemStatus.AT_WAREHOUSE,
    }
    if new_status == OrderStatus.PICKING_UP:
        for item in active_items:
            if item.status == OrderItemStatus.CONFIRMED:
                item.status = OrderItemStatus.PICKED_UP
    elif new_status == OrderStatus.AT_WAREHOUSE:
        for item in active_items:
            item.status = OrderItemStatus.AT_WAREHOUSE

    # COD: auto-complete payment when delivered
    if new_status == OrderStatus.DELIVERED:
        pay_result = await db.execute(
            select(Payment).where(Payment.order_id == order_id)
        )
        payment = pay_result.scalar_one_or_none()
        if payment and payment.method == PaymentMethod.COD and payment.status != PaymentStatus.COMPLETED:
            payment.status = PaymentStatus.COMPLETED
            payment.paid_at = datetime.now(timezone.utc)
            logger.info(f"COD payment auto-completed for order {order_id}")

    await db.commit()

    # Push notification to customer
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one_or_none()
    if user:
        msg = _STATUS_PUSH_MESSAGES.get(new_status, f"Trạng thái đơn: {new_status.value}")
        await push_order_update(
            fcm_token=user.fcm_token,
            order_id=str(order_id),
            status=new_status.value,
            message=msg,
        )

    # Fire Kafka event
    await send_event("orders", {
        "type": "ORDER_STATUS_ADVANCED",
        "order_id": str(order_id),
        "from_status": old_status.value,
        "to_status": new_status.value,
    })

    logger.info(f"Order {order_id}: {old_status.value} → {new_status.value}")

    return {
        "ok": True,
        "order_id": str(order_id),
        "previous_status": old_status.value,
        "new_status": new_status.value,
    }


@router.post(
    "/orders/{order_id}/set-status",
    summary="Đặt trạng thái đơn hàng (manual)",
    description="Admin set trạng thái cụ thể cho đơn hàng (dùng khi cần skip step hoặc fix lỗi).",
)
async def set_order_status(
    order_id: uuid.UUID,
    new_status: OrderStatus,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin force-set order status."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = new_status
    await db.commit()

    # Push to customer
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one_or_none()
    if user and new_status in _STATUS_PUSH_MESSAGES:
        await push_order_update(
            fcm_token=user.fcm_token,
            order_id=str(order_id),
            status=new_status.value,
            message=_STATUS_PUSH_MESSAGES[new_status],
        )

    logger.info(f"Order {order_id}: force {old_status.value} → {new_status.value}")

    return {"ok": True, "previous_status": old_status.value, "new_status": new_status.value}
