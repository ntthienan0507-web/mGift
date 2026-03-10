import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (!messaging && typeof window !== "undefined" && "Notification" in window) {
    try {
      messaging = getMessaging(app);
    } catch (e) {
      console.warn("Firebase Messaging not supported:", e);
    }
  }
  return messaging;
}

/**
 * Request notification permission & get FCM token.
 * Returns token string or null if denied/unsupported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied");
      return null;
    }

    const msg = getMessagingInstance();
    if (!msg) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(msg, { vapidKey });
    console.log("FCM Token:", token);
    return token;
  } catch (error) {
    console.error("Failed to get FCM token:", error);
    return null;
  }
}

/**
 * Listen for foreground messages.
 * Call this once in your app root.
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void
) {
  const msg = getMessagingInstance();
  if (!msg) return () => {};

  return onMessage(msg, (payload) => {
    const { title, body } = payload.notification ?? {};
    callback({
      title: title ?? "mGift",
      body: body ?? "",
      data: payload.data as Record<string, string> | undefined,
    });
  });
}
