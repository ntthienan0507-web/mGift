import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.shop import Shop
from pydantic import BaseModel, EmailStr

from app.schemas.shop import ShopCreate, ShopCreateResponse, ShopResponse, ShopUpdate
from app.services.notification import send_supplier_welcome_email, send_supplier_recover_email


class RecoverApiKeyRequest(BaseModel):
    email: EmailStr

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get(
    "/",
    response_model=list[ShopResponse],
    summary="Danh sách cửa hàng",
    description="Lấy tất cả cửa hàng đang hoạt động.",
)
async def list_shops(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Shop).where(Shop.is_active == True))
    return result.scalars().all()


@router.get(
    "/{shop_id}",
    response_model=ShopResponse,
    summary="Chi tiết cửa hàng",
    description="Lấy thông tin chi tiết một cửa hàng theo ID.",
    responses={404: {"description": "Không tìm thấy cửa hàng"}},
)
async def get_shop(shop_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.post(
    "/",
    response_model=ShopCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo cửa hàng",
    description="Tạo cửa hàng mới. Response bao gồm api_key để NCC dùng xác thực.",
)
async def create_shop(data: ShopCreate, db: AsyncSession = Depends(get_db)):
    shop = Shop(**data.model_dump())
    db.add(shop)
    await db.commit()
    await db.refresh(shop)

    # Gửi email chứa API key nếu có contact_email
    if shop.contact_email:
        await send_supplier_welcome_email(
            email=shop.contact_email,
            shop_name=shop.name,
            api_key=shop.api_key,
        )

    return shop


@router.patch(
    "/{shop_id}",
    response_model=ShopResponse,
    summary="Cập nhật cửa hàng",
    description="Cập nhật thông tin cửa hàng theo ID.",
    responses={404: {"description": "Không tìm thấy cửa hàng"}},
)
async def update_shop(
    shop_id: uuid.UUID, data: ShopUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(shop, field, value)

    await db.commit()
    await db.refresh(shop)
    return shop


@router.post(
    "/recover-api-key",
    summary="Quên API Key",
    description="Gửi lại API Key qua email liên hệ của shop.",
)
async def recover_api_key(data: RecoverApiKeyRequest, db: AsyncSession = Depends(get_db)):
    # Luôn trả success để không lộ email nào đã đăng ký
    result = await db.execute(
        select(Shop).where(Shop.contact_email == data.email)
    )
    shops = result.scalars().all()

    for shop in shops:
        await send_supplier_recover_email(
            email=shop.contact_email,
            shop_name=shop.name,
            api_key=shop.api_key,
        )

    return {"message": "Nếu email này đã đăng ký shop, API Key sẽ được gửi qua email."}
