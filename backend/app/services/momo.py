"""
Momo payment gateway integration.

References:
- Momo API docs: https://developers.momo.vn/v3/docs/payment/api/
- Request type: payWithMethod (unified, supports all Momo payment methods)
- Hash algorithm: HMAC SHA256
"""

import hashlib
import hmac
import uuid

import httpx
from loguru import logger

from app.core.config import settings


class MomoService:
    """Service for creating Momo payments and verifying callbacks."""

    def __init__(
        self,
        partner_code: str = "",
        access_key: str = "",
        secret_key: str = "",
        endpoint: str = "",
        return_url: str = "",
        notify_url: str = "",
    ):
        self.partner_code = partner_code or settings.MOMO_PARTNER_CODE
        self.access_key = access_key or settings.MOMO_ACCESS_KEY
        self.secret_key = secret_key or settings.MOMO_SECRET_KEY
        self.endpoint = endpoint or settings.MOMO_ENDPOINT
        self.return_url = return_url or settings.MOMO_RETURN_URL or f"{settings.APP_BASE_URL}/payment/result"
        self.notify_url = notify_url or settings.MOMO_NOTIFY_URL or f"{settings.APP_BASE_URL}/api/v1/payments/callback/momo"

    # ─── Public API ───────────────────────────────────

    async def create_payment(
        self,
        order_id: str,
        amount: int,
        order_info: str,
    ) -> dict:
        """
        Call Momo's /create endpoint to initiate a payment.

        Args:
            order_id: Unique order identifier (also used as orderId in Momo).
            amount: Payment amount in VND (integer, no decimals).
            order_info: Human-readable description shown on Momo.

        Returns:
            Momo API response dict. Key field: ``payUrl`` for redirect.

        Raises:
            httpx.HTTPStatusError: If Momo returns a non-2xx status.
        """
        request_id = str(uuid.uuid4())
        request_type = "payWithMethod"
        extra_data = ""

        # Build raw signature string (fields in alphabetical order as required by Momo)
        raw_signature = (
            f"accessKey={self.access_key}"
            f"&amount={amount}"
            f"&extraData={extra_data}"
            f"&ipnUrl={self.notify_url}"
            f"&orderId={order_id}"
            f"&orderInfo={order_info}"
            f"&partnerCode={self.partner_code}"
            f"&redirectUrl={self.return_url}"
            f"&requestId={request_id}"
            f"&requestType={request_type}"
        )

        signature = self._hmac_sha256(raw_signature)

        payload = {
            "partnerCode": self.partner_code,
            "accessKey": self.access_key,
            "requestId": request_id,
            "amount": amount,
            "orderId": order_id,
            "orderInfo": order_info,
            "redirectUrl": self.return_url,
            "ipnUrl": self.notify_url,
            "extraData": extra_data,
            "requestType": request_type,
            "signature": signature,
            "lang": "vi",
        }

        logger.info(f"Momo create_payment request for order {order_id}, amount={amount}")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.endpoint, json=payload)

        data = response.json()
        logger.info(f"Momo response: status={response.status_code}, resultCode={data.get('resultCode')}, message={data.get('message')}, orderId={order_id}")

        if response.status_code != 200 or data.get("resultCode") != 0:
            logger.error(f"Momo create_payment failed: {data}")

        response.raise_for_status()
        return data

    def verify_callback(self, data: dict) -> bool:
        """
        Verify a Momo IPN callback signature.

        Args:
            data: JSON body sent by Momo to the ipnUrl.

        Returns:
            True if the signature is valid, False otherwise.
        """
        received_signature = data.get("signature", "")
        if not received_signature:
            logger.warning("Momo callback missing signature")
            return False

        # Reconstruct signature string from callback data
        raw_signature = (
            f"accessKey={self.access_key}"
            f"&amount={data.get('amount', '')}"
            f"&extraData={data.get('extraData', '')}"
            f"&message={data.get('message', '')}"
            f"&orderId={data.get('orderId', '')}"
            f"&orderInfo={data.get('orderInfo', '')}"
            f"&orderType={data.get('orderType', '')}"
            f"&partnerCode={data.get('partnerCode', '')}"
            f"&payType={data.get('payType', '')}"
            f"&requestId={data.get('requestId', '')}"
            f"&responseTime={data.get('responseTime', '')}"
            f"&resultCode={data.get('resultCode', '')}"
            f"&transId={data.get('transId', '')}"
        )

        computed_signature = self._hmac_sha256(raw_signature)
        is_valid = hmac.compare_digest(computed_signature, received_signature)
        if not is_valid:
            logger.warning("Momo callback signature mismatch")
        return is_valid

    # ─── Internal ─────────────────────────────────────

    def _hmac_sha256(self, data: str) -> str:
        """Compute HMAC SHA256 hex digest."""
        return hmac.new(
            self.secret_key.encode("utf-8"),
            data.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()


# Module-level singleton
momo_service = MomoService()
