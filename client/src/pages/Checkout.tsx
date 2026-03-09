import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Package, Trash2, ShoppingBag, MapPin, User, Phone, Mail } from "lucide-react";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";
import { useOrderStore } from "@/store/useOrderStore";
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
  const { items, removeItem, getTotal, getSupplierGroups, clearBox } =
    useGiftBoxStore();
  const { createOrder } = useOrderStore();
  const navigate = useNavigate();
  const groups = getSupplierGroups();

  const saved = getSavedShipping();
  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [address, setAddress] = useState(saved?.address ?? "");
  const [note, setNote] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [saveInfo, setSaveInfo] = useState(!!saved);

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

  const canProceed = name.trim() && phone.trim() && email.trim() && address.trim();

  const handleProceedToPayment = () => {
    if (!canProceed) return;
    createOrder(items, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      note: note.trim(),
      giftMessage: giftMessage.trim(),
    });
    navigate("/payment");
  };

  return (
    <div className="space-y-6">
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

          {/* Sản phẩm theo NCC */}
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
                        {item.price.toLocaleString("vi-VN")}đ
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

        {/* Tổng kết đơn hàng */}
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle>Tổng kết đơn hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Số lượng món ({items.length})
                </span>
                <span>{getTotal().toLocaleString("vi-VN")}đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí đóng gói</span>
                <span className="text-primary">Miễn phí</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phí giao hàng</span>
                <span>30,000đ</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span>
              <span className="text-primary">
                {(getTotal() + 30000).toLocaleString("vi-VN")}đ
              </span>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!canProceed}
              onClick={handleProceedToPayment}
            >
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
