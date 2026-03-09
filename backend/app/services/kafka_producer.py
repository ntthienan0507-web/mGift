import json

from aiokafka import AIOKafkaProducer
from loguru import logger

from app.core.config import settings

_producer: AIOKafkaProducer | None = None


async def get_kafka_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        )
        await _producer.start()
        logger.info("Kafka producer started")
    return _producer


async def send_event(topic: str, event: dict) -> None:
    producer = await get_kafka_producer()
    await producer.send_and_wait(topic, value=event)
    logger.info(f"Event sent to {topic}: {event.get('type', 'unknown')}")


async def close_kafka_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None
        logger.info("Kafka producer stopped")
