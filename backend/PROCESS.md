# mGift - Order Fulfillment Process

## Tổng quan

```
Khách đặt hàng → NCC xác nhận → Shipper lấy hàng → Kho gom & đóng gói → Giao đến khách
```

Hệ thống sử dụng:
- **Kafka** event-driven cho xử lý bất đồng bộ
- **Firebase Cloud Messaging** push notification realtime
- **Email (SMTP)** thông báo song song
- **Redis** TTL cho supplier timeout
- **WebSocket** tracking đơn hàng realtime

---

## 1. Khách đặt hàng

**Trigger:** `POST /cart/checkout` hoặc `POST /orders/`

```
Khách chọn sản phẩm → Điền thông tin giao hàng → Chọn tốc độ giao → Thanh toán
```

### Tốc độ giao hàng

| Tốc độ | Thời gian | Phí ship | Mô tả |
|--------|-----------|----------|-------|
| `express` | x0.5 thời gian | x2 phí | Giao nhanh, ưu tiên xử lý |
| `standard` | Bình thường | Phí gốc | Giao tiêu chuẩn 1-3 ngày |
| `economy` | x1.5 thời gian | x0.7 phí | Giao tiết kiệm 3-5 ngày |

### AI detect urgency

Khi khách chat với AI, hệ thống tự phát hiện mức độ gấp:
- "giao gấp", "ngày mai", "hôm nay" → gợi ý **express**
- "không vội", "tiết kiệm", "từ từ" → gợi ý **economy**
- Mặc định → **standard**

Kết quả lưu vào `sessionStorage`, tự động chọn khi vào trang checkout.

### Khi đơn được tạo

1. Order status → `PENDING`
2. Items status → `REQUESTED` (chờ NCC xác nhận)
3. Tính phí ship dựa trên: khoảng cách + số NCC + tốc độ giao
4. Đặt deadline cho NCC (mặc định 30 phút)
5. **Kafka event** `ORDER_CREATED` → order-worker xử lý

### Thông báo

| Người nhận | Kênh | Nội dung |
|------------|------|----------|
| Supplier | Email + Push | "Đơn hàng mới! X sản phẩm cần xác nhận" |
| Admin | Push | "Đơn hàng mới! #abc - X SP từ Y NCC" |

---

## 2. NCC xác nhận đơn

**Trigger:** `POST /orders/{order_id}/items/{item_id}/respond`

### Supplier có 3 lựa chọn

| Hành động | Kết quả | Flow tiếp theo |
|-----------|---------|----------------|
| **Accept** | Item → `CONFIRMED` | Chờ tất cả NCC xác nhận |
| **Reject** (có lý do) | Item → `REJECTED` | Khách chọn SP thay thế |
| **Không phản hồi** | Item → `TIMEOUT` (sau 30 phút) | Khách chọn SP thay thế |

### Timeout enforcement

```
supplier_handler worker chạy background:
  - Mỗi 30 giây scan DB
  - Tìm items: status == REQUESTED && supplier_deadline < now
  - Mark TIMEOUT → thông báo customer + admin
```

### Sau khi tất cả NCC phản hồi

**Trường hợp 1: Tất cả CONFIRMED**
```
Order → ALL_CONFIRMED
→ Push customer: "Tất cả NCC đã xác nhận! Đang chuẩn bị giao"
→ Email customer: xác nhận đơn hàng
```

**Trường hợp 2: Có REJECTED / TIMEOUT**
```
Order → WAITING_REPLACEMENT
→ AI tìm sản phẩm tương tự từ NCC khác
→ Push + Email customer: "SP X không khả dụng, đây là gợi ý thay thế..."
→ Khách chọn SP mới → quay lại bước 2
```

---

## 3. Điều shipper lấy hàng

**Trigger:** Admin click "Điều shipper" trên dashboard

```
Order: ALL_CONFIRMED → DISPATCHING → PICKING_UP
```

| Admin action | Order status | Item status | Push to customer |
|-------------|-------------|-------------|-----------------|
| Điều shipper | `DISPATCHING` | — | "Đang điều shipper lấy hàng" |
| Shipper bắt đầu | `PICKING_UP` | → `PICKED_UP` | "Shipper đang gom hàng từ NCC" |

