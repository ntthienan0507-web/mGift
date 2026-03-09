import google.generativeai as genai
from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.product import Product


def _configure_genai():
    genai.configure(api_key=settings.GEMINI_API_KEY)


async def get_embedding(text_input: str) -> list[float]:
    """Get embedding vector from Gemini for a given text."""
    _configure_genai()
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text_input,
    )
    return result["embedding"]


async def generate_product_embedding(product: Product) -> list[float]:
    """Generate embedding for a product based on its name, description and metadata."""
    parts = [product.name]
    if product.description:
        parts.append(product.description)
    if product.metadata_info:
        parts.append(str(product.metadata_info))
    combined = " | ".join(parts)
    return await get_embedding(combined)


async def search_similar_products(
    db: AsyncSession, query: str, limit: int = 5
) -> list[Product]:
    """Search products by cosine similarity using pgvector."""
    query_embedding = await get_embedding(query)

    sql = text(
        """
        SELECT id, shop_id, name, description, price, image_url, stock, metadata_info,
               1 - (embedding <=> :embedding::vector) AS similarity
        FROM products
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :embedding::vector
        LIMIT :limit
        """
    )
    result = await db.execute(
        sql, {"embedding": str(query_embedding), "limit": limit}
    )
    rows = result.fetchall()

    products = []
    for row in rows:
        product = Product(
            id=row.id,
            shop_id=row.shop_id,
            name=row.name,
            description=row.description,
            price=row.price,
            image_url=row.image_url,
            stock=row.stock,
            metadata_info=row.metadata_info,
        )
        products.append(product)
        logger.debug(f"Found product: {row.name} (similarity: {row.similarity:.4f})")

    return products


async def ai_recommend(query: str) -> str:
    """Use Gemini to generate gift recommendation text."""
    _configure_genai()
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"""Bạn là trợ lý tư vấn quà tặng của mGift.vn.
Khách hàng hỏi: "{query}"
Hãy đưa ra gợi ý quà tặng phù hợp, ngắn gọn, thân thiện bằng tiếng Việt."""
    response = model.generate_content(prompt)
    return response.text
