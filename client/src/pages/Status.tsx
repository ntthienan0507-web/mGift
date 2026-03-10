import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStepper } from "@/components/tracking/OrderStepper";
import { Search, Package, Truck, Clock, ChevronRight, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { useOrder, useOrders } from "@/hooks/useGifts";
import { useAuthStore } from "@/store/useAuthStore";

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

const statusMap: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipping: 3,
  delivered: 4,
  completed: 4,
  cancelled: -1,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-primary/10 text-primary",
  shipping: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

export default function Status() {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const user = useAuthStore((s) => s.user);

  const { data: order, isLoading: orderLoading } = useOrder(searchId);
  const { data: orders } = useOrders();

  // Load lịch sử đơn hàng từ localStorage
  useEffect(() => {
    setHistory(getOrderHistory());
  }, []);

  // Tự động tra cứu nếu có query param ?id=xxx
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setOrderId(id);
      setSearchId(id);
    }
  }, [searchParams]);

  const handleSearch = (id?: string) => {
    const sid = id || orderId;
    if (!sid.trim()) return;
    setOrderId(sid);
    setSearchId(sid);
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Theo dõi đơn hàng"
        description="Tra cứu và theo dõi trạng thái đơn hàng mGift theo thời gian thực."
        path="/tracking"
      />
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
              placeholder="Nhập mã đơn hàng"
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

      {/* Loading */}
      {orderLoading && searchId && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Kết quả tra cứu */}
      {order && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Tiến trình đơn hàng
                </CardTitle>
                <Badge variant="outline">{order.id}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <OrderStepper currentStep={Math.max(0, statusMap[order.status] ?? 0)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Thông tin đơn hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Trạng thái</p>
                  <Badge className={statusColors[order.status] || "bg-muted text-muted-foreground"} variant="secondary">
                    {statusLabels[order.status] || order.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Tổng tiền</p>
                  <p className="font-bold text-primary">
                    {order.total_amount.toLocaleString("vi-VN")}đ
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-medium">Giao đến</p>
                <p className="text-sm text-muted-foreground">
                  {order.recipient_name} - {order.recipient_phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.recipient_address}
                </p>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Sản phẩm ({order.items.length} món)</p>
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      SP #{item.product_id.slice(0, 8)} x{item.quantity}
                    </span>
                    <span>{(item.unit_price * item.quantity).toLocaleString("vi-VN")}đ</span>
                  </div>
                ))}
              </div>

              {order.estimated_delivery && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Dự kiến giao: {new Date(order.estimated_delivery).toLocaleDateString("vi-VN")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Đơn hàng từ API (nếu đã đăng nhập) */}
      {user && orders && orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đơn hàng của bạn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {orders.map((item) => (
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
                    <p className="text-sm font-medium">{item.id.slice(0, 16)}...</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[item.status] || "bg-muted"} variant="secondary">
                    {statusLabels[item.status] || item.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lịch sử đơn hàng từ localStorage */}
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
                    <p className="text-sm font-medium">{item.id.slice(0, 16)}...</p>
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
      {!order && !orderLoading && history.length === 0 && (!orders || orders.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Truck className="h-12 w-12" />
          <p>Nhập mã đơn hàng để theo dõi trạng thái giao hàng</p>
        </div>
      )}
    </div>
  );
}
