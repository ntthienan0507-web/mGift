import { useEffect, useCallback, useState } from "react";
import { requestNotificationPermission, onForegroundMessage } from "@/services/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/services/api";

interface NotificationMessage {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function useNotification() {
  const { token: authToken, user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [fcmRegistered, setFcmRegistered] = useState(false);

  const registerFCM = useCallback(async () => {
    if (!authToken || !user || fcmRegistered) return;

    const fcmToken = await requestNotificationPermission();
    if (!fcmToken) return;

    try {
      await api.post("/auth/fcm-token", { fcm_token: fcmToken });
      setFcmRegistered(true);
    } catch (e) {
      console.error("Failed to register FCM token:", e);
    }
  }, [authToken, user, fcmRegistered]);

  // Register FCM when user logs in
  useEffect(() => {
    registerFCM();
  }, [registerFCM]);

  // Listen for foreground messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const msg: NotificationMessage = {
        id: Date.now().toString(),
        title: payload.title,
        body: payload.body,
        data: payload.data,
      };
      setNotifications((prev) => [msg, ...prev].slice(0, 20));
    });
    return unsubscribe;
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return { notifications, dismissNotification, clearAll, registerFCM };
}
