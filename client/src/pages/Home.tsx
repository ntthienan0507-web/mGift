import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, MessageCircle, Package, Truck, ArrowRight, Sparkles } from "lucide-react";
import { HeroIllustration } from "@/components/gifting/HeroIllustration";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useGifts";
import { resolveImageUrl } from "@/services/api";
import { ProductCard } from "@/components/gifting/ProductCard";
import { SEO } from "@/components/SEO";

const features = [
  {
    icon: MessageCircle,
    title: "Tư vấn AI thông minh",
    desc: "AI phân tích sở thích người nhận và gợi ý quà tặng phù hợp nhất.",
  },
  {
    icon: Package,
    title: "Gom hàng đa NCC",
    desc: "Chọn món quà từ nhiều shop, mGift gom thành 1 hộp quà tinh tế.",
  },
  {
    icon: Truck,
    title: "Theo dõi real-time",
    desc: "Biết chính xác từng món quà đang ở đâu trong quy trình xử lý.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { data, isLoading } = useProducts({ limit: 8 });
  const popularGifts = data;

  const homeJsonLd = popularGifts?.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Quà tặng phổ biến trên mGift",
        itemListElement: popularGifts.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: p.name,
            description: p.description || p.name,
            image: p.images[0]?.url ? resolveImageUrl(p.images[0].url) : undefined,
            offers: {
              "@type": "Offer",
              price: p.price,
              priceCurrency: "VND",
              availability: "https://schema.org/InStock",
            },
          },
        })),
      }
    : undefined;

  return (
    <div className="space-y-16 py-8">
      <SEO path="/" jsonLd={homeJsonLd} />
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Tặng quà <span className="text-primary">tinh tế</span>,
            <br />
            chỉ với vài bước
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            mGift giúp bạn chọn quà hoàn hảo với AI, gom từ nhiều shop, đóng gói
            tinh tế và giao tận nơi.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => navigate("/assistant")}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Bắt đầu tư vấn
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/checkout")}
            >
              Xem Gift Box
            </Button>
          </div>
        </div>
        <HeroIllustration />
      </section>

      {/* Popular Gifts */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Quà tặng phổ biến</h2>
          <Button
            variant="ghost"
            className="gap-1"
            onClick={() => navigate("/assistant")}
          >
            Xem thêm <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-square w-full" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))
            : popularGifts?.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    images: product.images.map((img) => resolveImageUrl(img.url)),
                    supplierId: product.shop_id,
                    supplierName: product.category_name || "mGift",
                  }}
                />
              ))}
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-6 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="text-center">
            <CardContent className="space-y-3 pt-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[200px] opacity-[0.04] select-none">
            🎁
          </div>
        </div>
        <div className="relative p-8 text-center text-primary-foreground sm:p-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">
            Sẵn sàng tặng quà ý nghĩa?
          </h2>
          <p className="mt-2 text-primary-foreground/80 max-w-md mx-auto">
            Để AI của mGift giúp bạn tìm món quà hoàn hảo nhất cho người thân yêu.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-6"
            onClick={() => navigate("/assistant")}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Thử ngay
          </Button>
        </div>
      </section>
    </div>
  );
}
