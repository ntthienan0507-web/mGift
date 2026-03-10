import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";
import {
  useSupplierProfile,
  getSupplierApiKey,
  clearSupplierApiKey,
} from "@/hooks/useSupplier";
import { SupplierAuth } from "@/pages/supplier/SupplierAuth";
import {
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  UserCircle,
  Menu,
  ArrowLeft,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/supplier", label: "Tổng quan", icon: TrendingUp, end: true },
  { to: "/supplier/products", label: "Sản phẩm", icon: Package },
  { to: "/supplier/orders", label: "Đơn hàng", icon: ShoppingCart },
  { to: "/supplier/profile", label: "Hồ sơ shop", icon: UserCircle },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function SupplierLayout() {
  const apiKey = getSupplierApiKey();
  const { data: profile, error: profileError } = useSupplierProfile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  if (!apiKey || profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <SupplierAuth />
      </div>
    );
  }

  const currentItem = NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== "/supplier"
  ) || NAV_ITEMS[0];

  const handleLogout = () => {
    clearSupplierApiKey();
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-muted/30 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <Store className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile?.name || "Shop"}</p>
            </div>
            {profile && (
              <Badge variant={profile.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                {profile.is_active ? "ON" : "OFF"}
              </Badge>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNav />
          </div>
          <div className="border-t p-3 space-y-1">
            <NavLink to="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <ArrowLeft className="h-4 w-4" />
                Về trang chủ
              </Button>
            </NavLink>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-3 lg:px-6">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="lg:hidden">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-3 pt-10">
              <SidebarNav onNavigate={() => setSheetOpen(false)} />
              <div className="mt-4 border-t pt-4 space-y-1">
                <NavLink to="/" onClick={() => setSheetOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Về trang chủ
                  </Button>
                </NavLink>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-lg font-semibold">{currentItem.label}</h1>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
