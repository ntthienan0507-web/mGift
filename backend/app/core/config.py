from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mgift:mgift_secret@localhost:5432/mgift_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:29092"

    # JWT
    JWT_SECRET_KEY: str = "change-me-to-a-random-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-southeast-1"
    AWS_S3_BUCKET: str = "mgift-assets"

    # SMTP (Email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_TLS: bool = True
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@mgift.vn"

    # VNPay
    VNPAY_TMN_CODE: str = ""
    VNPAY_HASH_SECRET: str = ""
    VNPAY_PAYMENT_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    VNPAY_RETURN_URL: str = ""

    # Momo
    MOMO_PARTNER_CODE: str = ""
    MOMO_ACCESS_KEY: str = ""
    MOMO_SECRET_KEY: str = ""
    MOMO_ENDPOINT: str = "https://test-payment.momo.vn/v2/gateway/api/create"
    MOMO_RETURN_URL: str = ""
    MOMO_NOTIFY_URL: str = ""

    # Firebase Cloud Messaging
    FIREBASE_SERVICE_ACCOUNT_PATH: str = ""

    # App
    APP_BASE_URL: str = "https://mgift.vn"
    ALLOWED_ORIGINS: list[str] = ["https://mgift.vn", "https://www.mgift.vn", "http://localhost:3000", "http://localhost:5173"]

    # Business
    SUPPLIER_CONFIRM_TIMEOUT_MINUTES: int = 30

    # Warehouse (kho gom hàng mGift) - default: HCM
    WAREHOUSE_LATITUDE: float = 10.7769
    WAREHOUSE_LONGITUDE: float = 106.7009
    WAREHOUSE_CITY: str = "Hồ Chí Minh"

    # Shipping & Gift
    SHIPPING_FEE_BASE: int = 30000
    SHIPPING_FEE_PER_SUPPLIER: int = 15000
    GIFT_WRAPPING_FEE: int = 25000

    # Delivery time (hours) - matrix thresholds
    DELIVERY_PICKUP_SPEED_KMH: int = 30        # Tốc độ lấy hàng supplier → kho (nội thành)
    DELIVERY_SHIPPING_SPEED_KMH: int = 40       # Tốc độ giao kho → user
    DELIVERY_WAREHOUSE_HOURS: float = 4.0       # Thời gian xử lý tại kho (đóng gói, QC)
    DELIVERY_INTERCITY_DAYS: float = 1.5        # Cộng thêm nếu khác tỉnh
    DELIVERY_SUPPLIER_CONFIRM_HOURS: float = 2.0  # Buffer chờ NCC xác nhận

    # Shipping speed multipliers
    SHIPPING_SPEED_EXPRESS_TIME_MULT: float = 0.5   # Giao nhanh: thời gian x0.5
    SHIPPING_SPEED_EXPRESS_FEE_MULT: float = 2.0    # Giao nhanh: phí x2
    SHIPPING_SPEED_ECONOMY_TIME_MULT: float = 1.5   # Giao tiết kiệm: thời gian x1.5
    SHIPPING_SPEED_ECONOMY_FEE_MULT: float = 0.7    # Giao tiết kiệm: phí x0.7

    # Gift Box suggestion
    GIFT_BOX_MAX_ITEMS: int = 5
    GIFT_BOX_SWEET_SPOT: int = 3  # số món "vừa đẹp", gợi ý nhẹ hơn sau mốc này

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
