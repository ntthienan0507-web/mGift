import { useState, useEffect } from "react";
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
  QrCode,
  Clock,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { useOrder, useCreatePayment, usePaymentByOrder, useCancelOrder } from "@/hooks/useGifts";
import { useNavigate } from "react-router-dom";

type PaymentMethodId = "vnpay" | "momo" | "zalopay" | "bank_transfer" | "cod";

const paymentMethods: {
  id: PaymentMethodId;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  discount?: string;
}[] = [
  {
    id: "vnpay",
    name: "VNPay",
    desc: "Thẻ ATM, Visa, MasterCard, QR Code",
    icon: <CreditCard className="h-5 w-5" />,
    color: "border-blue-500 bg-blue-50",
    discount: "Giảm 5%",
  },
  {
    id: "momo",
    name: "Ví MoMo",
    desc: "Thanh toán qua ví điện tử MoMo",
    icon: <Smartphone className="h-5 w-5" />,
    color: "border-pink-500 bg-pink-50",
    discount: "Giảm 10K",
  },
  {
    id: "zalopay",
    name: "ZaloPay",
    desc: "Thanh toán qua ví điện tử ZaloPay",
    icon: <Smartphone className="h-5 w-5" />,
    color: "border-blue-400 bg-sky-50",
    discount: "Hoàn 15K",
  },
  {
    id: "bank_transfer",
    name: "Chuyển khoản ngân hàng",
    desc: "Chuyển khoản trực tiếp qua app ngân hàng",
    icon: <Building2 className="h-5 w-5" />,
    color: "border-emerald-500 bg-emerald-50",
  },
  {
    id: "cod",
    name: "Thanh toán khi nhận hàng (COD)",
    desc: "Trả tiền mặt khi nhận được quà",
    icon: <Truck className="h-5 w-5" />,
    color: "border-orange-500 bg-orange-50",
  },
];

type PaymentStep = "select" | "processing" | "waiting";

