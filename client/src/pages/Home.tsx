import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, MessageCircle, Package, Truck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const popularGifts = [
  {
    name: "Bộ quà trà hoa cao cấp",
    price: "450,000đ",
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=400&h=400&fit=crop",
    tag: "Tinh tế",
  },
  {
    name: "Hộp chocolate Bỉ thủ công",
    price: "520,000đ",
    image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&h=400&fit=crop",
    tag: "Best seller",
  },
  {
    name: "Bó hoa hồng Ecuador",
    price: "890,000đ",
    image: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=400&h=400&fit=crop",
    tag: "Lãng mạn",
  },
  {
    name: "Nước hoa mini gift set",
    price: "750,000đ",
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop",
    tag: "Sang trọng",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-16 py-8">
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
        <div className="grid grid-cols-2 gap-3">
          <img
            src="https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=400&h=500&fit=crop"
            alt="Hộp quà tặng"
            className="h-64 w-full rounded-2xl object-cover shadow-lg"
          />
          <img
            src="https://images.unsplash.com/photo-1549465220-1a8b9238f060?w=400&h=500&fit=crop"
            alt="Quà tặng đẹp"
            className="mt-8 h-64 w-full rounded-2xl object-cover shadow-lg"
          />
        </div>
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
          {popularGifts.map((gift) => (
            <Card
              key={gift.name}
              className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
              onClick={() => navigate("/assistant")}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={gift.image}
                  alt={gift.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <Badge className="absolute left-2 top-2" variant="secondary">
                  {gift.tag}
                </Badge>
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium leading-tight">{gift.name}</p>
                <p className="mt-1 text-sm font-bold text-primary">
                  {gift.price}
                </p>
              </CardContent>
            </Card>
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

      {/* CTA with background image */}
      <section className="relative overflow-hidden rounded-2xl">
        <img
          src="https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&h=400&fit=crop"
          alt="Gift background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative bg-primary/85 p-8 text-center text-primary-foreground sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Sẵn sàng tặng quà ý nghĩa?
          </h2>
          <p className="mt-2 text-primary-foreground/80">
            Để AI của mGift giúp bạn tìm món quà hoàn hảo nhất.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="mt-6"
            onClick={() => navigate("/assistant")}
          >
            Thử ngay
          </Button>
        </div>
      </section>
    </div>
  );
}
