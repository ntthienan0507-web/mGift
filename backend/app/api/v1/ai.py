import hashlib
import json

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.schemas.gift_box import GiftBoxSuggestRequest, GiftBoxSuggestResponse
from app.schemas.product import AISearchRequest, ProductResponse
from app.services.ai_engine import ai_recommend, search_similar_products
from app.services.gift_box_advisor import analyze_gift_box
from app.services.shipping import ShippingSpeed, detect_shipping_urgency, estimate_product_delivery

router = APIRouter(prefix="/ai", tags=["ai"])

redis_client = aioredis.from_url(settings.REDIS_URL)
RECOMMEND_CACHE_TTL = 60 * 30  # 30 phút


@router.post(
    "/search",
    response_model=list[ProductResponse],
    summary="Tìm kiếm sản phẩm bằng AI",
    description="Tìm kiếm sản phẩm sử dụng vector similarity (AI embedding). Hỗ trợ ngôn ngữ tự nhiên.",
)
async def ai_search(data: AISearchRequest, db: AsyncSession = Depends(get_db)):
    """Search products using AI-powered vector similarity."""
    products = await search_similar_products(db, data.query, data.limit)
    return products


class RecommendRequest(BaseModel):
    message: str
    user_lat: float | None = None
    user_lng: float | None = None
    user_city: str | None = None
    max_delivery_hours: float | None = None  # VD: 24 = giao trong 1 ngày


@router.post(
    "/recommend",
    summary="Gợi ý quà tặng AI",
    description="Nhận gợi ý quà tặng từ Gemini AI kèm sản phẩm liên quan. Cache Redis 30 phút.",
)
async def recommend(data: RecommendRequest, db: AsyncSession = Depends(get_db)):
    """Get AI gift recommendation + related products. Cached in Redis."""
    cache_key = f"ai:recommend:{hashlib.md5(data.message.lower().strip().encode()).hexdigest()}"

    # Check cache
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            logger.debug(f"Cache hit: {cache_key}")
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis cache read failed: {e}")

    # Detect urgency from message
    suggested_speed = detect_shipping_urgency(data.message)

    # Get AI recommendation + search products
    reply = await ai_recommend(data.message)
    products = await search_similar_products(db, data.message, limit=8)

    # Add delivery estimate per product and optionally filter
    product_results = []
    for p in products:
        resp = ProductResponse.from_product(p)
        product_data = resp.model_dump(mode="json")

        # Calculate delivery estimate if user location provided
        if data.user_lat or data.user_city:
            shop = p.shop if hasattr(p, "shop") and p.shop else None
            est = await estimate_product_delivery(
                db=db,
                supplier_lat=getattr(shop, "latitude", None) if shop else None,
                supplier_lng=getattr(shop, "longitude", None) if shop else None,
                supplier_city=getattr(shop, "city", None) if shop else None,
                user_lat=data.user_lat,
                user_lng=data.user_lng,
                user_city=data.user_city,
            )
            product_data["delivery_hours"] = est.total_hours
            product_data["delivery_text"] = (
                f"Giao trong ngày" if est.total_days < 1
                else f"~{est.total_days:.0f} ngày"
            )
            product_data["warehouse_name"] = est.warehouse_name

            # Skip if exceeds max delivery time
            if data.max_delivery_hours and est.total_hours > data.max_delivery_hours:
                continue

        product_results.append(product_data)

    result = {
        "reply": reply,
        "products": product_results,
        "suggested_shipping_speed": suggested_speed.value,
    }

    # Cache result
    try:
        await redis_client.setex(cache_key, RECOMMEND_CACHE_TTL, json.dumps(result, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Redis cache write failed: {e}")

    return result


@router.post(
    "/gift-box/suggest",
    response_model=GiftBoxSuggestResponse,
    summary="Gift Box Advisor",
    description="Phân tích gift box hiện tại và gợi ý sản phẩm bổ sung. Trả về completeness score, gợi ý và message AI.",
)
async def suggest_gift_box(
    data: GiftBoxSuggestRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Smart Gift Box Advisor.

    Gửi danh sách items hiện có trong box → nhận lại:
    - completeness score (0→1)
    - gợi ý sản phẩm bổ sung (ưu tiên khác category, hợp budget)
    - message AI tự nhiên (giảm dần tone khi box đầy)
    - should_suggest = False khi box đã đủ → FE ẩn suggestion UI

    FE gọi API này mỗi khi user thêm/xóa item khỏi gift box.
    """
    current_items = [
        {
            "product_id": str(item.product_id),
            "name": item.name,
            "price": item.price,
            "category_id": str(item.category_id) if item.category_id else None,
        }
        for item in data.items
    ]

    result = await analyze_gift_box(
        db=db,
        current_items=current_items,
        budget_remaining=data.budget_remaining,
        occasion=data.occasion,
    )

    return result
