"""
Supplier Dashboard API
─────────────────────
Endpoints for NCC (suppliers) to manage their shop, products, and orders.
Authenticated via X-Supplier-API-Key header using get_current_supplier dependency.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBaseModel
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_supplier
from app.models.order import Order, OrderItem, OrderItemStatus
from app.models.product import Product
from app.models.review import Review
from app.models.shop import Shop
from app.schemas.product import ProductResponse, ProductUpdate
from app.schemas.shop import ShopResponse, ShopUpdate
from app.schemas.supplier import (
    SupplierOrderItemResponse,
    SupplierProductCreate,
    SupplierRejectRequest,
    SupplierStatsResponse,
)
from app.services.kafka_producer import send_event

router = APIRouter(prefix="/supplier", tags=["supplier"])


# ═══════════════════════════════════════════════════
# 1. SHOP PROFILE
# ═══════════════════════════════════════════════════

@router.get(
    "/profile",
    response_model=ShopResponse,
    summary="Xem profile shop",
    description="Lấy thông tin shop của nhà cung cấp đang đăng nhập.",
)
async def get_profile(
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Get own shop profile."""
    return current_supplier


@router.patch(
    "/profile",
    response_model=ShopResponse,
    summary="Cập nhật profile shop",
    description="Cập nhật thông tin shop: tên, mô tả, email, điện thoại, địa chỉ.",
)
async def update_profile(
    data: ShopUpdate,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Update own shop info (name, description, contact_email, contact_phone, address)."""
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_supplier, field, value)

    await db.commit()
    await db.refresh(current_supplier)
    return current_supplier


# ═══════════════════════════════════════════════════
# 2. PRODUCT MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/products",
    response_model=list[ProductResponse],
    summary="Danh sách sản phẩm của NCC",
    description="Lấy danh sách sản phẩm thuộc shop của nhà cung cấp, có phân trang.",
)
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """List own products with pagination."""
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.shop_id == current_supplier.id)
        .offset(skip)
        .limit(limit)
        .order_by(Product.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="NCC tạo sản phẩm",
    description="Tạo sản phẩm mới cho shop. shop_id tự động gán từ NCC đang đăng nhập.",
)
async def create_product(
    data: SupplierProductCreate,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Create a product. shop_id is auto-set from the authenticated supplier."""
    product = Product(
        shop_id=current_supplier.id,
        **data.model_dump(),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.patch(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="NCC cập nhật sản phẩm",
    description="Cập nhật sản phẩm của mình. Kiểm tra quyền sở hữu.",
    responses={
        403: {"description": "Sản phẩm không thuộc shop này"},
        404: {"description": "Không tìm thấy sản phẩm"},
    },
)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Update own product. Verifies ownership."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.shop_id != current_supplier.id:
        raise HTTPException(status_code=403, detail="You do not own this product")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="NCC xóa sản phẩm",
    description="Xóa sản phẩm của mình. Kiểm tra quyền sở hữu.",
    responses={
        403: {"description": "Sản phẩm không thuộc shop này"},
        404: {"description": "Không tìm thấy sản phẩm"},
    },
)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Delete own product. Verifies ownership."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.shop_id != current_supplier.id:
        raise HTTPException(status_code=403, detail="You do not own this product")

    await db.delete(product)
    await db.commit()


# ═══════════════════════════════════════════════════
# 3. ORDER MANAGEMENT
# ═══════════════════════════════════════════════════

@router.get(
    "/orders",
    response_model=list[SupplierOrderItemResponse],
    summary="Danh sách đơn hàng của NCC",
    description="Lấy các order item thuộc NCC này, kèm thông tin người nhận. Lọc theo trạng thái.",
)
async def list_orders(
    status_filter: OrderItemStatus | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """List order items belonging to this supplier. Join with Order for recipient info."""
    query = (
        select(OrderItem, Order, Product.name.label("product_name"))
        .join(Order, OrderItem.order_id == Order.id)
        .outerjoin(Product, OrderItem.product_id == Product.id)
        .where(OrderItem.supplier_id == current_supplier.id)
    )

    if status_filter is not None:
        query = query.where(OrderItem.status == status_filter)

    query = query.order_by(OrderItem.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)

    items = []
    for row in result.all():
        item = row[0]  # OrderItem
        order = row[1]  # Order
        product_name = row[2]  # Product.name
        items.append(
            SupplierOrderItemResponse(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=product_name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                status=item.status,
                supplier_deadline=item.supplier_deadline,
                reject_reason=item.reject_reason,
                recipient_name=order.recipient_name,
                recipient_phone=order.recipient_phone,
                recipient_address=order.recipient_address,
                order_created_at=order.created_at,
            )
        )

    return items


@router.get(
    "/orders/{order_id}",
    response_model=list[SupplierOrderItemResponse],
    summary="Chi tiết đơn hàng của NCC",
    description="Xem chi tiết các item trong đơn hàng thuộc về NCC này.",
    responses={404: {"description": "Không tìm thấy item nào cho đơn hàng này"}},
)
async def get_order_detail(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Get specific order details — only items belonging to this supplier."""
    result = await db.execute(
        select(OrderItem, Order, Product.name.label("product_name"))
        .join(Order, OrderItem.order_id == Order.id)
        .outerjoin(Product, OrderItem.product_id == Product.id)
        .where(OrderItem.order_id == order_id, OrderItem.supplier_id == current_supplier.id)
        .order_by(OrderItem.created_at.desc())
    )

    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No items found for this order")

    items = []
    for row in rows:
        item = row[0]
        order = row[1]
        product_name = row[2]
        items.append(
            SupplierOrderItemResponse(
                id=item.id,
                order_id=item.order_id,
                product_id=item.product_id,
                product_name=product_name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                status=item.status,
                supplier_deadline=item.supplier_deadline,
                reject_reason=item.reject_reason,
                recipient_name=order.recipient_name,
                recipient_phone=order.recipient_phone,
                recipient_address=order.recipient_address,
                order_created_at=order.created_at,
            )
        )

    return items


@router.post(
    "/orders/{order_id}/items/{item_id}/accept",
    summary="NCC chấp nhận item",
    description="Chấp nhận một order item. Kiểm tra quyền sở hữu và trạng thái REQUESTED.",
    responses={
        400: {"description": "Item đã được xử lý"},
        403: {"description": "Item không thuộc NCC này"},
        404: {"description": "Không tìm thấy order item"},
    },
)
async def accept_order_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Accept an order item (set status to CONFIRMED). Verifies ownership."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.supplier_id != current_supplier.id:
        raise HTTPException(status_code=403, detail="You do not own this order item")
    if item.status != OrderItemStatus.REQUESTED:
        raise HTTPException(status_code=400, detail=f"Item already {item.status.value}")

    item.status = OrderItemStatus.CONFIRMED
    await db.commit()

    logger.info(f"Supplier {current_supplier.id} ACCEPTED item {item_id}")

    await send_event("orders", {
        "type": "SUPPLIER_RESPONDED",
        "order_id": str(order_id),
        "item_id": str(item_id),
        "accepted": True,
    })

    return {"ok": True, "status": item.status.value}


@router.post(
    "/orders/{order_id}/items/{item_id}/reject",
    summary="NCC từ chối item",
    description="Từ chối một order item kèm lý do. Kiểm tra quyền sở hữu. Gửi Kafka event.",
    responses={
        400: {"description": "Item đã được xử lý"},
        403: {"description": "Item không thuộc NCC này"},
        404: {"description": "Không tìm thấy order item"},
    },
)
async def reject_order_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: SupplierRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Reject an order item with reason. Verifies ownership. Fires Kafka event."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.supplier_id != current_supplier.id:
        raise HTTPException(status_code=403, detail="You do not own this order item")
    if item.status != OrderItemStatus.REQUESTED:
        raise HTTPException(status_code=400, detail=f"Item already {item.status.value}")

    item.status = OrderItemStatus.REJECTED
    item.reject_reason = data.reason
    await db.commit()

    logger.info(f"Supplier {current_supplier.id} REJECTED item {item_id}: {data.reason}")

    await send_event("orders", {
        "type": "SUPPLIER_RESPONDED",
        "order_id": str(order_id),
        "item_id": str(item_id),
        "accepted": False,
        "reject_reason": data.reason,
    })

    return {"ok": True, "status": item.status.value}


# ═══════════════════════════════════════════════════
# 4. ANALYTICS / STATS
# ═══════════════════════════════════════════════════

@router.get(
    "/stats",
    response_model=SupplierStatsResponse,
    summary="Thống kê NCC",
    description="Dashboard thống kê: tổng sản phẩm, đơn hàng, đơn chờ xử lý, doanh thu và đánh giá trung bình.",
)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_supplier: Shop = Depends(get_current_supplier),
):
    """Return dashboard stats for the authenticated supplier."""
    # Total products
    total_products_result = await db.execute(
        select(func.count(Product.id)).where(Product.shop_id == current_supplier.id)
    )
    total_products = total_products_result.scalar() or 0

    # Total order items for this supplier
    total_orders_result = await db.execute(
        select(func.count(OrderItem.id)).where(OrderItem.supplier_id == current_supplier.id)
    )
    total_orders = total_orders_result.scalar() or 0

    # Pending orders (REQUESTED)
    pending_orders_result = await db.execute(
        select(func.count(OrderItem.id)).where(
            OrderItem.supplier_id == current_supplier.id,
            OrderItem.status == OrderItemStatus.REQUESTED,
        )
    )
    pending_orders = pending_orders_result.scalar() or 0

    # Revenue: sum of (unit_price * quantity) for CONFIRMED+ items
    confirmed_statuses = [
        OrderItemStatus.CONFIRMED,
        OrderItemStatus.PICKED_UP,
        OrderItemStatus.AT_WAREHOUSE,
    ]
    revenue_result = await db.execute(
        select(func.sum(OrderItem.unit_price * OrderItem.quantity)).where(
            OrderItem.supplier_id == current_supplier.id,
            OrderItem.status.in_(confirmed_statuses),
        )
    )
    revenue = float(revenue_result.scalar() or 0)

    # Avg rating: average rating of this supplier's products from reviews
    avg_rating_result = await db.execute(
        select(func.avg(Review.rating))
        .join(Product, Review.product_id == Product.id)
        .where(Product.shop_id == current_supplier.id)
    )
    avg_rating_value = avg_rating_result.scalar()
    avg_rating = round(float(avg_rating_value), 2) if avg_rating_value is not None else None

    return SupplierStatsResponse(
        total_products=total_products,
        total_orders=total_orders,
        pending_orders=pending_orders,
        revenue=revenue,
        avg_rating=avg_rating,
    )


# ---------------------------------------------------------------------------
# FCM Token Registration for Supplier
# ---------------------------------------------------------------------------

class SupplierFCMTokenRequest(PydanticBaseModel):
    fcm_token: str


@router.post(
    "/fcm-token",
    summary="Đăng ký FCM token cho NCC",
    description="Lưu FCM token để nhà cung cấp nhận push notification khi có đơn hàng mới.",
)
async def register_supplier_fcm_token(
    data: SupplierFCMTokenRequest,
    shop: Shop = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    shop.fcm_token = data.fcm_token
    await db.commit()
    return {"detail": "FCM token registered"}
