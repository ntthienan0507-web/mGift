import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.address import Address
from app.models.user import User
from app.schemas.address import AddressCreate, AddressResponse, AddressUpdate

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get(
    "/",
    response_model=list[AddressResponse],
    summary="Danh sách địa chỉ",
    description="Lấy tất cả địa chỉ của người dùng, sắp xếp theo mặc định và mới nhất.",
)
async def list_addresses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all addresses of the current user."""
    result = await db.execute(
        select(Address).where(Address.user_id == current_user.id).order_by(Address.is_default.desc(), Address.created_at.desc())
    )
    return result.scalars().all()


@router.get(
    "/{address_id}",
    response_model=AddressResponse,
    summary="Chi tiết địa chỉ",
    description="Lấy thông tin một địa chỉ theo ID. Chỉ trả về nếu thuộc về người dùng.",
    responses={404: {"description": "Không tìm thấy địa chỉ"}},
)
async def get_address(
    address_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single address (verify ownership)."""
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")
    return address


@router.post(
    "/",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm địa chỉ mới",
    description="Tạo địa chỉ giao hàng mới. Nếu là địa chỉ đầu tiên sẽ tự động đặt làm mặc định.",
)
async def create_address(
    data: AddressCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new address. If first address, auto set as default."""
    # Check if user has any existing addresses
    existing = await db.execute(
        select(Address).where(Address.user_id == current_user.id).limit(1)
    )
    is_first = existing.scalar_one_or_none() is None

    # If is_default=True or first address, unset other defaults
    if data.is_default or is_first:
        await _unset_defaults(db, current_user.id)

    address = Address(
        user_id=current_user.id,
        label=data.label,
        recipient_name=data.recipient_name,
        recipient_phone=data.recipient_phone,
        address_line=data.address_line,
        ward=data.ward,
        district=data.district,
        city=data.city,
        is_default=data.is_default or is_first,
    )
    db.add(address)
    await db.commit()
    await db.refresh(address)
    return address


@router.patch(
    "/{address_id}",
    response_model=AddressResponse,
    summary="Cập nhật địa chỉ",
    description="Cập nhật thông tin địa chỉ. Nếu đặt is_default=true, các địa chỉ khác sẽ bỏ mặc định.",
    responses={404: {"description": "Không tìm thấy địa chỉ"}},
)
async def update_address(
    address_id: uuid.UUID,
    data: AddressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an address. If setting is_default=True, unset others."""
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    update_data = data.model_dump(exclude_unset=True)

    # If setting as default, unset other defaults first
    if update_data.get("is_default") is True:
        await _unset_defaults(db, current_user.id)

    for field, value in update_data.items():
        setattr(address, field, value)

    await db.commit()
    await db.refresh(address)
    return address


@router.delete(
    "/{address_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa địa chỉ",
    description="Xóa địa chỉ. Nếu xóa địa chỉ mặc định, địa chỉ mới nhất sẽ được chọn thay.",
    responses={404: {"description": "Không tìm thấy địa chỉ"}},
)
async def delete_address(
    address_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an address. If deleting default, set another as default if exists."""
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    was_default = address.is_default
    await db.delete(address)
    await db.flush()

    # If we deleted the default, promote another address
    if was_default:
        next_result = await db.execute(
            select(Address)
            .where(Address.user_id == current_user.id)
            .order_by(Address.created_at.desc())
            .limit(1)
        )
        next_address = next_result.scalar_one_or_none()
        if next_address:
            next_address.is_default = True

    await db.commit()


@router.post(
    "/{address_id}/set-default",
    response_model=AddressResponse,
    summary="Đặt địa chỉ mặc định",
    description="Đặt một địa chỉ làm mặc định. Các địa chỉ khác sẽ bỏ trạng thái mặc định.",
    responses={404: {"description": "Không tìm thấy địa chỉ"}},
)
async def set_default_address(
    address_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set an address as the default."""
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_id == current_user.id)
    )
    address = result.scalar_one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    await _unset_defaults(db, current_user.id)
    address.is_default = True

    await db.commit()
    await db.refresh(address)
    return address


async def _unset_defaults(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Unset is_default on all addresses for the given user."""
    result = await db.execute(
        select(Address).where(Address.user_id == user_id, Address.is_default.is_(True))
    )
    for addr in result.scalars().all():
        addr.is_default = False