export default function Payment() {
  const navigate = useNavigate();
  const orderId = sessionStorage.getItem("mgift_current_order_id") || "";
  const { data: order } = useOrder(orderId);
  const createPayment = useCreatePayment();
  const { data: payment } = usePaymentByOrder(orderId);
  const cancelOrder = useCancelOrder();

  const [selected, setSelected] = useState<PaymentMethodId | null>(null);
  const [step, setStep] = useState<PaymentStep>("select");
  const [countdown, setCountdown] = useState(600);
  const [copied, setCopied] = useState(false);

  // Khi payment status thay đổi → redirect
  useEffect(() => {
    if (!payment) return;
    if (payment.status === "completed" || payment.status === "paid") {
      // Lưu order history vào localStorage
      try {
        const key = "mgift_order_history";
        const raw = localStorage.getItem(key);
        const history: { id: string; date: string }[] = raw ? JSON.parse(raw) : [];
        if (!history.some((o) => o.id === orderId)) {
          history.unshift({ id: orderId, date: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
        }
      } catch { /* ignore */ }
      navigate("/payment/result?status=success&order_id=" + orderId);
    } else if (payment.status === "failed" || payment.status === "expired") {
      navigate("/payment/result?status=failed&order_id=" + orderId);
    }
  }, [payment?.status, orderId, navigate]);

  // Redirect nếu payment đã có khi load (VNPay callback redirect)
  useEffect(() => {
    if (payment?.payment_url && step === "processing") {
      // BE trả về payment_url → redirect đến cổng thanh toán
      window.location.href = payment.payment_url;
    }
  }, [payment?.payment_url, step]);

  // Countdown timer
  useEffect(() => {
    if (step !== "waiting") return;
    if (countdown <= 0) {
      navigate("/payment/result?status=failed&order_id=" + orderId);
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown, navigate, orderId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!orderId || (!order && !createPayment.isPending)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <CreditCard className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Chưa có đơn hàng</h2>
        <p className="text-muted-foreground">
          Hãy thêm sản phẩm vào giỏ và đặt hàng trước.
        </p>
        <Button onClick={() => navigate("/checkout")}>
          Quay lại giỏ hàng
        </Button>
      </div>
    );
  }

  const handlePay = () => {
    if (!selected) return;

    // COD → tạo payment rồi chuyển luôn
    if (selected === "cod") {
      createPayment.mutate(
        { order_id: orderId, method: "cod" },
        {
          onSuccess: () => {
            // Lưu order history
            try {
              const key = "mgift_order_history";
              const raw = localStorage.getItem(key);
              const history: { id: string; date: string }[] = raw ? JSON.parse(raw) : [];
              if (!history.some((o) => o.id === orderId)) {
                history.unshift({ id: orderId, date: new Date().toISOString() });
                localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
              }
            } catch { /* ignore */ }
            navigate("/payment/result?status=success&order_id=" + orderId);
          },
        }
      );
      return;
    }

    // Cổng khác → tạo payment rồi chờ
    setStep("processing");
    createPayment.mutate(
      { order_id: orderId, method: selected },
      {
        onSuccess: (paymentData) => {
          if (paymentData.payment_url) {
            // BE trả redirect URL (VNPay, MoMo, ZaloPay)
            window.location.href = paymentData.payment_url;
          } else {
            // Không có redirect URL → hiện QR/thông tin CK
            setStep("waiting");
            setCountdown(600);
          }
        },
        onError: () => {
          setStep("select");
        },
      }
    );
  };

  const handleCancel = () => {
    cancelOrder.mutate({ orderId });
    navigate("/payment/result?status=failed&order_id=" + orderId);
  };

  // ============ BƯỚC: ĐANG KẾT NỐI CỔNG TT ============
  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Đang kết nối cổng thanh toán...</h2>
        <p className="text-muted-foreground">
          Vui lòng không tắt trình duyệt
        </p>
      </div>
    );
  }

  // ============ BƯỚC: CHỜ KHÁCH THANH TOÁN ============
  if (step === "waiting" && selected) {
    const isEwallet = selected === "momo" || selected === "zalopay" || selected === "vnpay";
    const isBankTransfer = selected === "bank_transfer";

    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Hoàn tất thanh toán</h1>
          <p className="text-sm text-muted-foreground">
            Đơn hàng #{orderId}
          </p>
        </div>

        {/* Countdown */}
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center justify-center gap-3 p-4">
            <Clock className="h-5 w-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">
              Giao dịch hết hạn sau
            </span>
            <span className="rounded-lg bg-orange-600 px-3 py-1 font-mono text-lg font-bold text-white">
              {formatTime(countdown)}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {isEwallet && (
              <>
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Quét mã QR bằng ứng dụng{" "}
                    <span className="font-semibold text-foreground">
                      {selected === "momo" ? "MoMo" : selected === "zalopay" ? "ZaloPay" : "VNPay / App ngân hàng"}
                    </span>
                  </p>
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-white">
                    <div className="text-center">
                      <QrCode className="mx-auto h-24 w-24 text-primary" />
                      <p className="mt-2 text-xs text-muted-foreground">QR thanh toán</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số tiền</span>
                    <span className="font-bold text-primary">
                      {order?.total_amount.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nội dung CK</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">{orderId}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy(orderId)}>
                        {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {isBankTransfer && (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Chuyển khoản theo thông tin bên dưới
                  </p>
                  <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-white">
                    <div className="text-center">
                      <QrCode className="mx-auto h-24 w-24 text-primary" />
                      <p className="mt-2 text-xs text-muted-foreground">QR chuyển khoản</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ngân hàng</span>
                    <span className="font-medium">Vietcombank</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số tài khoản</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">1234 5678 9012</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy("123456789012")}>
                        {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chủ tài khoản</span>
                    <span className="font-medium">CONG TY TNHH MGIFT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Số tiền</span>
                    <span className="font-bold text-primary">
                      {order?.total_amount.toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nội dung CK</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-medium">{orderId}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleCopy(orderId)}>
                        {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCancel}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Hủy giao dịch
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Hệ thống sẽ tự động xác nhận khi nhận được thanh toán.
        </p>
      </div>
    );
  }

  // ============ BƯỚC: CHỌN CỔNG THANH TOÁN ============
  return (
    <div className="space-y-6">
      <SEO title="Thanh toán" path="/payment" />
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
            Đơn hàng #{orderId}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="text-muted-foreground">Xác nhận đơn</span>
        <div className="h-px flex-1 bg-primary" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          2
        </span>
        <span className="font-medium">Thanh toán</span>
        <div className="h-px flex-1 bg-border" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          3
        </span>
        <span className="text-muted-foreground">Hoàn tất</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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

                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      selected === method.id
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {method.icon}
                  </div>

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

          <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Mọi giao dịch được mã hóa SSL 256-bit. Thông tin thanh toán của
              bạn luôn được bảo mật.
            </span>
          </div>
        </div>

        {/* Tóm tắt đơn hàng */}
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle className="text-base">Tóm tắt đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order && (
              <>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          SP #{item.product_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          SL: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {(item.unit_price * item.quantity).toLocaleString("vi-VN")}đ
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-1 text-sm">
                  <p className="font-medium">Giao đến</p>
                  <p className="text-muted-foreground">
                    {order.recipient_name} - {order.recipient_phone}
                  </p>
                  <p className="text-muted-foreground">
                    {order.recipient_address}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tạm tính</span>
                    <span>
                      {(order.total_amount - order.shipping_fee).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phí đóng gói</span>
                    <span className="text-primary">Miễn phí</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phí giao hàng</span>
                    <span>{order.shipping_fee.toLocaleString("vi-VN")}đ</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Tổng cộng</span>
                  <span className="text-primary">
                    {order.total_amount.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!selected || createPayment.isPending}
              onClick={handlePay}
            >
              {createPayment.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {selected === "cod"
                ? "Xác nhận đặt hàng (COD)"
                : `Thanh toán ${order?.total_amount.toLocaleString("vi-VN") ?? ""}đ`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
