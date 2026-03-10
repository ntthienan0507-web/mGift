import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.product import Product
from app.models.product_image import ProductImage
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.ai_engine import generate_product_embedding
from app.services.s3 import delete_image, upload_image

router = APIRouter(prefix="/products", tags=["products"])


@router.get(
    "/",
    response_model=list[ProductResponse],
    summary="Danh sách sản phẩm",
    description="Lấy danh sách sản phẩm với bộ lọc: shop, danh mục, giá, tìm kiếm và sắp xếp.",
)
async def list_products(
    shop_id: uuid.UUID | None = Query(None),
    category_id: uuid.UUID | None = Query(None),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query(None),
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).options(selectinload(Product.category), selectinload(Product.images))
    if shop_id:
        query = query.where(Product.shop_id == shop_id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            Product.name.ilike(pattern) | Product.description.ilike(pattern)
        )
    if sort_by == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort_by == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort_by == "name":
        query = query.order_by(Product.name.asc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()
    return [ProductResponse.from_product(p) for p in products]


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Chi tiết sản phẩm",
    description="Lấy thông tin chi tiết một sản phẩm theo ID.",
    responses={404: {"description": "Không tìm thấy sản phẩm"}},
)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category), selectinload(Product.images))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo sản phẩm mới",
    description="Tạo sản phẩm mới. Tự động generate AI embedding cho vector search.",
)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**data.model_dump())

    try:
        product.embedding = await generate_product_embedding(product)
    except Exception as e:
        logger.warning(f"Failed to generate embedding: {e}")

    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.post(
    "/{product_id}/images",
    response_model=ProductResponse,
    summary="Upload hình ảnh sản phẩm",
    description="Upload 1-3 hình ảnh cho sản phẩm, lưu trữ trên AWS S3. Tối đa 3 ảnh mỗi sản phẩm.",
    responses={
        400: {"description": "Vượt quá số lượng ảnh cho phép"},
        404: {"description": "Không tìm thấy sản phẩm"},
    },
)
async def upload_product_images(
    product_id: uuid.UUID,
    files: list[UploadFile],
    db: AsyncSession = Depends(get_db),
):
    """Upload 1-3 images for a product. Stored on AWS S3."""
    # Validate product exists
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate image count
    existing_count = len(product.images)
    if len(files) == 0:
        raise HTTPException(status_code=400, detail="At least 1 image required")
    if existing_count + len(files) > 3:
        raise HTTPException(
            status_code=400,
            detail=f"Max 3 images. Already have {existing_count}, trying to add {len(files)}.",
        )

    # Upload to S3 and save to DB
    for i, file in enumerate(files):
        try:
            url = await upload_image(file, folder=f"products/{product_id}")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        image = ProductImage(
            product_id=product_id,
            url=url,
            position=existing_count + i,
        )
        db.add(image)

    await db.commit()
    await db.refresh(product)
    return product


@router.delete(
    "/{product_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa hình ảnh sản phẩm",
    description="Xóa một hình ảnh của sản phẩm. Phải giữ lại ít nhất 1 ảnh.",
    responses={
        400: {"description": "Phải giữ ít nhất 1 ảnh"},
        404: {"description": "Không tìm thấy sản phẩm hoặc ảnh"},
    },
)
async def delete_product_image(
    product_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a product image. Must keep at least 1 image."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if len(product.images) <= 1:
        raise HTTPException(status_code=400, detail="Must keep at least 1 image")

    img_result = await db.execute(
        select(ProductImage).where(
            ProductImage.id == image_id, ProductImage.product_id == product_id
        )
    )
    image = img_result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    await delete_image(image.url)
    await db.delete(image)
    await db.commit()


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Cập nhật sản phẩm",
    description="Cập nhật thông tin sản phẩm. AI embedding sẽ được tự động tạo lại.",
    responses={404: {"description": "Không tìm thấy sản phẩm"}},
)
async def update_product(
    product_id: uuid.UUID,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    try:
        product.embedding = await generate_product_embedding(product)
    except Exception as e:
        logger.warning(f"Failed to regenerate embedding: {e}")

    await db.commit()
    await db.refresh(product)
    return product


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa sản phẩm",
    description="Xóa sản phẩm và tất cả hình ảnh trên S3.",
    responses={404: {"description": "Không tìm thấy sản phẩm"}},
)
async def delete_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete images from S3
    for image in product.images:
        try:
            await delete_image(image.url)
        except Exception as e:
            logger.warning(f"Failed to delete S3 image: {e}")

    await db.delete(product)
    await db.commit()
