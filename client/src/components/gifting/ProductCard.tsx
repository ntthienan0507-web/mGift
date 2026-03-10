import { Button } from "@/components/ui/button";
import { Heart, Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAddToCart } from "@/hooks/useGifts";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect, useCallback, useRef } from "react";
import { AuthModal } from "@/components/auth/AuthModal";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    images: string[];
    supplierId: string;
    supplierName: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const addToCart = useAddToCart();
  const user = useAuthStore((s) => s.user);
  const [showAuth, setShowAuth] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const images =
    product.images.length > 0
      ? product.images
      : ["https://placehold.co/400x400/f0f0f0/999?text=No+Image"];
  const hasMultiple = images.length > 1;

  // Auto-slideshow every 3s, pause on hover
  const startSlideshow = useCallback(() => {
    if (!hasMultiple) return;
    intervalRef.current = setInterval(() => {
      setImgIndex((prev) => (prev + 1) % images.length);
    }, 3000);
  }, [hasMultiple, images.length]);

  const stopSlideshow = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isHovered) {
      startSlideshow();
    }
    return stopSlideshow;
  }, [isHovered, startSlideshow, stopSlideshow]);

  const handleAdd = () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    addToCart.mutate({ product_id: product.id, quantity: 1 });
  };

  // JSON-LD structured data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    image: images,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      {/* Structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article
        className="group relative flex flex-col rounded-2xl bg-card border border-border/60 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
        onMouseEnter={() => {
          setIsHovered(true);
          stopSlideshow();
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        itemScope
        itemType="https://schema.org/Product"
      >
        {/* Image area */}
        <div className="relative aspect-[4/5] overflow-hidden bg-muted/40 p-2.5 pb-0">
          <div className="relative h-full w-full overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-[1.02]">
            {/* Slide track */}
            <div
              className="flex h-full will-change-transform transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
              style={{ width: `${images.length * 100}%`, transform: `translateX(-${imgIndex * (100 / images.length)}%)` }}
            >
              {images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={i === 0 ? product.name : `${product.name} - ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  itemProp={i === 0 ? "image" : undefined}
                  className="h-full shrink-0 object-cover"
                  style={{ width: `${100 / images.length}%` }}
                />
              ))}
            </div>

            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Nav arrows */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIndex((imgIndex - 1 + images.length) % images.length);
                  }}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-foreground backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIndex((imgIndex + 1) % images.length);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-foreground backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:scale-110"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1" role="tablist">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === imgIndex}
                      aria-label={`Image ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIndex(i);
                      }}
                      className={`rounded-full transition-all duration-300 ${
                        i === imgIndex
                          ? "h-1.5 w-4 bg-white shadow-sm"
                          : "h-1.5 w-1.5 bg-white/50 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Heart button */}
          <button
            type="button"
            aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
            onClick={() => setLiked(!liked)}
            className={`absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 ${
              liked
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-black/20 text-white hover:bg-black/30"
            }`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-3.5 pt-3">
          <h3 className="font-semibold leading-snug line-clamp-1" itemProp="name">
            {product.name}
          </h3>
          {product.description && (
            <p
              className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed"
              itemProp="description"
            >
              {product.description}
            </p>
          )}

          <div
            className="mt-auto flex items-center justify-between pt-2.5"
            itemProp="offers"
            itemScope
            itemType="https://schema.org/Offer"
          >
            <span className="text-lg font-bold text-primary" itemProp="price" content={String(product.price)}>
              {product.price.toLocaleString("vi-VN")}
              <span className="text-xs font-medium">đ</span>
            </span>
            <meta itemProp="priceCurrency" content="VND" />
            <meta itemProp="availability" content="https://schema.org/InStock" />
            <Button
              size="sm"
              className="h-8 rounded-full px-4 text-xs font-semibold shadow-sm transition-transform hover:scale-105"
              onClick={handleAdd}
              disabled={addToCart.isPending}
            >
              {addToCart.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="mr-0.5 h-3.5 w-3.5" />
                  Thêm
                </>
              )}
            </Button>
          </div>
        </div>
      </article>

      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
