# Hướng dẫn chạy mGift Backend

## Yêu cầu
- Python 3.12+
- Docker & Docker Compose
- (Optional) ngrok - để share API cho FE dev

---

## Chạy Local (Development)

### Bước 1: Start infrastructure

```bash
cd backend
docker compose up postgres redis kafka -d
```

Chờ ~30s cho Kafka ready. Kiểm tra:
```bash
docker compose ps
# Tất cả phải ở trạng thái "healthy" hoặc "running"
```

### Bước 2: Cấu hình environment

```bash
cp .env.example .env
```

Sửa `.env` cho local (đổi host → localhost):
```env
DATABASE_URL=postgresql+asyncpg://mgift:mgift_secret@localhost:5432/mgift_db
REDIS_URL=redis://localhost:6379/0
KAFKA_BOOTSTRAP_SERVERS=localhost:29092

JWT_SECRET_KEY=dev-secret-key-change-in-production
GEMINI_API_KEY=your-gemini-key
```

### Bước 3: Cài dependencies

```bash
pip install -r requirements.txt
```

### Bước 4: Tạo database tables

```bash
# Tạo migration
alembic revision --autogenerate -m "initial"

# Chạy migration
alembic upgrade head

# Enable pgvector extension
docker compose exec postgres psql -U mgift -d mgift_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Bước 5: Chạy API server

```bash
uvicorn app.main:app --reload --port 8000
```

API sẵn sàng tại: http://localhost:8000

### Bước 6: Chạy Workers (terminal riêng)

```bash
# Terminal 2: Order processor
python -m app.workers.order_processor

# Terminal 3: Supplier handler
python -m app.workers.supplier_handler
```

---

## Chạy bằng Docker (tất cả trong 1 lệnh)

```bash
cd backend
cp .env.example .env
# Sửa .env (giữ nguyên host: postgres, redis, kafka)

docker compose up -d --build

# Chạy migration
docker compose exec api alembic revision --autogenerate -m "initial"
docker compose exec api alembic upgrade head
docker compose exec postgres psql -U mgift -d mgift_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## API Documentation

| URL | Mô tả |
|-----|--------|
| http://localhost:8000/docs | Swagger UI - test API trực tiếp |
| http://localhost:8000/redoc | ReDoc - docs dễ đọc |
| http://localhost:8000/health | Health check |
| http://localhost:9000 | Kafdrop - xem Kafka topics (nếu chạy Docker) |

---

## Share cho FE dev (không cần deploy)

```bash
# Cách 1: ngrok
ngrok http 8000
# → Gửi link https://xxx.ngrok.io/docs cho FE dev

# Cách 2: Cloudflare Tunnel (miễn phí)
cloudflared tunnel --url http://localhost:8000
```

---

## Các lệnh hữu ích

```bash
# Xem logs
docker compose logs -f api
docker compose logs -f order-worker

# Restart
docker compose restart api

# Reset DB (xóa sạch data)
docker compose down -v
docker compose up -d

# Tạo migration mới sau khi sửa models
alembic revision --autogenerate -m "mô tả thay đổi"
alembic upgrade head

# Backup DB
docker compose exec postgres pg_dump -U mgift mgift_db > backup.sql

# Restore DB
cat backup.sql | docker compose exec -T postgres psql -U mgift mgift_db
```

---

## Troubleshooting

### Kafka chưa ready
```bash
# Chờ thêm hoặc check logs
docker compose logs kafka
# Thường mất 20-30s để khởi động
```

### Port đã bị chiếm
```bash
# Check port 5432, 6379, 8000
lsof -i :8000
# Kill process nếu cần
kill -9 <PID>
```

### Migration lỗi
```bash
# Xóa migration cũ và tạo lại
rm -rf migrations/versions/*.py
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

### pgvector extension lỗi
```bash
# Phải dùng image pgvector/pgvector:pg16, không phải postgres:16
docker compose exec postgres psql -U mgift -d mgift_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
