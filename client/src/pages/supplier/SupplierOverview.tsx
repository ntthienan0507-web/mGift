import { Card, CardContent } from "@/components/ui/card";
import { useSupplierStats } from "@/hooks/useSupplier";
import { SEO } from "@/components/SEO";
import { Package, ShoppingCart, TrendingUp, Star, Loader2 } from "lucide-react";

export default function SupplierOverview() {
  const { data: stats, isLoading } = useSupplierStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-16 text-muted-foreground">Không thể tải dữ liệu thống kê</div>;
  }

  const cards = [
    { title: "Tổng sản phẩm", value: stats.total_products, icon: <Package className="h-5 w-5" />, color: "text-blue-600 bg-blue-100" },
    { title: "Tổng đơn hàng", value: stats.total_orders, icon: <ShoppingCart className="h-5 w-5" />, color: "text-green-600 bg-green-100" },
    { title: "Đơn chờ xử lý", value: stats.pending_orders, icon: <ShoppingCart className="h-5 w-5" />, color: "text-orange-600 bg-orange-100" },
    { title: "Doanh thu", value: stats.revenue.toLocaleString("vi-VN") + "đ", icon: <TrendingUp className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-100" },
  ];

  return (
    <>
      <SEO title="Quản lý Shop" description="Trang quản lý dành cho nhà cung cấp" path="/supplier" />
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
    </>
  );
}
