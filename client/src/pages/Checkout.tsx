import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Package, Trash2, ShoppingBag } from "lucide-react";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Checkout() {
  const { items, removeItem, getTotal, getSupplierGroups, clearBox } =
    useGiftBoxStore();
  const navigate = useNavigate();
  const groups = getSupplierGroups();
  const [note, setNote] = useState("");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Gift Box của bạn đang trống</h2>
        <p className="text-muted-foreground">
          Hãy để AI tư vấn và chọn những món quà tuyệt vời!
        </p>
        <Button onClick={() => navigate("/assistant")}>
          Bắt đầu tư vấn AI
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Custom Gift Box</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items grouped by supplier */}
        <div className="space-y-4 lg:col-span-2">
          {Object.entries(groups).map(([supplier, supplierItems]) => (
            <Card key={supplier}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{supplier}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {supplierItems.length} món
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplierItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm font-bold text-primary">
                        {item.price.toLocaleString("vi-VN")}d
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tổng kết đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Số lượng món ({items.length})
                </span>
                <span>{getTotal().toLocaleString("vi-VN")}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí đóng gói</span>
                <span className="text-primary">Miễn phí</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí giao hàng</span>
                <span>30,000d</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span>
              <span className="text-primary">
                {(getTotal() + 30000).toLocaleString("vi-VN")}d
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Lời nhắn tặng quà</label>
              <Input
                placeholder="Gửi lời yêu thương..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <Button className="w-full" size="lg">
              Đặt hàng
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={clearBox}
            >
              Xóa tất cả
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
