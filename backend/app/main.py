from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.v1 import ai, auth, orders, products, shops
from app.services.kafka_producer import close_kafka_producer


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("mGift backend starting up")
    yield
    await close_kafka_producer()
    logger.info("mGift backend shut down")


app = FastAPI(
    title="mGift API",
    description="Backend API for mGift.vn - AI-powered gift platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(shops.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
