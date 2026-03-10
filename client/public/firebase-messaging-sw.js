/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG__?.apiKey,
  authDomain: self.__FIREBASE_CONFIG__?.authDomain,
  projectId: self.__FIREBASE_CONFIG__?.projectId,
  storageBucket: self.__FIREBASE_CONFIG__?.storageBucket,
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId,
  appId: self.__FIREBASE_CONFIG__?.appId,
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "mGift", {
    body: body ?? "",
    icon: icon ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data,
    actions: [{ action: "open", title: "Xem ngay" }],
  });
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
