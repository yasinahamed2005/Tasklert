import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

// 1. Immediately claim clients and skip waiting
self.skipWaiting();
clientsClaim();

// 2. Precache all build assets injected by Workbox / Vite
// This includes index.html, JS chunks (Dashboard, FocusTimerPage, CalendarPage, etc.), CSS, and static assets
precacheAndRoute(self.__WB_MANIFEST || []);

// 3. Clean up older cache versions
cleanupOutdatedCaches();

// 4. Runtime Caching for Google Fonts stylesheets & webfont binaries
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
  })
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
  })
);

// 5. Runtime Caching for Media, Audio & Static Icons (not precached)
registerRoute(
  ({ request, url }) =>
    request.destination === "audio" ||
    request.destination === "image" ||
    url.pathname.endsWith(".mp3") ||
    url.pathname.endsWith(".wav") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png"),
  new CacheFirst({
    cacheName: "tasklert-media-cache",
  })
);

// 6. Navigation Route: Direct SPA routes (/focus, /dashboard, /tasks, /calendar, /projects, /analytics)
// workbox navigation handler serves the precached /index.html app shell without network access
const handler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// 7. Embedded Tasklert Branded Offline Fallback HTML
const OFFLINE_FALLBACK_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Tasklert - Offline Mode</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #F9FAFB; color: #1E293B; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border: 1px solid #E9D5FF; border-radius: 24px; padding: 32px 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 10px 25px -5px rgba(139, 44, 245, 0.1); }
    .icon-box { width: 56px; height: 56px; background-color: #F3E8FF; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #8B2CF5; }
    h1 { font-size: 20px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
    p { font-size: 13px; color: #64748B; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 12px 20px; border-radius: 14px; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-primary { background-color: #8B2CF5; color: white; margin-bottom: 10px; }
    .btn-primary:active { transform: scale(0.98); }
    .btn-secondary { background-color: #FAF5FF; color: #7E22CE; border: 1px solid #E9D5FF; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>You're Offline</h1>
    <p>Tasklert could not connect to the network. Your cached tasks and offline dashboard remain available.</p>
    <button class="btn btn-primary" onclick="window.location.reload()">Try Again</button>
    <button class="btn btn-secondary" onclick="window.location.href='/'">Return to Dashboard</button>
  </div>
</body>
</html>`;

// 8. Catch handler: If any navigation request completely fails, serve offline fallback
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    return new Response(OFFLINE_FALLBACK_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return Response.error();
});

// =========================================================================
// 9. WEB PUSH NOTIFICATIONS, BACKGROUND ALARMS & SYNC
// =========================================================================

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

// Push Event: Receive server Web Push notification
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
    requireInteraction: true,
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

  // Immediate delivery acknowledgment to backend
  if (data.alarmId) {
    const ackHeaders = { "Content-Type": "application/json" };
    if (data.ackToken) {
      ackHeaders["Authorization"] = `Bearer ${data.ackToken}`;
    }
    fetch("/api/notifications/delivery-ack", {
      method: "POST",
      headers: ackHeaders,
      body: JSON.stringify({ alarmId: data.alarmId, ackToken: data.ackToken }),
    }).catch(() => {});
  }

  // Notify any active open browser window tabs
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

// Notification Click: Open task or trigger action
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || "open";
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || "/";

  // ACTION: DISMISS
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

  // ACTION: VIEW TIMER / OPEN
  if (notifData.alarmId) {
    const separator = targetUrl.includes("?") ? "&" : "?";
    targetUrl = `${targetUrl}${separator}alarmId=${encodeURIComponent(notifData.alarmId)}`;
    if (action) {
      targetUrl = `${targetUrl}&notifAction=${encodeURIComponent(action)}`;
    }
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
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

// Background Sync
self.addEventListener("sync", (event) => {
  if (event.tag === "tasklert-sync") {
    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "TASKLERT_TRIGGER_SYNC" });
          });
        })
    );
  }
});

// Message Listener
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CHECK_OFFLINE_READY") {
    event.ports?.[0]?.postMessage({ ready: true });
  }
});
