import React, { useState, useEffect } from "react";
import { Bell, BellRing, X, CheckCircle, AlertCircle, Smartphone } from "lucide-react";
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToDevicePush,
} from "../utils/pushManager";
import { toast } from "react-toastify";

export const NotificationPermissionBanner = () => {
  const [permissionState, setPermissionState] = useState("default");
  const [isVisible, setIsVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isIOSWebPush, setIsIOSWebPush] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentPermission = getNotificationPermission();
    setPermissionState(currentPermission);

    // Detect iOS
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setIsIOSWebPush(isIOS && !isStandalone);

    // Only show if permission is default (never asked), supported, and not dismissed recently
    if (currentPermission === "default" && isPushSupported()) {
      const dismissedUntil = localStorage.getItem("tasklert_notif_prompt_dismissed");
      if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
        // Show after a brief delay so page load remains smooth and uncluttered
        const timer = setTimeout(() => setIsVisible(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      await subscribeToDevicePush();
      setPermissionState("granted");
      setIsVisible(false);
      toast.success("🔔 Reminders & notifications enabled!");
    } catch (err) {
      console.warn("Notification subscribe error:", err.message);
      const perm = getNotificationPermission();
      setPermissionState(perm);
      if (perm === "denied") {
        toast.info("Notifications blocked. You can enable them anytime in site settings.");
        setIsVisible(false);
      } else {
        toast.error(err.message || "Could not enable notifications.");
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    // Respect choice: don't prompt again for 7 days
    const nextPrompt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem("tasklert_notif_prompt_dismissed", String(nextPrompt));
    setIsVisible(false);
  };

  if (!isVisible || permissionState !== "default") {
    return null;
  }

  return (
    <aside
      aria-label="Notification prompt"
      className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-white rounded-2xl border border-purple-200/80 shadow-lg p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0 text-purple-700">
          <BellRing className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 leading-tight">
            Enable Task Deadlines
          </h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Never miss a task deadline. Enable reminders for your important tasks and alarms.
          </p>

          {isIOSWebPush && (
            <p className="text-[11px] text-indigo-600 mt-1.5 flex items-center gap-1 font-medium">
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              Tip: On iOS Safari, tap &quot;Share&quot; → &quot;Add to Home Screen&quot; for full push alarms.
            </p>
          )}

          <div className="flex items-center gap-2.5 mt-3">
            <button
              type="button"
              onClick={handleEnable}
              disabled={isSubscribing}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubscribing ? "Enabling..." : "Enable Notifications"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl text-gray-600 hover:bg-gray-100 active:scale-95 font-semibold text-xs transition cursor-pointer"
            >
              Not Now
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition -mr-1 -mt-1 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

export default NotificationPermissionBanner;
