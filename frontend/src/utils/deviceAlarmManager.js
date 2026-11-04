/**
 * Tasklert Real Device & Android Exact Alarm Manager
 * 
 * Provides unified exact alarm scheduling:
 * 1. Native Android (via Capacitor LocalNotifications & AlarmManager)
 * 2. Mobile Browser / Desktop PWA (via Web Audio API sound loop, Vibration API, & Web Notifications)
 * 3. Dedicated Focus Timer Alarm scheduling with Samsung-style screen-off background ringing
 * 4. Reactive in-app full-screen alarm dispatching to AlarmModal & FocusCompletionModal
 */

import { soundManager } from "./soundManager";

class DeviceAlarmManager {
  constructor() {
    this.activeTimers = new Map();
    this.isInitialized = false;
    this.audioContextUnlocked = false;

    // Listen for user interaction to unlock Web Audio context on mobile browsers
    if (typeof window !== "undefined") {
      const unlockAudio = () => {
        soundManager.getAudioContext();
        this.audioContextUnlocked = true;
        window.removeEventListener("click", unlockAudio);
        window.removeEventListener("touchstart", unlockAudio);
      };
      window.addEventListener("click", unlockAudio, { once: true });
      window.addEventListener("touchstart", unlockAudio, { once: true });
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

  /**
   * Safe bridge to Capacitor LocalNotifications (window.Capacitor or dynamic import)
   */
  async getLocalNotificationsPlugin() {
    if (typeof window !== "undefined" && window.Capacitor?.Plugins?.LocalNotifications) {
      return window.Capacitor.Plugins.LocalNotifications;
    }
    try {
      const pkg = "@capacitor/local-notifications";
      const mod = await import(/* @vite-ignore */ pkg).catch(() => ({}));
      return mod?.LocalNotifications || null;
    } catch {
      return null;
    }
  }

  /**
   * Request push/alarm notification permissions on both Web and Native Android
   */
  async requestNotificationPermission() {
    if (typeof window === "undefined") return false;

    // Native Android Capacitor permissions
    if (this.isNativePlatform()) {
      try {
        const LocalNotifications = await this.getLocalNotificationsPlugin();
        if (LocalNotifications?.requestPermissions) {
          const res = await LocalNotifications.requestPermissions();
          return res.display === "granted";
        }
      } catch (err) {
        console.warn("Capacitor LocalNotifications request failed:", err);
      }
    }

    // Web Notification API
    if ("Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      }
    }

    return false;
  }

  /**
   * Safe 32-bit integer generator for Android Local Notification IDs
   */
  hashStringToInt(str) {
    if (!str) return Math.floor(Math.random() * 1000000);
    let hash = 0;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 2147483647;
  }

  /**
   * Schedule an exact alarm on Native Android and Web (For Task Reminders & Calendar)
   */
  async scheduleAlarm(reminder) {
    if (!reminder || !reminder.scheduledAt) return;

    const id = reminder._id || reminder.id || String(Date.now());
    const schedDate = new Date(reminder.scheduledAt);
    const now = Date.now();
    const delayMs = schedDate.getTime() - now;

    // Cancel existing timer for this ID if any
    this.cancelAlarm(id);

    // If alarm is disabled or already expired in the past (> 2 minutes ago), skip scheduling
    if (reminder.alarmEnabled === false || delayMs < -120000) {
      return;
    }

    // 1. Android Native Scheduling (Capacitor)
    if (this.isNativePlatform()) {
      try {
        const LocalNotifications = await this.getLocalNotificationsPlugin();
        if (LocalNotifications?.schedule) {
          await LocalNotifications.createChannel?.({
            id: "tasklert-alarms",
            name: "Tasklert Phone Alarms",
            description: "High-priority alarms with sound and vibration",
            importance: 5,
            visibility: 1,
            sound: "alarm_bell.wav",
            vibration: true,
            lights: true,
          }).catch(() => {});

          const notifId = this.hashStringToInt(id);
          await LocalNotifications.schedule({
            notifications: [
              {
                id: notifId,
                title: reminder.title ? `⏰ Alarm: ${reminder.title}` : "⏰ Tasklert Alarm",
                body: reminder.notes || reminder.message || "Scheduled alarm is ringing!",
                schedule: { at: schedDate, allowWhileIdle: true },
                channelId: "tasklert-alarms",
                sound: "alarm_bell.wav",
                extra: {
                  alarmId: id,
                  taskId: reminder.task?._id || reminder.task || null,
                  sound: reminder.sound || reminder.soundType || "digital",
                },
              },
            ],
          });
        }
      } catch (err) {
        console.warn("Could not schedule native Capacitor alarm:", err);
      }
    }

    // 2. Web / PWA Foreground & Background Timer Scheduling
    if (delayMs > 0 && delayMs <= 86400000) {
      const timer = setTimeout(() => {
        this.triggerAlarmRinging(reminder);
      }, delayMs);

      this.activeTimers.set(String(id), timer);
    } else if (delayMs <= 0 && delayMs >= -60000) {
      // Alarm is due right now
      this.triggerAlarmRinging(reminder);
    }
  }

  /**
   * Fires ringing alarm for task reminders: sound, vibration, native notification, and in-app modal
   */
  triggerAlarmRinging(reminder) {
    const soundName = reminder.sound || reminder.soundType || "digital";
    const volume = reminder.volume !== undefined ? reminder.volume : 80;

    // A. Start Audio Playback via SoundManager
    soundManager.playAlarm(soundName, volume);

    // B. Trigger Device Vibration
    if (reminder.vibrationEnabled !== false && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([500, 200, 500, 200, 1000]);
      } catch {}
    }

    // C. Web Notification if granted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`⏰ Tasklert: ${reminder.title}`, {
          body: reminder.notes || reminder.message || "Your scheduled reminder is ringing now!",
          icon: "/tasklert-icon.svg",
          badge: "/favicon.png",
          tag: `alarm-${reminder._id || reminder.id}`,
          requireInteraction: true,
        });
      } catch {}
    }

    // D. Dispatch Custom Event for AlarmModal
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tasklert:triggerAlarm", {
          detail: {
            alarmId: reminder._id || reminder.id,
            taskId: reminder.task?._id || reminder.task || null,
            title: reminder.title,
            message: reminder.notes || reminder.message || "",
            sound: soundName,
            volume,
            scheduledAt: reminder.scheduledAt,
          },
        })
      );
    }
  }

  /**
   * Cancel a scheduled task alarm
   */
  async cancelAlarm(id) {
    const key = String(id);
    if (this.activeTimers.has(key)) {
      clearTimeout(this.activeTimers.get(key));
      this.activeTimers.delete(key);
    }

    if (this.isNativePlatform()) {
      try {
        const LocalNotifications = await this.getLocalNotificationsPlugin();
        if (LocalNotifications?.cancel) {
          const notifId = this.hashStringToInt(key);
          await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
        }
      } catch {}
    }
  }

  /* =========================================================
     FOCUS TIMER SPECIALIZED BACKGROUND & ANDROID ALARMS
     ========================================================= */

  /**
   * Schedule exact Focus / Break completion alarm on Native Android and Web
   */
  async scheduleFocusAlarm({
    id = "active-focus-session",
    title,
    mode = "focus",
    durationSeconds = 1500,
    targetEndAt,
    sound = "chime",
    volume = 80,
    vibration = true,
    customAudioUrl = null,
    customAudioRecord = null,
    customAudioName = null,
  }) {
    if (!targetEndAt) return;
    const focusId = String(id || "active-focus-session");
    const schedDate = new Date(targetEndAt);
    const now = Date.now();
    const delayMs = schedDate.getTime() - now;

    // Cancel existing focus alarm if any
    await this.cancelFocusAlarm(focusId);

    // If alarm expired in the past (> 60s ago), skip
    if (delayMs < -60000) return;

    // Preload audio into Web Audio memory buffer so playback at 0:00 is instant with zero latency
    if (customAudioRecord?.data) {
      soundManager.preloadCustomAudio(mode, customAudioRecord.data);
    }

    // Start Web Audio silent keep-alive to keep AudioContext active in background tabs
    soundManager.startKeepAlive();

    const notifTitle = title || (mode === "focus" ? "🎯 Focus Session Complete!" : "☕ Break Over!");
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    const notifBody = mode === "focus"
      ? `Completed ${mins} minutes deep focus. Time for a well-deserved breather!`
      : `Recharge complete! Ready to start your next focus session?`;

    // 1. Android Native Scheduling (Capacitor AlarmManager with allowWhileIdle)
    if (this.isNativePlatform()) {
      try {
        const LocalNotifications = await this.getLocalNotificationsPlugin();
        if (LocalNotifications?.schedule) {
          await LocalNotifications.createChannel?.({
            id: "tasklert-focus-alarms",
            name: "Tasklert Focus Alarms",
            description: "High-priority alarms with sound and vibration for Focus sessions",
            importance: 5,
            visibility: 1, // Public lockscreen visibility
            vibration: Boolean(vibration),
            lights: true,
          }).catch(() => {});

          const notifIntId = this.hashStringToInt(`focus-${focusId}`);
          await LocalNotifications.schedule({
            notifications: [
              {
                id: notifIntId,
                title: notifTitle,
                body: notifBody,
                schedule: { at: schedDate, allowWhileIdle: true }, // exact alarm across Android Doze / screen-off
                channelId: "tasklert-focus-alarms",
                extra: {
                  isFocusAlarm: true,
                  focusId,
                  mode,
                  durationMinutes: mins,
                  sound,
                  volume,
                  customAudioName: customAudioName || (customAudioRecord?.name || null),
                },
              },
            ],
          });
        }
      } catch (err) {
        console.warn("Could not schedule native Android focus alarm:", err);
      }
    }

    // 2. Web / Desktop timer fallback
    if (delayMs > 0) {
      const timerKey = `focus-${focusId}`;
      const timer = setTimeout(() => {
        this.triggerFocusAlarmRinging({
          id: focusId,
          title: notifTitle,
          mode,
          durationSeconds,
          sound,
          volume,
          vibration,
          customAudioUrl,
          customAudioRecord,
          customAudioName,
        });
      }, delayMs);
      this.activeTimers.set(timerKey, timer);
    } else if (delayMs <= 0 && delayMs >= -60000) {
      // Alarm due right now
      this.triggerFocusAlarmRinging({
        id: focusId,
        title: notifTitle,
        mode,
        durationSeconds,
        sound,
        volume,
        vibration,
        customAudioUrl,
        customAudioRecord,
        customAudioName,
      });
    }
  }

  /**
   * Cancel scheduled focus alarm (on pause, reset, skip, duration change)
   */
  async cancelFocusAlarm(id = "active-focus-session") {
    const focusId = String(id || "active-focus-session");
    const timerKey = `focus-${focusId}`;

    if (this.activeTimers.has(timerKey)) {
      clearTimeout(this.activeTimers.get(timerKey));
      this.activeTimers.delete(timerKey);
    }

    soundManager.stopKeepAlive();

    if (this.isNativePlatform()) {
      try {
        const LocalNotifications = await this.getLocalNotificationsPlugin();
        if (LocalNotifications?.cancel) {
          const notifIntId = this.hashStringToInt(`focus-${focusId}`);
          await LocalNotifications.cancel({ notifications: [{ id: notifIntId }] });
        }
      } catch {}
    }
  }

  /**
   * Fires ringing focus alarm: sound loop, hardware vibration, native OS notification, and Samsung UI
   */
  triggerFocusAlarmRinging({
    id = "active-focus-session",
    title,
    mode = "focus",
    durationSeconds = 1500,
    sound = "chime",
    volume = 80,
    vibration = true,
    customAudioUrl = null,
    customAudioRecord = null,
    customAudioName = null,
  }) {
    // A. Start Audio Playback via SoundManager (Web Audio with OS hardware scheduling & custom binary buffer)
    soundManager.playAlarm(sound, volume, customAudioUrl, customAudioRecord);

    // B. Trigger Device Vibration
    if (vibration !== false && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([500, 200, 500, 200, 1000]);
      } catch {}
    }

    const notifTitle = title || (mode === "focus" ? "🎯 Focus Session Complete!" : "☕ Break Over!");
    const mins = Math.max(1, Math.round(durationSeconds / 60));
    const notifBody = mode === "focus"
      ? `Completed ${mins} minutes deep focus. Time for a well-deserved breather!`
      : `Break over! Ready to begin next session?`;

    // C. Web Notification if granted
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(notifTitle, {
              body: notifBody,
              icon: "/tasklert-icon.svg",
              badge: "/favicon.png",
              tag: `focus-alarm-${id}`,
              vibrate: [500, 200, 500, 200, 1000],
              requireInteraction: true,
              data: { url: "/focus", isFocus: true, mode, focusId: id },
              actions: [
                { action: "open", title: "👉 View Timer" },
                { action: "snooze", title: "💤 Snooze 5m" },
                { action: "dismiss", title: "✕ Dismiss" },
              ],
            });
          }).catch(() => {
            new Notification(notifTitle, { body: notifBody, icon: "/tasklert-icon.svg", requireInteraction: true });
          });
        } else {
          new Notification(notifTitle, { body: notifBody, icon: "/tasklert-icon.svg", requireInteraction: true });
        }
      } catch {}
    }

    // D. Dispatch Custom Event for FocusCompletionModal & Samsung-Style Alarm Screen
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tasklert:focusAlarmTriggered", {
          detail: {
            id,
            mode,
            durationSeconds,
            sound,
            volume,
            customAudioRecord,
            customAudioName: customAudioName || (customAudioRecord?.name || null),
            scheduledAt: new Date().toISOString(),
          },
        })
      );
    }
  }

  /**
   * Test/audition ringtone directly from modal
   */
  previewSound(soundName = "digital") {
    soundManager.previewSound(soundName);
  }

  /**
   * Stop ringtone audition or alarm
   */
  stopSound() {
    soundManager.stop();
  }

  /**
   * Test device vibration
   */
  testVibration() {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([300, 150, 300]);
      } catch {}
    }
  }

  /**
   * Batch synchronize all active upcoming reminders from backend
   */
  syncUpcomingAlarms(reminders = []) {
    if (!Array.isArray(reminders)) return;
    reminders.forEach((r) => {
      if (r.alarmEnabled && ["scheduled", "snoozed"].includes(r.status)) {
        this.scheduleAlarm(r);
      }
    });
  }
}

export const deviceAlarmManager = new DeviceAlarmManager();
export default deviceAlarmManager;
