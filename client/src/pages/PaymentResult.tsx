import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Gift,
  Copy,
  MapPin,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const paymentMethodNames: Record<string, string> = {
  vnpay: "VNPay",
  momo: "Ví MoMo",
  zalopay: "ZaloPay",
  bank_transfer: "Chuyển khoản ngân hàng",
  cod: "Thanh toán khi nhận hàng",
};

export default function PaymentResult() {
  const { currentOrder, clearOrder } = useOrderStore();
  const { clearBox } = useGiftBoxStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Xóa Gift Box + lưu mã đơn hàng khi thanh toán thành công
  useEffect(() => {
    if (currentOrder?.status === "paid") {
      clearBox();
      // Lưu mã đơn hàng vào localStorage
      try {
        const key = "mgift_order_history";
        const raw = localStorage.getItem(key);
        const history: { id: string; date: string }[] = raw ? JSON.parse(raw) : [];
        if (!history.some((o) => o.id === currentOrder.id)) {
          history.unshift({ id: currentOrder.id, date: currentOrder.createdAt });
          // Giữ tối đa 20 đơn gần nhất
          localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
        }
      } catch { /* ignore */ }
    }
  }, [currentOrder?.status, currentOrder?.id, currentOrder?.createdAt, clearBox]);

  if (!currentOrder) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Gift className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Không tìm thấy đơn hàng</h2>
        <Button onClick={() => navigate("/")}>Về trang chủ</Button>
      </div>
    );
  }

  const isSuccess = currentOrder.status === "paid";

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(currentOrder.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackHome = () => {
    clearOrder();
    navigate("/");
  };

  const handleTrackOrder = () => {
    navigate("/tracking");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* Status Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        {isSuccess ? (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-green-700">
              Đặt hàng thành công!
            </h1>
            <p className="text-muted-foreground">
              Cảm ơn bạn đã đặt quà tại mGift. Đơn hàng đang được xử lý.
            </p>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-red-700">
              Thanh toán thất bại
            </h1>
            <p className="text-muted-foreground">
              Đã có lỗi xảy ra. Vui lòng thử lại hoặc chọn phương thức khác.
            </p>
          </>
        )}
      </div>

      {isSuccess && (
        <>
          {/* Thông tin đơn hàng */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              {/* Mã đơn hàng */}
              <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mã đơn hàng</p>
                  <p className="text-lg font-bold">{currentOrder.id}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleCopyOrderId}
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Đã sao chép" : "Sao chép"}
                </Button>
              </div>

              <Separator />

              {/* Chi tiết */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Thời gian đặt
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(currentOrder.createdAt).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Gift className="h-3 w-3" /> Phương thức
                  </p>
                  <p className="text-sm font-medium">
                    {currentOrder.paymentMethod
                      ? paymentMethodNames[currentOrder.paymentMethod]
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Giao đến
                  </p>
                  <p className="text-sm font-medium">
                    {currentOrder.shipping.name} -{" "}
                    {currentOrder.shipping.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentOrder.shipping.address}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Danh sách sản phẩm */}
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Sản phẩm ({currentOrder.items.length} món)
                </p>
                {currentOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.supplierName}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {item.price.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Tổng cộng */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span>
                    {currentOrder.subtotal.toLocaleString("vi-VN")}đ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí giao hàng</span>
                  <span>
                    {currentOrder.shippingFee.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Tổng cộng</span>
                <span className="text-primary">
                  {currentOrder.total.toLocaleString("vi-VN")}đ
                </span>
              </div>

              {currentOrder.shipping.giftMessage && (
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Lời nhắn tặng quà
                  </p>
                  <p className="text-sm italic">
                    "{currentOrder.shipping.giftMessage}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dự kiến giao hàng */}
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Dự kiến giao hàng</p>
                <p className="text-sm text-muted-foreground">
                  2-4 ngày làm việc (gom hàng từ nhiều NCC)
                </p>
              </div>
              <Badge variant="secondary">Đang xử lý</Badge>
            </CardContent>
          </Card>
        </>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {isSuccess ? (
          <>
            <Button className="flex-1 gap-2" onClick={handleTrackOrder}>
              Theo dõi đơn hàng
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleBackHome}
            >
              Về trang chủ
            </Button>
          </>
        ) : (
          <>
            <Button className="flex-1" onClick={() => navigate("/payment")}>
              Thử lại
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/checkout")}
            >
              Quay lại giỏ hàng
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