### Multi-warehouse optimization

Hệ thống tự chọn kho tối ưu cho đơn hàng:

```
Algorithm: argmin over all warehouses W:
  cost(W) = max(pickup_time(shop_i → W)) + processing(W) + shipping(W → user)
```

- Sử dụng **Haversine** tính khoảng cách
- Hỗ trợ N shops → M warehouses → 1 user
- Tự detect nội thành / liên tỉnh
- Fallback theo tên thành phố nếu không có tọa độ

---

## 4. Hàng về kho

**Trigger:** Admin click "Hàng đã về kho"

```
Order: PICKING_UP → AT_WAREHOUSE
Items: PICKED_UP → AT_WAREHOUSE
```

### Warehouse service tự kiểm tra

```python
check_all_at_warehouse(db, order_id):
  - Nếu TẤT CẢ items đều AT_WAREHOUSE
  - → Order status → PACKING
  - → Kafka event READY_TO_PACK
```

| Push to customer |
|-----------------|
| "Hàng đã về kho mGift, đang kiểm tra" |

---

## 5. Đóng gói

**Trigger:** Admin click "Bắt đầu đóng gói"

```
Order: AT_WAREHOUSE → PACKING
```

Nhân viên kho:
- Kiểm tra sản phẩm (QC)
- Đóng gói gift box
- Gắn thiệp quà tặng (nếu có `gift_message`)
- Gift wrapping (nếu `gift_wrapping = true`)

| Push to customer |
|-----------------|
| "Đơn hàng đang được đóng gói tinh tế" |

---

## 6. Giao hàng

**Trigger:** Admin click "Xuất kho giao hàng"

```
Order: PACKING → SHIPPING
```

| Push to customer |
|-----------------|
| "Đơn hàng đang giao đến bạn!" |

---

## 7. Hoàn tất

**Trigger:** Admin click "Xác nhận đã giao"

```
Order: SHIPPING → DELIVERED
```

### COD tự động hoàn thành

```
Nếu payment.method == COD && payment.status != COMPLETED:
  → payment.status = COMPLETED
  → payment.paid_at = now()
```

### Các phương thức thanh toán

| Phương thức | Flow | Khi nào hoàn thành |
|------------|------|-------------------|
| **VNPay** | Redirect → gateway → callback IPN | Sau khi thanh toán online |
| **Momo** | Redirect → gateway → callback IPN | Sau khi thanh toán online |
| **Bank transfer** | Chuyển khoản thủ công | Admin xác nhận |
| **COD** | Thu tiền khi giao | Tự động khi DELIVERED |

| Push to customer |
|-----------------|
| "Đơn hàng đã giao thành công! Cảm ơn bạn!" |

---

## Flow diagram

```
                    ┌──────────────┐
                    │  Khách đặt   │
                    │    hàng      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   PENDING    │ ← Chờ NCC xác nhận (30 phút)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐     │     ┌──────▼──────┐
        │  REJECTED  │     │     │   TIMEOUT   │
        │  / TIMEOUT │     │     │  (30 phút)  │
        └─────┬─────┘     │     └──────┬──────┘
              │            │            │
              ▼            │            │
     ┌────────────────┐    │            │
     │    WAITING      │◄──┘────────────┘
     │  REPLACEMENT   │ ← Khách chọn SP thay thế
     └───────┬────────┘
             │ (tất cả xác nhận)
             ▼
    ┌────────────────┐
    │ ALL_CONFIRMED  │ ← Push + Email customer
    └───────┬────────┘
            │ Admin: Điều shipper
            ▼
    ┌────────────────┐
    │  DISPATCHING   │ ← Push: "Đang điều shipper"
    └───────┬────────┘
            │ Admin: Shipper bắt đầu
            ▼
    ┌────────────────┐
    │  PICKING_UP    │ ← Push: "Đang gom hàng"
    └───────┬────────┘   Items → PICKED_UP
            │ Admin: Hàng về kho
            ▼
    ┌────────────────┐
    │ AT_WAREHOUSE   │ ← Push: "Hàng đã về kho"
    └───────┬────────┘   Items → AT_WAREHOUSE
            │ Auto: all items at warehouse
            ▼
    ┌────────────────┐
    │   PACKING      │ ← Push: "Đang đóng gói"
    └───────┬────────┘   QC + Gift wrap + Thiệp
            │ Admin: Xuất kho
            ▼
    ┌────────────────┐
    │   SHIPPING     │ ← Push: "Đang giao đến bạn"
    └───────┬────────┘
            │ Admin: Đã giao
            ▼
    ┌────────────────┐
    │   DELIVERED    │ ← Push: "Giao thành công!"
    └────────────────┘   COD → auto complete payment
```

