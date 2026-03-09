"""
Order API - Full flow:
1. Customer creates order → notify suppliers
2. Supplier accepts/rejects → if any reject/timeout → notify customer to replace
3. All confirmed → dispatch shipper → pickup → warehouse → pack → ship → deliver
4. Customer can cancel at any time → apologize email
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.order import Order, OrderItem, OrderItemStatus, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.order import (
    CancelOrderRequest,
    OrderCreate,
    OrderResponse,
    ReplaceItemRequest,
    SupplierRespondRequest,
)
from app.services.kafka_producer import send_event

router = APIRouter(prefix="/orders", tags=["orders"])

# ─── WebSocket connections for real-time tracking ───
_ws_connections: dict[str, list[WebSocket]] = {}


# ═══════════════════════════════════════════════════
# 1. CUSTOMER: Create order
# ═══════════════════════════════════════════════════

@router.post("/", response_model=OrderResponse, status_code=201)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create order → split by supplier → fire ORDER_CREATED → notify each supplier."""
    total = 0.0
    order_items = []
    deadline = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES
    )

    for item_data in data.items:
        result = await db.execute(
            select(Product).where(Product.id == item_data.product_id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
        if product.stock < item_data.quantity:
            raise HTTPException(status_code=400, detail=f"Product {product.name} out of stock")

        subtotal = float(product.price) * item_data.quantity
        total += subtotal

        order_items.append(
            OrderItem(
                product_id=product.id,
                supplier_id=product.shop_id,
                quantity=item_data.quantity,
                unit_price=float(product.price),
                status=OrderItemStatus.REQUESTED,
                supplier_deadline=deadline,
            )
        )

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        total_amount=total,
        recipient_name=data.recipient_name,
        recipient_phone=data.recipient_phone,
        recipient_address=data.recipient_address,
        note=data.note,
    )
    db.add(order)
    await db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    await db.commit()
    await db.refresh(order)

    # Fire event → order_processor worker picks up and notifies suppliers
    await send_event("orders", {
        "type": "ORDER_CREATED",
        "order_id": str(order.id),
        "user_id": str(current_user.id),
    })

    return order


# ═══════════════════════════════════════════════════
# 2. SUPPLIER: Accept or Reject items
# ═══════════════════════════════════════════════════

@router.post("/{order_id}/items/{item_id}/respond")
async def supplier_respond(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: SupplierRespondRequest,
    db: AsyncSession = Depends(get_db),
):
    """Supplier accepts or rejects an order item."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if item.status != OrderItemStatus.REQUESTED:
        raise HTTPException(status_code=400, detail=f"Item already {item.status.value}")

    if data.accepted:
        item.status = OrderItemStatus.CONFIRMED
        logger.info(f"Supplier ACCEPTED item {item_id}")
    else:
        item.status = OrderItemStatus.REJECTED
        item.reject_reason = data.reject_reason
        logger.info(f"Supplier REJECTED item {item_id}: {data.reject_reason}")

    await db.commit()

    # Fire event to check if all items are resolved
    await send_event("orders", {
        "type": "SUPPLIER_RESPONDED",
        "order_id": str(order_id),
        "item_id": str(item_id),
        "accepted": data.accepted,
    })

    await _notify_ws(str(order_id), {
        "event": "supplier_responded",
        "item_id": str(item_id),
        "accepted": data.accepted,
    })

    return {"ok": True, "status": item.status.value}


# ═══════════════════════════════════════════════════
# 3. CUSTOMER: Replace rejected/timeout item
# ═══════════════════════════════════════════════════

@router.post("/{order_id}/items/{item_id}/replace", response_model=OrderResponse)
async def replace_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ReplaceItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer replaces a rejected/timeout item with a new product."""
    # Validate order belongs to user
    order_result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = order_result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.WAITING_REPLACEMENT:
        raise HTTPException(status_code=400, detail="Order is not waiting for replacement")

    # Validate old item
    item_result = await db.execute(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id)
    )
    old_item = item_result.scalar_one_or_none()
    if not old_item:
        raise HTTPException(status_code=404, detail="Order item not found")
    if old_item.status not in (OrderItemStatus.REJECTED, OrderItemStatus.TIMEOUT):
        raise HTTPException(status_code=400, detail="Item is not rejected or timed out")

    # Validate new product
    product_result = await db.execute(
        select(Product).where(Product.id == data.new_product_id)
    )
    new_product = product_result.scalar_one_or_none()
    if not new_product:
        raise HTTPException(status_code=404, detail="New product not found")
    if new_product.stock < data.quantity:
        raise HTTPException(status_code=400, detail="New product out of stock")

    # Mark old item as replaced
    old_item.status = OrderItemStatus.REPLACED

    # Create new item
    deadline = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES
    )
    new_item = OrderItem(
        order_id=order_id,
        product_id=new_product.id,
        supplier_id=new_product.shop_id,
        quantity=data.quantity,
        unit_price=float(new_product.price),
        status=OrderItemStatus.REQUESTED,
        supplier_deadline=deadline,
    )
    old_item.replaced_by_item_id = new_item.id
    db.add(new_item)

    # Recalculate total
    order.total_amount = float(order.total_amount) - (float(old_item.unit_price) * old_item.quantity) + (float(new_product.price) * data.quantity)
    order.status = OrderStatus.PENDING

    await db.commit()
    await db.refresh(order)

    # Notify new supplier
    await send_event("orders", {
        "type": "ITEM_REPLACED",
        "order_id": str(order_id),
        "new_item_id": str(new_item.id),
        "supplier_id": str(new_product.shop_id),
    })

    return order


