import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Utility: Convert URL-safe base64 string to Uint8Array for PushManager
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Detect persistent device identification, OS type, browser, and PWA mode
 */
export function getDeviceInfo() {
  let deviceId = localStorage.getItem("tasklert_device_id");
  if (!deviceId) {
    deviceId = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    localStorage.setItem("tasklert_device_id", deviceId);
  }

  const customLabel = localStorage.getItem("tasklert_device_custom_label") || "";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

  // 1. Detect Device Type and Default Name
  let deviceType = "other";
  let deviceName = "Web Browser";

  if (/android/i.test(userAgent)) {
    deviceType = "android";
    deviceName = /tablet/i.test(userAgent) ? "Android Tablet" : "Android Phone";
  } else if (/iphone/i.test(userAgent)) {
    deviceType = "ios";
    deviceName = "Apple iPhone";
  } else if (/ipad/i.test(userAgent) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    deviceType = "ios";
    deviceName = "Apple iPad";
  } else if (/macintosh|mac os x/i.test(userAgent)) {
    deviceType = "mac";
    deviceName = "MacBook / macOS";
  } else if (/windows/i.test(userAgent)) {
    deviceType = "windows";
    deviceName = "Windows PC";
  } else if (/linux/i.test(userAgent)) {
    deviceType = "linux";
    deviceName = "Linux Desktop";
  }

  // 2. Detect Browser
  let browser = "Unknown";
  if (/edg\//i.test(userAgent)) {
    browser = "Microsoft Edge";
  } else if (/samsungbrowser/i.test(userAgent)) {
    browser = "Samsung Internet";
  } else if (/chrome|crios/i.test(userAgent) && !/opr|opera/i.test(userAgent)) {
    browser = "Google Chrome";
  } else if (/firefox|fxios/i.test(userAgent)) {
    browser = "Mozilla Firefox";
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browser = "Apple Safari";
  } else if (/opr|opera/i.test(userAgent)) {
    browser = "Opera";
  }

  // 3. Detect PWA Standalone Mode
  const isPWA =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://"));

  return {
    deviceId,
    deviceName,
    customLabel,
    deviceType,
    browser,
    isPWA,
    userAgent,
  };
}

/**
 * Check browser Web Push & Service Worker support
 */
export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission; // "default", "granted", "denied"
}

/**
 * Retrieve current active push subscription from service worker
 */
export async function getCurrentPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("Failed to get current push subscription:", err);
    return null;
  }
}

/**
 * Register device for Web Push notifications
 */
export async function subscribeToDevicePush() {
  if (!isPushSupported()) {
    throw new Error("Web Push notifications are not supported by this browser.");
  }

  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("User must be authenticated to enable device notifications.");
  }

  // 1. Request browser notification permission explicitly
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notification permission was blocked in browser settings. Please allow notifications in site settings."
        : "Notification permission was dismissed."
    );
  }

  // 2. Fetch server's public VAPID key
  const { data: vapidData } = await axios.get(`${API_BASE}/api/notifications/vapid-public-key`);
  if (!vapidData.success || !vapidData.publicKey) {
    throw new Error("Server Web Push VAPID key is not configured yet.");
  }

  const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

  // 3. Ensure service worker is ready and registered
  const registration = await navigator.serviceWorker.ready;

  // 4. Subscribe with PushManager
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    // Unsubscribe existing to refresh key if needed
    try {
      await subscription.unsubscribe();
    } catch (_) {}
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const subscriptionJson = subscription.toJSON();
  const { deviceId, deviceName, customLabel, deviceType, browser, isPWA, userAgent } = getDeviceInfo();

  // 5. Send subscription to backend
  const { data: serverResponse } = await axios.post(
    `${API_BASE}/api/notifications/subscribe`,
    {
      endpoint: subscriptionJson.endpoint,
      keys: subscriptionJson.keys,
      deviceId,
      deviceName,
      customLabel,
      deviceType,
      browser,
      isPWA,
      userAgent,
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return serverResponse;
}

/**
 * Unsubscribe device from Web Push
 */
export async function unsubscribeFromDevicePush() {
  if (!isPushSupported()) return;

  const token = localStorage.getItem("token");
  const { deviceId } = getDeviceInfo();

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (token) {
        await axios.post(
          `${API_BASE}/api/notifications/unsubscribe`,
          { endpoint, deviceId },
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Error unsubscribing device push:", err);
  }
}

/**
 * Update a device's custom nickname / label
 */
export async function updateDeviceLabel(deviceMongoId, newLabel) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required");

  const { data } = await axios.patch(
    `${API_BASE}/api/notifications/devices/${deviceMongoId}`,
    { customLabel: newLabel },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

/**
 * Send a test push notification specifically to one device subscription
 */
export async function sendTestToSpecificDevice(deviceMongoId) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Authentication required");

  const { data } = await axios.post(
    `${API_BASE}/api/notifications/devices/${deviceMongoId}/test`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}
