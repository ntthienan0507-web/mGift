from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.product import AISearchRequest, ProductResponse
from app.services.ai_engine import ai_recommend, search_similar_products

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/search", response_model=list[ProductResponse])
async def ai_search(data: AISearchRequest, db: AsyncSession = Depends(get_db)):
    """Search products using AI-powered vector similarity."""
    products = await search_similar_products(db, data.query, data.limit)
    return products


@router.post("/recommend")
async def recommend(query: str):
    """Get AI gift recommendation text from Gemini."""
    result = await ai_recommend(query)
    return {"recommendation": result}