# ═══════════════════════════════════════════════════
# 4. CUSTOMER: Cancel order
# ═══════════════════════════════════════════════════

@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: uuid.UUID,
    data: CancelOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Customer cancels the order → apologize email."""
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    non_cancellable = {OrderStatus.SHIPPING, OrderStatus.DELIVERED, OrderStatus.CANCELLED}
    if order.status in non_cancellable:
        raise HTTPException(status_code=400, detail=f"Cannot cancel order in {order.status.value} status")

    order.status = OrderStatus.CANCELLED
    order.cancel_reason = data.reason

    # Cancel all active items
    for item in order.items:
        if item.status not in (OrderItemStatus.REJECTED, OrderItemStatus.TIMEOUT, OrderItemStatus.REPLACED, OrderItemStatus.CANCELLED):
            item.status = OrderItemStatus.CANCELLED

    await db.commit()
    await db.refresh(order)

    await send_event("orders", {
        "type": "ORDER_CANCELLED",
        "order_id": str(order_id),
        "user_id": str(current_user.id),
        "reason": data.reason,
    })

    await _notify_ws(str(order_id), {
        "event": "order_cancelled",
        "order_id": str(order_id),
    })

    return order


# ═══════════════════════════════════════════════════
# 5. INTERNAL: Update item status (shipper/warehouse/admin)
# ═══════════════════════════════════════════════════

@router.patch("/{order_id}/items/{item_id}/status")
async def update_order_item_status(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    new_status: OrderItemStatus,
    db: AsyncSession = Depends(get_db),
):
    """Internal API: shipper/warehouse updates item status along the fulfillment flow."""
    result = await db.execute(
        select(OrderItem).where(OrderItem.id == item_id, OrderItem.order_id == order_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")

    item.status = new_status
    await db.commit()

    # Fire event for warehouse logic
    await send_event("orders", {
        "type": "ITEM_STATUS_UPDATED",
        "order_id": str(order_id),
        "item_id": str(item_id),
        "status": new_status.value,
    })

    await _notify_ws(str(order_id), {
        "event": "item_status_updated",
        "item_id": str(item_id),
        "status": new_status.value,
    })

    return {"ok": True, "status": new_status.value}


# ═══════════════════════════════════════════════════
# 6. READ endpoints
# ═══════════════════════════════════════════════════

@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order).where(Order.user_id == current_user.id).order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order).where(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ═══════════════════════════════════════════════════
# 7. WebSocket: Real-time tracking
# ═══════════════════════════════════════════════════

@router.websocket("/ws/{order_id}")
async def order_tracking_ws(websocket: WebSocket, order_id: str):
    await websocket.accept()
    _ws_connections.setdefault(order_id, []).append(websocket)
    logger.info(f"WS connected for order {order_id}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        _ws_connections[order_id].remove(websocket)
        logger.info(f"WS disconnected for order {order_id}")


async def _notify_ws(order_id: str, data: dict) -> None:
    for ws in _ws_connections.get(order_id, []):
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            pass
