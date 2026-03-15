# mGift

AI-powered gift exchange platform — gợi ý quà thông minh, gom hàng từ nhiều shop, theo dõi đơn real-time.

## Overview

mGift giúp người dùng tìm và gửi quà tặng hoàn hảo thông qua AI tư vấn. Platform điều phối đơn hàng từ nhiều nhà cung cấp, gom về một gift box duy nhất, và cập nhật trạng thái real-time.

## Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.12+)
- **Database:** PostgreSQL 16 + pgvector (vector search cho AI)
- **Message Broker:** Kafka (KRaft mode)
- **Task Queue:** Celery + Redis
- **Auth:** JWT (OAuth2)

### Frontend
- **Framework:** React + Vite (TypeScript)
- **Styling:** Tailwind CSS + ShadcnUI
- **State:** Zustand
- **Data Fetching:** TanStack Query

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Client     │────▶│   FastAPI    │────▶│  PostgreSQL   │
│  React/Vite  │     │   + Gemini  │     │  + pgvector   │
└─────────────┘     └──────┬───────┘     └───────────────┘
                           │
                    ┌──────▼───────┐
                    │    Kafka     │
                    │  (KRaft)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Order    │ │ Supplier │ │ Tracking │
        │ Worker   │ │ Worker   │ │ Worker   │
        └──────────┘ └──────────┘ └──────────┘
```

## Features

- **AI Gift Assistant** — Tư vấn quà dựa trên sở thích, ngân sách, dịp đặc biệt (Gemini + pgvector)
- **Multi-supplier** — Gom hàng từ nhiều shop vào một gift box
- **Real-time Tracking** — Theo dõi trạng thái đơn hàng qua Kafka events
- **Smart Timeout** — Tự động xử lý khi shop không phản hồi (Redis TTL + retry)

## Project Structure

```
mGift/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # HTTP endpoints (ai, orders, shops)
│   │   ├── services/        # Business logic (AI engine, Kafka producer, warehouse)
│   │   ├── workers/         # Kafka consumers (order processor, supplier handler)
│   │   ├── models/          # SQLAlchemy models
│   │   └── schemas/         # Pydantic validation
│   ├── migrations/          # Alembic
│   ├── docker-compose.yml
│   └── requirements.txt
│
└── client/
    └── src/
        ├── components/
        │   ├── ui/          # ShadcnUI base components
        │   ├── assistant/   # AI chat interface
        │   ├── gifting/     # Product cards, gift box preview
        │   └── tracking/    # Real-time order stepper
        ├── hooks/           # API hooks (useGifts, useOrder)
        ├── store/           # Zustand (gift box state)
        ├── services/        # API client config
        └── pages/           # Home, Assistant, Checkout, Status
```

## Getting Started

```bash
# Backend
cd backend
docker compose up -d          # PostgreSQL + Kafka + Redis
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd client
npm install
npm run dev
```

## Order Flow

```
1. User chọn quà qua AI Assistant
2. POST /order → status=PENDING → Kafka topic "orders"
3. Worker tách đơn theo supplier_id
4. Mỗi supplier nhận event SUPPLIER_NOTIFIED
5. Supplier confirm → SUPPLIER_CONFIRMED
6. Timeout 30m không confirm → SUPPLIER_TIMEOUT → retry/swap shop
7. Tất cả confirm → gom hàng → đóng gift box → giao
8. Client nhận real-time updates qua polling/websocket
```
