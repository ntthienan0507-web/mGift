import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Smartphone,
  Building2,
  Truck,
  Shield,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { useOrderStore } from "@/store/useOrderStore";
import type { PaymentMethod } from "@/store/useOrderStore";
import { useNavigate } from "react-router-dom";

const paymentMethods: {
  id: PaymentMethod;
  name: string;
  desc: string;
  icon: React.ReactNode;
  logo: string;
  color: string;
  discount?: string;
}[] = [
  {
    id: "vnpay",
    name: "VNPay",
    desc: "Thẻ ATM, Visa, MasterCard, QR Code",
    icon: <CreditCard className="h-5 w-5" />,
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop",
    color: "border-blue-500 bg-blue-50",
    discount: "Giảm 5%",
  },
  {
    id: "momo",
    name: "Ví MoMo",
    desc: "Thanh toán qua ví điện tử MoMo",
    icon: <Smartphone className="h-5 w-5" />,
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop",
    color: "border-pink-500 bg-pink-50",
    discount: "Giảm 10K",
  },
  {
    id: "zalopay",
    name: "ZaloPay",
    desc: "Thanh toán qua ví điện tử ZaloPay",
    icon: <Smartphone className="h-5 w-5" />,
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop",
    color: "border-blue-400 bg-sky-50",
    discount: "Hoàn 15K",
  },
  {
    id: "bank_transfer",
    name: "Chuyển khoản ngân hàng",
    desc: "Chuyển khoản trực tiếp qua app ngân hàng",
    icon: <Building2 className="h-5 w-5" />,
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop",
    color: "border-emerald-500 bg-emerald-50",
  },
  {
    id: "cod",
    name: "Thanh toán khi nhận hàng (COD)",
    desc: "Trả tiền mặt khi nhận được quà",
    icon: <Truck className="h-5 w-5" />,
    logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop",
    color: "border-orange-500 bg-orange-50",
  },
];

export default function Payment() {
  const { currentOrder, setPaymentMethod, setOrderStatus } = useOrderStore();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!currentOrder) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CreditCard className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Chưa có đơn hàng</h2>
        <p className="text-muted-foreground">
          Hãy thêm sản phẩm vào Gift Box và đặt hàng trước.
        </p>
        <Button onClick={() => navigate("/checkout")}>
          Quay lại Gift Box
        </Button>
      </div>
    );
  }

  const handlePay = async () => {
    if (!selected) return;
    setPaymentMethod(selected);
    setIsProcessing(true);

    // Mô phỏng xử lý thanh toán
    setTimeout(() => {
      setOrderStatus("paid");
      setIsProcessing(false);
      navigate("/payment/result");
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/checkout")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CreditCard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Thanh toán</h1>
          <p className="text-sm text-muted-foreground">
            Đơn hàng #{currentOrder.id}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chọn phương thức thanh toán */}
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">
            Chọn phương thức thanh toán
          </h2>

          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <Card
                key={method.id}
                className={`cursor-pointer transition-all ${
                  selected === method.id
                    ? `ring-2 ring-primary ${method.color}`
                    : "hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelected(method.id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Radio indicator */}
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected === method.id
                        ? "border-primary"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {selected === method.id && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      selected === method.id
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {method.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{method.name}</p>
                      {method.discount && (
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-600 text-xs"
                        >
                          {method.discount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.desc}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Thông tin bảo mật */}
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Mọi giao dịch được mã hóa SSL 256-bit. Thông tin thanh toán của
              bạn luôn được bảo mật.
            </span>
          </div>
        </div>

        {/* Tóm tắt đơn hàng */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Tóm tắt đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Danh sách sản phẩm */}
            <div className="space-y-2">
              {currentOrder.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
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

            {/* Thông tin giao hàng */}
            <div className="space-y-1 text-sm">
              <p className="font-medium">Giao đến</p>
              <p className="text-muted-foreground">
                {currentOrder.shipping.name} - {currentOrder.shipping.phone}
              </p>
              <p className="text-muted-foreground">
                {currentOrder.shipping.address}
              </p>
              {currentOrder.shipping.giftMessage && (
                <p className="mt-1 italic text-muted-foreground">
                  "{currentOrder.shipping.giftMessage}"
                </p>
              )}
            </div>

            <Separator />

            {/* Chi phí */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>
                  {currentOrder.subtotal.toLocaleString("vi-VN")}đ
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí đóng gói</span>
                <span className="text-primary">Miễn phí</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí giao hàng</span>
                <span>
                  {currentOrder.shippingFee.toLocaleString("vi-VN")}đ
                </span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span>
              <span className="text-primary">
                {currentOrder.total.toLocaleString("vi-VN")}đ
              </span>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selected || isProcessing}
              onClick={handlePay}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                `Thanh toán ${currentOrder.total.toLocaleString("vi-VN")}đ`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
