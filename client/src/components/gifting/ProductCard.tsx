import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check } from "lucide-react";
import { useGiftBoxStore } from "@/store/useGiftBoxStore";
import type { GiftItem } from "@/store/useGiftBoxStore";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    supplierId: string;
    supplierName: string;
    tags?: string[];
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, removeItem } = useGiftBoxStore();
  const isInBox = items.some((i) => i.id === product.id);

  const giftItem: GiftItem = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    supplierId: product.supplierId,
    supplierName: product.supplierName,
  };

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {product.tags?.map((tag) => (
          <Badge
            key={tag}
            className="absolute left-2 top-2"
            variant="secondary"
          >
            {tag}
          </Badge>
        ))}
      </div>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{product.supplierName}</p>
        <h3 className="mt-1 font-medium leading-tight">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {product.price.toLocaleString("vi-VN")}d
          </span>
          <Button
            size="sm"
            variant={isInBox ? "secondary" : "default"}
            className="h-8 w-8 rounded-full p-0"
            onClick={() =>
              isInBox ? removeItem(product.id) : addItem(giftItem)
            }
          >
            {isInBox ? (
              <Check className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
