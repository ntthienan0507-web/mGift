"""
Shipping estimation service — Multi-warehouse.

Flow: Shops (N) → Kho tối ưu (1 trong M kho) → User

Bài toán:
  Cho N shop locations + M warehouse locations + 1 user location
  Tìm warehouse W* sao cho:
    cost(W) = max(dist(shop_i → W)) + dist(W → user)  tối thiểu
  → Chọn kho mà tổng TG pickup (bottleneck) + last-mile nhỏ nhất.

Distance: Haversine (great-circle).
"""

import enum
import math
from dataclasses import dataclass, field

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings


class ShippingSpeed(str, enum.Enum):
    EXPRESS = "express"      # Giao nhanh (2-4h nội thành)
    STANDARD = "standard"    # Giao tiêu chuẩn (1-3 ngày)
    ECONOMY = "economy"      # Giao tiết kiệm (3-5 ngày)


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class GeoPoint:
    latitude: float
    longitude: float


@dataclass
class WarehouseInfo:
    id: str
    name: str
    code: str
    city: str
    geo: GeoPoint
    processing_hours: float = 4.0


@dataclass
class DeliveryEstimate:
    warehouse_id: str
    warehouse_name: str
    warehouse_city: str
    pickup_hours: float          # max(shop_i → warehouse)
    warehouse_hours: float       # Xử lý tại kho
    shipping_hours: float        # Warehouse → User
    total_hours: float
    total_days: float
    max_pickup_km: float         # Khoảng cách shop xa nhất → kho
    total_pickup_km: float       # Tổng khoảng cách tất cả shop → kho
    user_km: float               # Khoảng cách kho → user
    is_intercity: bool
    shipping_fee: int
    per_shop_pickup: list[dict] = field(default_factory=list)  # Chi tiết từng shop


# ---------------------------------------------------------------------------
# City coordinates (fallback khi shop/user chưa có lat/lng)
# ---------------------------------------------------------------------------

CITY_COORDS: dict[str, GeoPoint] = {
    "hồ chí minh": GeoPoint(10.7769, 106.7009),
    "hà nội": GeoPoint(21.0285, 105.8542),
    "đà nẵng": GeoPoint(16.0544, 108.2022),
    "cần thơ": GeoPoint(10.0452, 105.7469),
    "hải phòng": GeoPoint(20.8449, 106.6881),
    "đồng nai": GeoPoint(10.9574, 106.8426),
    "biên hòa": GeoPoint(10.9574, 106.8426),
    "bình dương": GeoPoint(11.3254, 106.4770),
    "long an": GeoPoint(10.5364, 106.4133),
    "vũng tàu": GeoPoint(10.3460, 107.0843),
    "bà rịa": GeoPoint(10.4960, 107.1686),
    "nha trang": GeoPoint(12.2388, 109.1967),
    "khánh hòa": GeoPoint(12.2388, 109.1967),
    "huế": GeoPoint(16.4637, 107.5909),
    "buôn ma thuột": GeoPoint(12.6797, 108.0378),
    "đắk lắk": GeoPoint(12.6797, 108.0378),
    "đà lạt": GeoPoint(11.9404, 108.4583),
    "lâm đồng": GeoPoint(11.9404, 108.4583),
    "quy nhơn": GeoPoint(13.7830, 109.2197),
    "bình định": GeoPoint(13.7830, 109.2197),
    "thanh hóa": GeoPoint(19.8067, 105.7852),
    "nghệ an": GeoPoint(18.6793, 105.6813),
    "vinh": GeoPoint(18.6793, 105.6813),
    "thái nguyên": GeoPoint(21.5928, 105.8442),
    "nam định": GeoPoint(20.4388, 106.1621),
    "hải dương": GeoPoint(20.9373, 106.3146),
    "quảng ninh": GeoPoint(21.0064, 107.2925),
    "bắc ninh": GeoPoint(21.1861, 106.0763),
}


# ---------------------------------------------------------------------------
# Geo utils
# ---------------------------------------------------------------------------

def haversine(p1: GeoPoint, p2: GeoPoint) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [p1.latitude, p1.longitude, p2.latitude, p2.longitude])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def resolve_geo(
    latitude: float | None,
    longitude: float | None,
    city: str | None,
) -> GeoPoint | None:
    """Resolve geo from lat/lng or city name lookup."""
    if latitude and longitude:
        return GeoPoint(latitude, longitude)
    if city:
        key = city.lower().strip()
        for name, point in CITY_COORDS.items():
            if name in key or key in name:
                return point
    return None


def is_same_city(p1: GeoPoint, p2: GeoPoint, threshold_km: float = 30.0) -> bool:
    return haversine(p1, p2) < threshold_km


# ---------------------------------------------------------------------------
# Load warehouses from DB
# ---------------------------------------------------------------------------

