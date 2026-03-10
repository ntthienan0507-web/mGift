import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  FolderTree,
  Warehouse,
  ShieldAlert,
  Menu,
  ArrowLeft,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Người dùng", icon: Users },
  { to: "/admin/shops", label: "Cửa hàng", icon: Store },
  { to: "/admin/categories", label: "Danh mục", icon: FolderTree },
  { to: "/admin/products", label: "Sản phẩm", icon: Package },
  { to: "/admin/orders", label: "Đơn hàng", icon: ShoppingCart },
  { to: "/admin/warehouses", label: "Kho hàng", icon: Warehouse },
];

function SidebarNav() {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
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

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const [showAuth, setShowAuth] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const location = useLocation();

  // Not logged in
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Vui lòng đăng nhập với tài khoản admin</p>
        <Button onClick={() => setShowAuth(true)}>Đăng nhập</Button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    );
  }

  // Not admin
  if (!user.is_admin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Truy cập bị từ chối</h1>
        <p className="text-muted-foreground">
          Tài khoản <strong>{user.email}</strong> không có quyền admin.
        </p>
        <NavLink to="/">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Về trang chủ
          </Button>
        </NavLink>
      </div>
    );
  }

  // Get current page title
  const currentItem = NAV_ITEMS.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to) && item.to !== "/admin"
  ) || NAV_ITEMS[0];

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-muted/30 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Admin Panel</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <SidebarNav />
          </div>
          <div className="border-t p-3">
            <NavLink to="/">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                <ArrowLeft className="h-4 w-4" />
                Về trang chủ
              </Button>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-3 lg:px-6">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="lg:hidden">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-3 pt-10">
              <SidebarNav />
              <div className="mt-4 border-t pt-4">
                <NavLink to="/" onClick={() => setSheetOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Về trang chủ
                  </Button>
                </NavLink>
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-lg font-semibold">{currentItem.label}</h1>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
