import secrets

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.services.notification import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)

redis_client = aioredis.from_url(settings.REDIS_URL)

RESET_TOKEN_TTL = 15 * 60  # 15 minutes in seconds
RESET_TOKEN_PREFIX = "password_reset:"


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản",
    description="Tạo tài khoản mới bằng email. Giới hạn 3 lần/phút.",
    responses={400: {"description": "Email đã được đăng ký"}},
)
@limiter.limit("3/minute")
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Đăng nhập",
    description="Đăng nhập bằng email và mật khẩu, trả về JWT access token. Giới hạn 5 lần/phút.",
    responses={401: {"description": "Sai email hoặc mật khẩu"}},
)
@limiter.limit("5/minute")
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


# ---- Google OAuth ----


@router.post(
    "/google",
    response_model=TokenResponse,
    summary="Đăng nhập bằng Google",
    description="Xác thực Google ID token, tự tạo tài khoản nếu chưa có, trả về JWT.",
    responses={401: {"description": "Google token không hợp lệ"}},
)
@limiter.limit("10/minute")
async def google_auth(request: Request, data: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        idinfo = google_id_token.verify_oauth2_token(
            data.id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    full_name = idinfo.get("name", "")
    avatar_url = idinfo.get("picture", "")

    # Tìm user theo google_id hoặc email
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        # Kiểm tra email đã tồn tại chưa (user đăng ký bằng email trước đó)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            # Liên kết Google vào tài khoản có sẵn
            user.google_id = google_id
            if not user.avatar_url:
                user.avatar_url = avatar_url
        else:
            # Tạo user mới
            user = User(
                email=email,
                full_name=full_name,
                google_id=google_id,
                avatar_url=avatar_url,
            )
            db.add(user)

        await db.commit()
        await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


# ---- User Profile ----


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Xem thông tin cá nhân",
    description="Trả về thông tin profile của người dùng đang đăng nhập.",
)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Cập nhật thông tin cá nhân",
    description="Cập nhật họ tên và/hoặc số điện thoại của người dùng.",
)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.phone is not None:
        current_user.phone = data.phone

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Đổi mật khẩu",
    description="Đổi mật khẩu khi đã đăng nhập. Cần cung cấp mật khẩu cũ.",
    responses={400: {"description": "Mật khẩu cũ không đúng"}},
)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"detail": "Password changed successfully"}


# ---- Password Reset ----


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Quên mật khẩu",
    description="Gửi email chứa link đặt lại mật khẩu. Luôn trả về thành công để bảo mật.",
)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Always return success to avoid leaking whether an email exists
    if not user:
        return {"detail": "If the email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(32)
    redis_key = f"{RESET_TOKEN_PREFIX}{token}"
    await redis_client.setex(redis_key, RESET_TOKEN_TTL, str(user.id))

    await send_password_reset_email(user.email, token)

    return {"detail": "If the email exists, a reset link has been sent"}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Đặt lại mật khẩu",
    description="Đặt lại mật khẩu bằng token nhận từ email. Token hết hạn sau 15 phút.",
    responses={400: {"description": "Token không hợp lệ hoặc đã hết hạn"}},
)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    redis_key = f"{RESET_TOKEN_PREFIX}{data.token}"
    user_id = await redis_client.get(redis_key)

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id.decode()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(data.new_password)
    await db.commit()

    # Invalidate the token after successful reset
    await redis_client.delete(redis_key)

    return {"detail": "Password has been reset successfully"}


# ---------------------------------------------------------------------------
# FCM Token Registration
# ---------------------------------------------------------------------------

class FCMTokenRequest(BaseModel):
    fcm_token: str


@router.post(
    "/fcm-token",
    summary="Đăng ký FCM token",
    description="Lưu FCM token để nhận push notification.",
)
async def register_fcm_token(
    data: FCMTokenRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.fcm_token = data.fcm_token
    await db.commit()
    return {"detail": "FCM token registered"}
