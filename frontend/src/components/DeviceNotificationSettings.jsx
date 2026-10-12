import React, { useEffect, useState, useCallback } from "react";
import {
  Bell,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Play,
  Square,
  Trash2,
  Clock,
  Shield,
  Send,
  Moon,
  Info,
  Edit3,
  Check,
  X,
  Copy,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Tablet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  getNotificationPermission,
  isPushSupported,
  subscribeToDevicePush,
  unsubscribeFromDevicePush,
  getCurrentPushSubscription,
  getDeviceInfo,
  updateDeviceLabel,
  sendTestToSpecificDevice,
} from "../utils/pushManager";
import { soundManager } from "../utils/soundManager";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const SOUND_OPTIONS = [
  { id: "digital", label: "Digital Beep (Electronic)" },
  { id: "classic", label: "Classic Alarm (Twin Bell)" },
  { id: "chime", label: "Gentle Chime (Crystal Bell)" },
  { id: "bell", label: "Morning Bell (Harmonic)" },
  { id: "soft", label: "Soft Reminder (Mellow)" },
];

export const DeviceNotificationSettings = () => {
  const [permission, setPermission] = useState(getNotificationPermission());
  const [supported, setSupported] = useState(isPushSupported());
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [previewingSound, setPreviewingSound] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [sendingTestDeviceId, setSendingTestDeviceId] = useState(null);
  const [showMobileGuide, setShowMobileGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // User preferences
  const [prefs, setPrefs] = useState({
    defaultSound: "digital",
    defaultVolume: 80,
    defaultSnoozeDuration: 5,
    defaultChannels: { push: true, inApp: true, email: false },
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch connected devices
  const fetchDevices = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      setLoadingDevices(true);
      const { data } = await axios.get(`${API_BASE}/api/notifications/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  // Fetch user preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(`${API_BASE}/api/reminders/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && data.preferences) {
        setPrefs(data.preferences);
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchPreferences();
  }, [fetchDevices, fetchPreferences]);

  const currentDeviceId =
    typeof window !== "undefined" ? localStorage.getItem("tasklert_device_id") : null;
  const isCurrentDeviceConnected = devices.some((d) => d.deviceId === currentDeviceId);

  // Auto-sync background push registration if browser notification permission is already granted
  useEffect(() => {
    let active = true;
    const autoSync = async () => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const currentSub = await getCurrentPushSubscription();
        if (currentSub && active) {
          const subJson = currentSub.toJSON();
          const { deviceId, deviceName, userAgent } = getDeviceInfo();
          await axios.post(
            `${API_BASE}/api/notifications/subscribe`,
            {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
              deviceId,
              deviceName,
              userAgent,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (active) {
            fetchDevices();
          }
        }
      } catch (err) {
        console.warn("Push auto-sync skipped:", err.message);
      }
    };

    autoSync();
    return () => {
      active = false;
    };
  }, [fetchDevices]);

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      await subscribeToDevicePush();
      setPermission("granted");
      toast.success("Device notifications enabled successfully! 🔔");
      await fetchDevices();
    } catch (err) {
      console.error("Failed to subscribe device:", err);
      toast.error(err.message || "Failed to enable notifications");
      setPermission(getNotificationPermission());
    } finally {
      setSubscribing(false);
    }
  };

  const handleDisablePush = async () => {
    try {
      await unsubscribeFromDevicePush();
      toast.info("Device unsubscribed from push notifications.");
      await fetchDevices();
    } catch (err) {
      toast.error("Failed to unsubscribe device");
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/api/notifications/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Device removed from notifications.");
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch (err) {
      toast.error("Failed to remove device");
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You must be logged in to test notifications.");
        return;
      }

      // If this device isn't registered yet or no devices exist in backend, connect it first!
      const currentDevId = localStorage.getItem("tasklert_device_id");
      const isConnected = devices.some((d) => d.deviceId === currentDevId);

      if (!isConnected || devices.length === 0) {
        toast.info("Connecting this device for push notifications first... 📲");
        await subscribeToDevicePush();
        await fetchDevices();
      }

      const { data } = await axios.post(
        `${API_BASE}/api/notifications/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(data.message || "Test notification dispatched to your device! 🔔");
    } catch (err) {
      console.error("Failed to send test push:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to send test push");
    } finally {
      setTestingPush(false);
    }
  };

  const startEditingDevice = (device) => {
    setEditingDeviceId(device.id);
    setEditingLabel(device.customLabel || device.deviceName || "");
  };

  const saveEditingDevice = async (deviceId) => {
    try {
      await updateDeviceLabel(deviceId, editingLabel);
      toast.success("Device nickname updated!");
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, customLabel: editingLabel } : d))
      );
      setEditingDeviceId(null);
    } catch (err) {
      toast.error(err.message || "Failed to update device nickname");
    }
  };

  const handleSendDeviceTest = async (device) => {
    setSendingTestDeviceId(device.id);
    try {
      const data = await sendTestToSpecificDevice(device.id);
      toast.success(
        data.message || `Test notification sent to ${device.customLabel || device.deviceName}! 🔔`
      );
      setDevices((prev) =>
        prev.map((d) =>
          d.id === device.id ? { ...d, lastSuccessfulPush: new Date().toISOString() } : d
        )
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to dispatch device test notification"
      );
    } finally {
      setSendingTestDeviceId(null);
    }
  };

  const copyMobileUrl = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Tasklert web address copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePreviewSound = (soundId) => {
    if (previewingSound === soundId) {
      soundManager.stop();
      setPreviewingSound(null);
    } else {
      setPreviewingSound(soundId);
      soundManager.preview(soundId, prefs.defaultVolume || 80);
      setTimeout(() => {
        setPreviewingSound(null);
      }, 2500);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/reminders/preferences`,
        prefs,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Alarm & Notification preferences saved!");
    } catch (err) {
      toast.error("Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Device Notification Status Banner */}
      <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl ${
                permission === "granted"
                  ? "bg-emerald-50 text-emerald-600"
                  : permission === "denied"
                  ? "bg-rose-50 text-rose-600"
                  : "bg-purple-50 text-purple-600"
              }`}
            >
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-800">
                  Real-Time Multi-Device Notifications
                </h3>
                {permission === "granted" && isCurrentDeviceConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Active ({devices.length} Connected)
                  </span>
                ) : permission === "granted" && !isCurrentDeviceConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <Clock className="h-3 w-3" /> Permission Allowed • Device Not Connected
                  </span>
                ) : permission === "denied" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    <AlertCircle className="h-3 w-3" /> Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                    <Clock className="h-3 w-3" /> Not Configured
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 max-w-xl">
                {permission === "granted" && isCurrentDeviceConnected
                  ? "Your current device is registered to receive Web Push alerts even when Tasklert is closed."
                  : permission === "granted" && !isCurrentDeviceConnected
                  ? "Browser notifications are allowed, but this device hasn't been connected to your Tasklert account yet. Click 'Connect This Device' below to finish registration."
                  : permission === "denied"
                  ? "Notifications are blocked by your browser. Please click the padlock or tune icon in your address bar and allow Notifications for this site."
                  : "Enable push notifications to receive alarms and reminders across your laptops, phones, and tablets."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {!isCurrentDeviceConnected ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={subscribing || !supported}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:brightness-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
              >
                <Bell className="h-4 w-4" />
                {subscribing ? "Connecting Device..." : "Connect This Device"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={testingPush}
                  className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {testingPush ? "Sending..." : "Test Push Alert"}
                </button>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Disconnect Device
                </button>
              </>
            )}
          </div>
        </div>

        {!supported && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Web Push is not supported in this browser. On iOS devices, please tap &apos;Share&apos; &rarr; &apos;Add to Home Screen&apos; to enable Web Push.
            </span>
          </div>
        )}
      </div>

      {/* 2. Registered Devices List */}
      <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-50">
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Laptop className="h-4 w-4 text-purple-600" />
              Connected Multi-Device Fleet ({devices.length})
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Every device registered here receives real-time background Web Push alarms simultaneously.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowMobileGuide((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition cursor-pointer"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Connect Mobile Phone</span>
              {showMobileGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={fetchDevices}
              disabled={loadingDevices}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-purple-600 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              title="Refresh device list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDevices ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* GUIDED ONBOARDING / MOBILE CONNECTION GUIDE */}
        {showMobileGuide && (
          <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/70 via-fuchsia-50/40 to-white p-4.5 space-y-3.5 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 flex items-center gap-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Cross-Device Setup: How to Connect Your Mobile Phone
              </span>
              <button
                type="button"
                onClick={() => setShowMobileGuide(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-gray-600 leading-relaxed">
              Tasklert delivers calendar-grade alarms across all your registered devices. Follow these steps to register your phone to the same account:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-1.5 shadow-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px]">
                  1
                </span>
                <p className="font-semibold text-gray-800">Open on Phone</p>
                <p className="text-[11px] text-gray-500">
                  Open your phone&apos;s browser (Chrome or Safari) and visit Tasklert at your workspace address.
                </p>
                <button
                  type="button"
                  onClick={copyMobileUrl}
                  className="mt-1 w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-semibold border border-purple-200 cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                  {copiedLink ? "Address Copied!" : "Copy Web Address"}
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-1.5 shadow-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px]">
                  2
                </span>
                <p className="font-semibold text-gray-800">Sign In</p>
                <p className="text-[11px] text-gray-500">
                  Log in to the same account. Tasklert links all your device subscriptions to your account automatically.
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-purple-100 space-y-1.5 shadow-xs">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px]">
                  3
                </span>
                <p className="font-semibold text-gray-800">Enable Push</p>
                <p className="text-[11px] text-gray-500">
                  Tap &quot;Connect This Device&quot;. On iOS, tap <strong>Share &rarr; Add to Home Screen</strong>, then open the app and enable push.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DEVICE LIST */}
        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/20 p-6 text-center space-y-3">
            <p className="text-xs text-gray-500">
              No devices registered yet. Connect this device to receive background alarms.
            </p>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={subscribing || !supported}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Bell className="h-3.5 w-3.5" />
              {subscribing ? "Connecting..." : "Connect This Device Now"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const isMobile =
                device.deviceType === "android" ||
                device.deviceType === "ios" ||
                /mobile|android|iphone|ipad/i.test(device.deviceName || "");
              const isThisDevice = device.deviceId === currentDeviceId;
              const isEditing = editingDeviceId === device.id;

              return (
                <div
                  key={device.id}
                  className={`p-4 rounded-xl border transition ${
                    isThisDevice
                      ? "border-purple-300 bg-purple-50/40 shadow-xs"
                      : "border-purple-100 bg-white hover:border-purple-200 shadow-xs"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left: Device Icon & Name/Metadata */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white border border-purple-100 text-purple-600 shrink-0 shadow-2xs">
                        {isMobile ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Device Name with Inline Edit */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="px-2 py-0.5 text-xs font-bold border border-purple-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                                placeholder="Device nickname"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => saveEditingDevice(device.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                title="Save"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDeviceId(null)}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-bold text-gray-800 truncate">
                                {device.customLabel || device.deviceName}
                              </p>
                              <button
                                type="button"
                                onClick={() => startEditingDevice(device)}
                                className="p-1 text-gray-400 hover:text-purple-600 rounded transition cursor-pointer"
                                title="Rename device"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {isThisDevice && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                              This Device
                            </span>
                          )}

                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Push Active
                          </span>

                          {device.isPWA && (
                            <span className="text-[10px] bg-fuchsia-50 text-fuchsia-700 px-2 py-0.5 rounded-full font-semibold border border-fuchsia-200">
                              Installed PWA
                            </span>
                          )}
                        </div>

                        {/* Sub-meta details */}
                        <div className="flex items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-1 flex-wrap">
                          <span>{device.deviceName}</span>
                          <span>•</span>
                          <span>{device.browser || "Web Browser"}</span>
                          <span>•</span>
                          <span>Last active: {new Date(device.lastActive).toLocaleString()}</span>
                          {device.lastSuccessfulPush && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 font-medium">
                                Last push: {new Date(device.lastSuccessfulPush).toLocaleTimeString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => handleSendDeviceTest(device)}
                        disabled={sendingTestDeviceId === device.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition cursor-pointer disabled:opacity-50"
                        title="Send test push to this specific device"
                      >
                        <Send className="h-3 w-3" />
                        <span>{sendingTestDeviceId === device.id ? "Sending..." : "Test Push"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(device.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Remove device"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Alarm Sounds & Audio Preferences */}
      <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-purple-600" />
            Default Alarm Sound &amp; Audio Experience
          </h4>
          <p className="text-xs text-gray-500">
            Synthesized Web Audio tones played when an alarm triggers while Tasklert is open.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Sound selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Default Sound Tone
            </label>
            <div className="space-y-2">
              {SOUND_OPTIONS.map((snd) => (
                <div
                  key={snd.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                    prefs.defaultSound === snd.id
                      ? "border-purple-500 bg-purple-50/60"
                      : "border-gray-200 hover:border-purple-200 bg-white"
                  }`}
                  onClick={() => setPrefs((prev) => ({ ...prev, defaultSound: snd.id }))}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="alarmSound"
                      checked={prefs.defaultSound === snd.id}
                      onChange={() => setPrefs((prev) => ({ ...prev, defaultSound: snd.id }))}
                      className="accent-purple-600 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-gray-800">{snd.label}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewSound(snd.id);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-purple-200 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition cursor-pointer"
                  >
                    {previewingSound === snd.id ? (
                      <>
                        <Square className="h-3 w-3 text-purple-700 fill-purple-700" /> Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 text-purple-700 fill-purple-700" /> Preview
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Volume & Snooze settings */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700">In-App Alarm Volume</label>
                <span className="text-xs font-bold text-purple-600">{prefs.defaultVolume || 80}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={prefs.defaultVolume || 80}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, defaultVolume: Number(e.target.value) }))
                }
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Default Snooze Duration
              </label>
              <select
                value={prefs.defaultSnoozeDuration || 5}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    defaultSnoozeDuration: Number(e.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>

            {/* Quiet Hours */}
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-center justify-between text-xs font-semibold text-gray-700 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Moon className="h-4 w-4 text-purple-600" />
                  Quiet Hours (Mute Alarm Sounds)
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(prefs.quietHours?.enabled)}
                  onChange={(e) =>
                    setPrefs((prev) => ({
                      ...prev,
                      quietHours: { ...prev.quietHours, enabled: e.target.checked },
                    }))
                  }
                  className="accent-purple-600 cursor-pointer h-4 w-4"
                />
              </label>

              {prefs.quietHours?.enabled && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-500">From:</label>
                    <input
                      type="time"
                      value={prefs.quietHours?.start || "22:00"}
                      onChange={(e) =>
                        setPrefs((prev) => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, start: e.target.value },
                        }))
                      }
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500">To:</label>
                    <input
                      type="time"
                      value={prefs.quietHours?.end || "07:00"}
                      onChange={(e) =>
                        setPrefs((prev) => ({
                          ...prev,
                          quietHours: { ...prev.quietHours, end: e.target.value },
                        }))
                      }
                      className="w-full text-xs border border-gray-200 rounded-lg p-1.5"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-purple-50">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingPrefs}
            className="rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {savingPrefs ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceNotificationSettings;
