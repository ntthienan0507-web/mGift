import { useNotification } from "@/hooks/useNotification";
import { X, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function NotificationToast() {
  const { notifications, dismissNotification } = useNotification();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2">
      {notifications.slice(0, 3).map((n) => (
        <div
          key={n.id}
          className="animate-in slide-in-from-right cursor-pointer rounded-lg border bg-background p-3 shadow-lg transition-all hover:shadow-xl"
          onClick={() => {
            if (n.data?.url) navigate(n.data.url);
            dismissNotification(n.id);
          }}
        >
          <div className="flex items-start gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {n.body}
              </p>
            </div>
            <button
              className="shrink-0 rounded p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(n.id);
              }}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
