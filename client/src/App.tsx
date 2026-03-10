import { useEffect, lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Assistant from "@/pages/Assistant";
import Checkout from "@/pages/Checkout";
import Payment from "@/pages/Payment";
import PaymentResult from "@/pages/PaymentResult";
import Status from "@/pages/Status";
import { useAuthStore } from "@/store/useAuthStore";
import { NotificationToast } from "@/components/NotificationToast";
import { Loader2 } from "lucide-react";

// Lazy load admin & supplier layouts (separate bundles)
const AdminLayout = lazy(() => import("@/components/layout/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminShopsPage = lazy(() => import("@/pages/admin/AdminShops"));
const AdminCategoriesPage = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminProductsPage = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminWarehousesPage = lazy(() => import("@/pages/admin/AdminWarehouses"));

const SupplierLayout = lazy(() => import("@/components/layout/SupplierLayout"));
const SupplierOverview = lazy(() => import("@/pages/supplier/SupplierOverview"));
const SupplierProducts = lazy(() => import("@/pages/supplier/SupplierProducts").then(m => ({ default: m.SupplierProducts })));
const SupplierOrders = lazy(() => import("@/pages/supplier/SupplierOrders").then(m => ({ default: m.SupplierOrders })));
const SupplierProfile = lazy(() => import("@/pages/supplier/SupplierProfile").then(m => ({ default: m.SupplierProfileSection })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <>
      <NotificationToast />
      <Routes>
        {/* Public pages with main layout */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/payment/result" element={<PaymentResult />} />
          <Route path="/tracking" element={<Status />} />
        </Route>

        {/* Admin - separate layout */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<Suspense fallback={<PageLoader />}><AdminOverview /></Suspense>} />
          <Route path="users" element={<Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>} />
          <Route path="shops" element={<Suspense fallback={<PageLoader />}><AdminShopsPage /></Suspense>} />
          <Route path="categories" element={<Suspense fallback={<PageLoader />}><AdminCategoriesPage /></Suspense>} />
          <Route path="products" element={<Suspense fallback={<PageLoader />}><AdminProductsPage /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<PageLoader />}><AdminOrdersPage /></Suspense>} />
          <Route path="warehouses" element={<Suspense fallback={<PageLoader />}><AdminWarehousesPage /></Suspense>} />
        </Route>

        {/* Supplier - separate layout */}
        <Route
          path="/supplier"
          element={
            <Suspense fallback={<PageLoader />}>
              <SupplierLayout />
            </Suspense>
          }
        >
          <Route index element={<Suspense fallback={<PageLoader />}><SupplierOverview /></Suspense>} />
          <Route path="products" element={<Suspense fallback={<PageLoader />}><SupplierProducts /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<PageLoader />}><SupplierOrders /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<PageLoader />}><SupplierProfile /></Suspense>} />
        </Route>
      </Routes>
    </>
  );
}
