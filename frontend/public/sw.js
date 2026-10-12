// Tasklert Web Push & PWA Service Worker
const CACHE_NAME = "tasklert-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 1. PUSH EVENT: Receive server Web Push notification
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
    tag: data.tag || `tasklert-alarm-${Date.now()}`,
    vibrate: [300, 150, 300, 150, 400],
    requireInteraction: true, // Keep notification active until user dismisses or acts
    data: {
      url: data.url || "/",
      alarmId: data.alarmId || null,
      taskId: data.taskId || null,
      sound: data.sound || "digital",
      volume: data.volume || 80,
      priority: data.priority || "Medium",
      scheduledAt: data.scheduledAt || null,
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: "open", title: "👉 Open Task" },
      { action: "snooze", title: "💤 Snooze 5m" },
      { action: "dismiss", title: "✕ Dismiss" },
    ],
  };

  // Notify any active open browser window tabs so the active page can play alarm sound and show modal
  const broadcastPromise = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: "TASKLERT_ALARM_EVENT",
          alarm: {
            title,
            body: options.body,
            alarmId: data.alarmId,
            taskId: data.taskId,
            sound: data.sound,
            volume: data.volume,
            priority: data.priority,
            scheduledAt: data.scheduledAt,
          },
        });
      });
    });

  // Display native OS push notification
  const notifyPromise = self.registration.showNotification(title, options);

  event.waitUntil(Promise.all([notifyPromise, broadcastPromise]));
});

// 2. NOTIFICATION CLICK: Open task or trigger action
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || "/";

  // Handle action buttons
  if (action === "dismiss" && notifData.alarmId) {
    // Dismiss alarm
    const dismissUrl = `/api/reminders/${notifData.alarmId}/dismiss`;
    // Background fetch will be made if token is available, or handled on client
  }

  // Open or focus Tasklert client window
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            client.postMessage({
              type: "TASKLERT_NOTIFICATION_ACTION",
              action,
              alarmId: notifData.alarmId,
              taskId: notifData.taskId,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// 3. FETCH: Pass-through without interfering with authenticated API responses
self.addEventListener("fetch", (event) => {
  // Let network handle all API calls and dynamic fetches directly
  return;
});
