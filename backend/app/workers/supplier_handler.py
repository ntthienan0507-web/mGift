"""
Kafka consumer for 'suppliers' topic + timeout checker.

- SUPPLIER_NOTIFIED → set Redis TTL per item
- Timeout checker → every 30s scans for expired items → mark TIMEOUT → trigger re-check

Run: python -m app.workers.supplier_handler
"""

import asyncio
import json

import redis.asyncio as aioredis
from aiokafka import AIOKafkaConsumer
from loguru import logger
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.order import OrderItem, OrderItemStatus
from app.services.kafka_producer import send_event
from app.services.warehouse import check_all_items_resolved

redis_client = aioredis.from_url(settings.REDIS_URL)


async def handle_supplier_notified(event: dict) -> None:
    """Set Redis TTL key for each item. When key expires → item timed out."""
    order_id = event["order_id"]
    supplier_id = event["supplier_id"]
    item_ids = event.get("item_ids", [])
    ttl = settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES * 60

    for item_id in item_ids:
        key = f"supplier_timeout:{order_id}:{item_id}"
        await redis_client.setex(key, ttl, supplier_id)
        logger.info(f"Timeout set: {key} ({ttl}s)")


async def check_timeouts() -> None:
    """
    Periodically scan DB for items past deadline that are still REQUESTED.
    Mark them TIMEOUT → fire SUPPLIER_RESPONDED to trigger re-check.
    """
    while True:
        await asyncio.sleep(30)
        try:
            async with async_session() as db:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)

                result = await db.execute(
                    select(OrderItem).where(
                        OrderItem.status == OrderItemStatus.REQUESTED,
                        OrderItem.supplier_deadline < now,
                    )
                )
                expired_items = result.scalars().all()

                for item in expired_items:
                    item.status = OrderItemStatus.TIMEOUT
                    item.reject_reason = "Nhà cung cấp không phản hồi trong thời gian quy định"
                    logger.warning(f"TIMEOUT: item {item.id} in order {item.order_id}")

                if expired_items:
                    await db.commit()

                    # Group by order and fire events
                    order_ids = set(str(item.order_id) for item in expired_items)
                    for order_id in order_ids:
                        await check_all_items_resolved(db, order_id)

        except Exception as e:
            logger.error(f"Timeout checker error: {e}")


async def handle_items_rejected(event: dict) -> None:
    """
    When items are rejected/timed out, fetch similar products as suggestions
    and notify the customer.
    """
    order_id = event["order_id"]
    user_id = event["user_id"]
    rejected_item_ids = event.get("rejected_item_ids", [])

    async with async_session() as db:
        from app.models.product import Product
        from app.models.user import User
        from app.services.ai_engine import search_similar_products
        from app.services.notification import notify_customer_item_rejected

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            return

        rejected_items_info = []
        suggestions = []

        for item_id in rejected_item_ids:
            item_result = await db.execute(select(OrderItem).where(OrderItem.id == item_id))
            item = item_result.scalar_one_or_none()
            if not item:
                continue

            prod_result = await db.execute(select(Product).where(Product.id == item.product_id))
            product = prod_result.scalar_one_or_none()
            if not product:
                continue

            rejected_items_info.append({
                "product_name": product.name,
                "reason": item.reject_reason or "Nhà cung cấp từ chối",
            })

            # Find similar products from OTHER suppliers
            try:
                similar = await search_similar_products(db, product.name, limit=3)
                for s in similar:
                    if s.shop_id != product.shop_id:
                        from app.models.shop import Shop
                        shop_result = await db.execute(select(Shop).where(Shop.id == s.shop_id))
                        shop = shop_result.scalar_one_or_none()
                        suggestions.append({
                            "product_id": str(s.id),
                            "name": s.name,
                            "price": float(s.price),
                            "shop_name": shop.name if shop else "Unknown",
                        })
            except Exception as e:
                logger.warning(f"Failed to get suggestions: {e}")

        await notify_customer_item_rejected(
            customer_email=user.email,
            customer_name=user.full_name,
            order_id=order_id,
            rejected_items=rejected_items_info,
            suggestions=suggestions,
        )

    logger.info(f"ITEMS_REJECTED {order_id}: notified customer with {len(suggestions)} suggestions")


EVENT_HANDLERS = {
    "SUPPLIER_NOTIFIED": handle_supplier_notified,
    "ITEMS_REJECTED": handle_items_rejected,
}


async def run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "suppliers", "notifications",
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="supplier-handler",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )
    await consumer.start()
    logger.info("Supplier handler consumer started (+ timeout checker)")

    timeout_task = asyncio.create_task(check_timeouts())
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
                logger.warning(f"Unknown event type on {msg.topic}: {event_type}")
    finally:
        timeout_task.cancel()
        await consumer.stop()


if __name__ == "__main__":
    asyncio.run(run_consumer())
