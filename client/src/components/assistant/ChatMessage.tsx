import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";

interface ChatMessageProps {
  content: string;
  role: "user" | "assistant";
  isTyping?: boolean;
}

export function ChatMessage({ content, role, isTyping }: ChatMessageProps) {
  const [displayed, setDisplayed] = useState(role === "user" ? content : "");

  useEffect(() => {
    if (role !== "assistant" || !content) return;
    let i = 0;
    const chunk = 5;
    setDisplayed("");
    const interval = setInterval(() => {
      i += chunk;
      setDisplayed(content.slice(0, i));
      if (i >= content.length) clearInterval(interval);
    }, 10);
    return () => clearInterval(interval);
  }, [content, role]);

  return (
    <div
      className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : ""}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={
            role === "assistant"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary"
          }
        >
          {role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isTyping ? (
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
            }}
          >
            {displayed}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
