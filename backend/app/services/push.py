"""
Firebase Cloud Messaging (FCM) push notification service.
Sends push notifications to users, suppliers, and admins.
"""

import firebase_admin
from firebase_admin import credentials, messaging
from loguru import logger

from app.core.config import settings

# Initialize Firebase Admin SDK
_firebase_app = None


def _get_firebase_app():
    global _firebase_app
    if _firebase_app:
        return _firebase_app

    if not settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_PATH not configured – push notifications disabled")
        return None

    try:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized")
        return _firebase_app
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return None


async def send_push(
    fcm_token: str,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    image: str | None = None,
) -> bool:
    """Send a single push notification. Returns True if successful."""
    if not _get_firebase_app():
        logger.warning(f"Push skipped (Firebase not configured): {title}")
        return False

    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
                image=image,
            ),
            data=data or {},
            token=fcm_token,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon="/icons/icon-192.png",
                    badge="/icons/icon-192.png",
                ),
            ),
        )
        result = messaging.send(message)
        logger.info(f"Push sent: {title} → {result}")
        return True
    except messaging.UnregisteredError:
        logger.warning(f"FCM token expired/unregistered: {fcm_token[:20]}...")
        return False
    except Exception as e:
        logger.error(f"Push failed: {e}")
        return False


async def send_push_to_many(
    fcm_tokens: list[str],
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> int:
    """Send push to multiple tokens. Returns count of successful sends."""
    if not _get_firebase_app() or not fcm_tokens:
        return 0

    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            tokens=fcm_tokens,
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon="/icons/icon-192.png",
                    badge="/icons/icon-192.png",
                ),
            ),
        )
        response = messaging.send_each_for_multicast(message)
        logger.info(f"Push multicast: {response.success_count}/{len(fcm_tokens)} sent")
        return response.success_count
    except Exception as e:
        logger.error(f"Push multicast failed: {e}")
        return 0


# ---------------------------------------------------------------------------
# High-level notification helpers
# ---------------------------------------------------------------------------

async def push_order_update(fcm_token: str | None, order_id: str, status: str, message: str) -> None:
    """Push order status update to customer."""
    if not fcm_token:
        return
    await send_push(
        fcm_token=fcm_token,
        title=f"Đơn hàng #{order_id[:8]} - {status}",
        body=message,
        data={"url": f"/tracking?order={order_id}", "type": "order_update"},
    )


async def push_new_order_to_supplier(fcm_token: str | None, order_id: str, item_count: int) -> None:
    """Push new order notification to supplier."""
    if not fcm_token:
        return
    await send_push(
        fcm_token=fcm_token,
        title="Đơn hàng mới!",
        body=f"Bạn có {item_count} sản phẩm cần xác nhận trong đơn #{order_id[:8]}",
        data={"url": f"/supplier/orders/{order_id}", "type": "new_order"},
    )


async def push_to_admin(fcm_tokens: list[str], title: str, body: str, url: str = "/admin") -> None:
    """Push notification to all admin users."""
    if not fcm_tokens:
        return
    await send_push_to_many(
        fcm_tokens=fcm_tokens,
        title=title,
        body=body,
        data={"url": url, "type": "admin"},
    )
