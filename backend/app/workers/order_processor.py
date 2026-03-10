"""
Kafka consumer for 'orders' topic.

Handles the full order lifecycle:
- ORDER_CREATED → notify each supplier (email)
- SUPPLIER_RESPONDED → check all resolved → next step
- ITEM_REPLACED → notify new supplier
- ALL_CONFIRMED → dispatch shipper
- ITEM_STATUS_UPDATED → warehouse checks
- READY_TO_PACK → log
- ORDER_CANCELLED → notify customer with apology

Run: python -m app.workers.order_processor
"""

import asyncio
import json
from itertools import groupby
from operator import attrgetter

from aiokafka import AIOKafkaConsumer
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models.order import Order, OrderItem, OrderItemStatus
from app.models.product import Product
from app.models.shop import Shop
from app.models.user import User
from app.services.ai_engine import search_similar_products
from app.services.kafka_producer import send_event
from app.services.notification import (
    notify_customer_all_confirmed,
    notify_customer_item_rejected,
    notify_customer_order_cancelled,
    notify_supplier_new_order,
)
from app.services.push import (
    push_new_order_to_supplier,
    push_order_update,
    push_to_admin,
)
from app.services.warehouse import check_all_at_warehouse, check_all_items_resolved


async def _get_admin_fcm_tokens(db: AsyncSession) -> list[str]:
    """Get FCM tokens of all admin users."""
    result = await db.execute(
        select(User).where(User.is_admin.is_(True), User.fcm_token.isnot(None))
    )
    return [u.fcm_token for u in result.scalars().all() if u.fcm_token]


async def handle_order_created(event: dict) -> None:
    """Split order by supplier → email each supplier with their items."""
    order_id = event["order_id"]

    async with async_session() as db:
        order_result = await db.execute(select(Order).where(Order.id == order_id))
        order = order_result.scalar_one_or_none()
        if not order:
            return

        items_result = await db.execute(
            select(OrderItem).where(OrderItem.order_id == order_id)
        )
        items = items_result.scalars().all()

        # Group items by supplier
        supplier_groups: dict[str, list[OrderItem]] = {}
        for item in items:
            sid = str(item.supplier_id)
            supplier_groups.setdefault(sid, []).append(item)

        # Notify each supplier
        for supplier_id, supplier_items in supplier_groups.items():
            shop_result = await db.execute(select(Shop).where(Shop.id == supplier_id))
            shop = shop_result.scalar_one_or_none()
            if not shop or not shop.contact_email:
                logger.warning(f"Supplier {supplier_id} has no contact email")
                continue

            # Build item details for email
            email_items = []
            for si in supplier_items:
                prod_result = await db.execute(select(Product).where(Product.id == si.product_id))
                prod = prod_result.scalar_one_or_none()
                email_items.append({
                    "product_name": prod.name if prod else "Unknown",
                    "quantity": si.quantity,
                    "unit_price": float(si.unit_price),
                })

            await notify_supplier_new_order(
                supplier_email=shop.contact_email,
                supplier_name=shop.name,
                order_id=order_id,
                items=email_items,
            )

            # Firebase push to supplier
            await push_new_order_to_supplier(
                fcm_token=shop.fcm_token,
                order_id=order_id,
                item_count=len(supplier_items),
            )

            # Set timeout in Redis via supplier_handler
            await send_event("suppliers", {
                "type": "SUPPLIER_NOTIFIED",
                "order_id": order_id,
                "supplier_id": supplier_id,
                "item_ids": [str(i.id) for i in supplier_items],
            })

        # Firebase push to all admins
        admin_tokens = await _get_admin_fcm_tokens(db)
        await push_to_admin(
            fcm_tokens=admin_tokens,
            title="Đơn hàng mới!",
            body=f"Đơn #{order_id[:8]} - {len(items)} sản phẩm từ {len(supplier_groups)} NCC",
            url=f"/admin/orders",
        )

        logger.info(f"ORDER_CREATED {order_id}: notified {len(supplier_groups)} suppliers + {len(admin_tokens)} admins")


async def handle_supplier_responded(event: dict) -> None:
    """After supplier responds, check if all items are resolved."""
    order_id = event["order_id"]
    async with async_session() as db:
        await check_all_items_resolved(db, order_id)


