import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStepper } from "@/components/tracking/OrderStepper";
import { Search, Package, Truck } from "lucide-react";

// Mock order data for demo
const mockOrder = {
  orderId: "MG-20260310-001",
  status: 2,
  items: [
    {
      productName: "Bộ quà trà hoa cao cấp",
      supplierName: "The Tea House",
      status: "Đã gom về kho",
    },
    {
      productName: "Nến thơm lavender handmade",
      supplierName: "Candle Studio",
      status: "Shop đang chuẩn bị",
    },
    {
      productName: "Hộp chocolate Bỉ thủ công",
      supplierName: "ChocoArt VN",
      status: "Đã gom về kho",
    },
  ],
  createdAt: "2026-03-10T08:30:00Z",
};

const statusColors: Record<string, string> = {
  "Đã gom về kho": "bg-primary/10 text-primary",
  "Shop đang chuẩn bị": "bg-yellow-100 text-yellow-700",
  "Đang giao": "bg-blue-100 text-blue-700",
  "Đã giao": "bg-green-100 text-green-700",
};

export default function Status() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<typeof mockOrder | null>(null);

  const handleSearch = () => {
    // Mock: always return the demo order
    setOrder(mockOrder);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Theo dõi đơn hàng</h1>
      </div>

      {/* Search */}
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
              placeholder="Nhập mã đơn hàng (VD: MG-20260310-001)"
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

      {order && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Order Progress */}
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

          {/* Item Status */}
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

      {!order && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Truck className="h-12 w-12" />
          <p>Nhập mã đơn hàng để theo dõi trạng thái giao hàng</p>
        </div>
      )}
    </div>
  );
}
