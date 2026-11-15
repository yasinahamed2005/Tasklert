// Tasklert Service Worker (Development Fallback & Lifecycle Host)
// In production builds, this is compiled by vite-plugin-pwa from src/sw.js with all 34 precached assets.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch for development with network-first fallback
self.addEventListener("fetch", () => {
  // Let Vite dev server handle module requests directly
});

// Push & Notification handlers
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { title: "Tasklert Alarm", body: event.data.text() };
    }
  }

  const title = data.title || "⏰ Tasklert Alarm";
  const options = {
    body: data.body || "You have a scheduled reminder.",
    icon: data.icon || "/tasklert-icon.svg",
    badge: data.badge || "/favicon.png",
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
