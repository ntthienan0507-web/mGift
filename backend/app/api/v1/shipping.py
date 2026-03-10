"""
Shipping estimation API.
Multi-warehouse: tìm kho tối ưu cho đơn hàng từ nhiều shop.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.product import Product
from app.models.shop import Shop
from app.models.warehouse import Warehouse
from app.services.shipping import ShippingSpeed, find_optimal_warehouse, find_all_warehouse_options

router = APIRouter(prefix="/shipping", tags=["shipping"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ShopPickupDetail(BaseModel):
    shop_name: str
    distance_km: float
    pickup_hours: float
    same_city: bool


class DeliveryEstimateResponse(BaseModel):
    warehouse_id: str
    warehouse_name: str
    warehouse_city: str
    pickup_hours: float
    warehouse_hours: float
    shipping_hours: float
    total_hours: float
    total_days: float
    max_pickup_km: float
    user_km: float
    is_intercity: bool
    shipping_fee: int
    estimated_delivery_text: str
    per_shop_pickup: list[ShopPickupDetail]


class EstimateRequest(BaseModel):
    product_ids: list[uuid.UUID] = Field(..., min_length=1)
    user_lat: float | None = None
    user_lng: float | None = None
    user_city: str | None = None
    shipping_speed: str = "standard"  # express | standard | economy


class WarehouseResponse(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    city: str
    latitude: float
    longitude: float
    capacity: int
    processing_hours: float
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def _delivery_text(total_days: float, is_intercity: bool) -> str:
    if total_days < 1:
        return "Giao trong ngày"
    elif total_days <= 2:
        text = "Giao trong 1-2 ngày"
    elif total_days <= 3:
        text = "Giao trong 2-3 ngày"
    else:
        text = f"Giao trong {total_days:.0f}-{total_days + 1:.0f} ngày"
    if is_intercity:
        text += " (liên tỉnh)"
    return text


@router.post(
    "/estimate",
    response_model=DeliveryEstimateResponse,
    summary="Ước tính giao hàng (kho tối ưu)",
    description="""