async def handle_item_replaced(event: dict) -> None:
    """Notify the new supplier about the replacement item."""
    order_id = event["order_id"]
    new_item_id = event["new_item_id"]
    supplier_id = event["supplier_id"]

    async with async_session() as db:
        shop_result = await db.execute(select(Shop).where(Shop.id == supplier_id))
        shop = shop_result.scalar_one_or_none()

        item_result = await db.execute(select(OrderItem).where(OrderItem.id == new_item_id))
        item = item_result.scalar_one_or_none()

        if shop and shop.contact_email and item:
            prod_result = await db.execute(select(Product).where(Product.id == item.product_id))
            prod = prod_result.scalar_one_or_none()

            await notify_supplier_new_order(
                supplier_email=shop.contact_email,
                supplier_name=shop.name,
                order_id=order_id,
                items=[{
                    "product_name": prod.name if prod else "Unknown",
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                }],
            )

            await send_event("suppliers", {
                "type": "SUPPLIER_NOTIFIED",
                "order_id": order_id,
                "supplier_id": supplier_id,
                "item_ids": [str(new_item_id)],
            })

    logger.info(f"ITEM_REPLACED: notified supplier {supplier_id} for order {order_id}")


async def handle_all_confirmed(event: dict) -> None:
    """All suppliers confirmed → notify customer → dispatch shipper."""
    order_id = event["order_id"]
    user_id = event["user_id"]

    async with async_session() as db:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        if user:
            await notify_customer_all_confirmed(
                customer_email=user.email,
                customer_name=user.full_name,
                order_id=order_id,
            )
            # Firebase push to customer
            await push_order_update(
                fcm_token=user.fcm_token,
                order_id=order_id,
                status="Đã xác nhận",
                message="Tất cả NCC đã xác nhận! Đơn hàng đang được chuẩn bị giao.",
            )

        # Update order to dispatching
        order_result = await db.execute(select(Order).where(Order.id == order_id))
        order = order_result.scalar_one_or_none()
        if order:
            from app.models.order import OrderStatus
            order.status = OrderStatus.DISPATCHING
            await db.commit()

    logger.info(f"ALL_CONFIRMED {order_id}: notified customer (email + push), dispatching shipper")


_STATUS_MESSAGES = {
    "picked_up": "Shipper đã lấy hàng từ NCC",
    "at_warehouse": "Hàng đã về kho mGift",
    "shipping": "Đơn hàng đang giao đến bạn",
    "delivered": "Đơn hàng đã giao thành công!",
}


async def handle_item_status_updated(event: dict) -> None:
    """When shipper/warehouse updates an item → push + check if ready to pack."""
    order_id = event["order_id"]
    status = event["status"]

    async with async_session() as db:
        # Push status update to customer
        if status in _STATUS_MESSAGES:
            order_result = await db.execute(select(Order).where(Order.id == order_id))
            order = order_result.scalar_one_or_none()
            if order:
                user_result = await db.execute(select(User).where(User.id == order.user_id))
                user = user_result.scalar_one_or_none()
                if user:
                    await push_order_update(
                        fcm_token=user.fcm_token,
                        order_id=order_id,
                        status=status,
                        message=_STATUS_MESSAGES[status],
                    )

        if status == OrderItemStatus.AT_WAREHOUSE.value:
            await check_all_at_warehouse(db, order_id)


async def handle_order_cancelled(event: dict) -> None:
    """Order cancelled → send apology email to customer."""
    order_id = event["order_id"]
    user_id = event["user_id"]

    async with async_session() as db:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        if user:
            await notify_customer_order_cancelled(
                customer_email=user.email,
                customer_name=user.full_name,
                order_id=order_id,
            )
            await push_order_update(
                fcm_token=user.fcm_token,
                order_id=order_id,
                status="Đã hủy",
                message="Đơn hàng đã được hủy theo yêu cầu.",
            )

    logger.info(f"ORDER_CANCELLED {order_id}: apology email + push sent")


EVENT_HANDLERS = {
    "ORDER_CREATED": handle_order_created,
    "SUPPLIER_RESPONDED": handle_supplier_responded,
    "ITEM_REPLACED": handle_item_replaced,
    "ALL_CONFIRMED": handle_all_confirmed,
    "ITEM_STATUS_UPDATED": handle_item_status_updated,
    "ORDER_CANCELLED": handle_order_cancelled,
    "READY_TO_PACK": lambda e: logger.info(f"READY_TO_PACK order {e['order_id']}"),
}


async def run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "orders",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="order-processor",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )
    await consumer.start()
    logger.info("Order processor consumer started")
    try:
        async for msg in consumer:
            event = msg.value
            event_type = event.get("type")
            handler = EVENT_HANDLERS.get(event_type)
            if handler:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Error handling {event_type}: {e}")
            else:
                logger.warning(f"Unknown event type: {event_type}")
    finally:
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(run_consumer())
