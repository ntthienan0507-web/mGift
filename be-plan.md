Chào ông, đây là bản thiết kế **Backend (BE)** chi tiết cho dự án **mGift.vn**, tập trung vào kiến trúc **Event-Driven** để xử lý điều phối đa NCC và tích hợp AI.

Vì ông làm theo hướng chuyên nghiệp nhưng cần nhanh, tôi sẽ chia theo cấu trúc **Micro-services/Domain-driven** gọn nhẹ ngay trên một Repo.

---

## 1. Stack Backend Chi Tiết

* **Framework:** FastAPI (Python 3.12+).
* **Database:** PostgreSQL 16 + `pgvector` (Vector Search).
* **Message Broker:** Kafka (KRaft mode - không cần Zookeeper cho gọn).
* **Task Queue:** Celery + Redis (Xử lý các logic timeout & retry).
* **Auth:** JWT (OAuth2 with Password flow).
* **Deployment:** Docker Compose + Ubuntu 24.

---

## 2. Cấu Trúc Folder (SaaS-Ready)

```text
backend/
├── app/
│   ├── api/                # Các Router xử lý HTTP request
│   │   ├── v1/
│   │   │   ├── ai.py       # Tư vấn, phân tích gu
│   │   │   ├── orders.py   # Nhận đơn, tracking
│   │   │   └── shops.py    # Quản lý NCC/Inventory
│   ├── services/           # Business Logic lõi
│   │   ├── ai_engine.py    # Gemini & Vector Search logic
│   │   ├── kafka_producer.py # Bắn event vào Kafka
│   │   └── warehouse.py    # Logic gom hàng & đóng gói
│   ├── workers/            # Kafka Consumers (Chạy độc lập)
│   │   ├── order_processor.py
│   │   └── supplier_handler.py
│   ├── models/             # SQLAlchemy Models
│   ├── schemas/            # Pydantic (Data validation)
│   └── main.py             # Entry point
├── migrations/             # Alembic (DB Versioning)
├── docker-compose.yml
└── requirements.txt

```

---

## 3. Quy Trình Xử Lý Đơn Hàng (Kafka Logic)

Đây là phần "xương sống" để ông điều phối nhiều shop:

1. **Giai đoạn Đặt hàng (FastAPI):**
* `POST /order`: Lưu đơn vào Postgres với trạng thái `PENDING`.
* Bắn event `ORDER_CREATED` vào Kafka topic `orders`.


2. **Giai đoạn Điều phối NCC (Kafka Consumer):**
* Worker đọc topic `orders`, tách đơn ra theo từng `supplier_id`.
* Bắn event `SUPPLIER_NOTIFIED` cho từng shop.
* **Timeout Logic:** Worker set một key vào Redis với TTL là 30 phút. Nếu quá 30p không có event `SUPPLIER_CONFIRMED`, worker sẽ bắn event `SUPPLIER_TIMEOUT` để ông điều hướng shipper hoặc đổi shop khác.


3. **Giai đoạn Gom hàng (Warehouse Service):**
* Mỗi khi 1 NCC giao hàng cho shipper -> Cập nhật trạng thái món đó là `PICKED_UP`.
* Khi shipper giao đến kho mGift -> Trạng thái thành `AT_WAREHOUSE`.
* **Logic đóng gói:** Khi toàn bộ món trong 1 `order_id` có trạng thái `AT_WAREHOUSE` -> Hệ thống tự động bắn event `READY_TO_PACK` để nhân viên kho in mã đóng gói quà.



---

## 4. Thiết Kế Database (Cốt lõi)

### Bảng `products` (Hybrid Search)

| Field       | Type            | Description                               |
| ----------- | --------------- | ----------------------------------------- |
| `id`        | UUID            | Primary Key                               |
| `shop_id`   | INT             | Link tới NCC                              |
| `metadata`  | JSONB           | Chứa sở thích, giới tính, độ tuổi phù hợp |
| `embedding` | **vector(768)** | **Dữ liệu Vector của Gemini**             |

### Bảng `order_items` (Quản lý trạng thái từng món)

| Field               | Type      | Description                                           |
| ------------------- | --------- | ----------------------------------------------------- |
| `order_id`          | UUID      |                                                       |
| `product_id`        | UUID      |                                                       |
| `status`            | ENUM      | `requested`, `confirmed`, `picked_up`, `at_warehouse` |
| `supplier_deadline` | TIMESTAMP | Thời hạn shop phải xác nhận                           |

---

## 5. Kế Hoạch Triển Khai (Action Plan cho BE)

### Bước 1: Setup Docker Compose (Ngày 1)

Ông cần 1 file compose chạy:

* PostgreSQL + pgvector.
* Kafka + UI (như `kafdrop`) để ông dễ debug event.
* Redis.

### Bước 2: Xây dựng AI Search (Ngày 2)

* Viết Service gọi Gemini API để lấy Embedding.
* Viết Query PostgreSQL tìm kiếm 5 món quà gần nhất dựa trên `cosine similarity`.

### Bước 3: Build Luồng Order & Kafka (Ngày 3-4)

* Viết Producer để đẩy đơn hàng vào Kafka.
* Viết 1 Consumer mẫu để nghe và log ra màn hình. Đây là lúc ông "vibe" logic điều phối.

### Bước 4: WebSocket Tracking (Ngày 5)

* FastAPI có `WebSocketRouter`. Mỗi khi Kafka có update về trạng thái món hàng, BE sẽ đẩy thẳng xuống FE để khách thấy hiệu ứng "Món quà 1/3 đã về kho".

---

## 6. Lời khuyên cho ông:

* **Pydantic v2:** Tận dụng tối đa để validate dữ liệu từ NCC gửi về (Webhook).
* **Dependency Injection:** Dùng DI của FastAPI để quản lý Kafka Producer và DB Session.
* **Logging:** Vì có Kafka chạy ngầm, hãy dùng thư viện `loguru` để tracking lỗi dễ hơn.

Ông có muốn tôi chuẩn bị cho ông file **`docker-compose.yml` "Full-Option"** bao gồm cả Kafka, Postgres và Redis để ông chạy thử trên Ubuntu 24 luôn không? (Đây là bước khởi đầu nhanh nhất).