Tìm kho tối ưu cho đơn hàng gồm nhiều shop.
Algorithm: với mỗi kho, tính cost = max(pickup từ các shop) + xử lý kho + giao user.
Chọn kho có cost thấp nhất.
    """,
)
async def estimate_shipping(
    data: EstimateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id.in_(data.product_ids)))
    products = result.scalars().all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    shop_ids = list(set(p.shop_id for p in products))
    result = await db.execute(select(Shop).where(Shop.id.in_(shop_ids)))
    shops_map = {s.id: s for s in result.scalars().all()}

    shops = [
        {
            "name": shops_map[sid].name if sid in shops_map else "Unknown",
            "latitude": getattr(shops_map.get(sid), "latitude", None),
            "longitude": getattr(shops_map.get(sid), "longitude", None),
            "city": getattr(shops_map.get(sid), "city", None),
        }
        for sid in shop_ids
    ]

    try:
        speed = ShippingSpeed(data.shipping_speed)
    except ValueError:
        speed = ShippingSpeed.STANDARD

    est = await find_optimal_warehouse(
        db=db, shops=shops,
        user_lat=data.user_lat, user_lng=data.user_lng, user_city=data.user_city,
        speed=speed,
    )

    return DeliveryEstimateResponse(
        warehouse_id=est.warehouse_id,
        warehouse_name=est.warehouse_name,
        warehouse_city=est.warehouse_city,
        pickup_hours=est.pickup_hours,
        warehouse_hours=est.warehouse_hours,
        shipping_hours=est.shipping_hours,
        total_hours=est.total_hours,
        total_days=est.total_days,
        max_pickup_km=est.max_pickup_km,
        user_km=est.user_km,
        is_intercity=est.is_intercity,
        shipping_fee=est.shipping_fee,
        estimated_delivery_text=_delivery_text(est.total_days, est.is_intercity),
        per_shop_pickup=[ShopPickupDetail(**s) for s in est.per_shop_pickup],
    )


@router.post(
    "/estimate/all",
    response_model=list[DeliveryEstimateResponse],
    summary="So sánh tất cả kho",
    description="Trả về TG giao hàng qua từng kho, sắp xếp nhanh nhất trước. FE có thể hiển thị cho user chọn.",
)
async def estimate_all_warehouses(
    data: EstimateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id.in_(data.product_ids)))
    products = result.scalars().all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    shop_ids = list(set(p.shop_id for p in products))
    result = await db.execute(select(Shop).where(Shop.id.in_(shop_ids)))
    shops_map = {s.id: s for s in result.scalars().all()}

    shops = [
        {
            "name": shops_map[sid].name if sid in shops_map else "Unknown",
            "latitude": getattr(shops_map.get(sid), "latitude", None),
            "longitude": getattr(shops_map.get(sid), "longitude", None),
            "city": getattr(shops_map.get(sid), "city", None),
        }
        for sid in shop_ids
    ]

    try:
        speed = ShippingSpeed(data.shipping_speed)
    except ValueError:
        speed = ShippingSpeed.STANDARD

    estimates = await find_all_warehouse_options(
        db=db, shops=shops,
        user_lat=data.user_lat, user_lng=data.user_lng, user_city=data.user_city,
        speed=speed,
    )

    return [
        DeliveryEstimateResponse(
            warehouse_id=est.warehouse_id,
            warehouse_name=est.warehouse_name,
            warehouse_city=est.warehouse_city,
            pickup_hours=est.pickup_hours,
            warehouse_hours=est.warehouse_hours,
            shipping_hours=est.shipping_hours,
            total_hours=est.total_hours,
            total_days=est.total_days,
            max_pickup_km=est.max_pickup_km,
            user_km=est.user_km,
            is_intercity=est.is_intercity,
            shipping_fee=est.shipping_fee,
            estimated_delivery_text=_delivery_text(est.total_days, est.is_intercity),
            per_shop_pickup=[ShopPickupDetail(**s) for s in est.per_shop_pickup],
        )
        for est in estimates
    ]


# ---------------------------------------------------------------------------
# Shipping speed options (for checkout UI)
# ---------------------------------------------------------------------------

class ShippingOptionResponse(BaseModel):
    speed: str
    label: str
    description: str
    shipping_fee: int
    estimated_days: float
    estimated_text: str


@router.post(
    "/options",
    response_model=list[ShippingOptionResponse],
    summary="So sánh tốc độ giao hàng",
    description="Trả về 3 option giao hàng (nhanh/tiêu chuẩn/tiết kiệm) với phí + TG dự kiến.",
)
async def shipping_options(
    data: EstimateRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id.in_(data.product_ids)))
    products = result.scalars().all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    shop_ids = list(set(p.shop_id for p in products))
    result = await db.execute(select(Shop).where(Shop.id.in_(shop_ids)))
    shops_map = {s.id: s for s in result.scalars().all()}

    shops = [
        {
            "name": shops_map[sid].name if sid in shops_map else "Unknown",
            "latitude": getattr(shops_map.get(sid), "latitude", None),
            "longitude": getattr(shops_map.get(sid), "longitude", None),
            "city": getattr(shops_map.get(sid), "city", None),
        }
        for sid in shop_ids
    ]

    speed_labels = {
        ShippingSpeed.EXPRESS: ("Giao nhanh", "Ưu tiên xử lý, giao trong ngày (nội thành)"),
        ShippingSpeed.STANDARD: ("Giao tiêu chuẩn", "Giao hàng trong 1-3 ngày"),
        ShippingSpeed.ECONOMY: ("Giao tiết kiệm", "Giao hàng trong 3-5 ngày, phí thấp nhất"),
    }

    options = []
    for speed in [ShippingSpeed.EXPRESS, ShippingSpeed.STANDARD, ShippingSpeed.ECONOMY]:
        est = await find_optimal_warehouse(
            db=db, shops=shops,
            user_lat=data.user_lat, user_lng=data.user_lng, user_city=data.user_city,
            speed=speed,
        )
        label, desc = speed_labels[speed]
        options.append(ShippingOptionResponse(
            speed=speed.value,
            label=label,
            description=desc,
            shipping_fee=est.shipping_fee,
            estimated_days=est.total_days,
            estimated_text=_delivery_text(est.total_days, est.is_intercity),
        ))

    return options


# ---------------------------------------------------------------------------
# Warehouse CRUD (admin)
# ---------------------------------------------------------------------------

@router.get(
    "/warehouses",
    response_model=list[WarehouseResponse],
    summary="Danh sách kho",
)
async def list_warehouses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Warehouse).order_by(Warehouse.name))
    return result.scalars().all()


class WarehouseCreate(BaseModel):
    name: str
    code: str = Field(..., max_length=20)
    address: str | None = None
    city: str
    latitude: float
    longitude: float
    capacity: int = 1000
    processing_hours: float = 4.0


@router.post(
    "/warehouses",
    response_model=WarehouseResponse,
    summary="Thêm kho mới",
    description="Admin thêm kho gom hàng. Hệ thống sẽ tự chọn kho tối ưu cho mỗi đơn.",
)
async def create_warehouse(data: WarehouseCreate, db: AsyncSession = Depends(get_db)):
    warehouse = Warehouse(**data.model_dump())
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return warehouse


class WarehouseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    capacity: int | None = None
    processing_hours: float | None = None
    is_active: bool | None = None


@router.patch(
    "/warehouses/{warehouse_id}",
    response_model=WarehouseResponse,
    summary="Cập nhật kho",
)
async def update_warehouse(
    warehouse_id: uuid.UUID,
    data: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(warehouse, field, value)

    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.delete(
    "/warehouses/{warehouse_id}",
    status_code=204,
    summary="Xóa kho",
)
async def delete_warehouse(
    warehouse_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    await db.delete(warehouse)
    await db.commit()
