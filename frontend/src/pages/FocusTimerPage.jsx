import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle,
  Clock,
  Layers,
  Settings2,
  X,
  Volume2,
  VolumeX,
  Bell,
  BellRing,
  ChevronRight,
  Smartphone,
  Zap,
  Repeat,
  Music,
  Trophy,
  Target,
  FileEdit,
  Check,
  Flame,
  Sprout,
  Activity,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import { deviceAlarmManager } from "../utils/deviceAlarmManager";
import { customRingtoneStorage } from "../utils/customRingtoneStorage";
import { API_BASE_URL } from "../config/api";
import { LiquidTimer } from "../components/focus/LiquidTimer";
import { RingtonePickerModal } from "../components/focus/RingtonePickerModal";
import { FocusCompletionModal } from "../components/focus/FocusCompletionModal";
import { FocusSettingsModal } from "../components/focus/FocusSettingsModal";
import { FocusDiagnosticsModal } from "../components/focus/FocusDiagnosticsModal";
import { precisionTimerWorker } from "../utils/timerWorker";

const LOCAL_STORAGE_SESSION_KEY = "tasklert_focus_session_v2";
const LOCAL_STORAGE_SETTINGS_KEY = "tasklert_focus_settings";

const DEFAULT_SETTINGS = {
  focusDuration: 25, // minutes
  shortBreakDuration: 5, // minutes
  longBreakDuration: 15, // minutes
  cyclesBeforeLongBreak: 4,
  alarmSound: "chime", // 'chime' | 'classic' | 'digital' | 'bell' | 'soft' | 'custom'
  alarmVolume: 80,
  autoStartNext: true,
  screenWakeLock: true,
  vibration: true,
  flashlightBlink: false,
  dailyGoalSessions: 4,
};

