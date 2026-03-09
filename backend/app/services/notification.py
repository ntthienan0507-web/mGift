"""
Notification service - send emails & push notifications to users and suppliers.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from loguru import logger

from app.core.config import settings


async def notify_supplier_new_order(
    supplier_email: str,
    supplier_name: str,
    order_id: str,
    items: list[dict],
) -> None:
    """Notify supplier about new order items they need to confirm."""
    item_rows = ""
    for item in items:
        item_rows += f"<tr><td>{item['product_name']}</td><td>{item['quantity']}</td><td>{item['unit_price']:,.0f}đ</td></tr>"

    html = f"""
    <h2>mGift - Đơn hàng mới cần xác nhận</h2>
    <p>Xin chào <b>{supplier_name}</b>,</p>
    <p>Bạn có đơn hàng mới <b>#{order_id[:8]}</b> cần xác nhận trong vòng <b>{settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES} phút</b>.</p>
    <table border="1" cellpadding="8" cellspacing="0">
        <tr><th>Sản phẩm</th><th>SL</th><th>Giá</th></tr>
        {item_rows}
    </table>
    <p>
        <a href="{settings.APP_BASE_URL}/supplier/orders/{order_id}/respond">
            👉 Xác nhận / Từ chối đơn hàng
        </a>
    </p>
    <p>Nếu không phản hồi trong {settings.SUPPLIER_CONFIRM_TIMEOUT_MINUTES} phút, đơn sẽ tự động bị huỷ.</p>
    """
    await _send_email(supplier_email, f"[mGift] Đơn hàng mới #{order_id[:8]}", html)


async def notify_customer_item_rejected(
    customer_email: str,
    customer_name: str,
    order_id: str,
    rejected_items: list[dict],
    suggestions: list[dict],
) -> None:
    """Notify customer that some items were rejected/timed out, suggest alternatives."""
    rejected_rows = ""
    for item in rejected_items:
        reason = item.get("reason", "Quá thời gian xác nhận")
        rejected_rows += f"<li><b>{item['product_name']}</b> - {reason}</li>"

    suggestion_rows = ""
    for s in suggestions:
        suggestion_rows += f"<li>{s['name']} - {s['price']:,.0f}đ (Shop: {s['shop_name']})</li>"

    html = f"""
    <h2>mGift - Cập nhật đơn hàng #{order_id[:8]}</h2>
    <p>Xin chào <b>{customer_name}</b>,</p>
    <p>Rất tiếc, một số sản phẩm trong đơn hàng không được nhà cung cấp xác nhận:</p>
    <ul>{rejected_rows}</ul>
    <p>Chúng tôi gợi ý các sản phẩm thay thế tương tự:</p>
    <ul>{suggestion_rows}</ul>
    <p>
        <a href="{settings.APP_BASE_URL}/orders/{order_id}/replace">
            👉 Chọn sản phẩm thay thế
        </a>
    </p>
    <p>Hoặc bạn có thể huỷ đơn hàng nếu không muốn tiếp tục.</p>
    """
    await _send_email(customer_email, f"[mGift] Cần thay đổi đơn hàng #{order_id[:8]}", html)


async def notify_customer_all_confirmed(
    customer_email: str,
    customer_name: str,
    order_id: str,
) -> None:
    """Notify customer that all suppliers confirmed -> dispatching shipper."""
    html = f"""
    <h2>mGift - Đơn hàng đã được xác nhận!</h2>
    <p>Xin chào <b>{customer_name}</b>,</p>
    <p>Tất cả nhà cung cấp đã xác nhận đơn hàng <b>#{order_id[:8]}</b>.</p>
    <p>Chúng tôi đang điều shipper đến lấy hàng. Bạn có thể theo dõi trạng thái tại:</p>
    <p><a href="{settings.APP_BASE_URL}/orders/{order_id}/tracking">👉 Theo dõi đơn hàng</a></p>
    """
    await _send_email(customer_email, f"[mGift] Đơn hàng #{order_id[:8]} đã xác nhận!", html)


async def notify_customer_order_cancelled(
    customer_email: str,
    customer_name: str,
    order_id: str,
) -> None:
    """Notify customer that order is cancelled - apologize."""
    html = f"""
    <h2>mGift - Đơn hàng đã được huỷ</h2>
    <p>Xin chào <b>{customer_name}</b>,</p>
    <p>Đơn hàng <b>#{order_id[:8]}</b> đã được huỷ theo yêu cầu.</p>
    <p>Chúng tôi rất xin lỗi vì trải nghiệm chưa tốt lần này. Mong rằng lần sau mGift có thể phục vụ bạn tốt hơn.</p>
    <p><a href="{settings.APP_BASE_URL}">👉 Khám phá quà tặng khác</a></p>
    """
    await _send_email(customer_email, f"[mGift] Đơn hàng #{order_id[:8]} đã huỷ", html)


async def notify_customer_delivered(
    customer_email: str,
    customer_name: str,
    order_id: str,
) -> None:
    html = f"""
    <h2>mGift - Giao hàng thành công!</h2>
    <p>Xin chào <b>{customer_name}</b>,</p>
    <p>Đơn hàng <b>#{order_id[:8]}</b> đã được giao thành công. Cảm ơn bạn đã sử dụng mGift!</p>
    """
    await _send_email(customer_email, f"[mGift] Đơn hàng #{order_id[:8]} đã giao!", html)


async def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send email via SMTP. Fails silently with logging."""
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP not configured. Skipping email to {to}: {subject}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())

        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
