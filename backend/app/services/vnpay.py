"""
VNPay payment gateway integration.

References:
- VNPay API docs: https://sandbox.vnpayment.vn/apis/
- Version: 2.1.0
- Hash algorithm: HMAC SHA512
"""

import hashlib
import hmac
import urllib.parse
from datetime import datetime, timezone

from loguru import logger

from app.core.config import settings


class VNPayService:
    """Service for creating VNPay payment URLs and verifying callbacks."""

    def __init__(
        self,
        tmn_code: str = "",
        hash_secret: str = "",
        payment_url: str = "",
        return_url: str = "",
    ):
        self.tmn_code = tmn_code or settings.VNPAY_TMN_CODE
        self.hash_secret = hash_secret or settings.VNPAY_HASH_SECRET
        self.payment_url = payment_url or settings.VNPAY_PAYMENT_URL
        self.return_url = return_url or settings.VNPAY_RETURN_URL or f"{settings.APP_BASE_URL}/payment/result"

    # ─── Public API ───────────────────────────────────

    def create_payment_url(
        self,
        order_id: str,
        amount: float,
        order_info: str,
        ip_addr: str,
    ) -> str:
        """
        Build the VNPay redirect URL with a valid HMAC SHA512 secure hash.

        Args:
            order_id: Unique transaction reference (vnp_TxnRef).
            amount: Payment amount in VND (will be multiplied by 100).
            order_info: Human-readable description of the order.
            ip_addr: Client IP address.

        Returns:
            Full VNPay payment URL that the client should be redirected to.
        """
        now = datetime.now(timezone.utc)

        params: dict[str, str] = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": self.tmn_code,
            "vnp_Amount": str(int(amount * 100)),
            "vnp_CreateDate": now.strftime("%Y%m%d%H%M%S"),
            "vnp_CurrCode": "VND",
            "vnp_IpAddr": ip_addr,
            "vnp_Locale": "vn",
            "vnp_OrderInfo": order_info,
            "vnp_OrderType": "other",
            "vnp_ReturnUrl": self.return_url,
            "vnp_TxnRef": order_id,
        }

        # Sort params alphabetically, build query string, then sign
        sorted_params = sorted(params.items())
        query_string = urllib.parse.urlencode(sorted_params, quote_via=urllib.parse.quote)

        secure_hash = self._hmac_sha512(query_string)
        full_url = f"{self.payment_url}?{query_string}&vnp_SecureHash={secure_hash}"

        logger.info(f"VNPay URL created for order {order_id}, amount={amount}")
        return full_url

    def verify_callback(self, params: dict) -> bool:
        """
        Verify a VNPay IPN/return callback by checking the vnp_SecureHash.

        Args:
            params: Query-string parameters from VNPay (dict).

        Returns:
            True if the signature is valid, False otherwise.
        """
        received_hash = params.get("vnp_SecureHash", "")
        if not received_hash:
            logger.warning("VNPay callback missing vnp_SecureHash")
            return False

        # Remove hash-related fields before re-computing
        check_params = {
            k: v for k, v in params.items()
            if k not in ("vnp_SecureHash", "vnp_SecureHashType")
        }

        sorted_params = sorted(check_params.items())
        query_string = urllib.parse.urlencode(sorted_params, quote_via=urllib.parse.quote)
        computed_hash = self._hmac_sha512(query_string)

        is_valid = hmac.compare_digest(computed_hash, received_hash)
        if not is_valid:
            logger.warning("VNPay callback signature mismatch")
        return is_valid

    # ─── Internal ─────────────────────────────────────

    def _hmac_sha512(self, data: str) -> str:
        """Compute HMAC SHA512 hex digest."""
        return hmac.new(
            self.hash_secret.encode("utf-8"),
            data.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()


# Module-level singleton (mirrors the pattern used by other services)
vnpay_service = VNPayService()
