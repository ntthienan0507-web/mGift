import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1 import admin, addresses, ai, auth, cart, categories, orders, payments, products, reviews, shipping, shops, supplier, wishlist
from app.core.config import settings
from app.services.kafka_producer import close_kafka_producer

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("mGift backend starting up")
    yield
    await close_kafka_producer()
    logger.info("mGift backend shut down")


tags_metadata = [
    {"name": "auth", "description": "Đăng ký, đăng nhập, quản lý tài khoản và mật khẩu"},
    {"name": "addresses", "description": "Sổ địa chỉ giao hàng của người dùng"},
    {"name": "categories", "description": "Danh mục sản phẩm (cây phân cấp)"},
    {"name": "products", "description": "Quản lý sản phẩm, hình ảnh và tìm kiếm"},
    {"name": "ai", "description": "Tìm kiếm AI, gợi ý quà tặng và Gift Box Advisor"},
    {"name": "cart", "description": "Giỏ hàng: thêm, sửa, xóa sản phẩm và checkout"},
    {"name": "wishlist", "description": "Danh sách yêu thích sản phẩm"},
    {"name": "orders", "description": "Đặt hàng, theo dõi trạng thái và quản lý đơn hàng"},
    {"name": "payments", "description": "Thanh toán qua VNPay, Momo, COD và hoàn tiền"},
    {"name": "reviews", "description": "Đánh giá và xếp hạng sản phẩm"},
    {"name": "supplier", "description": "Dashboard nhà cung cấp: quản lý shop, sản phẩm và đơn hàng"},
    {"name": "shops", "description": "Quản lý thông tin cửa hàng"},
    {"name": "shipping", "description": "Ước tính thời gian và phí giao hàng dựa trên vị trí"},
    {"name": "admin", "description": "Quản trị hệ thống: quản lý users, shops, products, orders và thống kê"},
]

app = FastAPI(
    title="mGift API",
    description="Backend API for mGift.vn - AI-powered gift platform",
    version="0.1.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(shops.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(orders.router, prefix="/api/v1")
app.include_router(addresses.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(wishlist.router, prefix="/api/v1")
app.include_router(cart.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(shipping.router, prefix="/api/v1")
app.include_router(supplier.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


# Serve uploaded images locally (fallback when S3 not configured)
_upload_dir = "/app/uploads"
os.makedirs(_upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}
