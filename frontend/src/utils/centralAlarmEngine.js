/**
 * Tasklert Central Alarm Engine (v4 Unified Architecture)
 * 
 * The single authoritative alarm & ringtone coordinator for:
 * 1. Focus Timer
 * 2. Short Break
 * 3. Long Break
 * 4. Clock Alarms
 * 5. Smart Reminders
 * 
 * Core Features:
 * - One Global Tasklert Ringtone across all features (Preset or Custom MP3)
 * - Exact native Android AlarmManager.setAlarmClock() scheduling via TasklertAlarmPlugin
 * - Multi-Device Priority: Mobile Device = Primary, Laptop/Browser = Fallback
 * - Device Registry & Native Acknowledgment Sync (/api/devices/confirm-alarm)
 * - Background Reboot Recovery & Multi-Alarm Registry
 * - In-App & System Notification / Lock Screen Synchronization
 */

import { soundManager } from "./soundManager";
import { customRingtoneStorage } from "./customRingtoneStorage";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const PREFS_GLOBAL_RINGTONE_ID = "tasklert_global_ringtone_id";
const PREFS_GLOBAL_RINGTONE_NAME = "tasklert_global_ringtone_name";
const PREFS_DEVICE_ID = "tasklert_device_id";

// Built-in high fidelity sound presets
export const GLOBAL_SOUND_PRESETS = [
  { id: "chime", name: "Gentle Chime", desc: "Harmonic crystal cascade chime", icon: "✨" },
  { id: "classic", name: "Classic Twin Bell", desc: "Resonant mechanical alarm bell", icon: "🔔" },
  { id: "digital", name: "Digital Pulse", desc: "Crisp electronic timer beep", icon: "⏰" },
  { id: "bell", name: "Morning Bell", desc: "Warm morning harmonic chime", icon: "🌅" },
  { id: "soft", name: "Soft Reminder", desc: "Mellow acoustic reminder tones", icon: "🎵" },
];

class CentralAlarmEngine {
  constructor() {
    this.activeTimers = new Map();
    this.deviceId = null;
    this.isInitialized = false;
    this.heartbeatTimer = null;
    this.isRinging = false;
    this.activeRingingAlarm = null;
    this.cachedDevices = [];
    this.hasMobilePrimary = false;

    if (typeof window !== "undefined") {
      this.init();
    }
  }

  /**
   * Initialize device identity, permissions, and registration
   */
  async init() {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // 1. Resolve or generate stable device UUID
    this.deviceId = localStorage.getItem(PREFS_DEVICE_ID);
    if (!this.deviceId) {
      this.deviceId = "dev-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now();
      localStorage.setItem(PREFS_DEVICE_ID, this.deviceId);
    }

    // 2. Unlock AudioContext on first click or touch
    const unlockAudio = () => {
      soundManager.unlockAudioContext();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });

    // 3. Register device with backend if logged in
    this.registerDeviceWithBackend().catch(() => {});

