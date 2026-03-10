import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { useAdminStats } from "@/hooks/useAdmin";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { AdminUsers } from "./AdminUsers";
import { AdminShops } from "./AdminShops";
import { AdminProducts } from "./AdminProducts";
import { AdminOrders } from "./AdminOrders";

type TabId = "overview" | "users" | "shops" | "products" | "orders";

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showAuth, setShowAuth] = useState(false);
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats();

  // Not logged in
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Vui lòng đăng nhập với tài khoản admin</p>
        <Button onClick={() => setShowAuth(true)}>Đăng nhập</Button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  // Logged in but not admin (403 from API)
  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Truy cập bị từ chối</h1>
        <p className="text-muted-foreground">
          Tài khoản <strong>{user.email}</strong> không có quyền admin.
        </p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Tổng quan", icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: "users", label: "Người dùng", icon: <Users className="h-4 w-4" /> },
    { id: "shops", label: "Cửa hàng", icon: <Store className="h-4 w-4" /> },
    { id: "products", label: "Sản phẩm", icon: <Package className="h-4 w-4" /> },
    { id: "orders", label: "Đơn hàng", icon: <ShoppingCart className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <SEO title="Admin Dashboard" description="Quản trị hệ thống mGift" path="/admin" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Quản trị toàn bộ hệ thống mGift
          </p>
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

      {activeTab === "overview" && (
        <OverviewTab stats={stats} loading={statsLoading} />
      )}
      {activeTab === "users" && <AdminUsers />}
      {activeTab === "shops" && <AdminShops />}
      {activeTab === "products" && <AdminProducts />}
      {activeTab === "orders" && <AdminOrders />}
    </div>
  );
}

// ============ OVERVIEW TAB ============

function OverviewTab({
  stats,
  loading,
}: {
  stats: ReturnType<typeof useAdminStats>["data"];
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
      title: "Tổng người dùng",
      value: stats.total_users,
      icon: <Users className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: "Tổng cửa hàng",
      value: stats.total_shops,
      icon: <Store className="h-5 w-5" />,
      color: "text-purple-600 bg-purple-100",
    },
    {
      title: "Tổng sản phẩm",
      value: stats.total_products,
      icon: <Package className="h-5 w-5" />,
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: "Tổng đơn hàng",
      value: stats.total_orders,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: "text-green-600 bg-green-100",
    },
    {
      title: "Tổng doanh thu",
      value: stats.total_revenue.toLocaleString("vi-VN") + "đ",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-emerald-600 bg-emerald-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}
              >
                {card.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