export const FocusTimerPage = () => {
  const location = useLocation();

  // Dynamic Theme State (recomputed instantly on theme changes)
  const [themeKey, setThemeKey] = useState(() => {
    if (typeof window !== "undefined") {
      const cls = Array.from(document.documentElement.classList).find((c) =>
        c.startsWith("theme-")
      );
      return cls || localStorage.getItem("theme") || "theme-lavender";
    }
    return "theme-lavender";
  });

  // Listen for theme changes across app
  useEffect(() => {
    const handleThemeChange = (e) => {
      const newTheme = e.detail || localStorage.getItem("theme") || "theme-lavender";
      setThemeKey(newTheme);
    };

    window.addEventListener("themechange", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    const observer = new MutationObserver(() => {
      const cls = Array.from(document.documentElement.classList).find((c) =>
        c.startsWith("theme-")
      );
      if (cls && cls !== themeKey) {
        setThemeKey(cls);
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
      observer.disconnect();
    };
  }, [themeKey]);

  // Dynamic theme color palette
  const themePalette = useMemo(() => {
    switch (themeKey) {
      case "theme-blue":
        return {
          name: "theme-blue",
          primary: "#1e88e5",
          primaryDark: "#1565c0",
          primaryLight: "#90caf9",
          primaryUltraLight: "#eff6ff",
          primaryGlow: "rgba(30, 136, 229, 0.45)",
          gradientTop: "#64b5f6",
          gradientMid: "#1e88e5",
          gradientBottom: "#0d47a1",
          borderColor: "#bfdbfe",
          badgeBg: "#e0f2fe",
          badgeText: "#0369a1",
        };
      case "theme-pink":
        return {
          name: "theme-pink",
          primary: "#c026d3",
          primaryDark: "#86198f",
          primaryLight: "#f0abfc",
          primaryUltraLight: "#fdf4ff",
          primaryGlow: "rgba(192, 38, 211, 0.45)",
          gradientTop: "#e879f9",
          gradientMid: "#c026d3",
          gradientBottom: "#701a75",
          borderColor: "#f5d0fe",
          badgeBg: "#fae8ff",
          badgeText: "#a21caf",
        };
      case "theme-peach":
        return {
          name: "theme-peach",
          primary: "#d4a373",
          primaryDark: "#a06d40",
          primaryLight: "#f4d0b0",
          primaryUltraLight: "#fef8f3",
          primaryGlow: "rgba(212, 163, 115, 0.45)",
          gradientTop: "#e9c49a",
          gradientMid: "#d4a373",
          gradientBottom: "#8c5626",
          borderColor: "#fed7aa",
          badgeBg: "#ffedd5",
          badgeText: "#c2410c",
        };
      case "theme-green":
        return {
          name: "theme-green",
          primary: "#43a047",
          primaryDark: "#2e7d32",
          primaryLight: "#a5d6a7",
          primaryUltraLight: "#f0fdf4",
          primaryGlow: "rgba(67, 160, 71, 0.45)",
          gradientTop: "#81c784",
          gradientMid: "#43a047",
          gradientBottom: "#1b5e20",
          borderColor: "#bbf7d0",
          badgeBg: "#dcfce7",
          badgeText: "#15803d",
        };
      case "theme-dark":
        return {
          name: "theme-dark",
          primary: "#4b5563",
          primaryDark: "#1f2937",
          primaryLight: "#9ca3af",
          primaryUltraLight: "#f3f4f6",
          primaryGlow: "rgba(75, 85, 99, 0.45)",
          gradientTop: "#6b7280",
          gradientMid: "#4b5563",
          gradientBottom: "#111827",
          borderColor: "#e5e7eb",
          badgeBg: "#e5e7eb",
          badgeText: "#1f2937",
        };
      case "theme-lavender":
      default:
        return {
          name: "theme-lavender",
          primary: "#8b5cf6",
          primaryDark: "#6d28d9",
          primaryLight: "#c4b5fd",
          primaryUltraLight: "#faf5ff",
          primaryGlow: "rgba(139, 92, 246, 0.45)",
          gradientTop: "#a78bfa",
          gradientMid: "#8b5cf6",
          gradientBottom: "#5b21b6",
          borderColor: "#ede9fe",
          badgeBg: "#f3e8ff",
          badgeText: "#6d28d9",
        };
    }
  }, [themeKey]);

  // Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      return saved && saved !== "undefined"
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        : DEFAULT_SETTINGS;
    } catch (_) {
      return DEFAULT_SETTINGS;
    }
  });

  // Modal open states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCustomDurationModal, setShowCustomDurationModal] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState(30);

  // Active Session State
  const [activeSession, setActiveSession] = useState(null);
  const [sessionType, setSessionType] = useState("focus"); // 'focus' | 'short_break' | 'long_break'
  const [selectedTaskId, setSelectedTaskId] = useState(location.state?.taskId || "");
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState({
    totalCompletedSessions: 0,
    totalFocusMinutes: 0,
    todayFocusMinutes: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);

  // Authoritative seconds remaining
  const [remainingSeconds, setRemainingSeconds] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Completed session info for completion modal
  const [completedSessionInfo, setCompletedSessionInfo] = useState(null);

  // Custom ringtone metadata & quick preview state
  const [customRingtoneMeta, setCustomRingtoneMeta] = useState(null);
  const [isAudioPreviewPlaying, setIsAudioPreviewPlaying] = useState(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // State refs
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;

  const sessionTypeRef = useRef(sessionType);
  sessionTypeRef.current = sessionType;

  const selectedTaskIdRef = useRef(selectedTaskId);
  selectedTaskIdRef.current = selectedTaskId;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const cycleCountRef = useRef(cycleCount);
  cycleCountRef.current = cycleCount;

  const timerIntervalRef = useRef(null);
  const timerWorkerRef = useRef(null);
  const broadcastChannelRef = useRef(null);
  const isCompletingRef = useRef(false);
  const handleCompleteRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Non-throttled Background Web Worker Countdown
  useEffect(() => {
    try {
      const workerBlob = new Blob(
        [
          `
          let timer = null;
          self.onmessage = function(e) {
            if (e.data && e.data.type === "START") {
              if (timer) clearInterval(timer);
              timer = setInterval(function() {
                self.postMessage({ type: "TICK" });
              }, 1000);
            } else if (e.data && e.data.type === "STOP") {
              if (timer) clearInterval(timer);
              timer = null;
            }
          };
          `,
        ],
        { type: "application/javascript" }
      );
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (e.data?.type === "TICK") {
          try {
            const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
            if (raw) {
              const local = JSON.parse(raw);
              if (local.status === "running" && local.targetEndTimestamp) {
                const diff = Math.ceil((local.targetEndTimestamp - Date.now()) / 1000);
                if (diff <= 0) {
                  localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
                  setRemainingSeconds(0);
                  setIsRunning(false);
                  handleCompleteRef.current?.();
                  return;
                }
                setRemainingSeconds(diff);
                return;
              }
            }
          } catch (_) {}

          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              setIsRunning(false);
              handleCompleteRef.current?.();
              return 0;
            }
            return prev - 1;
          });
        }
      };

      timerWorkerRef.current = worker;

      return () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      };
    } catch (err) {
      console.warn("Timer Web Worker initialization fallback:", err);
    }
  }, []);


  // Modal Scroll Lock Management
  useEffect(() => {
    const isAnyModalOpen =
      showSettingsModal || showRingtoneModal || showCompletionModal || showCustomDurationModal;
    if (isAnyModalOpen) {
      document.body.classList.add("modal-scroll-locked");
    } else {
      document.body.classList.remove("modal-scroll-locked");
    }
    return () => {
      document.body.classList.remove("modal-scroll-locked");
    };
  }, [showSettingsModal, showRingtoneModal, showCompletionModal, showCustomDurationModal]);

  // Update Settings helper
  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));

    if (!isRunning && !isPaused) {
      if (sessionType === "focus") setRemainingSeconds(merged.focusDuration * 60);
      else if (sessionType === "short_break") setRemainingSeconds(merged.shortBreakDuration * 60);
      else if (sessionType === "long_break") setRemainingSeconds(merged.longBreakDuration * 60);
    }
  };

  // Screen Wake Lock API management
  const requestScreenWakeLock = useCallback(async () => {
    if (
      typeof navigator !== "undefined" &&
      "wakeLock" in navigator &&
      settingsRef.current.screenWakeLock
    ) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (err) {
        console.warn("Screen Wake Lock could not be requested:", err);
      }
    }
  }, []);

  const releaseScreenWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (_) {}
      wakeLockRef.current = null;
    }
  }, []);

  // Flashlight / Screen flash effect on completion
  const triggerFlashlightEffect = useCallback(() => {
    if (!settingsRef.current.flashlightBlink) return;
    try {
      const flashEl = document.createElement("div");
      flashEl.className = "fixed inset-0 z-9999 pointer-events-none transition-opacity duration-300";
      flashEl.style.backgroundColor = themePalette.primaryUltraLight;
      flashEl.style.opacity = "0.9";
      document.body.appendChild(flashEl);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        flashEl.style.opacity = count % 2 === 0 ? "0.9" : "0.1";
        if (count >= 6) {
          clearInterval(interval);
          flashEl.remove();
        }
      }, 200);
    } catch (_) {}
  }, [themePalette.primaryUltraLight]);

  // Load custom ringtone metadata on mount and mode switch
  const refreshCustomRingtoneMeta = useCallback(async () => {
    try {
      const meta = await customRingtoneStorage.getRingtoneMetadata(sessionTypeRef.current || "focus");
      setCustomRingtoneMeta(meta);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshCustomRingtoneMeta();
  }, [sessionType, refreshCustomRingtoneMeta]);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request native browser notification permission
  const handleRequestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.info("Notifications are not supported by this browser.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === "granted") {
        toast.success("Notifications enabled! You'll be alerted when timers finish.");
      } else if (result === "denied") {
        toast.warn("Notification permission was denied. You can re-enable it in browser settings.");
      }
    } catch (e) {
      console.warn("Could not request notification permission:", e);
    }
  };

  // Cross-tab BroadcastChannel setup
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("tasklert_focus_timer_sync");
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === "FOCUS_SESSION_COMPLETED") {
            soundManager.stop();
            setShowCompletionModal(false);
          } else if (type === "FOCUS_SESSION_STARTED") {
            if (payload) {
              setActiveSession(payload);
              setSessionType(payload.sessionType || "focus");
              setIsRunning(true);
              setIsPaused(false);
            }
          } else if (type === "FOCUS_SESSION_RESET") {
            soundManager.stop();
            setActiveSession(null);
            setIsRunning(false);
            setIsPaused(false);
          }
        };

        return () => {
          channel.close();
        };
      } catch (_) {}
    }
  }, []);

  // Fetch pending tasks to associate with focus session
  const fetchTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(`${API_BASE_URL}/api/tasks/gp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks.filter((t) => !t.completed));
      }
    } catch (err) {
      console.warn("Could not load tasks for timer:", err.message);
    }
  }, []);

  // Fetch focus history from backend
  const fetchHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(`${API_BASE_URL}/api/focus/history?limit=15`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setHistory(data.sessions || []);
        setHistorySummary(data.summary || {});
      }
    } catch (err) {
      console.warn("Could not load focus history:", err.message);
    }
  }, []);

  // Dispatch Native PWA Notification
  const dispatchNativeNotification = useCallback((modeTitle, bodyMessage) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(modeTitle, {
            body: bodyMessage,
            icon: "/tasklert-icon.svg",
            badge: "/favicon.png",
            tag: `tasklert-focus-${Date.now()}`,
            vibrate: [300, 150, 300, 150, 400],
            requireInteraction: true,
            data: { url: "/focus" },
            actions: [
              { action: "open", title: "👉 View Timer" },
              { action: "dismiss", title: "✕ Dismiss" },
            ],
          });
        });
      } else {
        new Notification(modeTitle, {
          body: bodyMessage,
          icon: "/tasklert-icon.svg",
        });
      }
    } catch (err) {
      console.warn("Could not dispatch native notification:", err);
    }
  }, []);

  // COMPLETE SESSION
  const handleComplete = useCallback(async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setActionLoading(true);

    precisionTimerWorker.stop();

    const currentMode = sessionTypeRef.current;
    const currentTaskId = selectedTaskIdRef.current;
    const currentSettings = settingsRef.current;
    const currentSession = activeSessionRef.current;
    const currentCycle = cycleCountRef.current;

    releaseScreenWakeLock();
    deviceAlarmManager.cancelFocusAlarm(currentSession?._id || "active-focus-session");

    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setIsRunning(false);
    setIsPaused(false);
    setActiveSession(null);

    try {
      const token = localStorage.getItem("token");

      if (currentSession?._id && token) {
        try {
          await axios.post(
            `${API_BASE_URL}/api/focus/${currentSession._id}/complete`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (serverErr) {
          console.warn("Could not record completion on server:", serverErr.message);
        }
      }

      // 1. Play Alarm Sound (Web Audio binary decoding + custom MP3)
      let customAudioRecord = null;
      try {
        let customAudioUrl = null;
        if (customRingtoneStorage) {
          const stored = await customRingtoneStorage.getRingtone(currentMode);
          if (stored) {
            customAudioRecord = stored;
            if (stored.url) customAudioUrl = stored.url;
          }
        }
        soundManager.playAlarm(
          currentSettings.alarmSound || "chime",
          currentSettings.alarmVolume || 80,
          customAudioUrl,
          customAudioRecord
        );
      } catch (_) {}

      // 2. Hardware Vibration
      if (
        currentSettings.vibration &&
        typeof navigator !== "undefined" &&
        navigator.vibrate
      ) {
        try {
          navigator.vibrate([400, 200, 400, 200, 800]);
        } catch (_) {}
      }

      // 3. Flashlight / Screen Blink
      triggerFlashlightEffect();

      // 4. Native OS Notification
      const notifTitle =
        currentMode === "focus" ? "🎯 Focus Session Complete!" : "☕ Break Over!";
      const notifBody =
        currentMode === "focus"
          ? "Outstanding work! Take a refreshing break or kick off your next sprint."
          : "Recharge complete! Ready to dive back into deep work?";
      dispatchNativeNotification(notifTitle, notifBody);

      // 5. Open In-App Completion Alert Modal
      setCompletedSessionInfo({
        mode: currentMode,
        taskId: currentTaskId,
        durationMinutes:
          currentMode === "focus"
            ? currentSettings.focusDuration
            : currentMode === "short_break"
            ? currentSettings.shortBreakDuration
            : currentSettings.longBreakDuration,
        customAudioRecord,
        customAudioName: customAudioRecord?.name || null,
        soundName: currentSettings.alarmSound || "chime",
        volume: currentSettings.alarmVolume || 80,
      });
      setShowCompletionModal(true);

      // 6. Advance Pomodoro Cycle
      let nextMode = "focus";
      let nextDurationSec = currentSettings.focusDuration * 60;

      if (currentMode === "focus") {
        const nextCycle = currentCycle + 1;
        setCycleCount(nextCycle);
        if (nextCycle >= currentSettings.cyclesBeforeLongBreak) {
          nextMode = "long_break";
          nextDurationSec = currentSettings.longBreakDuration * 60;
          setCycleCount(0);
        } else {
          nextMode = "short_break";
          nextDurationSec = currentSettings.shortBreakDuration * 60;
        }
      } else {
        nextMode = "focus";
        nextDurationSec = currentSettings.focusDuration * 60;
      }

      setSessionType(nextMode);
      setRemainingSeconds(nextDurationSec);

      broadcastChannelRef.current?.postMessage({ type: "FOCUS_SESSION_COMPLETED" });
      fetchHistory();
    } catch (err) {
      console.error("Completion handling error:", err);
    } finally {
      setActionLoading(false);
      isCompletingRef.current = false;
    }
  }, [
    dispatchNativeNotification,
    fetchHistory,
    releaseScreenWakeLock,
    triggerFlashlightEffect,
  ]);

  handleCompleteRef.current = handleComplete;

  // SNOOZE ALARM (Samsung-style: stops audio, schedules new alarm after snooze duration without duplicate DB record)
  const handleSnooze = useCallback(async (snoozeMinutes = 5) => {
    soundManager.stop();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    setShowCompletionModal(false);

    const snoozeSec = Math.max(1, snoozeMinutes) * 60;
    const now = Date.now();
    const targetEndTimestamp = now + snoozeSec * 1000;

    const localSession = {
      id: `snooze-${now}`,
      sessionType,
      plannedDuration: snoozeSec,
      startTime: now,
      targetEndTimestamp,
      accumulatedSeconds: 0,
      status: "running",
      taskId: selectedTaskId || null,
      isSnooze: true,
    };

    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(localSession));
    setRemainingSeconds(snoozeSec);
    setIsRunning(true);
    setIsPaused(false);

    let customAudioUrl = null;
    let customAudioRecord = null;
    if (customRingtoneStorage) {
      try {
        const stored = await customRingtoneStorage.getRingtone(sessionType);
        if (stored) {
          customAudioRecord = stored;
          if (stored.url) customAudioUrl = stored.url;
          if (stored.data) {
            soundManager.preloadCustomAudio(sessionType, stored.data);
          }
        }
      } catch (_) {}
    }

    deviceAlarmManager.scheduleFocusAlarm({
      id: localSession.id,
      title: "⏰ Snoozed Focus Alarm",
      mode: sessionType,
      durationSeconds: snoozeSec,
      targetEndAt: targetEndTimestamp,
      sound: settings.alarmSound || "chime",
      volume: settings.alarmVolume || 80,
      vibration: settings.vibration !== false,
      customAudioUrl,
      customAudioRecord,
      customAudioName: customAudioRecord?.name || null,
    });

    toast.info(`Alarm snoozed for ${snoozeMinutes} minutes. 💤`);
  }, [sessionType, selectedTaskId, settings]);

  useEffect(() => {
    const handleAlarmTriggered = () => {
      if (!isCompletingRef.current) {
        handleCompleteRef.current?.();
      }
    };
    window.addEventListener("tasklert:focusAlarmTriggered", handleAlarmTriggered);

    const handleMessage = (e) => {
      if (e.data?.type === "TASKLERT_FOCUS_NOTIFICATION_ACTION") {
        const { action } = e.data;
        if (action === "snooze") {
          handleSnooze(5);
        } else if (action === "dismiss") {
          soundManager.stop();
          deviceAlarmManager.cancelFocusAlarm();
          setShowCompletionModal(false);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("tasklert:focusAlarmTriggered", handleAlarmTriggered);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, [handleSnooze]);


  // Timestamp-based sync
  const syncTimestampCountdown = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (!raw) return;
      const local = JSON.parse(raw);

      if (local.status === "running" && local.targetEndTimestamp) {
        const now = Date.now();
        const diffSec = Math.ceil((local.targetEndTimestamp - now) / 1000);

        if (diffSec <= 0) {
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
          setRemainingSeconds(0);
          setIsRunning(false);
          setIsPaused(false);
          handleCompleteRef.current?.();
        } else {
          setRemainingSeconds(diffSec);
          setIsRunning(true);
          setIsPaused(false);
          setSessionType(local.sessionType || "focus");
          if (local.taskId) setSelectedTaskId(local.taskId);
        }
      } else if (local.status === "paused") {
        setRemainingSeconds(local.remainingSeconds || settingsRef.current.focusDuration * 60);
        setIsRunning(false);
        setIsPaused(true);
        setSessionType(local.sessionType || "focus");
      }
    } catch (e) {
      console.warn("Could not sync timestamp session:", e);
    }
  }, []);

  // Check active session on mount
  const checkActiveSession = useCallback(async () => {
    setLoading(true);
    try {
      syncTimestampCountdown();

      const token = localStorage.getItem("token");
      if (token) {
        const { data } = await axios.get(`${API_BASE_URL}/api/focus/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.success && data.activeSession) {
          const s = data.activeSession;
          setActiveSession(s);
          setSessionType(s.sessionType || "focus");

          if (s.status === "running") {
            const now = Date.now();
            const planned = Number(s.plannedDuration) || settingsRef.current.focusDuration * 60;
            let elapsed = Number(s.accumulatedSeconds) || 0;
            const resumedTime = s.lastResumedAt ? new Date(s.lastResumedAt).getTime() : now;
            elapsed += Math.max(0, Math.floor((now - resumedTime) / 1000));

            const remaining = Math.max(0, planned - elapsed);

            if (remaining <= 0) {
              localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
              setRemainingSeconds(0);
              setIsRunning(false);
              setIsPaused(false);
              handleCompleteRef.current?.();
            } else {
              setRemainingSeconds(remaining);
              setIsRunning(true);
              setIsPaused(false);

              localStorage.setItem(
                LOCAL_STORAGE_SESSION_KEY,
                JSON.stringify({
                  id: s._id,
                  sessionType: s.sessionType,
                  targetEndTimestamp: now + remaining * 1000,
                  plannedDuration: planned,
                  status: "running",
                  taskId: s.task?._id || s.task,
                })
              );
            }
          } else if (s.status === "paused") {
            const planned = Number(s.plannedDuration) || settingsRef.current.focusDuration * 60;
            const accumulated = Number(s.accumulatedSeconds) || 0;
            const remaining = Math.max(0, planned - accumulated);
            setRemainingSeconds(remaining);
            setIsRunning(false);
            setIsPaused(true);
          }
        }
      }
    } catch (err) {
      console.warn("Could not check active session:", err.message);
    } finally {
      setLoading(false);
    }
  }, [syncTimestampCountdown]);

  useEffect(() => {
    checkActiveSession();
    fetchTasks();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Visibility & Focus handlers
  useEffect(() => {
    const handleReactivation = () => {
      if (document.visibilityState === "visible") {
        syncTimestampCountdown();
      }
    };

    document.addEventListener("visibilitychange", handleReactivation);
    window.addEventListener("focus", handleReactivation);
    window.addEventListener("storage", handleReactivation);

    return () => {
      document.removeEventListener("visibilitychange", handleReactivation);
      window.removeEventListener("focus", handleReactivation);
      window.removeEventListener("storage", handleReactivation);
    };
  }, [syncTimestampCountdown]);

  // Countdown interval with Web Worker and Audio Keep-Alive
  useEffect(() => {
    if (isRunning) {
      requestScreenWakeLock();
      soundManager.startKeepAlive();
      timerWorkerRef.current?.postMessage({ type: "START" });

      timerIntervalRef.current = setInterval(() => {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
          if (raw) {
            const local = JSON.parse(raw);
            if (local.targetEndTimestamp) {
              const diff = Math.ceil((local.targetEndTimestamp - Date.now()) / 1000);
              if (diff <= 0) {
                clearInterval(timerIntervalRef.current);
                localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
                setRemainingSeconds(0);
                setIsRunning(false);
                handleCompleteRef.current?.();
                return;
              }
              setRemainingSeconds(diff);
              return;
            }
          }
        } catch (_) {}

        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsRunning(false);
            handleCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      releaseScreenWakeLock();
      soundManager.stopKeepAlive();
      timerWorkerRef.current?.postMessage({ type: "STOP" });
      clearInterval(timerIntervalRef.current);
    }

    return () => {
      timerWorkerRef.current?.postMessage({ type: "STOP" });
      clearInterval(timerIntervalRef.current);
    };
  }, [isRunning, requestScreenWakeLock, releaseScreenWakeLock]);

  // START SESSION
  const handleStart = async () => {
    try {
      await soundManager.unlockAudioContext();
    } catch (_) {}

    setActionLoading(true);
    try {
      let plannedSec = settings.focusDuration * 60;
      if (sessionType === "short_break") plannedSec = settings.shortBreakDuration * 60;
      if (sessionType === "long_break") plannedSec = settings.longBreakDuration * 60;

      const now = Date.now();
      const targetEndTimestamp = now + plannedSec * 1000;

      // 2. Fetch custom audio and preload binary bytes into Web Audio memory buffer
      let customAudioUrl = null;
      let customAudioRecord = null;
      if (customRingtoneStorage) {
        try {
          const stored = await customRingtoneStorage.getRingtone(sessionType);
          if (stored) {
            customAudioRecord = stored;
            if (stored.url) customAudioUrl = stored.url;
            if (stored.data) {
              await soundManager.preloadCustomAudio(sessionType, stored.data, stored.name);
            }
          }
        } catch (_) {}
      }

      const localSession = {
        id: `local-${now}`,
        sessionType,
        plannedDuration: plannedSec,
        startTime: now,
        targetEndTimestamp,
        accumulatedSeconds: 0,
        status: "running",
        taskId: selectedTaskId || null,
        ringtoneName: customAudioRecord?.name || settings.alarmSound,
      };

      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(localSession));
      setRemainingSeconds(plannedSec);
      setIsRunning(true);
      setIsPaused(false);

      // Start precision background Web Worker countdown
      precisionTimerWorker.start(
        targetEndTimestamp,
        (rem) => setRemainingSeconds(rem),
        () => handleCompleteRef.current?.()
      );

      const token = localStorage.getItem("token");
      if (token) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/api/focus/start`,
            {
              taskId: selectedTaskId || null,
              sessionType,
              plannedDuration: plannedSec,
              sound: settings.alarmSound || "chime",
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (data.success && data.session) {
            setActiveSession(data.session);
            localSession.id = data.session._id;
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(localSession));
          }
        } catch (apiErr) {
          console.warn("Backend startSession:", apiErr.message);
        }
      }

      // 3. Schedule exact alarm with deviceAlarmManager (Android AlarmManager + Web Audio KeepAlive)
      deviceAlarmManager.scheduleFocusAlarm({
        id: localSession.id,
        mode: sessionType,
        durationSeconds: plannedSec,
        targetEndAt: targetEndTimestamp,
        sound: settings.alarmSound || "chime",
        volume: settings.alarmVolume || 80,
        vibration: settings.vibration !== false,
        customAudioUrl,
        customAudioRecord,
        customAudioName: customAudioRecord?.name || null,
      });

      deviceAlarmManager.requestNotificationPermission();

      broadcastChannelRef.current?.postMessage({
        type: "FOCUS_SESSION_STARTED",
        payload: localSession,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not sync with server, running in local mode.");
    } finally {
      setActionLoading(false);
    }
  };

  // PAUSE SESSION
  const handlePause = async () => {
    precisionTimerWorker.stop();
    soundManager.stopKeepAlive();
    setActionLoading(true);
    try {
      const now = Date.now();
      let currentRemaining = remainingSeconds;

      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (raw) {
        const local = JSON.parse(raw);
        if (local.targetEndTimestamp) {
          currentRemaining = Math.max(0, Math.ceil((local.targetEndTimestamp - now) / 1000));
        }
        local.status = "paused";
        local.remainingSeconds = currentRemaining;
        local.targetEndTimestamp = null;
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(local));
      }

      deviceAlarmManager.cancelFocusAlarm(activeSession?._id || "active-focus-session");
      setRemainingSeconds(currentRemaining);
      setIsRunning(false);
      setIsPaused(true);

      const token = localStorage.getItem("token");
      if (activeSession?._id && token) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/api/focus/${activeSession._id}/pause`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (data.success) {
            setActiveSession(data.session);
          }
        } catch (pauseErr) {
          console.warn("Backend pause error:", pauseErr.message);
        }
      }
    } catch (err) {
      toast.error("Could not pause session on server.");
    } finally {
      setActionLoading(false);
    }
  };

  // RESUME SESSION
  const handleResume = async () => {
    try {
      await soundManager.unlockAudioContext();
    } catch (_) {}

    setActionLoading(true);
    try {
      const now = Date.now();
      const targetEndTimestamp = now + remainingSeconds * 1000;

      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (raw) {
        const local = JSON.parse(raw);
        local.status = "running";
        local.targetEndTimestamp = targetEndTimestamp;
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(local));
      }

      setIsRunning(true);
      setIsPaused(false);

      // Start precision background Web Worker countdown
      precisionTimerWorker.start(
        targetEndTimestamp,
        (rem) => setRemainingSeconds(rem),
        () => handleCompleteRef.current?.()
      );

      // Preload custom audio bytes & reschedule exact alarm across background/screen-off
      let resumeCustomAudioUrl = null;
      let resumeCustomRecord = null;
      if (customRingtoneStorage) {
        try {
          const stored = await customRingtoneStorage.getRingtone(sessionType);
          if (stored) {
            resumeCustomRecord = stored;
            if (stored.url) resumeCustomAudioUrl = stored.url;
            if (stored.data) {
              await soundManager.preloadCustomAudio(sessionType, stored.data, stored.name);
            }
          }
        } catch (_) {}
      }

      deviceAlarmManager.scheduleFocusAlarm({
        id: activeSession?._id || "active-focus-session",
        mode: sessionType,
        durationSeconds: remainingSeconds,
        targetEndAt: targetEndTimestamp,
        sound: settings.alarmSound || "chime",
        volume: settings.alarmVolume || 80,
        vibration: settings.vibration !== false,
        customAudioUrl: resumeCustomAudioUrl,
        customAudioRecord: resumeCustomRecord,
        customAudioName: resumeCustomRecord?.name || null,
      });

      const token = localStorage.getItem("token");
      if (activeSession?._id && token) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/api/focus/${activeSession._id}/resume`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (data.success) {
            setActiveSession(data.session);
          }
        } catch (resumeErr) {
          console.warn("Backend resume error:", resumeErr.message);
        }
      }
    } catch (err) {
      toast.error("Could not resume session on server.");
    } finally {
      setActionLoading(false);
    }
  };

  // RESET SESSION
  const handleReset = async () => {
    precisionTimerWorker.stop();
    soundManager.stopKeepAlive();
    soundManager.stop();
    deviceAlarmManager.cancelFocusAlarm(activeSession?._id || "active-focus-session");
    setActionLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (activeSession?._id && token) {
        try {
          await axios.post(
            `${API_BASE_URL}/api/focus/${activeSession._id}/cancel`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (_) {}
      }

      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      broadcastChannelRef.current?.postMessage({ type: "FOCUS_SESSION_RESET" });

      setActiveSession(null);
      setIsRunning(false);
      setIsPaused(false);
      setRemainingSeconds(
        sessionType === "focus"
          ? settings.focusDuration * 60
          : sessionType === "short_break"
          ? settings.shortBreakDuration * 60
          : settings.longBreakDuration * 60
      );
      fetchHistory();
    } catch (err) {
      toast.error("Could not cancel session on server.");
    } finally {
      setActionLoading(false);
    }
  };

  // SKIP TO NEXT SESSION MODE
  const handleSkip = () => {
    precisionTimerWorker.stop();
    soundManager.stopKeepAlive();
    soundManager.stop();
    deviceAlarmManager.cancelFocusAlarm(activeSession?._id || "active-focus-session");
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setIsRunning(false);
    setIsPaused(false);
    setActiveSession(null);

    if (sessionType === "focus") {
      const nextCycle = cycleCount + 1;
      setCycleCount(nextCycle);
      if (nextCycle >= settings.cyclesBeforeLongBreak) {
        setSessionType("long_break");
        setRemainingSeconds(settings.longBreakDuration * 60);
        setCycleCount(0);
      } else {
        setSessionType("short_break");
        setRemainingSeconds(settings.shortBreakDuration * 60);
      }
    } else {
      setSessionType("focus");
      setRemainingSeconds(settings.focusDuration * 60);
    }
  };

  // Switch session type manually when timer is idle
  const handleSelectType = (type) => {
    if (isRunning || isPaused) {
      toast.info("Please pause or reset your active timer before switching modes.");
      return;
    }
    setSessionType(type);
    if (type === "focus") setRemainingSeconds(settings.focusDuration * 60);
    else if (type === "short_break") setRemainingSeconds(settings.shortBreakDuration * 60);
    else if (type === "long_break") setRemainingSeconds(settings.longBreakDuration * 60);
  };

  // Quick audio preview toggle on the Alarm & Ringtone pill
  const handleToggleAudioPreview = async (e) => {
    e.stopPropagation();
    if (isAudioPreviewPlaying) {
      soundManager.stop();
      setIsAudioPreviewPlaying(false);
    } else {
      setIsAudioPreviewPlaying(true);
      await soundManager.unlockAudioContext();
      try {
        let customRecord = null;
        if (settings.alarmSound === "custom" || customRingtoneMeta) {
          const stored = await customRingtoneStorage.getRingtone(sessionType || "focus");
          if (stored) {
            customRecord = stored;
          }
        }
        if (settings.alarmSound === "custom" && customRecord) {
          soundManager.previewCustomAudio(customRecord, settings.alarmVolume || 80, () => {
            setIsAudioPreviewPlaying(false);
          });
        } else {
          soundManager.preview(settings.alarmSound || "chime", settings.alarmVolume || 80);
          setTimeout(() => {
            setIsAudioPreviewPlaying(false);
          }, 3500);
        }
      } catch (_) {
        setIsAudioPreviewPlaying(false);
      }
    }
  };

  // Test sound helper in header
  const handleTestSound = async () => {
    if (isPlayingTestSound) {
      soundManager.stop();
      setIsPlayingTestSound(false);
    } else {
      setIsPlayingTestSound(true);
      await soundManager.unlockAudioContext();
      if (settings.alarmSound === "custom") {
        try {
          const stored = await customRingtoneStorage.getRingtone(sessionType || "focus");
          if (stored) {
            soundManager.previewCustomAudio(stored, settings.alarmVolume || 80, () => {
              setIsPlayingTestSound(false);
            });
            return;
          }
        } catch (_) {}
      }
      soundManager.preview(settings.alarmSound || "chime", settings.alarmVolume || 80);
      setTimeout(() => {
        setIsPlayingTestSound(false);
      }, 2500);
    }
  };

  // Custom duration apply
  const handleApplyCustomDuration = (e) => {
    e.preventDefault();
    const mins = Math.max(1, Math.min(180, Number(customMinutesInput) || 25));
    if (sessionType === "focus") {
      updateSettings({ focusDuration: mins });
    } else if (sessionType === "short_break") {
      updateSettings({ shortBreakDuration: mins });
    } else {
      updateSettings({ longBreakDuration: mins });
    }
    setRemainingSeconds(mins * 60);
    setShowCustomDurationModal(false);
  };

  // Total planned duration
  const totalPlannedSec = useMemo(() => {
    if (activeSession?.plannedDuration) return activeSession.plannedDuration;
    if (sessionType === "focus") return settings.focusDuration * 60;
    if (sessionType === "short_break") return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
  }, [activeSession, sessionType, settings]);

  // Formatted display values
  const formattedTotalFocus = useMemo(() => {
    const mins = historySummary.todayFocusMinutes || 0;
    if (mins === 0) return "0m";
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return `${hours}h ${remMins}m`;
    }
    return `${remMins}m`;
  }, [historySummary.todayFocusMinutes]);

  // Weekly mini bar chart data
  const weeklyChartData = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let hasActualData = false;
    history.forEach((s) => {
      if (s.status === "completed" && s.sessionType === "focus" && s.startedAt) {
        const d = new Date(s.startedAt);
        if (d >= oneWeekAgo) {
          hasActualData = true;
          const dayIdx = (d.getDay() + 6) % 7; // Mon = 0
          const dayName = days[dayIdx];
          counts[dayName] += Math.round((s.actualElapsedSeconds || s.plannedDuration || 1500) / 60);
        }
      }
    });

    const mockMinutes = { Mon: 35, Tue: 50, Wed: 65, Thu: 100, Fri: 40, Sat: 60, Sun: 75 };

    return days.map((day) => {
      const minutes = hasActualData ? counts[day] : mockMinutes[day];
      const heightPercent = Math.min(100, Math.max(18, Math.round((minutes / 110) * 100)));
      return { day, minutes, heightPercent };
    });
  }, [history]);

  // Ringtone pill label display
  const ringtonePillLabel = useMemo(() => {
    if (customRingtoneMeta?.name) {
      return customRingtoneMeta.name;
    }
    switch (settings.alarmSound) {
      case "classic":
        return "Classic Twin Bell";
      case "digital":
        return "Digital Pulse";
      case "bell":
        return "Zen Singing Bowl";
      case "soft":
        return "Warm Marimba";
      case "chime":
      default:
        return "Gentle Chime";
    }
  }, [customRingtoneMeta, settings.alarmSound]);

  // Stepper completed sessions count (bounded to daily goal)
  const completedTodaySessions = Math.min(
    settings.dailyGoalSessions || 4,
    historySummary.totalCompletedSessions || 0
  );

  return (
    <div className="p-3 sm:p-5 md:p-6 min-w-0 w-full space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div
        className="bg-white/95 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 border"
        style={{ borderColor: themePalette.borderColor }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border"
            style={{
              backgroundColor: themePalette.primaryUltraLight,
              color: themePalette.primary,
              borderColor: themePalette.borderColor,
            }}
          >
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Focus Timer
              </h1>
              {isRunning && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 animate-pulse"
                  style={{
                    backgroundColor: themePalette.badgeBg,
                    color: themePalette.badgeText,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: themePalette.primary }}
                  />
                  Running
                </span>
              )}
              {isPaused && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-medium">
              Deep focus with Pomodoro, custom alarms, and distraction-free sessions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Notification Status Pill */}
          {notificationPermission === "granted" ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 shadow-2xs"
              title="Browser notifications active"
            >
              <BellRing className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alerts Active</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs"
              style={{
                borderColor: themePalette.borderColor,
                backgroundColor: themePalette.primaryUltraLight,
                color: themePalette.primary,
              }}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Alerts</span>
            </button>
          )}

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={handleTestSound}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-2xs"
            style={{
              backgroundColor: isPlayingTestSound ? themePalette.primary : "#ffffff",
              color: isPlayingTestSound ? "#ffffff" : "#334155",
              borderColor: isPlayingTestSound ? themePalette.primary : "#e2e8f0",
            }}
            title="Preview completion alarm sound"
          >
            {isPlayingTestSound ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" style={{ color: themePalette.primary }} />
            )}
            <span>{isPlayingTestSound ? "Stop Alert" : "Test Alert"}</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <Settings2 className="w-3.5 h-3.5" style={{ color: themePalette.primary }} />
            <span>Settings</span>
          </button>

          {/* Engine Diagnostics Button */}
          <button
            type="button"
            onClick={() => setShowDiagnosticsModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer shadow-2xs"
            title="Inspect Android Alarm Engine & Ringtone Capabilities"
          >
            <Activity className="w-3.5 h-3.5 text-purple-600" />
            <span>Diagnostics</span>
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Dashboard Grid (Matching Image 2 Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 of 12 cols): Timer Centerpiece, Presets, Controls & Quick Settings */}
        <div className="lg:col-span-8 space-y-5">
          {/* Main Showcase Card */}
          <div
            className="bg-white/95 rounded-3xl p-6 sm:p-7 md:p-8 border shadow-xs transition-all flex flex-col justify-between"
            style={{ borderColor: themePalette.borderColor }}
          >
            {/* Top Mode Switcher Capsule */}
            <div className="flex justify-center mb-6">
              <div
                className="inline-flex rounded-2xl p-1 border shadow-2xs max-w-md w-full"
                style={{
                  backgroundColor: themePalette.primaryUltraLight,
                  borderColor: themePalette.borderColor,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleSelectType("focus")}
                  className="flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: sessionType === "focus" ? themePalette.primary : "transparent",
                    color: sessionType === "focus" ? "#ffffff" : "#475569",
                    boxShadow: sessionType === "focus" ? `0 2px 8px -2px ${themePalette.primaryGlow}` : "none",
                  }}
                >
                  <span>🍅</span>
                  <span>Focus</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectType("short_break")}
                  className="flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: sessionType === "short_break" ? themePalette.primary : "transparent",
                    color: sessionType === "short_break" ? "#ffffff" : "#475569",
                    boxShadow: sessionType === "short_break" ? `0 2px 8px -2px ${themePalette.primaryGlow}` : "none",
                  }}
                >
                  <span>☕</span>
                  <span>Short Break</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectType("long_break")}
                  className="flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: sessionType === "long_break" ? themePalette.primary : "transparent",
                    color: sessionType === "long_break" ? "#ffffff" : "#475569",
                    boxShadow: sessionType === "long_break" ? `0 2px 8px -2px ${themePalette.primaryGlow}` : "none",
                  }}
                >
                  <span>🛋️</span>
                  <span>Long Break</span>
                </button>
              </div>
            </div>

            {/* Middle Section: Liquid Timer (Left) + 5 Settings Cards (Right) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-7 items-center">
              {/* Left Sub-column: Liquid Timer, Presets, Controls */}
              <div className="md:col-span-7 flex flex-col items-center justify-center">
                <LiquidTimer
                  sessionType={sessionType}
                  remainingSeconds={remainingSeconds}
                  totalSeconds={totalPlannedSec}
                  isRunning={isRunning}
                  isPaused={isPaused}
                  cycleCount={cycleCount}
                  totalCycles={settings.cyclesBeforeLongBreak || 4}
                  themePalette={themePalette}
                />

                {/* Duration Presets: 15m | 25m | 45m | 60m | Custom */}
                <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                  {[15, 25, 45, 60].map((mins) => {
                    const isActive =
                      (sessionType === "focus" && settings.focusDuration === mins) ||
                      (sessionType === "short_break" && settings.shortBreakDuration === mins) ||
                      (sessionType === "long_break" && settings.longBreakDuration === mins);
                    return (
                      <button
                        key={mins}
                        type="button"
                        disabled={isRunning || isPaused}
                        onClick={() => {
                          if (sessionType === "focus") updateSettings({ focusDuration: mins });
                          else if (sessionType === "short_break") updateSettings({ shortBreakDuration: mins });
                          else updateSettings({ longBreakDuration: mins });
                          setRemainingSeconds(mins * 60);
                        }}
                        className="px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50"
                        style={{
                          backgroundColor: isActive ? themePalette.primary : "#ffffff",
                          color: isActive ? "#ffffff" : "#334155",
                          borderColor: isActive ? themePalette.primary : "#e2e8f0",
                          boxShadow: isActive ? `0 4px 12px -2px ${themePalette.primaryGlow}` : "none",
                        }}
                      >
                        {mins}m
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={isRunning || isPaused}
                    onClick={() => {
                      setCustomMinutesInput(
                        sessionType === "focus"
                          ? settings.focusDuration
                          : sessionType === "short_break"
                          ? settings.shortBreakDuration
                          : settings.longBreakDuration
                      );
                      setShowCustomDurationModal(true);
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-bold border bg-white text-slate-700 hover:bg-slate-50 border-slate-200 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <FileEdit className="w-3.5 h-3.5" style={{ color: themePalette.primary }} />
                    <span>Custom</span>
                  </button>
                </div>

                {/* Primary Action Controls: Reset, Large Play/Pause, Skip */}
                <div className="flex items-center justify-center gap-6 mt-5">
                  {/* Reset */}
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={actionLoading || (!isRunning && !isPaused && remainingSeconds === totalPlannedSec)}
                    className="w-12 h-12 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs hover:border-slate-300"
                    title="Reset timer"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  {/* Play / Pause (Prominent themed circle) */}
                  <button
                    type="button"
                    onClick={isRunning ? handlePause : isPaused ? handleResume : handleStart}
                    disabled={actionLoading}
                    className="w-16 h-16 rounded-full text-white flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: themePalette.primary,
                      boxShadow: `0 12px 28px -6px ${themePalette.primaryGlow}`,
                    }}
                    aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
                  >
                    {isRunning ? (
                      <Pause className="w-7 h-7 fill-white text-white" />
                    ) : (
                      <Play className="w-7 h-7 fill-white text-white translate-x-0.5" />
                    )}
                  </button>

                  {/* Skip */}
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={actionLoading}
                    className="w-12 h-12 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition cursor-pointer shadow-2xs hover:border-slate-300"
                    title="Skip session"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Right Sub-column: 5 Compact Settings Cards */}
              <div className="md:col-span-5 space-y-2.5">
                {/* 1. Alarm & Ringtone */}
                <div
                  onClick={() => setShowRingtoneModal(true)}
                  className="p-3 bg-white rounded-2xl border border-slate-100 hover:border-slate-300 transition cursor-pointer space-y-2 shadow-2xs group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-xl"
                        style={{
                          backgroundColor: themePalette.primaryUltraLight,
                          color: themePalette.primary,
                        }}
                      >
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 transition">
                          Alarm & Ringtone
                        </p>
                        <p className="text-[10px] text-slate-500">Choose your alarm sound</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
                  </div>

                  <div
                    className="flex items-center justify-between rounded-xl px-3 py-1.5 border"
                    style={{
                      backgroundColor: themePalette.primaryUltraLight,
                      borderColor: themePalette.borderColor,
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                      <Music className="w-3.5 h-3.5 shrink-0" style={{ color: themePalette.primary }} />
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {ringtonePillLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleAudioPreview}
                      className="p-1 rounded-full text-white transition cursor-pointer shrink-0 shadow-2xs"
                      style={{ backgroundColor: themePalette.primary }}
                      title={isAudioPreviewPlaying ? "Stop preview" : "Play preview"}
                    >
                      {isAudioPreviewPlaying ? (
                        <Pause className="w-3 h-3 fill-white" />
                      ) : (
                        <Play className="w-3 h-3 fill-white translate-x-0.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Screen Wake & Alert */}
                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="p-2 rounded-xl shrink-0"
                      style={{
                        backgroundColor: themePalette.primaryUltraLight,
                        color: themePalette.primary,
                      }}
                    >
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Screen Wake & Alert</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Keep screen awake during focus
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.screenWakeLock}
                      onChange={(e) => updateSettings({ screenWakeLock: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className="w-11 h-6 rounded-full transition-colors relative"
                      style={{ backgroundColor: settings.screenWakeLock ? themePalette.primary : "#e2e8f0" }}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform shadow-xs ${
                          settings.screenWakeLock ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {/* 3. Vibration */}
                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="p-2 rounded-xl shrink-0"
                      style={{
                        backgroundColor: themePalette.primaryUltraLight,
                        color: themePalette.primary,
                      }}
                    >
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Vibration</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Vibrate when the timer ends
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.vibration}
                      onChange={(e) => updateSettings({ vibration: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className="w-11 h-6 rounded-full transition-colors relative"
                      style={{ backgroundColor: settings.vibration ? themePalette.primary : "#e2e8f0" }}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform shadow-xs ${
                          settings.vibration ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {/* 4. Flashlight Blink */}
                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="p-2 rounded-xl shrink-0"
                      style={{
                        backgroundColor: themePalette.primaryUltraLight,
                        color: themePalette.primary,
                      }}
                    >
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Flashlight Blink</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Flash screen on completion
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.flashlightBlink}
                      onChange={(e) => updateSettings({ flashlightBlink: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className="w-11 h-6 rounded-full transition-colors relative"
                      style={{ backgroundColor: settings.flashlightBlink ? themePalette.primary : "#e2e8f0" }}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform shadow-xs ${
                          settings.flashlightBlink ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>

                {/* 5. Auto Start Next */}
                <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className="p-2 rounded-xl shrink-0"
                      style={{
                        backgroundColor: themePalette.primaryUltraLight,
                        color: themePalette.primary,
                      }}
                    >
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Auto Start Next</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Automatically start the next session
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.autoStartNext}
                      onChange={(e) => updateSettings({ autoStartNext: e.target.checked })}
                      className="sr-only"
                    />
                    <div
                      className="w-11 h-6 rounded-full transition-colors relative"
                      style={{ backgroundColor: settings.autoStartNext ? themePalette.primary : "#e2e8f0" }}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform shadow-xs ${
                          settings.autoStartNext ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Motivation Quote Card (Bottom-left of workspace) */}
          <div
            className="bg-white/95 rounded-2xl p-4 border shadow-2xs flex items-center justify-between gap-3"
            style={{ borderColor: themePalette.borderColor }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2.5 rounded-xl shrink-0"
                style={{
                  backgroundColor: themePalette.primaryUltraLight,
                  color: themePalette.primary,
                }}
              >
                <Sprout className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 tracking-tight">"Stay Focused"</p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Small focus sessions lead to big results.
                </p>
              </div>
            </div>

            {/* Complete Early Option (Visible when active) */}
            {(isRunning || isPaused) && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={actionLoading}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Finish Early</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column (4 of 12 cols): Today's Focus Summary & Recent Sessions */}
        <div className="lg:col-span-4 space-y-5">
          {/* Today's Focus Summary Card */}
          <div
            className="bg-white/95 rounded-3xl p-5 sm:p-6 border shadow-xs space-y-4"
            style={{ borderColor: themePalette.borderColor }}
          >
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Today's Focus Summary</span>
            </h3>

            {/* Total Focus & Completed */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: themePalette.primaryUltraLight,
                  borderColor: themePalette.borderColor,
                }}
              >
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" style={{ color: themePalette.primary }} />
                  <span>Total Focus</span>
                </div>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {formattedTotalFocus}
                </p>
              </div>

              <div
                className="p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: themePalette.primaryUltraLight,
                  borderColor: themePalette.borderColor,
                }}
              >
                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Completed</span>
                </div>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {historySummary.totalCompletedSessions || 0} Sessions
                </p>
              </div>
            </div>

            {/* Weekly Mini Bar Chart */}
            <div className="pt-2">
              <div className="flex items-end justify-between gap-1.5 h-24 px-1">
                {weeklyChartData.map((item) => (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      className="w-full max-w-[22px] rounded-lg transition-all duration-500 hover:opacity-85"
                      style={{
                        height: `${item.heightPercent}%`,
                        backgroundColor: themePalette.primary,
                      }}
                      title={`${item.day}: ${item.minutes} minutes`}
                    />
                    <span className="text-[10px] font-bold text-slate-400">
                      {item.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Sessions Card */}
          <div
            className="bg-white/95 rounded-3xl p-5 sm:p-6 border shadow-xs space-y-3.5"
            style={{ borderColor: themePalette.borderColor }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: themePalette.primary }} />
                <span>Recent Sessions</span>
              </h3>
              <span className="text-xs font-bold text-slate-500">
                View All →
              </span>
            </div>

            {history.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No recorded sessions yet today. Start your first focus block!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 tg-custom-scrollbar">
                {history.slice(0, 4).map((s) => {
                  const isFocus = s.sessionType === "focus";
                  const elapsedMins = Math.round((s.actualElapsedSeconds || s.plannedDuration || 1500) / 60);
                  const timeFormatted = new Date(s.createdAt || s.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={s._id}
                      className="p-2.5 rounded-2xl border border-slate-100 flex items-center justify-between text-xs bg-white shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">
                          {isFocus ? "🍅" : s.sessionType === "short_break" ? "☕" : "🛋️"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {isFocus ? "Focus" : s.sessionType === "short_break" ? "Short Break" : "Long Break"}{" "}
                            <span className="text-slate-400 font-normal">({elapsedMins}m)</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Today • {timeFormatted}
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        ✓ Completed
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: Pomodoro Progress & Today's Goal */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left: Pomodoro Progress Stepper (8 of 12 cols) */}
        <div
          className="md:col-span-8 bg-white/95 rounded-3xl p-5 sm:p-6 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ borderColor: themePalette.borderColor }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-2xl shrink-0"
              style={{
                backgroundColor: themePalette.primaryUltraLight,
                color: themePalette.primary,
              }}
            >
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Pomodoro Progress
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                You're on a roll! Keep going.
              </p>
            </div>
          </div>

          {/* Stepper with connected dots */}
          <div className="flex items-center gap-2 sm:gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const isCompleted = cycleCount > idx;
              const isCurrent = cycleCount === idx && isRunning;
              return (
                <React.Fragment key={idx}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-2xs"
                    style={{
                      backgroundColor: isCompleted
                        ? themePalette.primary
                        : isCurrent
                        ? themePalette.primaryUltraLight
                        : "#f8fafc",
                      color: isCompleted ? "#ffffff" : isCurrent ? themePalette.primary : "#94a3b8",
                      border: isCurrent
                        ? `2px solid ${themePalette.primary}`
                        : "1px solid #e2e8f0",
                    }}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
                  </div>
                  {idx < 3 && (
                    <div
                      className="h-1 w-6 sm:w-8 rounded-full transition-all"
                      style={{
                        backgroundColor: isCompleted ? themePalette.primary : "#e2e8f0",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <span className="text-xs font-bold shrink-0" style={{ color: themePalette.primary }}>
            Cycle {Math.min(4, cycleCount + 1)} of {settings.cyclesBeforeLongBreak || 4}
          </span>
        </div>

        {/* Right: Today's Goal Progress Card (4 of 12 cols) */}
        <div
          className="md:col-span-4 bg-white/95 rounded-3xl p-5 sm:p-6 border shadow-xs flex flex-col justify-between gap-3"
          style={{ borderColor: themePalette.borderColor }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0 border border-amber-100">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Today's Goal
                </h4>
                <p className="text-[11px] text-slate-500">
                  {settings.dailyGoalSessions || 4} Focus Sessions
                </p>
              </div>
            </div>

            <span className="text-xs font-black" style={{ color: themePalette.primary }}>
              {completedTodaySessions} / {settings.dailyGoalSessions || 4}
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((completedTodaySessions / (settings.dailyGoalSessions || 4)) * 100)
                )}%`,
                backgroundColor: themePalette.primary,
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Custom Duration Modal */}
      {showCustomDurationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4"
            style={{ borderColor: themePalette.borderColor }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileEdit className="w-4 h-4" style={{ color: themePalette.primary }} />
                <span>Custom Duration</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomDurationModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyCustomDuration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Minutes (1 - 180)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomDurationModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  style={{ backgroundColor: themePalette.primary }}
                >
                  Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Ringtone Picker Modal */}
      <RingtonePickerModal
        isOpen={showRingtoneModal}
        onClose={() => setShowRingtoneModal(false)}
        targetSlot={sessionType}
        currentSound={settings.alarmSound || "chime"}
        currentVolume={settings.alarmVolume || 80}
        onSave={async (data) => {
          updateSettings({
            alarmSound: data.soundId,
            alarmVolume: data.volume,
          });
          await refreshCustomRingtoneMeta();
          setShowRingtoneModal(false);
        }}
      />

      {/* 6. Settings Modal */}
      <FocusSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          updateSettings(newSettings);
        }}
        onOpenRingtonePicker={() => {
          setShowSettingsModal(false);
          setShowRingtoneModal(true);
        }}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestNotificationPermission}
      />

      {/* 7. Focus Completion Alert Modal (Samsung Clock Style) */}
      <FocusCompletionModal
        isOpen={showCompletionModal}
        sessionInfo={completedSessionInfo}
        todayTotalMinutes={historySummary.todayFocusMinutes || 0}
        onDismiss={() => {
          soundManager.stop();
          deviceAlarmManager.cancelFocusAlarm();
          setShowCompletionModal(false);
        }}
        onStartNext={() => {
          soundManager.stop();
          deviceAlarmManager.cancelFocusAlarm();
          setShowCompletionModal(false);
          handleStart();
        }}
        onSnooze={handleSnooze}
      />

      {/* 8. Developer Engine Diagnostics Modal */}
      <FocusDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
      />
    </div>
  );
};

export default FocusTimerPage;