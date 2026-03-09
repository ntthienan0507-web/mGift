# Deploy mGift Backend lên VPS

## Yêu cầu VPS
- Ubuntu 24.04 LTS
- RAM: tối thiểu 4GB (Kafka ngốn ~1GB)
- Disk: 20GB+
- Mở port: 80, 443

---

## Bước 1: Cài đặt trên VPS

```bash
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Cài Docker
curl -fsSL https://get.docker.com | sh

# Cài Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx

# Tạo folder project
mkdir -p /opt/mgift
```

---

## Bước 2: Đưa code lên VPS

### Cách 1: SCP (nhanh)
```bash
# Chạy trên máy local
scp -r backend/ root@YOUR_VPS_IP:/opt/mgift/
```

### Cách 2: Git
```bash
# Trên VPS
cd /opt/mgift
git clone YOUR_REPO_URL .
```

---

## Bước 3: Cấu hình environment

```bash
cd /opt/mgift/backend
cp .env.example .env
nano .env
```

Sửa các giá trị production:
```env
DATABASE_URL=postgresql+asyncpg://mgift:STRONG_PASSWORD_HERE@postgres:5432/mgift_db
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
REDIS_URL=redis://redis:6379/0
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
JWT_SECRET_KEY=RANDOM_64_CHAR_SECRET
GEMINI_API_KEY=your-real-gemini-key
```

Tạo JWT secret:
```bash
openssl rand -hex 32
```

---

## Bước 4: Start Docker services

```bash
cd /opt/mgift/backend

# Build & start tất cả
docker compose up -d --build

# Xem logs
docker compose logs -f api

# Chạy migration lần đầu
docker compose exec api alembic revision --autogenerate -m "initial"
docker compose exec api alembic upgrade head
```

Kiểm tra:
```bash
curl http://localhost:8000/health
# → {"status":"ok"}

# Xem tất cả containers
docker compose ps
```

---

## Bước 5: Cấu hình Nginx

```bash
# Copy nginx config
cp /opt/mgift/backend/nginx/mgift.conf /etc/nginx/sites-available/mgift

# Sửa server_name nếu cần
nano /etc/nginx/sites-available/mgift

# Enable site
ln -s /etc/nginx/sites-available/mgift /etc/nginx/sites-enabled/

# Xóa default site
rm -f /etc/nginx/sites-enabled/default

# Test & restart
nginx -t && systemctl restart nginx
```

---

## Bước 6: Trỏ DNS

Vào nhà cung cấp domain (Tenten, Namecheap, Cloudflare...) và thêm:

| Type    | Name  | Value          | TTL |
|---------|-------|----------------|-----|
| **A**   | `@`   | `YOUR_VPS_IP`  | 300 |
| **A**   | `api` | `YOUR_VPS_IP`  | 300 |
| **CNAME** | `www` | `mgift.vn`   | 300 |

- `mgift.vn` → Frontend (nếu deploy cùng VPS)
- `api.mgift.vn` → Backend API
- `www.mgift.vn` → Redirect về `mgift.vn`

Kiểm tra DNS đã propagate:
```bash
dig api.mgift.vn +short
# → YOUR_VPS_IP
```

---

## Bước 7: SSL (HTTPS)

```bash
# Cấp SSL tự động
certbot --nginx -d api.mgift.vn

# Certbot sẽ:
# - Tự tạo certificate
# - Tự sửa nginx config thêm SSL
# - Tự setup auto-renew (mỗi 90 ngày)

# Verify auto-renew
certbot renew --dry-run
```

---

## Bước 8: Verify

```bash
# Test HTTPS
curl https://api.mgift.vn/health

# Test API docs
# Mở browser: https://api.mgift.vn/docs

# Kafdrop (chỉ access qua SSH tunnel, không expose ra ngoài)
ssh -L 9000:localhost:9000 root@YOUR_VPS_IP
# Mở browser: http://localhost:9000
```

---

## Quản lý hàng ngày

```bash
cd /opt/mgift/backend

# Xem logs
docker compose logs -f api
docker compose logs -f order-worker

# Restart service
docker compose restart api

# Update code mới
git pull
docker compose up -d --build

# Chạy migration mới
docker compose exec api alembic upgrade head

# Backup database
docker compose exec postgres pg_dump -U mgift mgift_db > backup_$(date +%Y%m%d).sql
```

---

## Tổng quan kiến trúc

```
Browser → api.mgift.vn
  → Cloudflare (DNS + CDN)
  → VPS :443 (Nginx + SSL)
  → :8000 (FastAPI container)
  → PostgreSQL / Kafka / Redis (internal Docker network)
```
