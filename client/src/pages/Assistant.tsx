import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ChatMessage } from "@/components/assistant/ChatMessage";
import { QuickActions } from "@/components/assistant/QuickActions";
import { ProductCard } from "@/components/gifting/ProductCard";
import { GiftBoxSidebar } from "@/components/gifting/GiftBoxSidebar";
import { Send, Bot } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Mock products for demo
const mockProducts = [
  {
    id: "1",
    name: "Bộ quà trà hoa cao cấp",
    price: 450000,
    image: "https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=400&h=400&fit=crop",
    supplierId: "s1",
    supplierName: "The Tea House",
    tags: ["Tinh tế"],
  },
  {
    id: "2",
    name: "Nến thơm lavender handmade",
    price: 280000,
    image: "https://images.unsplash.com/photo-1602607115284-ce640da56b96?w=400&h=400&fit=crop",
    supplierId: "s2",
    supplierName: "Candle Studio",
    tags: ["Hot"],
  },
  {
    id: "3",
    name: "Hộp chocolate Bỉ thủ công",
    price: 520000,
    image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=400&h=400&fit=crop",
    supplierId: "s3",
    supplierName: "ChocoArt VN",
    tags: ["Best seller"],
  },
  {
    id: "4",
    name: "Khăn lụa tơ tằm",
    price: 680000,
    image: "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&h=400&fit=crop",
    supplierId: "s4",
    supplierName: "Silk Saigon",
    tags: ["Premium"],
  },
  {
    id: "5",
    name: "Bó hoa hồng Ecuador",
    price: 890000,
    image: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=400&h=400&fit=crop",
    supplierId: "s5",
    supplierName: "Flora Boutique",
    tags: ["Lãng mạn"],
  },
  {
    id: "6",
    name: "Nước hoa mini gift set",
    price: 750000,
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&h=400&fit=crop",
    supplierId: "s6",
    supplierName: "Perfume Lab",
    tags: ["Sang trọng"],
  },
  {
    id: "7",
    name: "Gấu bông handmade",
    price: 320000,
    image: "https://images.unsplash.com/photo-1559715541-5daf8a0296d0?w=400&h=400&fit=crop",
    supplierId: "s2",
    supplierName: "Candle Studio",
    tags: ["Dễ thương"],
  },
  {
    id: "8",
    name: "Bộ tách cà phê gốm sứ",
    price: 420000,
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop",
    supplierId: "s1",
    supplierName: "The Tea House",
    tags: ["Tinh tế"],
  },
];

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
  const [showProducts, setShowProducts] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Tuyệt vời! Dựa trên yêu cầu "${msg}", tôi đã chọn ra những món quà phù hợp nhất. Bạn có thể thêm bất kỳ món nào vào Gift Box để tạo hộp quà riêng của mình!`,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsLoading(false);
      setShowProducts(true);
    }, 1500);
  };

  return (
    <div className="space-y-6">
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
        <GiftBoxSidebar />
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
      {showProducts && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Gợi ý cho bạn</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {mockProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
