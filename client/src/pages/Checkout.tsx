import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Package, Trash2, ShoppingBag, MapPin, User, Phone, Mail, Loader2, Zap, Truck, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useCart, useRemoveCartItem, useClearCart, useCartCheckout, useShippingOptions, type ShippingOption } from "@/hooks/useGifts";
import { resolveImageUrl } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthModal } from "@/components/auth/AuthModal";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const SHIPPING_STORAGE_KEY = "mgift_shipping_info";

function getSavedShipping() {
  try {
    const saved = localStorage.getItem(SHIPPING_STORAGE_KEY);
    if (saved) return JSON.parse(saved) as { name: string; phone: string; email: string; address: string };
  } catch { /* ignore */ }
  return null;
}

export default function Checkout() {
  const { data: cart, isLoading: cartLoading } = useCart();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const checkout = useCartCheckout();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [showAuth, setShowAuth] = useState(false);

  const saved = getSavedShipping();
  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  const [note, setNote] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [saveInfo, setSaveInfo] = useState(!!saved);
  const [shippingSpeed, setShippingSpeed] = useState(
    () => sessionStorage.getItem("mgift_suggested_speed") || "standard"
  );
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const fetchShippingOptions = useShippingOptions();

  // Fetch shipping options khi có cart
  useEffect(() => {
    if (cart && cart.items.length > 0) {
      const productIds = cart.items.map((item) => item.product_id);
      fetchShippingOptions.mutate(
        { product_ids: productIds },
        { onSuccess: (opts) => setShippingOptions(opts) }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.items.length]);

  // Lưu thông tin giao hàng khi user tick "Lưu"
  useEffect(() => {
    if (saveInfo && name && phone && address) {
      localStorage.setItem(
        SHIPPING_STORAGE_KEY,
        JSON.stringify({ name, phone, email, address })
      );
    }
    if (!saveInfo) {
      localStorage.removeItem(SHIPPING_STORAGE_KEY);
    }
  }, [saveInfo, name, phone, email, address]);

  if (cartLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Giỏ hàng của bạn đang trống</h2>
        <p className="text-muted-foreground">
          Hãy để AI tư vấn và chọn những món quà tuyệt vời!
        </p>
        <Button onClick={() => navigate("/assistant")}>
          Bắt đầu tư vấn AI
        </Button>
      </div>
    );
  }

  const selectedOption = shippingOptions.find((o) => o.speed === shippingSpeed);
  const currentShippingFee = selectedOption
    ? selectedOption.shipping_fee
    : shippingSpeed === "express" ? 60000 : shippingSpeed === "economy" ? 21000 : 30000;

  const canProceed = name.trim() && phone.trim() && email.trim() && address.trim();

  const handleProceedToPayment = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (!canProceed) return;

    checkout.mutate(
      {
        recipient_name: name.trim(),
        recipient_phone: phone.trim(),
        recipient_address: address.trim(),
        note: note.trim() || undefined,
        gift_message: giftMessage.trim() || undefined,
        shipping_speed: shippingSpeed,
      },
      {
        onSuccess: (order) => {
          // Lưu orderId để Payment page sử dụng
          sessionStorage.setItem("mgift_current_order_id", order.id);
          navigate("/payment");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Đặt hàng Gift Box"
        description="Xác nhận đơn hàng và điền thông tin giao hàng. Đóng gói tinh tế, giao tận nơi."
        path="/checkout"
      />
      <div className="flex items-center gap-3">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Đặt hàng</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          1
        </span>
        <span className="font-medium">Xác nhận đơn</span>
        <div className="h-px flex-1 bg-border" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          2
        </span>
        <span className="text-muted-foreground">Thanh toán</span>
        <div className="h-px flex-1 bg-border" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          3
        </span>
        <span className="text-muted-foreground">Hoàn tất</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Thông tin người nhận */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Thông tin giao hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <User className="h-3 w-3" /> Họ tên người nhận *
                  </label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Số điện thoại *
                  </label>
                  <Input
                    placeholder="0901 234 567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email *
                </label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Dùng để nhận xác nhận đơn hàng và cập nhật trạng thái giao hàng
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Địa chỉ giao hàng *
                </label>
                <Input
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Ghi chú giao hàng
                </label>
                <Input
                  placeholder="VD: Giao giờ hành chính, gọi trước khi giao..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Lời nhắn tặng quà
                </label>
                <Input
                  placeholder="Gửi lời yêu thương đến người nhận..."
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                />
              </div>

              {/* Lưu thông tin */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveInfo}
                  onChange={(e) => setSaveInfo(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Lưu thông tin giao hàng cho lần sau
                </span>
              </label>
            </CardContent>
          </Card>

          {/* Tốc độ giao hàng */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-primary" />
                Tốc độ giao hàng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {shippingOptions.length > 0 ? (
                shippingOptions.map((opt) => {
                  const isSelected = shippingSpeed === opt.speed;
                  const Icon = opt.speed === "express" ? Zap : opt.speed === "economy" ? Clock : Truck;
                  return (
                    <button
                      key={opt.speed}
                      type="button"
                      onClick={() => setShippingSpeed(opt.speed)}
                      className={`w-full flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{opt.label}</span>
                          {opt.speed === "express" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">
                              Nhanh nhất
                            </Badge>
                          )}
                          {opt.speed === "economy" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">
                              Tiết kiệm
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{opt.estimated_text} &middot; {opt.description}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${isSelected ? "text-primary" : ""}`}>
                        {opt.shipping_fee.toLocaleString("vi-VN")}đ
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="space-y-2">
                  {[
                    { speed: "express", label: "Giao nhanh", desc: "Giao trong ngày (nội thành)", fee: 60000, Icon: Zap },
                    { speed: "standard", label: "Giao tiêu chuẩn", desc: "Giao trong 1-3 ngày", fee: 30000, Icon: Truck },
                    { speed: "economy", label: "Giao tiết kiệm", desc: "Giao trong 3-5 ngày", fee: 21000, Icon: Clock },
                  ].map(({ speed, label, desc, fee, Icon }) => {
                    const isSelected = shippingSpeed === speed;
                    return (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setShippingSpeed(speed)}
                        className={`w-full flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <span className="font-medium text-sm">{label}</span>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <span className={`text-sm font-bold ${isSelected ? "text-primary" : ""}`}>
                          {fee.toLocaleString("vi-VN")}đ
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sản phẩm trong giỏ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Sản phẩm trong giỏ</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {cart.total_items} món
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  {item.product_image && (
                    <img
                      src={resolveImageUrl(item.product_image)}
                      alt={item.product_name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      SL: {item.quantity}
                    </p>
                    <p className="text-sm font-bold text-primary">
                      {item.subtotal.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem.mutate(item.id)}
                    disabled={removeItem.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tổng kết đơn hàng */}
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle>Tổng kết đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Số lượng món ({cart.total_items})
                </span>
                <span>{cart.total_amount.toLocaleString("vi-VN")}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí đóng gói</span>
                <span className="text-primary">Miễn phí</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Phí giao hàng
                  {shippingSpeed === "express" && " (nhanh)"}
                  {shippingSpeed === "economy" && " (tiết kiệm)"}
                </span>
                <span>{currentShippingFee.toLocaleString("vi-VN")}đ</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span>
              <span className="text-primary">
                {(cart.total_amount + currentShippingFee).toLocaleString("vi-VN")}đ
              </span>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!canProceed || checkout.isPending}
              onClick={handleProceedToPayment}
            >
              {checkout.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Tiến hành thanh toán
            </Button>

            {!canProceed && (
              <p className="text-xs text-center text-muted-foreground">
                Vui lòng điền đầy đủ thông tin giao hàng
              </p>
            )}

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => clearCart.mutate()}
              disabled={clearCart.isPending}
            >
              Xóa tất cả
            </Button>
          </CardContent>
        </Card>
      </div>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
