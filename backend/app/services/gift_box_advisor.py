"""
Smart Gift Box Advisor - gợi ý món bổ sung khi khách thêm quà vào box.

Logic:
- Phân tích những gì đã có trong box (categories, price range, occasion)
- Gợi ý món BỔ SUNG (khác category, hợp tổng thể)
- Biết khi nào "đủ" → giảm dần gợi ý, không ép khách mua thêm
- Dùng Gemini để tạo lời gợi ý tự nhiên
"""

import google.generativeai as genai
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.product import Product


# Mức độ "completeness" của gift box
COMPLETENESS = {
    0: {"level": "empty", "message": None},
    1: {"level": "starting", "suggest_count": 3, "tone": "enthusiastic"},
    2: {"level": "building", "suggest_count": 2, "tone": "helpful"},
    3: {"level": "sweet_spot", "suggest_count": 1, "tone": "gentle"},
    4: {"level": "almost_full", "suggest_count": 1, "tone": "subtle"},
    5: {"level": "full", "suggest_count": 0, "tone": "satisfied"},
}


async def analyze_gift_box(
    db: AsyncSession,
    current_items: list[dict],
    budget_remaining: float | None = None,
    occasion: str | None = None,
) -> dict:
    """
    Phân tích gift box hiện tại và trả về gợi ý thông minh.

    current_items: [{"product_id": "...", "name": "...", "price": ..., "category_id": "..."}]
    budget_remaining: ngân sách còn lại (nếu khách set)
    occasion: dịp tặng quà (sinh nhật, valentine, ...)
    """
    item_count = len(current_items)
    max_items = settings.GIFT_BOX_MAX_ITEMS
    sweet_spot = settings.GIFT_BOX_SWEET_SPOT

    # Box đã đầy → chúc mừng, không gợi ý thêm
    if item_count >= max_items:
        return {
            "completeness": 1.0,
            "status": "complete",
            "message": "Gift box của bạn đã hoàn chỉnh rồi! 🎁",
            "suggestions": [],
            "should_suggest": False,
        }

    # Tính completeness score (0.0 → 1.0)
    completeness = min(item_count / sweet_spot, 1.0)

    # Xác định số lượng gợi ý dựa trên mức độ đầy
    if item_count == 0:
        suggest_count = 0
        tone = None
    elif item_count < sweet_spot:
        suggest_count = max(3 - item_count + 1, 1)
        tone = "enthusiastic" if item_count == 1 else "helpful"
    elif item_count == sweet_spot:
        suggest_count = 1
        tone = "gentle"
    else:
        suggest_count = 1
        tone = "subtle"

    # Lấy IDs và categories đã có trong box
    existing_product_ids = [item["product_id"] for item in current_items]
    existing_category_ids = [item.get("category_id") for item in current_items if item.get("category_id")]
    total_spent = sum(item.get("price", 0) for item in current_items)

    # Tìm sản phẩm bổ sung
    suggestions = await _find_complementary_products(
        db=db,
        existing_product_ids=existing_product_ids,
        existing_category_ids=existing_category_ids,
        budget_remaining=budget_remaining,
        occasion=occasion,
        limit=suggest_count,
    )

    # Tạo message gợi ý bằng AI
    message = await _generate_suggestion_message(
        current_items=current_items,
        suggestions=suggestions,
        tone=tone,
        occasion=occasion,
        completeness=completeness,
    )

    return {
        "completeness": round(completeness, 2),
        "status": "starting" if item_count < 2 else ("building" if item_count < sweet_spot else "ready"),
        "item_count": item_count,
        "max_items": max_items,
        "message": message,
        "suggestions": suggestions,
        "should_suggest": suggest_count > 0 and len(suggestions) > 0,
        "total_spent": total_spent,
    }


