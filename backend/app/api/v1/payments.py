"""
Payment API - Flow:
1. Customer creates payment for an order -> get payment_url for redirect (VNPay/Momo)
2. Gateway sends callback (IPN/webhook) -> update payment status
3. Customer or system queries payment status
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.order import Order
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.kafka_producer import send_event
from app.services.momo import momo_service
from app.services.vnpay import vnpay_service

router = APIRouter(prefix="/payments", tags=["payments"])


# ===================================================================
# 1. Create payment for order
# ===================================================================

@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=201,
    summary="Tạo thanh toán",
    description="Tạo thanh toán cho đơn hàng. Trả về payment_url để redirect đến VNPay/Momo.",
    responses={
        400: {"description": "Đã có thanh toán cho đơn hàng này"},
        404: {"description": "Không tìm thấy đơn hàng"},
        502: {"description": "Lỗi cổng thanh toán Momo"},
    },
)
async def create_payment(
    data: PaymentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a payment for an order -> returns payment_url for redirect."""
    # Validate order
    result = await db.execute(
        select(Order).where(Order.id == data.order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if payment already exists for this order
    existing = await db.execute(
        select(Payment).where(
            Payment.order_id == data.order_id,
            Payment.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.COMPLETED]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Payment already exists for this order")

    payment = Payment(
        order_id=order.id,
        method=data.method,
        status=PaymentStatus.PENDING,
        amount=float(order.total_amount),
    )

    # Flush to generate payment.id (needed for gateway order references)
    db.add(payment)
    await db.flush()

    # Build payment URL based on method
    if data.method == PaymentMethod.VNPAY:
        client_ip = request.client.host if request.client else "127.0.0.1"
        payment.payment_url = vnpay_service.create_payment_url(
            order_id=str(payment.id),
            amount=float(order.total_amount),
            order_info=f"Thanh toan don hang {order.id}",
            ip_addr=client_ip,
        )
    elif data.method == PaymentMethod.MOMO:
        momo_resp = await momo_service.create_payment(
            order_id=str(payment.id),
            amount=int(order.total_amount),
            order_info=f"Thanh toan don hang {order.id}",
        )
        payment.payment_url = momo_resp.get("payUrl")
        if not payment.payment_url:
            logger.error(f"Momo did not return payUrl: {momo_resp}")
            raise HTTPException(status_code=502, detail="Momo payment gateway error")
    # COD and BANK_TRANSFER don't need a redirect URL

    await db.commit()
    await db.refresh(payment)

    await send_event("payments", {
        "type": "PAYMENT_CREATED",
        "payment_id": str(payment.id),
        "order_id": str(order.id),
        "method": data.method.value,
    })

    logger.info(f"Payment {payment.id} created for order {order.id} via {data.method.value}")
    return payment


# ===================================================================
# 2. Get payment status
# ===================================================================

@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Chi tiết thanh toán",
    description="Lấy thông tin thanh toán theo payment ID.",
    responses={404: {"description": "Không tìm thấy thanh toán"}},
)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment by ID."""
    result = await db.execute(
        select(Payment)
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.id == payment_id, Order.user_id == current_user.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


# ===================================================================
# 3. Get payment by order
# ===================================================================

@router.get(
    "/order/{order_id}",
    response_model=PaymentResponse,
    summary="Thanh toán theo đơn hàng",
    description="Lấy thông tin thanh toán của một đơn hàng cụ thể.",
    responses={404: {"description": "Không tìm thấy thanh toán cho đơn hàng này"}},
)
async def get_payment_by_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get payment for a specific order."""
    result = await db.execute(
        select(Payment)
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.order_id == order_id, Order.user_id == current_user.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found for this order")
    return payment


# ===================================================================
# 4. VNPay IPN callback (webhook)
# ===================================================================

@router.post(
    "/callback/vnpay",
    summary="VNPay IPN callback",
    description="Webhook nhận kết quả thanh toán từ VNPay. Xác thực chữ ký và cập nhật trạng thái.",
)
async def vnpay_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """VNPay IPN callback - called by VNPay server after payment."""
    params = dict(request.query_params)
    logger.info(f"VNPay callback params: {params}")

    # Verify signature
    if not vnpay_service.verify_callback(params):
        logger.warning("VNPay callback: invalid signature")
        return {"RspCode": "97", "Message": "Invalid Checksum"}

    transaction_id = params.get("vnp_TransactionNo", "")
    payment_ref = params.get("vnp_TxnRef", "")
    response_code = params.get("vnp_ResponseCode", "")

    if not payment_ref:
        return {"RspCode": "01", "Message": "Order not found"}

    result = await db.execute(
        select(Payment).where(Payment.id == payment_ref)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        return {"RspCode": "01", "Message": "Order not found"}

    # Prevent processing already-completed payments
    if payment.status == PaymentStatus.COMPLETED:
        return {"RspCode": "02", "Message": "Order already confirmed"}

    # Verify amount matches (vnp_Amount is VND * 100)
    vnp_amount = int(params.get("vnp_Amount", "0"))
    if vnp_amount != int(payment.amount * 100):
        logger.warning(f"VNPay callback: amount mismatch, expected {int(payment.amount * 100)}, got {vnp_amount}")
        return {"RspCode": "04", "Message": "Invalid Amount"}

    if response_code == "00":
        payment.status = PaymentStatus.COMPLETED
        payment.paid_at = datetime.now(timezone.utc)
    else:
        payment.status = PaymentStatus.FAILED

    payment.transaction_id = transaction_id
    payment.metadata_info = params

    await db.commit()

    await send_event("payments", {
        "type": "PAYMENT_UPDATED",
        "payment_id": str(payment.id),
        "order_id": str(payment.order_id),
        "status": payment.status.value,
    })

    logger.info(f"VNPay callback: payment {payment.id} -> {payment.status.value}")
    return {"RspCode": "00", "Message": "Confirm Success"}


# ===================================================================
# 5. Momo callback (webhook)
# ===================================================================

@router.post(
    "/callback/momo",
    summary="Momo IPN callback",
    description="Webhook nhận kết quả thanh toán từ Momo. Xác thực chữ ký và cập nhật trạng thái.",
    responses={
        400: {"description": "Chữ ký không hợp lệ hoặc thiếu orderId"},
        404: {"description": "Không tìm thấy thanh toán"},
    },
)
async def momo_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Momo IPN callback - called by Momo server after payment."""
    body = await request.json()
    logger.info(f"Momo callback body: {body}")

    # Verify signature
    if not momo_service.verify_callback(body):
        logger.warning("Momo callback: invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    order_id = body.get("orderId", "")
    result_code = body.get("resultCode")
    trans_id = str(body.get("transId", ""))

    if not order_id:
        raise HTTPException(status_code=400, detail="Missing orderId")

    result = await db.execute(
        select(Payment).where(Payment.id == order_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Prevent processing already-completed payments
    if payment.status == PaymentStatus.COMPLETED:
        return {"status": 0, "message": "ok"}

    if result_code == 0:
        payment.status = PaymentStatus.COMPLETED
        payment.paid_at = datetime.now(timezone.utc)
    else:
        payment.status = PaymentStatus.FAILED

    payment.transaction_id = trans_id
    payment.metadata_info = body

    await db.commit()

    await send_event("payments", {
        "type": "PAYMENT_UPDATED",
        "payment_id": str(payment.id),
        "order_id": str(payment.order_id),
        "status": payment.status.value,
    })

    logger.info(f"Momo callback: payment {payment.id} -> {payment.status.value}")
    return {"status": 0, "message": "ok"}


# ===================================================================
# 6. Refund payment (placeholder)
# ===================================================================

@router.post(
    "/{payment_id}/refund",
    response_model=PaymentResponse,
    summary="Hoàn tiền",
    description="Yêu cầu hoàn tiền cho thanh toán đã hoàn thành. Chỉ áp dụng với payment đã COMPLETED.",
    responses={
        400: {"description": "Chỉ có thể hoàn tiền thanh toán đã hoàn thành"},
        404: {"description": "Không tìm thấy thanh toán"},
    },
)
async def refund_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Request a refund for a completed payment.

    TODO: Integrate with VNPay refund API (vnp_Command=refund) and
    Momo refund API (/v2/gateway/api/refund) when ready.
    """
    result = await db.execute(
        select(Payment)
        .join(Order, Payment.order_id == Order.id)
        .where(Payment.id == payment_id, Order.user_id == current_user.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status != PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Only completed payments can be refunded")

    # Mark as refunded (actual gateway refund call to be implemented)
    payment.status = PaymentStatus.REFUNDED
    await db.commit()
    await db.refresh(payment)

    await send_event("payments", {
        "type": "PAYMENT_REFUNDED",
        "payment_id": str(payment.id),
        "order_id": str(payment.order_id),
    })

    logger.info(f"Payment {payment.id} marked as refunded")
    return payment
