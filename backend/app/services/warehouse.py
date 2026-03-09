"""
Warehouse service - handles fulfillment flow after all suppliers confirmed.
"""

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem, OrderItemStatus, OrderStatus
from app.services.kafka_producer import send_event


async def check_all_items_resolved(db: AsyncSession, order_id: str) -> None:
    """
    After each supplier response, check if all items are resolved:
    - All CONFIRMED → move to ALL_CONFIRMED → dispatch shipper
    - Any REJECTED/TIMEOUT → move to WAITING_REPLACEMENT → notify customer
    """
    order_result = await db.execute(select(Order).where(Order.id == order_id))
    order = order_result.scalar_one_or_none()
    if not order or order.status == OrderStatus.CANCELLED:
        return

    items_result = await db.execute(
        select(OrderItem).where(
            OrderItem.order_id == order_id,
            OrderItem.status.notin_([OrderItemStatus.REPLACED, OrderItemStatus.CANCELLED]),
        )
    )
    active_items = items_result.scalars().all()

    # Still waiting for some suppliers
    pending = [i for i in active_items if i.status == OrderItemStatus.REQUESTED]
    if pending:
        return

    rejected = [i for i in active_items if i.status in (OrderItemStatus.REJECTED, OrderItemStatus.TIMEOUT)]
    confirmed = [i for i in active_items if i.status == OrderItemStatus.CONFIRMED]

    if rejected:
        order.status = OrderStatus.WAITING_REPLACEMENT
        await db.commit()

        await send_event("notifications", {
            "type": "ITEMS_REJECTED",
            "order_id": order_id,
            "user_id": str(order.user_id),
            "rejected_item_ids": [str(i.id) for i in rejected],
        })
        logger.info(f"Order {order_id}: {len(rejected)} items rejected, waiting replacement")

    elif confirmed and not rejected:
        order.status = OrderStatus.ALL_CONFIRMED
        await db.commit()

        await send_event("orders", {
            "type": "ALL_CONFIRMED",
            "order_id": order_id,
            "user_id": str(order.user_id),
        })
        logger.info(f"Order {order_id}: all items confirmed!")


async def check_all_at_warehouse(db: AsyncSession, order_id: str) -> None:
    """When an item arrives at warehouse, check if entire order is ready to pack."""
    items_result = await db.execute(
        select(OrderItem).where(
            OrderItem.order_id == order_id,
            OrderItem.status.notin_([OrderItemStatus.REPLACED, OrderItemStatus.CANCELLED]),
        )
    )
    active_items = items_result.scalars().all()

    all_at_warehouse = all(i.status == OrderItemStatus.AT_WAREHOUSE for i in active_items)
    if all_at_warehouse and active_items:
        order_result = await db.execute(select(Order).where(Order.id == order_id))
        order = order_result.scalar_one_or_none()
        if order:
            order.status = OrderStatus.PACKING
            await db.commit()

        await send_event("orders", {
            "type": "READY_TO_PACK",
            "order_id": order_id,
            "item_count": len(active_items),
        })
        logger.info(f"Order {order_id}: all {len(active_items)} items at warehouse → PACKING")
