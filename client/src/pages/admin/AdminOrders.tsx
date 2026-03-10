import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useAdminOrders,
  useAdminOrderDetail,
  useAdvanceOrder,
  type AdminOrder,
} from "@/hooks/useAdmin";
import {
  ShoppingCart,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  User,
  Package,
  CreditCard,
  Truck,
  ArrowLeft,
  Gift,
  Clock,
  Zap,
} from "lucide-react";

const ORDER_STATUSES = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "waiting_replacement", label: "Chờ thay thế" },
  { value: "all_confirmed", label: "Đã xác nhận" },
  { value: "dispatching", label: "Điều shipper" },
  { value: "picking_up", label: "Đang lấy hàng" },
  { value: "at_warehouse", label: "Tại kho" },
  { value: "packing", label: "Đóng gói" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã hủy" },
];

const FULFILLMENT_FLOW = [
  "pending",
  "all_confirmed",
  "dispatching",
  "picking_up",
  "at_warehouse",
  "packing",
  "shipping",
  "delivered",
];

const NEXT_ACTION_LABEL: Record<string, string> = {
  all_confirmed: "Điều shipper lấy hàng",
  dispatching: "Shipper bắt đầu lấy hàng",
  picking_up: "Hàng đã về kho",
  at_warehouse: "Bắt đầu đóng gói",
  packing: "Xuất kho giao hàng",
  shipping: "Xác nhận đã giao",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "delivered") return "default";
  if (s === "cancelled") return "destructive";
  if (s === "shipping" || s === "packing") return "outline";
  return "secondary";
};

const statusLabel = (s: string) => ORDER_STATUSES.find((os) => os.value === s)?.label ?? s;

const itemStatusLabel = (s: string) => {
  const map: Record<string, string> = {
    requested: "Chờ NCC",
    confirmed: "NCC xác nhận",
    rejected: "NCC từ chối",
    timeout: "Quá hạn",
    replaced: "Đã thay thế",
    picked_up: "Đã lấy",
    at_warehouse: "Tại kho",
    cancelled: "Đã hủy",
  };
  return map[s] || s;
};

const speedLabel = (s: string | null) => {
  if (s === "express") return "Giao nhanh";
  if (s === "economy") return "Tiết kiệm";
  return "Tiêu chuẩn";
};

function OrderList({
  orders,
  isLoading,
  onSelect,
}: {
  orders: AdminOrder[];
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <ShoppingCart className="h-10 w-10" />
        <p>Không có đơn hàng nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <button
          key={order.id}
          onClick={() => onSelect(order.id)}
          className="w-full flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-bold">
                #{order.id.slice(0, 8)}
              </code>
              <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
              {order.shipping_speed === "express" && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-orange-600 border-orange-300">
                  <Zap className="h-3 w-3 mr-0.5" />Nhanh
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(order.created_at).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm">
              <span className="font-medium">{order.recipient_name}</span>
              <span className="text-muted-foreground">{order.item_count} SP</span>
              <span className="font-bold text-primary ml-auto">
                {order.total_amount.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

function OrderDetail({
  orderId,
  onBack,
}: {
  orderId: string;
  onBack: () => void;
}) {
  const { data: order, isLoading } = useAdminOrderDetail(orderId);
  const advance = useAdvanceOrder();

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canAdvance = NEXT_ACTION_LABEL[order.status] != null;
  const currentStep = FULFILLMENT_FLOW.indexOf(order.status);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            Đơn #{order.id.slice(0, 8)}
            <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("vi-VN")}
            {order.payment_method && ` · ${order.payment_method.toUpperCase()}`}
            {order.payment_status && ` (${order.payment_status})`}
          </p>
        </div>
        {canAdvance && (
          <Button
            onClick={() => advance.mutate(orderId)}
            disabled={advance.isPending}
            className="gap-1"
          >
            {advance.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {NEXT_ACTION_LABEL[order.status]}
          </Button>
        )}
      </div>

      {/* Fulfillment Progress */}
      {currentStep >= 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {FULFILLMENT_FLOW.map((step, i) => {
            const done = i <= currentStep;
            const active = i === currentStep;
            return (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div
                  className={`h-2 w-2 rounded-full ${
                    active ? "bg-primary ring-2 ring-primary/30" : done ? "bg-primary" : "bg-muted"
                  }`}
                />
                <span
                  className={`text-[10px] ${
                    active ? "font-bold text-primary" : done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {statusLabel(step)}
                </span>
                {i < FULFILLMENT_FLOW.length - 1 && (
                  <div className={`w-4 h-px ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Receiver info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> Người nhận
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.recipient_name}</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <Phone className="h-3 w-3" /> {order.recipient_phone}
            </p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" /> {order.recipient_address}
            </p>
            {order.gift_message && (
              <p className="flex items-center gap-1 text-muted-foreground">
                <Gift className="h-3 w-3" /> {order.gift_message}
              </p>
            )}
            {order.note && <p className="text-muted-foreground italic">Ghi chú: {order.note}</p>}
          </CardContent>
        </Card>

        {/* Payment & Shipping */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Thanh toán & Giao hàng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phương thức</span>
              <span className="font-medium">
                {order.payment_method?.toUpperCase() || "Chưa thanh toán"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TT thanh toán</span>
              <Badge variant={order.payment_status === "completed" ? "default" : "secondary"}>
                {order.payment_status || "N/A"}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Truck className="h-3 w-3" /> Tốc độ giao
              </span>
              <span className="flex items-center gap-1">
                {order.shipping_speed === "express" && <Zap className="h-3 w-3 text-orange-500" />}
                {order.shipping_speed === "economy" && <Clock className="h-3 w-3 text-emerald-500" />}
                {speedLabel(order.shipping_speed)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phí giao</span>
              <span>{order.shipping_fee.toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Tổng cộng</span>
              <span className="text-primary">{order.total_amount.toLocaleString("vi-VN")}đ</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> Sản phẩm ({order.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border p-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.product_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    NCC: {item.supplier_name || "?"} · SL: {item.quantity} · {item.unit_price.toLocaleString("vi-VN")}đ
                  </p>
                  {item.reject_reason && (
                    <p className="text-xs text-destructive">Lý do: {item.reject_reason}</p>
                  )}
                </div>
                <Badge
                  variant={
                    item.status === "confirmed" || item.status === "at_warehouse"
                      ? "default"
                      : item.status === "rejected" || item.status === "timeout"
                      ? "destructive"
                      : "secondary"
                  }
                  className="shrink-0 text-[10px]"
                >
                  {itemStatusLabel(item.status)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { data: orders, isLoading } = useAdminOrders({
    limit: 200,
    status: statusFilter || undefined,
  });

  if (selectedOrderId) {
    return (
      <OrderDetail
        orderId={selectedOrderId}
        onBack={() => setSelectedOrderId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <OrderList
        orders={orders ?? []}
        isLoading={isLoading}
        onSelect={setSelectedOrderId}
      />
    </div>
  );
}
