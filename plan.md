Hợp lý luôn ông, với tinh thần "thực chiến" và dùng **Vibecode** (hoặc Cursor/v0), việc có một cấu trúc Base UI chuẩn ngay từ đầu sẽ giúp AI sinh code cho ông cực kỳ chính xác và không bị "rác".

Dưới đây là kế hoạch chi tiết để ông dựng **Client (React + Vite)** cho mGift.vn.

---

### 1. Kiến trúc Client (The "Clean" Frontend)

Ông nên dùng bộ stack này để AI hỗ trợ tốt nhất:

- **Framework:** React + Vite (TypeScript).
- **Styling:** Tailwind CSS + **ShadcnUI** (Thư viện này AI hiểu cực rõ).
- **State Management:** **Zustand** (Nhẹ hơn Redux, rất hợp để quản lý cái Gift Box từ nhiều shop).
- **Data Fetching:** **TanStack Query (React Query)** (Để quản lý trạng thái từ FastAPI và tự động sync).

---

### 2. Cấu trúc Folder để "Vibe" hiệu quả

Ông hãy yêu cầu AI tạo cấu trúc như sau để tách biệt logic:

```text
src/
├── components/
│   ├── ui/             # Các component gốc từ ShadcnUI (Button, Card, Input)
│   ├── assistant/      # Chat interface, AI Typing animation
│   ├── gifting/        # Product Cards, GiftBox Preview, Supplier Tags
│   └── tracking/       # Real-time Stepper (Kafka status)
├── hooks/              # Custom hooks gọi API (useGifts, useOrder)
├── store/              # Zustand store (useGiftBoxStore)
├── services/           # Axios/Fetch config để kết nối FastAPI
└── pages/
    ├── Home.tsx        # Landing page tinh tế
    ├── Assistant.tsx   # Luồng tư vấn AI
    ├── Checkout.tsx    # Luồng gom hàng từ nhiều shop
    └── Status.tsx      # Theo dõi đơn hàng Real-time

```

---

### 3. Plan từng bước để ông Prompt (Vibe)

#### Bước 1: Khởi tạo Layout & Theme (Style Tinh tế)

Ông hãy prompt cho AI:

> "Khởi tạo một dự án React Vite với Tailwind và ShadcnUI. Thiết kế một layout tối giản, hiện đại với tông màu trung tính (Sử dụng CSS Variables cho Primary là Emerald Green đậm và Background là Off-white). Tạo một Navigation bar đơn giản."

#### Bước 2: Build màn hình "AI Assistant"

Đây là phần lõi. Prompt:

> "Xây dựng giao diện Chat Assistant. Thiết kế khung chat nằm giữa màn hình. Mỗi tin nhắn của AI có animation typing. Có các nút gợi ý nhanh (Quick Actions) như 'Tặng mẹ', 'Tặng người yêu', 'Ngân sách dưới 1tr'. Khi người dùng nhập xong, hiển thị một loading state mô phỏng AI đang phân tích dữ liệu."

#### Bước 3: Build màn hình "Gift Selection & Custom Box"

Phần này cần quản lý nhiều NCC. Prompt:

> "Thiết kế trang danh sách sản phẩm gợi ý. Mỗi sản phẩm hiển thị: Tên, Giá, Ảnh, và Tên Shop (Supplier). Có một sidebar hiển thị 'Your Custom Box' chứa các món đã chọn từ nhiều shop khác nhau. Sử dụng Zustand để quản lý trạng thái giỏ hàng này."

#### Bước 4: Build màn hình "Order Tracking" (Connect Kafka logic)

Đây là nơi hiển thị sức mạnh điều phối. Prompt:

> "Tạo một trang Tracking đơn hàng sử dụng Stepper. Các bước bao gồm: Đã đặt đơn -> Shop xác nhận -> Đang gom hàng về kho mGift -> Đang đóng gói -> Đang giao. Thiết kế UI hiển thị trạng thái của từng món hàng riêng lẻ từ các NCC khác nhau trong cùng một đơn hàng."

---

### 4. Code "Mồi" cho Zustand Store (Quản lý đa NCC)

Đây là đoạn logic ông cần để quản lý việc gom hàng từ nhiều shop:

```typescript
// store/useGiftBoxStore.ts
import { create } from "zustand";

interface GiftItem {
  id: string;
  name: string;
  price: number;
  supplierId: string;
}

interface GiftBoxState {
  items: GiftItem[];
  addItem: (item: GiftItem) => void;
  removeItem: (id: string) => void;
  total: () => number;
}

export const useGiftBoxStore = create<GiftBoxState>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  total: () => get().items.reduce((sum, item) => sum + item.price, 0),
}));
```

---

### 5. Gợi ý bộ UI "Pro" cho ông

Vì ông không chuyên Design, hãy bảo AI sử dụng các component này từ ShadcnUI:

- **`Tabs`**: Để chuyển đổi giữa các gợi ý của AI.
- **`Badge`**: Để đánh dấu "Hot", "Tinh tế", hoặc tên NCC.
- **`Skeleton`**: Để làm hiệu ứng loading khi chờ AI/Kafka phản hồi.
- **`Sheet`**: Để làm giỏ hàng "Custom Box" trượt ra từ cạnh màn hình.

### Hành động tiếp theo:

Ông hãy chạy lệnh `npm create vite@latest` để lấy base, sau đó copy cấu trúc folder trên vào. Ông muốn tôi hỗ trợ viết **Prompt chi tiết** cho màn hình nào trước để ông dán vào Vibecode không? (Tôi khuyên nên bắt đầu từ màn hình **Assistant** - Trái tim của mGift).
