import { Link } from "react-router-dom";
import { Gift } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30 mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold text-primary">mGift</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Nền tảng tặng quà tinh tế với AI tư vấn thông minh. Gom hàng đa nhà cung cấp, đóng gói đẹp, giao tận nơi.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Dịch vụ</h3>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/assistant" className="hover:text-foreground transition-colors">Tư vấn AI</Link>
              <Link to="/checkout" className="hover:text-foreground transition-colors">Gift Box</Link>
              <Link to="/tracking" className="hover:text-foreground transition-colors">Theo dõi đơn hàng</Link>
            </nav>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Liên hệ</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>Email: hello@mgift.vn</span>
              <span>Hotline: 1900 xxxx</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} mGift. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
}
