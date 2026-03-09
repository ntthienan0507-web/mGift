import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStepper } from "@/components/tracking/OrderStepper";
import { Search, Package, Truck, Clock, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface OrderHistory {
  id: string;
  date: string;
}

function getOrderHistory(): OrderHistory[] {
  try {
    const raw = localStorage.getItem("mgift_order_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Mock: tạo data tracking dựa trên mã đơn
function getMockOrder(orderId: string) {
  // Random step dựa trên orderId để consistent
  const hash = orderId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const step = hash % 5;

  return {
    orderId,
    status: step,
    items: [
      {
        productName: "Bộ quà trà hoa cao cấp",
        supplierName: "The Tea House",
        status: step >= 2 ? "Đã gom về kho" : "Shop đang chuẩn bị",
      },
      {
        productName: "Nến thơm lavender handmade",
        supplierName: "Candle Studio",
        status: step >= 3 ? "Đã gom về kho" : "Shop đang chuẩn bị",
      },
      {
        productName: "Hộp chocolate Bỉ thủ công",
        supplierName: "ChocoArt VN",
        status: step >= 2 ? "Đã gom về kho" : "Shop đang chuẩn bị",
      },
    ],
  };
}

const statusColors: Record<string, string> = {
  "Đã gom về kho": "bg-primary/10 text-primary",
  "Shop đang chuẩn bị": "bg-yellow-100 text-yellow-700",
  "Đang giao": "bg-blue-100 text-blue-700",
  "Đã giao": "bg-green-100 text-green-700",
};

export default function Status() {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<ReturnType<typeof getMockOrder> | null>(null);
  const [history, setHistory] = useState<OrderHistory[]>([]);

  // Load lịch sử đơn hàng
  useEffect(() => {
    setHistory(getOrderHistory());
  }, []);

  // Tự động tra cứu nếu có query param ?id=xxx
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setOrderId(id);
      setOrder(getMockOrder(id));
    }
  }, [searchParams]);

  const handleSearch = (id?: string) => {
    const searchId = id || orderId;
    if (!searchId.trim()) return;
    setOrderId(searchId);
    setOrder(getMockOrder(searchId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Theo dõi đơn hàng</h1>
      </div>

      {/* Tìm kiếm */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Nhập mã đơn hàng (VD: MG-20260310-XXXX)"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Tra cứu
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Kết quả tra cứu */}
      {order && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Tiến trình đơn hàng
                </CardTitle>
                <Badge variant="outline">{order.orderId}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <OrderStepper currentStep={order.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Chi tiết từng món hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.supplierName}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      statusColors[item.status] ||
                      "bg-muted text-muted-foreground"
                    }
                    variant="secondary"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lịch sử đơn hàng */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đơn hàng gần đây</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {history.map((item) => (
              <button
                key={item.id}
                className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-accent"
                onClick={() => handleSearch(item.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.id}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.date).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!order && history.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Truck className="h-12 w-12" />
          <p>Nhập mã đơn hàng để theo dõi trạng thái giao hàng</p>
        </div>
      )}
    </div>
  );
}
