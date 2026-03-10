import { Card, CardContent } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/useAdmin";
import { SEO } from "@/components/SEO";
import {
  Users,
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Loader2,
} from "lucide-react";

export default function AdminOverview() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
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
    { title: "Tổng người dùng", value: stats.total_users, icon: <Users className="h-5 w-5" />, color: "text-blue-600 bg-blue-100" },
    { title: "Tổng cửa hàng", value: stats.total_shops, icon: <Store className="h-5 w-5" />, color: "text-purple-600 bg-purple-100" },
    { title: "Tổng sản phẩm", value: stats.total_products, icon: <Package className="h-5 w-5" />, color: "text-orange-600 bg-orange-100" },
    { title: "Tổng đơn hàng", value: stats.total_orders, icon: <ShoppingCart className="h-5 w-5" />, color: "text-green-600 bg-green-100" },
    { title: "Tổng doanh thu", value: stats.total_revenue.toLocaleString("vi-VN") + "đ", icon: <TrendingUp className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-100" },
  ];

  return (
    <>
      <SEO title="Admin Dashboard" description="Quản trị hệ thống mGift" path="/admin" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
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
    </>
  );
}
