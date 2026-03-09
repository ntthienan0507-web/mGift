import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingBag, X, Gift } from "lucide-react";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";
import { useNavigate } from "react-router-dom";

export function GiftBoxSidebar() {
  const { items, removeItem, getTotal, getSupplierGroups, clearBox } =
    useGiftBoxStore();
  const navigate = useNavigate();
  const groups = getSupplierGroups();

  return (
    <Sheet>
      <SheetTrigger
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ShoppingBag className="h-4 w-4" />
        Gift Box
        {items.length > 0 && (
          <Badge className="ml-1">{items.length}</Badge>
        )}
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Custom Gift Box
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <ShoppingBag className="h-12 w-12" />
            <p>Gift Box chưa có món nào</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-4">
              {Object.entries(groups).map(([supplier, supplierItems]) => (
                <div key={supplier} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {supplier}
                    </Badge>
                  </div>
                  {supplierItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-accent"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.price.toLocaleString("vi-VN")}d
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Separator className="mt-2" />
                </div>
              ))}
            </ScrollArea>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Tổng cộng</span>
                <span className="text-primary">
                  {getTotal().toLocaleString("vi-VN")}d
                </span>
              </div>
              <Button
                className="w-full"
                onClick={() => navigate("/checkout")}
              >
                Tiến hành đặt hàng
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={clearBox}
              >
                Xóa tất cả
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