async def load_warehouses(db: AsyncSession) -> list[WarehouseInfo]:
    """Load all active warehouses from DB."""
    from app.models.warehouse import Warehouse
    result = await db.execute(
        select(Warehouse).where(Warehouse.is_active.is_(True))
    )
    warehouses = []
    for w in result.scalars().all():
        warehouses.append(WarehouseInfo(
            id=str(w.id),
            name=w.name,
            code=w.code,
            city=w.city,
            geo=GeoPoint(w.latitude, w.longitude),
            processing_hours=w.processing_hours,
        ))

    # Fallback: nếu chưa có warehouse nào trong DB, dùng default từ config
    if not warehouses:
        warehouses.append(WarehouseInfo(
            id="default",
            name="Kho HCM (default)",
            code="HCM-01",
            city="Hồ Chí Minh",
            geo=GeoPoint(settings.WAREHOUSE_LATITUDE, settings.WAREHOUSE_LONGITUDE),
            processing_hours=settings.DELIVERY_WAREHOUSE_HOURS,
        ))
    return warehouses


# ---------------------------------------------------------------------------
# Core: find optimal warehouse for a set of shops
# ---------------------------------------------------------------------------

def _get_speed_multipliers(speed: ShippingSpeed) -> tuple[float, float]:
    """Return (time_multiplier, fee_multiplier) for given speed."""
    if speed == ShippingSpeed.EXPRESS:
        return settings.SHIPPING_SPEED_EXPRESS_TIME_MULT, settings.SHIPPING_SPEED_EXPRESS_FEE_MULT
    elif speed == ShippingSpeed.ECONOMY:
        return settings.SHIPPING_SPEED_ECONOMY_TIME_MULT, settings.SHIPPING_SPEED_ECONOMY_FEE_MULT
    return 1.0, 1.0  # standard


def _estimate_for_warehouse(
    warehouse: WarehouseInfo,
    shop_geos: list[tuple[str, GeoPoint]],  # (shop_name, geo)
    user_geo: GeoPoint | None,
    speed: ShippingSpeed = ShippingSpeed.STANDARD,
) -> DeliveryEstimate:
    """
    Calculate delivery estimate for a specific warehouse.

    Cost = max(pickup_i) + warehouse_processing + last_mile
    Where pickup_i = dist(shop_i → warehouse) / speed + confirm_buffer [+ intercity penalty]
    """
    wh_geo = warehouse.geo

    # Per-shop pickup
    per_shop = []
    max_pickup_hours = 0.0
    max_pickup_km = 0.0
    total_pickup_km = 0.0

    for shop_name, shop_geo in shop_geos:
        dist_km = haversine(shop_geo, wh_geo)
        same_city = is_same_city(shop_geo, wh_geo)
        pickup_h = dist_km / settings.DELIVERY_PICKUP_SPEED_KMH
        pickup_h += settings.DELIVERY_SUPPLIER_CONFIRM_HOURS
        if not same_city:
            pickup_h += settings.DELIVERY_INTERCITY_DAYS * 24

        per_shop.append({
            "shop_name": shop_name,
            "distance_km": round(dist_km, 1),
            "pickup_hours": round(pickup_h, 1),
            "same_city": same_city,
        })
        max_pickup_hours = max(max_pickup_hours, pickup_h)
        max_pickup_km = max(max_pickup_km, dist_km)
        total_pickup_km += dist_km

    # Last-mile: warehouse → user
    user_dist_km = 10.0  # default nội thành
    user_same_city = True
    if user_geo:
        user_dist_km = haversine(wh_geo, user_geo)
        user_same_city = is_same_city(wh_geo, user_geo)

    shipping_hours = user_dist_km / settings.DELIVERY_SHIPPING_SPEED_KMH
    if not user_same_city:
        shipping_hours += settings.DELIVERY_INTERCITY_DAYS * 24

    time_mult, fee_mult = _get_speed_multipliers(speed)
    total_hours = (max_pickup_hours + warehouse.processing_hours + shipping_hours) * time_mult
    intercity = not user_same_city or any(not s["same_city"] for s in per_shop)

    # Fee
    fee = settings.SHIPPING_FEE_BASE
    fee += max(0, len(shop_geos) - 1) * settings.SHIPPING_FEE_PER_SUPPLIER
    if intercity:
        fee += 20000
    if user_dist_km > 50:
        fee += int(user_dist_km * 200)
    fee = int(fee * fee_mult)

    return DeliveryEstimate(
        warehouse_id=warehouse.id,
        warehouse_name=warehouse.name,
        warehouse_city=warehouse.city,
        pickup_hours=round(max_pickup_hours, 1),
        warehouse_hours=warehouse.processing_hours,
        shipping_hours=round(shipping_hours, 1),
        total_hours=round(total_hours, 1),
        total_days=round(total_hours / 24, 1),
        max_pickup_km=round(max_pickup_km, 1),
        total_pickup_km=round(total_pickup_km, 1),
        user_km=round(user_dist_km, 1),
        is_intercity=intercity,
        shipping_fee=fee,
        per_shop_pickup=per_shop,
    )


