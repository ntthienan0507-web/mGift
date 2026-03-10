import google.generativeai as genai
from loguru import logger
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.product import Product


def _has_gemini_key() -> bool:
    """Check if a real Gemini API key is configured."""
    key = settings.GEMINI_API_KEY
    return bool(key) and key not in ("", "your-gemini-api-key")


def _configure_genai():
    genai.configure(api_key=settings.GEMINI_API_KEY)


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

async def get_embedding(text_input: str) -> list[float]:
    """Get embedding vector from Gemini for a given text."""
    _configure_genai()
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text_input,
    )
    return result["embedding"]


async def generate_product_embedding(product: Product) -> list[float] | None:
    """Generate embedding for a product. Returns None when Gemini is unavailable."""
    if not _has_gemini_key():
        logger.warning("GEMINI_API_KEY not configured – skipping embedding for product %s", product.name)
        return None
    try:
        parts = [product.name]
        if product.description:
            parts.append(product.description)
        if product.metadata_info:
            parts.append(str(product.metadata_info))
        combined = " | ".join(parts)
        return await get_embedding(combined)
    except Exception as e:
        logger.error("Embedding generation failed for product %s: %s", product.name, e)
        return None


# ---------------------------------------------------------------------------
# Search – vector similarity with keyword fallback
# ---------------------------------------------------------------------------

async def _keyword_search(db: AsyncSession, query: str, limit: int) -> list[Product]:
    """Fallback keyword search using ILIKE on name, description, metadata_info."""
    keywords = [kw.strip() for kw in query.split() if len(kw.strip()) >= 2]

    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.reviews),
        )
    )

    if keywords:
        conditions = []
        for kw in keywords:
            pattern = f"%{kw}%"
            conditions.append(Product.name.ilike(pattern))
            conditions.append(Product.description.ilike(pattern))
        stmt = stmt.where(or_(*conditions)).order_by(Product.price.asc())
    else:
        stmt = stmt.order_by(Product.created_at.desc())

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    products = list(result.scalars().all())

    for p in products:
        logger.debug(f"Keyword match: {p.name}")
    return products


async def search_similar_products(
    db: AsyncSession, query: str, limit: int = 5
) -> list[Product]:
    """Search products by vector similarity, falling back to keyword search."""
    if not _has_gemini_key():
        logger.info("Gemini unavailable – using keyword search fallback")
        return await _keyword_search(db, query, limit)

    try:
        query_embedding = await get_embedding(query)
    except Exception as e:
        logger.error("Embedding query failed: %s – falling back to keyword search", e)
        return await _keyword_search(db, query, limit)

    # Use raw SQL for vector similarity ordering, then load full ORM objects
    sql = text(
        """
        SELECT id
        FROM products
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
        """
    )
    result = await db.execute(
        sql, {"embedding": str(query_embedding), "limit": limit}
    )
    ids = [row.id for row in result.fetchall()]

    if not ids:
        logger.info("Vector search returned 0 results – trying keyword fallback")
        return await _keyword_search(db, query, limit)

    # Load full Product objects with relationships
    stmt = (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
            selectinload(Product.reviews),
        )
        .where(Product.id.in_(ids))
    )
    result = await db.execute(stmt)
    products_map = {p.id: p for p in result.scalars().all()}

    # Preserve similarity order
    products = [products_map[pid] for pid in ids if pid in products_map]
    for p in products:
        logger.debug(f"Found product: {p.name}")

    return products


# ---------------------------------------------------------------------------
# AI Recommend – Gemini chat with template fallback
# ---------------------------------------------------------------------------

_OCCASION_SUGGESTIONS = {
    "sinh nhật": [
        "🎂 **Quà sinh nhật gợi ý:**",
        "• Hộp quà chăm sóc bản thân (nến thơm, sữa tắm, mặt nạ)",
        "• Bộ trà/cà phê cao cấp kèm bánh handmade",
        "• Ví da, bóp nhỏ, phụ kiện thời trang",
        "• Sách best-seller + bookmark handmade",
    ],
    "valentine": [
        "💕 **Quà Valentine gợi ý:**",
        "• Hộp chocolate thủ công kèm thiệp viết tay",
        "• Nước hoa mini set / gấu bông kèm hoa",
        "• Bộ trang sức nhỏ xinh",
        "• Voucher spa hoặc dinner cho 2 người",
    ],
    "tết": [
        "🧧 **Quà Tết gợi ý:**",
        "• Hộp quà Tết (mứt, hạt, trà, bánh)",
        "• Rượu vang / bia thủ công cao cấp",
        "• Giỏ trái cây nhập khẩu",
        "• Bộ lì xì handmade kèm thiệp chúc Tết",
    ],
    "cảm ơn": [
        "🙏 **Quà cảm ơn gợi ý:**",
        "• Hộp quà chăm sóc sức khỏe (mật ong, trà thảo mộc)",
        "• Bộ cốc sứ / ly thuỷ tinh đẹp",
        "• Cây xanh mini để bàn",
        "• Voucher mua sắm hoặc ăn uống",
    ],
}

_DEFAULT_SUGGESTION = [
    "🎁 **Gợi ý quà tặng từ mGift:**",
    "• Hộp quà mix nhiều món (snack, nến thơm, phụ kiện) – phù hợp mọi dịp",
    "• Bộ chăm sóc cá nhân (sữa tắm, kem dưỡng, xịt thơm)",
    "• Quà handmade (thiệp, sáp thơm, bookmark) – ấm áp và ý nghĩa",
    "• Set cà phê / trà đặc sản Việt Nam",
    "",
    "💡 *Hãy mô tả thêm về người nhận (tuổi, sở thích, dịp tặng) để mình gợi ý chính xác hơn nhé!*",
]


def _template_recommend(query: str) -> str:
    """Generate a template-based recommendation when Gemini is unavailable."""
    query_lower = query.lower()
    for keyword, lines in _OCCASION_SUGGESTIONS.items():
        if keyword in query_lower:
            return "\n".join(lines + ["", "💡 *Bạn có thể duyệt thêm sản phẩm trên mGift để chọn món phù hợp nhất nhé!*"])
    return "\n".join(_DEFAULT_SUGGESTION)


async def ai_recommend(query: str) -> str:
    """Use Gemini to generate gift recommendation, with template fallback."""
    if not _has_gemini_key():
        logger.info("Gemini unavailable – using template recommendation")
        return _template_recommend(query)

    try:
        _configure_genai()
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = f"""Bạn là trợ lý tư vấn quà tặng của mGift.vn.
Khách hàng hỏi: "{query}"
Hãy đưa ra gợi ý quà tặng phù hợp, ngắn gọn, thân thiện bằng tiếng Việt.
Nếu khách nhắc đến thời gian gấp (ngày mai, hôm nay, gấp...), hãy lưu ý và gợi ý chọn "Giao nhanh" khi đặt hàng.
Nếu khách không vội, có thể gợi ý "Giao tiết kiệm" để tiết kiệm phí ship."""
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logger.error("Gemini recommend failed: %s – using template fallback", e)
        return _template_recommend(query)