async def _find_complementary_products(
    db: AsyncSession,
    existing_product_ids: list[str],
    existing_category_ids: list[str],
    budget_remaining: float | None,
    occasion: str | None,
    limit: int,
) -> list[dict]:
    """Tìm sản phẩm bổ sung - ưu tiên khác category, hợp ngân sách."""
    if limit <= 0:
        return []

    # Build query: ưu tiên sản phẩm từ category KHÁC (để mix đa dạng)
    query = select(Product).where(
        Product.id.notin_(existing_product_ids),
        Product.stock > 0,
    )

    # Filter theo budget
    if budget_remaining is not None and budget_remaining > 0:
        query = query.where(Product.price <= budget_remaining)

    # Filter theo occasion nếu có (dùng metadata JSONB)
    if occasion:
        query = query.where(
            Product.metadata_info["occasion"].astext.contains(occasion)
        )

    # Ưu tiên category khác → sản phẩm đa dạng hơn
    if existing_category_ids:
        # Lấy từ category khác trước
        diff_category_query = query.where(
            Product.category_id.notin_(existing_category_ids)
        ).limit(limit)

        result = await db.execute(diff_category_query)
        products = list(result.scalars().all())

        # Nếu chưa đủ, bổ sung từ cùng category
        if len(products) < limit:
            remaining = limit - len(products)
            same_query = query.where(
                Product.category_id.in_(existing_category_ids)
            ).limit(remaining)
            result2 = await db.execute(same_query)
            products.extend(result2.scalars().all())
    else:
        result = await db.execute(query.limit(limit))
        products = list(result.scalars().all())

    return [
        {
            "product_id": str(p.id),
            "name": p.name,
            "price": float(p.price),
            "description": p.description,
            "category_id": str(p.category_id) if p.category_id else None,
            "shop_id": str(p.shop_id),
            "images": [{"url": img.url, "position": img.position} for img in (p.images or [])],
        }
        for p in products
    ]


async def _generate_suggestion_message(
    current_items: list[dict],
    suggestions: list[dict],
    tone: str | None,
    occasion: str | None,
    completeness: float,
) -> str | None:
    """Dùng Gemini tạo lời gợi ý tự nhiên, phù hợp với mức độ đầy của box."""
    if tone is None or not suggestions:
        return None

    if not settings.GEMINI_API_KEY:
        return _fallback_message(tone, completeness, suggestions)

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")

        current_names = ", ".join(item.get("name", "") for item in current_items)
        suggestion_names = ", ".join(s["name"] for s in suggestions)

        tone_guide = {
            "enthusiastic": "Hào hứng nhưng không quá mức. Gợi ý thêm vài món để box thêm đặc biệt.",
            "helpful": "Nhẹ nhàng gợi ý, cho thấy thêm 1-2 món nữa sẽ trọn vẹn hơn.",
            "gentle": "Box đã khá đẹp rồi. Chỉ gợi ý nhẹ nhàng 1 món nếu muốn thêm. Không ép.",
            "subtle": "Box gần như hoàn chỉnh. Chỉ mention rất nhẹ, tôn trọng lựa chọn của khách.",
        }

        prompt = f"""Bạn là trợ lý tư vấn quà tặng mGift.vn. Viết 1-2 câu gợi ý NGẮN GỌN bằng tiếng Việt.

Trong box hiện có: {current_names}
{'Dịp: ' + occasion if occasion else ''}
Mức độ đầy: {completeness:.0%}
Giọng điệu: {tone_guide.get(tone, '')}

Gợi ý thêm: {suggestion_names}

QUAN TRỌNG:
- Tối đa 2 câu, thân thiện, tự nhiên
- Không liệt kê, không dùng bullet point
- Nếu box đã đẹp (>= 80% đầy), chỉ khen và gợi ý rất nhẹ
- Không bao giờ nói "bạn NÊN mua thêm" - chỉ gợi ý nhẹ nhàng"""

        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini suggestion failed: {e}")
        return _fallback_message(tone, completeness, suggestions)


def _fallback_message(tone: str, completeness: float, suggestions: list[dict]) -> str:
    """Fallback khi Gemini không khả dụng."""
    if completeness >= 0.8:
        return "Gift box của bạn trông rất tuyệt! Nếu muốn, có thể thêm một chút nữa cho trọn vẹn."
    elif completeness >= 0.5:
        name = suggestions[0]["name"] if suggestions else "một món"
        return f"Box đang đẹp lắm! Thêm {name} nữa sẽ rất hợp đấy."
    else:
        return "Một khởi đầu tuyệt vời! Thêm vài món nữa để gift box thêm đặc biệt nhé."