async def find_optimal_warehouse(
    db: AsyncSession,
    shops: list[dict],
    user_lat: float | None = None,
    user_lng: float | None = None,
    user_city: str | None = None,
    speed: ShippingSpeed = ShippingSpeed.STANDARD,
) -> DeliveryEstimate:
    """
    Given N shops + user location, find the warehouse that minimizes total delivery time.

    Algorithm:
      For each warehouse W:
        cost(W) = max(pickup_hours(shop_i → W)) + processing(W) + shipping(W → user)
      Choose W* = argmin(cost(W))

    Returns DeliveryEstimate for the optimal warehouse.
    """
    warehouses = await load_warehouses(db)
    user_geo = resolve_geo(user_lat, user_lng, user_city)

    # Resolve shop geos
    shop_geos: list[tuple[str, GeoPoint]] = []
    for s in shops:
        geo = resolve_geo(s.get("latitude"), s.get("longitude"), s.get("city"))
        name = s.get("name", "Shop")
        if geo:
            shop_geos.append((name, geo))
        else:
            # Unknown location → default HCM
            shop_geos.append((name, GeoPoint(10.7769, 106.7009)))

    if not shop_geos:
        shop_geos = [("Unknown", GeoPoint(10.7769, 106.7009))]

    # Evaluate all warehouses, pick the best
    best: DeliveryEstimate | None = None
    all_estimates: list[DeliveryEstimate] = []

    for wh in warehouses:
        est = _estimate_for_warehouse(wh, shop_geos, user_geo, speed)
        all_estimates.append(est)
        if best is None or est.total_hours < best.total_hours:
            best = est

    logger.info(
        f"Optimal warehouse: {best.warehouse_name} ({best.warehouse_city}) "
        f"for {len(shops)} shops → {best.total_hours:.1f}h [{speed.value}] "
        f"(evaluated {len(warehouses)} warehouses)"
    )

    return best


async def find_all_warehouse_options(
    db: AsyncSession,
    shops: list[dict],
    user_lat: float | None = None,
    user_lng: float | None = None,
    user_city: str | None = None,
    speed: ShippingSpeed = ShippingSpeed.STANDARD,
) -> list[DeliveryEstimate]:
    """
    Return ALL warehouse options sorted by total_hours (best first).
    Useful for FE to show alternatives.
    """
    warehouses = await load_warehouses(db)
    user_geo = resolve_geo(user_lat, user_lng, user_city)

    shop_geos: list[tuple[str, GeoPoint]] = []
    for s in shops:
        geo = resolve_geo(s.get("latitude"), s.get("longitude"), s.get("city"))
        shop_geos.append((s.get("name", "Shop"), geo or GeoPoint(10.7769, 106.7009)))

    if not shop_geos:
        shop_geos = [("Unknown", GeoPoint(10.7769, 106.7009))]

    estimates = [_estimate_for_warehouse(wh, shop_geos, user_geo, speed) for wh in warehouses]
    estimates.sort(key=lambda e: e.total_hours)
    return estimates


# ---------------------------------------------------------------------------
# Single-product estimate (for AI recommend, product detail)
# ---------------------------------------------------------------------------

async def estimate_product_delivery(
    db: AsyncSession,
    supplier_lat: float | None = None,
    supplier_lng: float | None = None,
    supplier_city: str | None = None,
    user_lat: float | None = None,
    user_lng: float | None = None,
    user_city: str | None = None,
    speed: ShippingSpeed = ShippingSpeed.STANDARD,
) -> DeliveryEstimate:
    """Estimate delivery for a single product (1 shop → best warehouse → user)."""
    return await find_optimal_warehouse(
        db=db,
        shops=[{"latitude": supplier_lat, "longitude": supplier_lng, "city": supplier_city, "name": "Supplier"}],
        user_lat=user_lat,
        user_lng=user_lng,
        user_city=user_city,
        speed=speed,
    )


# ---------------------------------------------------------------------------
# Urgency detection from user message
# ---------------------------------------------------------------------------

_URGENT_KEYWORDS = [
    "gấp", "giao nhanh", "hỏa tốc", "ngay", "hôm nay", "tối nay",
    "sáng mai", "ngày mai", "trong ngày", "nhanh", "urgent", "express",
    "kịp", "muộn", "trễ", "deadline", "sớm", "asap", "lẹ",
]

_ECONOMY_KEYWORDS = [
    "tiết kiệm", "rẻ", "không gấp", "từ từ", "chậm cũng được",
    "tuần sau", "tháng sau", "economy", "bao giờ cũng được",
    "không vội", "thong thả",
]


def detect_shipping_urgency(message: str) -> ShippingSpeed:
    """Detect shipping urgency from user's chat message."""
    msg_lower = message.lower()
    for kw in _URGENT_KEYWORDS:
        if kw in msg_lower:
            return ShippingSpeed.EXPRESS
    for kw in _ECONOMY_KEYWORDS:
        if kw in msg_lower:
            return ShippingSpeed.ECONOMY
    return ShippingSpeed.STANDARD
