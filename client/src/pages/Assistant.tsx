import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "@/components/assistant/ChatMessage";
import { QuickActions } from "@/components/assistant/QuickActions";
import { ProductCard } from "@/components/gifting/ProductCard";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAIRecommend, useCart, type Product } from "@/hooks/useGifts";
import { resolveImageUrl } from "@/services/api";
import { Send, Bot, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý AI của mGift. Hãy cho tôi biết bạn muốn tặng quà cho ai và dịp gì, tôi sẽ gợi ý những món quà tinh tế nhất!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiProducts, setAiProducts] = useState<Product[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recommend = useAIRecommend();
  const { data: cart } = useCart();


  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const data = await recommend.mutateAsync(msg);

      // Save suggested shipping speed for checkout
      if (data.suggested_shipping_speed && data.suggested_shipping_speed !== "standard") {
        sessionStorage.setItem("mgift_suggested_speed", data.suggested_shipping_speed);
      }

      // Build reply with shipping hint
      let replyText = data.reply;
      if (data.suggested_shipping_speed === "express") {
        replyText += "\n\n⚡ *Mình nhận thấy bạn cần giao gấp — khi đặt hàng hãy chọn **Giao nhanh** để nhận sớm nhất nhé!*";
      } else if (data.suggested_shipping_speed === "economy") {
        replyText += "\n\n💰 *Không vội hả? Bạn có thể chọn **Giao tiết kiệm** khi đặt hàng để giảm phí ship nhé!*";
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: replyText,
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (data.products?.length) {
        setAiProducts(data.products);
      }
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn. Vui lòng thử lại sau nhé!",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const mapProduct = (product: Product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    images: product.images.map((img) => resolveImageUrl(img.url)),
    supplierId: product.shop_id,
    supplierName: product.category_name || "mGift",
  });

  const cartCount = cart?.total_items ?? 0;

  return (
    <div className="space-y-6">
      <SEO
        title="Tư vấn AI - Chọn quà thông minh"
        description="Để AI của mGift giúp bạn tìm món quà hoàn hảo nhất. Phân tích sở thích người nhận và gợi ý quà tặng phù hợp."
        path="/assistant"
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Tư vấn AI</h1>
            <p className="text-sm text-muted-foreground">
              Để AI giúp bạn chọn quà hoàn hảo
            </p>
          </div>
        </div>
        <Link to="/checkout" className="relative">
          <Button variant="outline" size="sm">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {cartCount}
              </span>
            )}
          </Button>
        </Link>
      </div>

      {/* Chat Area */}
      <Card className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 280px)" }}>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                content={msg.content}
                role={msg.role}
              />
            ))}
            {isLoading && (
              <ChatMessage content="" role="assistant" isTyping />
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t p-4 space-y-3">
          {messages.length <= 1 && (
            <QuickActions onSelect={handleSend} />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ví dụ: Tôi muốn tặng quà sinh nhật cho mẹ..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Product Suggestions */}
      {aiProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Gợi ý cho bạn</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {aiProducts.map((p) => (
              <ProductCard key={p.id} product={mapProduct(p)} />
            ))}
          </div>
        </section>
      )}

      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
}
