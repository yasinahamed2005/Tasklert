// Development fallback Service Worker (Classic format, no import statements)
self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function() {
  // Pass-through in development
});