---

## Admin Dashboard

### Quản lý đơn hàng (`/admin/orders`)

- Filter theo trạng thái
- Click vào đơn → xem chi tiết (người nhận, items, NCC, thanh toán)
- **Progress bar** hiển thị bước hiện tại
- **Nút advance** chuyển đơn sang bước tiếp theo
- Nút set-status (manual) cho trường hợp đặc biệt

### API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/admin/orders` | Danh sách đơn hàng (filter by status) |
| GET | `/admin/orders/{id}` | Chi tiết đơn + items + payment |
| POST | `/admin/orders/{id}/advance` | Chuyển sang bước tiếp theo |
| POST | `/admin/orders/{id}/set-status` | Force set trạng thái |
| PATCH | `/orders/{id}/items/{item_id}/status` | Update item status cụ thể |

---

## Notification Matrix

| Event | Customer | Supplier | Admin |
|-------|----------|----------|-------|
| Đơn mới | — | Push + Email | Push |
| NCC xác nhận xong | Push + Email | — | — |
| NCC từ chối/timeout | Push + Email (kèm gợi ý AI) | — | Push |
| Điều shipper | Push | — | — |
| Đang lấy hàng | Push | — | — |
| Hàng về kho | Push | — | — |
| Đang đóng gói | Push | — | — |
| Đang giao | Push | — | — |
| Đã giao | Push | — | — |
| Đơn bị hủy | Push + Email | — | — |

---

## Shipping Fee Calculation

```
base_fee = SHIPPING_FEE_BASE (30,000đ)
supplier_fee = SHIPPING_FEE_PER_SUPPLIER × (số NCC - 1) (15,000đ/NCC)
intercity_fee = 20,000đ (nếu liên tỉnh)
distance_fee = 200đ/km (trên 50km)

total_fee = (base_fee + supplier_fee + intercity_fee + distance_fee) × speed_multiplier
```

| Speed | Time multiplier | Fee multiplier |
|-------|----------------|---------------|
| express | 0.5x | 2.0x |
| standard | 1.0x | 1.0x |
| economy | 1.5x | 0.7x |

---

## Config

```env
# Supplier timeout
SUPPLIER_CONFIRM_TIMEOUT_MINUTES=30

# Shipping speeds
SHIPPING_SPEED_EXPRESS_TIME_MULT=0.5
SHIPPING_SPEED_EXPRESS_FEE_MULT=2.0
SHIPPING_SPEED_ECONOMY_TIME_MULT=1.5
SHIPPING_SPEED_ECONOMY_FEE_MULT=0.7

# Delivery speed
DELIVERY_PICKUP_SPEED_KMH=30
DELIVERY_SHIPPING_SPEED_KMH=40
DELIVERY_WAREHOUSE_HOURS=4.0
DELIVERY_INTERCITY_DAYS=1.5
DELIVERY_SUPPLIER_CONFIRM_HOURS=2.0

# Fees
SHIPPING_FEE_BASE=30000
SHIPPING_FEE_PER_SUPPLIER=15000
GIFT_WRAPPING_FEE=25000

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=/app/firebase-service-account.json

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=app-password
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API | FastAPI + Uvicorn |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Message Queue | Apache Kafka |
| Push Notification | Firebase Cloud Messaging |
| Email | SMTP (Gmail/SES) |
| AI | Google Gemini 2.5 Flash |
| Shipping | Haversine + multi-warehouse optimization |
| Workers | aiokafka consumers (order_processor, supplier_handler) |
