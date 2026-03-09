import { Link, useLocation } from "react-router-dom";
import { Gift, MessageCircle, ShoppingBag, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";

export function Navbar() {
  const location = useLocation();
  const itemCount = useGiftBoxStore((s) => s.items.length);

  const links = [
    { to: "/", label: "Trang chủ", icon: Gift },
    { to: "/assistant", label: "Tư vấn AI", icon: MessageCircle },
    { to: "/checkout", label: "Gift Box", icon: ShoppingBag },
    { to: "/tracking", label: "Theo dõi", icon: Truck },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-primary">mGift</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {to === "/checkout" && itemCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-xs">
                    {itemCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
