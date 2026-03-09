import { Button } from "@/components/ui/button";
import { Heart, Users, Wallet, Sparkles } from "lucide-react";

interface QuickActionsProps {
  onSelect: (text: string) => void;
}

const actions = [
  { label: "Tặng mẹ", icon: Heart, text: "Gợi ý quà tặng cho mẹ" },
  { label: "Tặng người yêu", icon: Sparkles, text: "Gợi ý quà tặng cho người yêu" },
  { label: "Tặng bạn bè", icon: Users, text: "Gợi ý quà tặng cho bạn bè" },
  { label: "Dưới 1 triệu", icon: Wallet, text: "Gợi ý quà tặng ngân sách dưới 1 triệu" },
];

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="gap-2 rounded-full"
          onClick={() => onSelect(action.text)}
        >
          <action.icon className="h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