    // 4. Start 4-minute heartbeat
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(() => {});
    }, 4 * 60 * 1000);

    // 5. If on Native Android, ask engine to restore any valid alarms from registry
    if (this.isNativePlatform()) {
      try {
        await window.Capacitor?.Plugins?.TasklertAlarmEngine?.restoreScheduledAlarms?.();
      } catch (err) {
        console.warn("[centralAlarmEngine] Native restore on init:", err);
      }
    }
  }

  isNativePlatform() {
    return Boolean(
      typeof window !== "undefined" &&
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === "function" &&
        window.Capacitor.isNativePlatform()
    );
  }

  getDevicePlatform() {
    if (this.isNativePlatform()) return "android_native";
    if (typeof window === "undefined") return "unknown";
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone;

    if (/Android/i.test(ua)) {
      return isStandalone ? "android_pwa" : "web_mobile";
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return "ios";
    }
    return "web_desktop";
  }

  getDeviceType() {
    const plat = this.getDevicePlatform();
    if (plat === "android_native" || plat === "android_pwa" || plat === "web_mobile" || plat === "ios") {
      return "mobile";
    }
    return "laptop";
  }

  /**
   * Register device capabilities and permissions with Tasklert backend
   */
  async registerDeviceWithBackend() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    try {
      const isNative = this.isNativePlatform();
      let exactAlarm = false;
      let notifications = false;
      let fullScreen = false;

      if (isNative && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
        const perms = await window.Capacitor.Plugins.TasklertAlarmEngine.checkPermissions().catch(() => ({}));
        exactAlarm = Boolean(perms?.exactAlarm);
        notifications = Boolean(perms?.notifications);
        fullScreen = Boolean(perms?.fullScreenIntent);
      } else if (typeof window !== "undefined" && "Notification" in window) {
        notifications = Notification.permission === "granted";
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/devices/register`,
        {
          deviceId: this.deviceId,
          deviceType: this.getDeviceType(),
          platform: this.getDevicePlatform(),
          deviceName: isNative ? "Samsung Android (Native)" : (this.getDeviceType() === "mobile" ? "Mobile Browser" : "Laptop/Desktop Client"),
          userAgent: navigator.userAgent || "",
          nativeAlarmCapability: isNative,
          exactAlarmPermission: exactAlarm,
          notificationPermission: notifications,
          fullScreenIntentPermission: fullScreen,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        this.hasMobilePrimary = Boolean(res.data.isPrimaryAlarmDevice);
      }
    } catch (err) {
      // Non-blocking registration attempt
    }
  }

  async sendHeartbeat() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !this.deviceId) return;

    try {
      await axios.post(
        `${API_BASE_URL}/api/devices/heartbeat`,
        { deviceId: this.deviceId, activeStatus: "active" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {}
  }

  /* =========================================================================
     PHASE 4: ONE GLOBAL TASKLERT RINGTONE ENGINE
     ========================================================================= */

  /**
   * Get the current global ringtone selection
   */
  getGlobalRingtoneId() {
    if (typeof window === "undefined") return "chime";
    return localStorage.getItem(PREFS_GLOBAL_RINGTONE_ID) || "chime";
  }

  getGlobalRingtoneName() {
    if (typeof window === "undefined") return "Gentle Chime";
    return localStorage.getItem(PREFS_GLOBAL_RINGTONE_NAME) || "Gentle Chime";
  }

  /**
   * Retrieve active global ringtone metadata and audio binary
   */
  async getGlobalRingtone() {
    const ringtoneId = this.getGlobalRingtoneId();
    const ringtoneName = this.getGlobalRingtoneName();

    if (ringtoneId === "custom") {
      const record = await customRingtoneStorage.getRingtone("global_ringtone");
      if (record) {
        return {
          id: "custom",
          name: record.name || ringtoneName || "Custom Ringtone.mp3",
          type: "custom",
          record,
        };
      }
      // Fallback check to legacy 'focus' slot
      const legacyRecord = await customRingtoneStorage.getRingtone("focus");
      if (legacyRecord) {
        return {
          id: "custom",
          name: legacyRecord.name || ringtoneName,
          type: "custom",
          record: legacyRecord,
        };
      }
    }

    const preset = GLOBAL_SOUND_PRESETS.find((s) => s.id === ringtoneId) || GLOBAL_SOUND_PRESETS[0];
    return {
      id: preset.id,
      name: preset.name,
      type: "preset",
      record: null,
    };
  }

  /**
   * Select a built-in preset as the ONE GLOBAL TASKLERT RINGTONE
   */
  async setGlobalRingtonePreset(presetId) {
    const preset = GLOBAL_SOUND_PRESETS.find((s) => s.id === presetId) || GLOBAL_SOUND_PRESETS[0];

    localStorage.setItem(PREFS_GLOBAL_RINGTONE_ID, preset.id);
    localStorage.setItem(PREFS_GLOBAL_RINGTONE_NAME, preset.name);

    // Sync to backend preferences if user logged in
    this.syncGlobalRingtoneToBackend(preset.id, preset.name, "preset").catch(() => {});

    return { id: preset.id, name: preset.name, type: "preset" };
  }

  /**
   * Upload and persist ONE GLOBAL CUSTOM MP3 RINGTONE
   * Mirrors to IndexedDB, Native Android private storage, and SoundManager memory buffer.
   */
  async uploadGlobalCustomRingtone(file) {
    if (!file) throw new Error("No audio file provided");

    // Validate size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("Ringtone file size must be under 15MB");
    }

    // 1. Save into IndexedDB under 'global_ringtone' and 'focus'
    const saved = await customRingtoneStorage.saveRingtone("global_ringtone", file, true);
    await customRingtoneStorage.saveRingtone("focus", file, true);

    const fileName = file.name || "Custom Ringtone.mp3";
    localStorage.setItem(PREFS_GLOBAL_RINGTONE_ID, "custom");
    localStorage.setItem(PREFS_GLOBAL_RINGTONE_NAME, fileName);

    // 2. Sync to native Android if running in Capacitor
    if (this.isNativePlatform() && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(arrayBuffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = window.btoa(binary);

        await window.Capacitor.Plugins.TasklertAlarmEngine.saveGlobalRingtone({
          fileName,
          base64Data,
        });
        console.log(`[centralAlarmEngine] Synced ONE GLOBAL RINGTONE to native Android: ${fileName}`);
      } catch (nativeErr) {
        console.warn("[centralAlarmEngine] Native global ringtone sync failed:", nativeErr);
      }
    }

    // 3. Invalidate SoundManager audio buffer cache
    soundManager.clearBuffers();
    if (saved?.data) {
      soundManager.preloadCustomAudio("global", saved.data, fileName);
      soundManager.preloadCustomAudio("focus", saved.data, fileName);
    }

    // 4. Sync metadata to backend
    this.syncGlobalRingtoneToBackend("custom", fileName, "custom").catch(() => {});

    return { id: "custom", name: fileName, type: "custom", record: saved };
  }

  async syncGlobalRingtoneToBackend(id, name, type) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;

    try {
      await axios.put(
        `${API_BASE_URL}/api/reminders/preferences`,
        {
          globalRingtoneId: id,
          globalRingtoneName: name,
          globalRingtoneType: type,
          defaultSound: id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {}
  }

  /**
   * Play the ONE GLOBAL RINGTONE for preview or active ringing
   */
  async playGlobalRingtone(volume = 80) {
    const ringtoneInfo = await this.getGlobalRingtone();
    if (ringtoneInfo.type === "custom" && ringtoneInfo.record) {
      await soundManager.playAlarm("custom", volume, ringtoneInfo.record, "global");
    } else {
      await soundManager.playAlarm(ringtoneInfo.id, volume);
    }
  }

  stopGlobalRingtone() {
    soundManager.stop();
    this.isRinging = false;
    this.activeRingingAlarm = null;
  }

  /* =========================================================================
     PHASES 2, 3, 5, 6, 7: UNIFIED ALARM SCHEDULING & MULTI-DEVICE ARBITRATION
     ========================================================================= */

  /**
   * Schedule an alarm across Focus, Clock, or Reminder
   * @param {Object} options
   * @param {string} options.id - Unique ID (e.g. reminder ID, focus ID)
   * @param {string} options.title - Alarm title
   * @param {string} options.message - Alarm notes or description
   * @param {string} options.alarmType - 'focus' | 'clock' | 'reminder' | 'short_break' | 'long_break'
   * @param {Date|string|number} options.scheduledAt - Exact scheduled timestamp
   * @param {number} [options.volume=80] - Audio volume (0-100)
   * @param {boolean} [options.vibration=true] - Vibration enabled
   * @param {number} [options.snoozeDuration=5] - Snooze minutes
   */
  async scheduleAlarm({
    id,
    title = "Tasklert Alarm",
    message = "",
    alarmType = "reminder",
    scheduledAt,
    volume = 80,
    vibration = true,
    snoozeDuration = 5,
  }) {
    if (!id || !scheduledAt) return;

    const alarmId = String(id);
    const targetDate = new Date(scheduledAt);
    const targetEndAtMs = targetDate.getTime();
    const now = Date.now();
    const delayMs = targetEndAtMs - now;

    // Clear existing local timer if any
    this.cancelAlarm(alarmId);

    // If alarm expired in the past (> 2 minutes ago), skip
    if (delayMs < -120000) return;

    const ringtoneInfo = await this.getGlobalRingtone();

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: NATIVE SAMSUNG ANDROID (PRIMARY ALARM DEVICE)
    // ─────────────────────────────────────────────────────────────────────────
    if (this.isNativePlatform() && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        const res = await window.Capacitor.Plugins.TasklertAlarmEngine.scheduleAlarm({
          id: alarmId,
          title,
          message,
          mode: alarmType,
          alarmType,
          targetEndAtMs,
          sound: ringtoneInfo.id,
          volume: Number(volume),
          vibration: Boolean(vibration),
          ringtoneFileName: ringtoneInfo.name,
          customAudioPath: null,
        });

        console.log(`[centralAlarmEngine] Native Samsung Android exact alarm scheduled for: ${targetDate.toISOString()}`);

        // Acknowledge to backend that mobile has confirmed native control (Phase 7 priority)
        const token = localStorage.getItem("token");
        if (token && this.deviceId) {
          axios.post(
            `${API_BASE_URL}/api/devices/confirm-alarm`,
            { deviceId: this.deviceId, alarmId },
            { headers: { Authorization: `Bearer ${token}` } }
          ).catch(() => {});
        }

        return res;
      } catch (err) {
        console.warn("[centralAlarmEngine] Native Android scheduleAlarm error:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: LAPTOP / BROWSER / PWA FALLBACK
    // ─────────────────────────────────────────────────────────────────────────
    if (delayMs > 0 && delayMs <= 86400000) {
      const timer = setTimeout(() => {
        this.triggerAlarmRinging({
          id: alarmId,
          title,
          message,
          alarmType,
          volume,
          vibration,
          snoozeDuration,
          scheduledAt,
        });
      }, delayMs);

      this.activeTimers.set(alarmId, timer);
    } else if (delayMs <= 0 && delayMs >= -60000) {
      // Due immediately
      this.triggerAlarmRinging({
        id: alarmId,
        title,
        message,
        alarmType,
        volume,
        vibration,
        snoozeDuration,
        scheduledAt,
      });
    }
  }

  /**
   * Cancel an alarm locally and on native Android
   */
  async cancelAlarm(id) {
    if (!id) return;
    const alarmId = String(id);

    if (this.activeTimers.has(alarmId)) {
      clearTimeout(this.activeTimers.get(alarmId));
      this.activeTimers.delete(alarmId);
    }
    const focusKey = `focus-${alarmId}`;
    if (this.activeTimers.has(focusKey)) {
      clearTimeout(this.activeTimers.get(focusKey));
      this.activeTimers.delete(focusKey);
    }

    if (this.isNativePlatform() && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        await window.Capacitor.Plugins.TasklertAlarmEngine.cancelAlarm({ id: alarmId });
      } catch (_) {}
    }
  }

  /**
   * Snooze an active alarm
   */
  async snoozeAlarm(id, minutes = 5) {
    const alarmId = String(id);
    this.stopGlobalRingtone();

    if (this.isNativePlatform() && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        await window.Capacitor.Plugins.TasklertAlarmEngine.snoozeAlarm({
          id: alarmId,
          snoozeMinutes: minutes,
        });
      } catch (_) {}
    } else {
      const targetEndAtMs = Date.now() + minutes * 60 * 1000;
      this.scheduleAlarm({
        id: alarmId,
        title: `Snoozed (${minutes}m)`,
        scheduledAt: new Date(targetEndAtMs),
        snoozeDuration: minutes,
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tasklert:alarmSnoozed", {
          detail: { alarmId, minutes },
        })
      );
    }
  }

  /**
   * Dismiss an active alarm
   */
  async dismissAlarm(id) {
    const alarmId = String(id);
    this.stopGlobalRingtone();

    if (this.isNativePlatform() && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        await window.Capacitor.Plugins.TasklertAlarmEngine.dismissAlarm({ id: alarmId });
      } catch (_) {}
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tasklert:alarmDismissed", {
          detail: { alarmId },
        })
      );
    }
  }

  /**
   * Trigger local ringing on Laptop / Web Browser (Fallback)
   */
  async triggerAlarmRinging(alarm) {
    // Multi-Device Priority Check (Phase 7):
    // If on Laptop and mobile confirmed this alarm, suppress loud duplicate ringing
    if (this.getDeviceType() === "laptop" && alarm.mobileOwned) {
      console.log(`[centralAlarmEngine] Mobile phone is primary owner for alarm ${alarm.id}. Laptop duplicate audio suppressed.`);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(`⏰ Tasklert: ${alarm.title}`, {
            body: "Alarm ringing on your Samsung phone",
            icon: "/tasklert-icon.svg",
            tag: `suppressed-alarm-${alarm.id}`,
          });
        } catch (_) {}
      }
      return;
    }

    this.isRinging = true;
    this.activeRingingAlarm = alarm;

    // A. Start Audio Playback via SoundManager with ONE GLOBAL RINGTONE
    await this.playGlobalRingtone(alarm.volume || 80);

    // B. Trigger device vibration
    if (alarm.vibration !== false && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([600, 250, 600, 250, 1000]);
      } catch (_) {}
    }

    // C. Web Notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`⏰ ${alarm.title || "Tasklert Alarm"}`, {
          body: alarm.message || "Your scheduled alarm is ringing now!",
          icon: "/tasklert-icon.svg",
          badge: "/favicon.png",
          tag: `tasklert-alarm-${alarm.id}`,
          requireInteraction: true,
        });
      } catch (_) {}
    }

    // D. Dispatch in-app ringing event for AlarmModal / Focus completion UI
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tasklert:triggerAlarm", {
          detail: {
            alarmId: alarm.id,
            taskId: alarm.taskId || null,
            title: alarm.title,
            message: alarm.message,
            alarmType: alarm.alarmType || "reminder",
            scheduledAt: alarm.scheduledAt,
            volume: alarm.volume || 80,
            snoozeDuration: alarm.snoozeDuration || 5,
          },
        })
      );
    }
  }

  /* =========================================================================
     PHASE 11: DIAGNOSTICS & PERMISSION CHECKS
     ========================================================================= */

  async getDiagnosticStatus() {
    const isNative = this.isNativePlatform();
    const globalRingtone = await this.getGlobalRingtone();

    if (isNative && window.Capacitor?.Plugins?.TasklertAlarmEngine) {
      try {
        const nativeDiag = await window.Capacitor.Plugins.TasklertAlarmEngine.getDiagnosticStatus();
        return {
          ...nativeDiag,
          globalRingtoneId: globalRingtone.id,
          globalRingtoneName: globalRingtone.name,
          globalRingtoneType: globalRingtone.type,
          deviceType: "mobile",
          isPrimaryDevice: true,
        };
      } catch (_) {}
    }

    // Web diagnostics
    const notifs = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";
    const audioCtx = soundManager.getAudioContext();

    return {
      platform: "Web / Laptop Client",
      isNativeEngineActive: false,
      canScheduleExactAlarms: false,
      hasNotificationPermission: notifs === "granted",
      hasFullScreenIntentPermission: false,
      activeAlarmCount: this.activeTimers.size,
      globalRingtoneId: globalRingtone.id,
      globalRingtoneName: globalRingtone.name,
      globalRingtoneType: globalRingtone.type,
      audioContextState: audioCtx ? audioCtx.state : "unsupported",
      deviceType: this.getDeviceType(),
      isPrimaryDevice: false,
    };
  }
}

export const centralAlarmEngine = new CentralAlarmEngine();
export default centralAlarmEngine;

