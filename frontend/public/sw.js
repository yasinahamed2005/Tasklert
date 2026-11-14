// Tasklert Web Push & PWA Service Worker (v2)
const CACHE_NAME = "tasklert-v2";

self.addEventListener("install", (_event) => {
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

// Clean message listener for manual cache purge or ping
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Helper: Read stored auth token from IndexedDB so background push actions can authenticate without an open window
function getStoredAuthToken() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("tasklert_pwa_auth", 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("tokens")) {
          db.createObjectStore("tokens");
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction("tokens", "readonly");
          const store = tx.objectStore("tokens");
          const getReq = store.get("authToken");
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch (_) {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

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
    tag: data.tag || `tasklert-alarm-${data.alarmId || Date.now()}`,
    vibrate: [400, 200, 400, 200, 800],
    requireInteraction: true, // Keep notification active until user dismisses or acts
    data: {
      url: data.url || "/",
      alarmId: data.alarmId || null,
      taskId: data.taskId || null,
      sound: data.sound || "digital",
      volume: data.volume || 80,
      priority: data.priority || "Medium",
      scheduledAt: data.scheduledAt || null,
      isFocus: data.isFocus || (data.url && data.url.includes("focus")),
      timestamp: Date.now(),
    },
    actions: data.actions || [
      { action: "open", title: "👉 Open Task" },
      { action: "snooze", title: "💤 Snooze 5m" },
      { action: "dismiss", title: "✓ Dismiss" },
    ],
  };

  // Immediate delivery acknowledgment to backend for Rule 6 diagnostics
  if (data.alarmId) {
    fetch("/api/notifications/delivery-ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alarmId: data.alarmId }),
    }).catch(() => {});
  }

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
            isFocus: data.isFocus,
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

  const action = event.action || "open";
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || "/";

  // ACTION: DISMISS
  // Silences the alarm and dismisses the session directly from the notification shade
  // Sends durable fetch to backend even if browser / PWA window is completely closed!
  if (action === "dismiss") {
    event.waitUntil(
      (async () => {
        const token = await getStoredAuthToken();
        if (notifData.alarmId) {
          const headers = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          try {
            await fetch(`/api/reminders/${notifData.alarmId}/dismiss`, {
              method: "POST",
              headers,
              body: JSON.stringify({ completeLinkedTask: true }),
            });
          } catch (err) {
            console.warn("[SW] Background dismiss error:", err);
          }
        }

        try {
          const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          for (const client of clientList) {
            client.postMessage({
              type: "TASKLERT_NOTIFICATION_ACTION",
              action: "dismiss",
              alarmId: notifData.alarmId,
              taskId: notifData.taskId,
            });
          }
        } catch (_) {}
      })()
    );
    return;
  }

  // ACTION: SNOOZE
  // Snoozes the alarm directly from the notification shade without opening a window
  // Sends durable fetch to backend even if browser / PWA window is completely closed!
  if (action === "snooze") {
    event.waitUntil(
      (async () => {
        const token = await getStoredAuthToken();
        if (notifData.alarmId) {
          const headers = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          try {
            await fetch(`/api/reminders/${notifData.alarmId}/snooze`, {
              method: "POST",
              headers,
              body: JSON.stringify({ durationMinutes: 5 }),
            });
          } catch (err) {
            console.warn("[SW] Background snooze error:", err);
          }
        }

        try {
          const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          for (const client of clientList) {
            client.postMessage({
              type: "TASKLERT_NOTIFICATION_ACTION",
              action: "snooze",
              alarmId: notifData.alarmId,
              taskId: notifData.taskId,
              snoozeMinutes: 5,
            });
          }
        } catch (_) {}
      })()
    );
    return;
  }

  // ACTION: VIEW TIMER / OPEN (User explicitly clicked "View Timer" or tapped notification body)
  if (notifData.alarmId) {
    const separator = targetUrl.includes("?") ? "&" : "?";
    targetUrl = `${targetUrl}${separator}alarmId=${encodeURIComponent(notifData.alarmId)}`;
    if (action) {
      targetUrl = `${targetUrl}&notifAction=${encodeURIComponent(action)}`;
    }
  }

  // Open or focus Tasklert client window
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            // Send action to open client
            if (notifData.isFocus || targetUrl.includes("/focus")) {
              client.postMessage({
                type: "TASKLERT_FOCUS_NOTIFICATION_ACTION",
                action: "open",
                mode: notifData.mode,
                focusId: notifData.focusId,
              });
            } else {
              client.postMessage({
                type: "TASKLERT_NOTIFICATION_ACTION",
                action: "open",
                alarmId: notifData.alarmId,
                taskId: notifData.taskId,
              });
            }

            if ("navigate" in client && targetUrl && !client.url.includes(targetUrl)) {
              try {
                client.navigate(targetUrl);
              } catch (_) {}
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
