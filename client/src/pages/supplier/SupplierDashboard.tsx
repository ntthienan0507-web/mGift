import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SEO } from "@/components/SEO";
import {
  useSupplierStats,
  useSupplierProfile,
  useCreateShop,
  useRecoverApiKey,
  getSupplierApiKey,
  setSupplierApiKey,
  clearSupplierApiKey,
} from "@/hooks/useSupplier";
import {
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Star,
  Loader2,
  Copy,
  CheckCircle2,
  LogOut,
  KeyRound,
  Mail,
} from "lucide-react";
import { SupplierProducts } from "./SupplierProducts";
import { SupplierOrders } from "./SupplierOrders";
import { SupplierProfileSection } from "./SupplierProfile";

type TabId = "dashboard" | "products" | "orders" | "profile";

export default function SupplierDashboard() {
  const apiKey = getSupplierApiKey();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const { data: stats, isLoading: statsLoading } = useSupplierStats();
  const { data: profile, error: profileError } = useSupplierProfile();

  // Nếu chưa có API key hoặc key sai → hiện form đăng ký/đăng nhập
  if (!apiKey || profileError) {
    return <SupplierAuth />;
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Tổng quan", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "products", label: "Sản phẩm", icon: <Package className="h-4 w-4" /> },
    { id: "orders", label: "Đơn hàng", icon: <ShoppingCart className="h-4 w-4" /> },
    { id: "profile", label: "Hồ sơ shop", icon: <Store className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <SEO
        title="Quản lý Shop"
        description="Trang quản lý sản phẩm và đơn hàng dành cho nhà cung cấp."
        path="/supplier"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {profile?.name || "Quản lý Shop"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Trang quản lý dành cho nhà cung cấp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <Badge variant={profile.is_active ? "default" : "secondary"}>
              {profile.is_active ? "Đang hoạt động" : "Tạm ngưng"}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearSupplierApiKey();
              window.location.reload();
            }}
            title="Đăng xuất supplier"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <DashboardTab stats={stats} loading={statsLoading} />
      )}
      {activeTab === "products" && <SupplierProducts />}
      {activeTab === "orders" && <SupplierOrders />}
      {activeTab === "profile" && <SupplierProfileSection />}
    </div>
  );
}

// ============ AUTH / REGISTER ============

function SupplierAuth() {
  const [mode, setMode] = useState<"login" | "register" | "recover">("register");
  const createShop = useCreateShop();
  const recoverKey = useRecoverApiKey();

  // Register form
  const [shopName, setShopName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // Login form (paste API key)
  const [apiKeyInput, setApiKeyInput] = useState("");

  // Recover form
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSent, setRecoverSent] = useState(false);

  // Created shop result
  const [createdApiKey, setCreatedApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) return;

    createShop.mutate(
      {
        name: shopName.trim(),
        description: description.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim() || null,
      },
      {
        onSuccess: (data) => {
          setCreatedApiKey(data.api_key);
          setSupplierApiKey(data.api_key);
        },
      }
    );
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSupplierApiKey(apiKeyInput.trim());
    window.location.reload();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sau khi tạo shop thành công → hiện API key
  if (createdApiKey) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-700">
            Đăng ký shop thành công!
          </h1>
          <p className="text-muted-foreground">
            Đây là API Key của shop bạn. Hãy lưu lại cẩn thận, bạn sẽ cần nó để đăng nhập lại.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-destructive">
                API Key (lưu lại, chỉ hiện 1 lần!)
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted p-3 text-sm font-mono break-all">
                  {createdApiKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Vào trang quản lý
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <SEO title="Đăng ký Nhà cung cấp" path="/supplier" />

      <div className="flex flex-col items-center text-center space-y-3">
        <Store className="h-12 w-12 text-primary" />
        <h1 className="text-2xl font-bold">Nhà cung cấp mGift</h1>
        <p className="text-muted-foreground">
          Đăng ký shop để bán sản phẩm trên mGift
        </p>
      </div>

      {/* Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { id: "register" as const, label: "Đăng ký mới" },
          { id: "login" as const, label: "Có API Key" },
          { id: "recover" as const, label: "Quên API Key" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "register" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Đăng ký cửa hàng mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tên shop *</label>
                <Input
                  placeholder="Tên cửa hàng của bạn"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mô tả</label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground"
                  placeholder="Giới thiệu ngắn về shop..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email liên hệ</label>
                  <Input
                    type="email"
                    placeholder="shop@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <Input
                    placeholder="0901 234 567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Địa chỉ</label>
                <Input
                  placeholder="Địa chỉ cửa hàng"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <Separator />

              <Button
                className="w-full"
                type="submit"
                disabled={createShop.isPending || !shopName.trim()}
              >
                {createShop.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Store className="mr-2 h-4 w-4" />
                )}
                Đăng ký cửa hàng
              </Button>

              {createShop.isError && (
                <p className="text-sm text-destructive text-center">
                  Đã có lỗi xảy ra. Vui lòng thử lại.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      ) : mode === "login" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Đăng nhập bằng API Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key *</label>
                <Input
                  placeholder="Paste API Key của shop..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  API Key được cấp khi bạn đăng ký shop
                </p>
              </div>

              <Button
                className="w-full"
                type="submit"
                disabled={!apiKeyInput.trim()}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Khôi phục API Key
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recoverSent ? (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Nếu email này đã đăng ký shop, API Key sẽ được gửi qua email.
                  Vui lòng kiểm tra hộp thư.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setRecoverSent(false); setMode("login"); }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Quay lại đăng nhập
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!recoverEmail.trim()) return;
                  recoverKey.mutate(recoverEmail.trim(), {
                    onSuccess: () => setRecoverSent(true),
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email liên hệ của shop *</label>
                  <Input
                    type="email"
                    placeholder="Email bạn đã dùng khi đăng ký shop"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    API Key sẽ được gửi về email liên hệ đã đăng ký
                  </p>
                </div>

                <Button
                  className="w-full"
                  type="submit"
                  disabled={recoverKey.isPending || !recoverEmail.trim()}
                >
                  {recoverKey.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Gửi API Key qua email
                </Button>

                {recoverKey.isError && (
                  <p className="text-sm text-destructive text-center">
                    Đã có lỗi xảy ra. Vui lòng thử lại.
                  </p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ DASHBOARD TAB ============

function DashboardTab({
  stats,
  loading,
}: {
  stats: ReturnType<typeof useSupplierStats>["data"];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Không thể tải dữ liệu thống kê
      </div>
    );
  }

  const cards = [
    {
      title: "Tổng sản phẩm",
      value: stats.total_products,
      icon: <Package className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Tổng đơn hàng",
      value: stats.total_orders,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "Đơn chờ xử lý",
      value: stats.pending_orders,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "Doanh thu",
      value: stats.revenue.toLocaleString("vi-VN") + "đ",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-emerald-600 bg-emerald-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.avg_rating !== null && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Đánh giá trung bình</p>
              <p className="text-lg font-bold">{stats.avg_rating.toFixed(1)} / 5.0</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
