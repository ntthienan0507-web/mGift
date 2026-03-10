import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryTreeResponse,
    CategoryUpdate,
)

router = APIRouter(prefix="/categories", tags=["categories"])


def generate_slug(name: str) -> str:
    """Generate a URL-friendly slug from a name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


@router.get(
    "/",
    response_model=list[CategoryTreeResponse],
    summary="Danh sách danh mục",
    description="Lấy tất cả danh mục dạng cây phân cấp (top-level kèm children).",
)
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all categories in a tree structure (top-level with children)."""
    result = await db.execute(
        select(Category).where(Category.parent_id.is_(None))
    )
    categories = result.scalars().all()
    return categories


@router.get(
    "/{slug}",
    response_model=CategoryTreeResponse,
    summary="Chi tiết danh mục",
    description="Lấy thông tin danh mục theo slug.",
    responses={404: {"description": "Không tìm thấy danh mục"}},
)
async def get_category(slug: str, db: AsyncSession = Depends(get_db)):
    """Get a category by its slug."""
    result = await db.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo danh mục",
    description="Tạo danh mục mới. Slug được tự động sinh từ tên.",
    responses={
        400: {"description": "Danh mục trùng tên"},
        404: {"description": "Danh mục cha không tồn tại"},
    },
)
async def create_category(data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """Create a new category. Slug is auto-generated from the name."""
    slug = generate_slug(data.name)

    # Check slug uniqueness
    existing = await db.execute(select(Category).where(Category.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    # Validate parent exists if provided
    if data.parent_id:
        parent_result = await db.execute(
            select(Category).where(Category.id == data.parent_id)
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent category not found")

    category = Category(**data.model_dump(), slug=slug)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.patch(
    "/{category_id}",
    response_model=CategoryResponse,
    summary="Cập nhật danh mục",
    description="Cập nhật tên, mô tả hoặc danh mục cha. Slug tự động cập nhật khi đổi tên.",
    responses={
        400: {"description": "Tên trùng hoặc danh mục tự làm cha chính nó"},
        404: {"description": "Không tìm thấy danh mục"},
    },
)
async def update_category(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a category."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = data.model_dump(exclude_unset=True)

    # Regenerate slug if name is being updated
    if "name" in update_data:
        new_slug = generate_slug(update_data["name"])
        existing = await db.execute(
            select(Category).where(Category.slug == new_slug, Category.id != category_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        update_data["slug"] = new_slug

    # Validate parent exists if provided
    if "parent_id" in update_data and update_data["parent_id"] is not None:
        if update_data["parent_id"] == category_id:
            raise HTTPException(status_code=400, detail="Category cannot be its own parent")
        parent_result = await db.execute(
            select(Category).where(Category.id == update_data["parent_id"])
        )
        if not parent_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Parent category not found")

    for field, value in update_data.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa danh mục",
    description="Xóa danh mục theo ID.",
    responses={404: {"description": "Không tìm thấy danh mục"}},
)
async def delete_category(category_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a category."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()
