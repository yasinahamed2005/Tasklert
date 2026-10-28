import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  Coffee,
  Sparkles,
  Flame,
  Clock,
  Layers,
  Settings2,
  X,
  Volume2,
  VolumeX,
  Bell,
  BellRing,
  BellOff,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import { API_BASE_URL } from "../config/api";

const LOCAL_STORAGE_SESSION_KEY = "tasklert_focus_session_v2";
const LOCAL_STORAGE_SETTINGS_KEY = "tasklert_focus_settings";

const DEFAULT_SETTINGS = {
  focusDuration: 25, // minutes
  shortBreakDuration: 5, // minutes
  longBreakDuration: 15, // minutes
  cyclesBeforeLongBreak: 4,
  alarmSound: "chime", // 'chime' | 'classic' | 'digital' | 'bell' | 'soft'
  alarmVolume: 80,
  autoStartBreaks: false,
};

export const FocusTimerPage = () => {
  const location = useLocation();

  // Settings
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

  const [showSettings, setShowSettings] = useState(false);
  const [showLimitationHelp, setShowLimitationHelp] = useState(false);

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

  // Authoritative seconds remaining (derived from timestamp)
  const [remainingSeconds, setRemainingSeconds] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Completion Alert Modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedSessionInfo, setCompletedSessionInfo] = useState(null);

  // Sound previewing state
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  // Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "unsupported";
  });

  // State refs to keep callbacks decoupled and completely prevent render loops
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
  const broadcastChannelRef = useRef(null);
  const isCompletingRef = useRef(false);
  const handleCompleteRef = useRef(null);

  // Dynamic theme accent
  const themePrimary = useMemo(() => {
    if (typeof window === "undefined") return "#a855f7";
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
      "#a855f7"
    );
  }, []);

  // Update Settings helper
  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));

    // If timer is idle, adjust remaining time immediately
    if (!isRunning && !isPaused) {
      if (sessionType === "focus") setRemainingSeconds(merged.focusDuration * 60);
      else if (sessionType === "short_break") setRemainingSeconds(merged.shortBreakDuration * 60);
      else if (sessionType === "long_break") setRemainingSeconds(merged.longBreakDuration * 60);
    }
  };

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

  // Dispatch Native PWA / Service Worker Notification (Layer 3)
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

  // COMPLETE SESSION (Authoritatively saves to backend and triggers 4-layer alerts)
  const handleComplete = useCallback(async () => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;
    setActionLoading(true);

    const currentMode = sessionTypeRef.current;
    const currentTaskId = selectedTaskIdRef.current;
    const currentSettings = settingsRef.current;
    const currentSession = activeSessionRef.current;
    const currentCycle = cycleCountRef.current;

    // Immediately clear running state & local storage so expired session is NEVER re-triggered
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

      // 1. Layer 1 Alert: Play Audible Alarm Sound
      try {
        soundManager.playAlarm(currentSettings.alarmSound || "chime", currentSettings.alarmVolume || 80);
      } catch (_) {}

      // 2. Layer 3 Alert: Service Worker Native Push Notification
      const notifTitle =
        currentMode === "focus"
          ? "🎯 Focus Session Complete!"
          : "☕ Break Over!";
      const notifBody =
        currentMode === "focus"
          ? "Outstanding work! Take a refreshing break or kick off your next sprint."
          : "Recharge complete! Ready to dive back into deep work?";

      dispatchNativeNotification(notifTitle, notifBody);

      // 3. Show In-App Completion Alert Modal
      setCompletedSessionInfo({
        mode: currentMode,
        taskId: currentTaskId,
        durationMinutes:
          currentMode === "focus"
            ? currentSettings.focusDuration
            : currentMode === "short_break"
            ? currentSettings.shortBreakDuration
            : currentSettings.longBreakDuration,
      });
      setShowCompletionModal(true);

      // 4. Advance Pomodoro Cycle
      if (currentMode === "focus") {
        const nextCycle = currentCycle + 1;
        setCycleCount(nextCycle);
        if (nextCycle >= currentSettings.cyclesBeforeLongBreak) {
          setSessionType("long_break");
          setRemainingSeconds(currentSettings.longBreakDuration * 60);
          setCycleCount(0);
        } else {
          setSessionType("short_break");
          setRemainingSeconds(currentSettings.shortBreakDuration * 60);
        }
      } else {
        setSessionType("focus");
        setRemainingSeconds(currentSettings.focusDuration * 60);
      }

      // Broadcast completion to other tabs
      broadcastChannelRef.current?.postMessage({ type: "FOCUS_SESSION_COMPLETED" });

      // Refresh history once
      fetchHistory();
    } catch (err) {
      console.error("Completion handling error:", err);
    } finally {
      setActionLoading(false);
      isCompletingRef.current = false;
    }
  }, [dispatchNativeNotification, fetchHistory]);

  handleCompleteRef.current = handleComplete;

  // Timestamp-based sync: Recalculate remaining seconds from authoritative end timestamp
  const syncTimestampCountdown = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (!raw) return;
      const local = JSON.parse(raw);

      if (local.status === "running" && local.targetEndTimestamp) {
        const now = Date.now();
        const diffSec = Math.ceil((local.targetEndTimestamp - now) / 1000);

        if (diffSec <= 0) {
          // Timer expired while page was backgrounded or asleep!
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

  // Check active session from server & local storage on mount (guarded against re-renders)
  const checkActiveSession = useCallback(async () => {
    setLoading(true);
    try {
      // Check localStorage first for instant offline/PWA recovery
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

  // Initial load: strictly runs ONCE on component mount to prevent infinite network request loops
  useEffect(() => {
    checkActiveSession();
    fetchTasks();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // VisibilityChange & Window Focus handlers (instantly recovers when tab is reopened or screen wakes)
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

  // Countdown interval: strictly depends only on `isRunning`
  useEffect(() => {
    if (isRunning) {
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
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [isRunning]);

  // START SESSION
  const handleStart = async () => {
    // Unlock browser Web Audio API context following user interaction
    try {
      soundManager.getAudioContext();
    } catch (_) {}

    setActionLoading(true);
    try {
      let plannedSec = settings.focusDuration * 60;
      if (sessionType === "short_break") plannedSec = settings.shortBreakDuration * 60;
      if (sessionType === "long_break") plannedSec = settings.longBreakDuration * 60;

      const now = Date.now();
      const targetEndTimestamp = now + plannedSec * 1000;

      // 1. Persist local timestamp immediately for instant offline responsiveness
      const localSession = {
        id: `local-${now}`,
        sessionType,
        plannedDuration: plannedSec,
        startTime: now,
        targetEndTimestamp,
        accumulatedSeconds: 0,
        status: "running",
        taskId: selectedTaskId || null,
      };

      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(localSession));
      setRemainingSeconds(plannedSec);
      setIsRunning(true);
      setIsPaused(false);

      // 2. Call backend focus/start
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
          console.warn("Backend startSession notification:", apiErr.message);
        }
      }

      broadcastChannelRef.current?.postMessage({
        type: "FOCUS_SESSION_STARTED",
        payload: localSession,
      });

      toast.info(
        sessionType === "focus"
          ? "Focus sprint started! Time to get in the zone. 🚀"
          : "Break started! Stretch, breathe, and recharge. ☕"
      );
    } catch (err) {
      console.error(err);
      toast.error("Could not sync with server, running in local mode.");
    } finally {
      setActionLoading(false);
    }
  };

  // PAUSE SESSION
  const handlePause = async () => {
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
      soundManager.getAudioContext();
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
    if (
      !window.confirm(
        "Are you sure you want to reset this timer? Unfinished sessions will not be counted in productivity metrics."
      )
    ) {
      return;
    }

    soundManager.stop();
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
      toast.info("Timer reset.");
      fetchHistory();
    } catch (err) {
      toast.error("Could not cancel session on server.");
    } finally {
      setActionLoading(false);
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

  // Test sound helper
  const handleTestSound = () => {
    if (isPlayingTestSound) {
      soundManager.stop();
      setIsPlayingTestSound(false);
    } else {
      setIsPlayingTestSound(true);
      soundManager.preview(settings.alarmSound || "chime", settings.alarmVolume || 80);
      setTimeout(() => {
        setIsPlayingTestSound(false);
      }, 2500);
    }
  };

  // Format time MM:SS
  const formatTime = (totalSec) => {
    const sec = isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Total planned duration
  const totalPlannedSec = useMemo(() => {
    if (activeSession?.plannedDuration) return activeSession.plannedDuration;
    if (sessionType === "focus") return settings.focusDuration * 60;
    if (sessionType === "short_break") return settings.shortBreakDuration * 60;
    return settings.longBreakDuration * 60;
  }, [activeSession, sessionType, settings]);

  const safeRemaining = isFinite(remainingSeconds) ? remainingSeconds : totalPlannedSec;
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((totalPlannedSec - safeRemaining) / (totalPlannedSec || 1)) * 100))
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 min-w-0 w-full space-y-5 sm:space-y-6">
      {/* Top Banner with Quick Status Controls */}
      <div
        className="bg-white rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ borderColor: "var(--calendar-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-2xl shrink-0"
            style={{
              backgroundColor: "var(--calendar-header-bg)",
              color: "var(--calendar-header-text)",
            }}
          >
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
                Focus Timer
              </h1>
              {isRunning && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Running
                </span>
              )}
              {isPaused && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Timestamp-anchored Pomodoro cycles with authoritative recovery and multi-layer alarms.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Notification Status Indicator */}
          {notificationPermission === "granted" ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700"
              title="Browser notifications are enabled"
            >
              <BellRing className="w-3.5 h-3.5 text-emerald-600" />
              <span>Alerts Active</span>
            </span>
          ) : notificationPermission === "denied" ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700"
              title="Notifications are blocked in browser permissions"
            >
              <BellOff className="w-3.5 h-3.5 text-rose-500" />
              <span>Alerts Blocked</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleRequestNotificationPermission}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-[11px] font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Notifications</span>
            </button>
          )}

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={handleTestSound}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isPlayingTestSound
                ? "bg-purple-600 text-white border-purple-600 animate-pulse"
                : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
            }`}
            title="Preview completion alarm sound"
          >
            {isPlayingTestSound ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isPlayingTestSound ? "Stop Test" : "Test Sound"}</span>
          </button>

          {/* Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-xs font-bold text-purple-700 hover:bg-purple-50 transition cursor-pointer shadow-xs"
          >
            <Settings2 className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div
          className="bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 animate-fadeIn"
          style={{ borderColor: "var(--calendar-border)" }}
        >
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-purple-600" /> Adjust Durations & Sounds
            </h3>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Focus (Minutes)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.focusDuration}
                onChange={(e) =>
                  updateSettings({ focusDuration: Math.max(1, Number(e.target.value)) })
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Short Break (Min)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.shortBreakDuration}
                onChange={(e) =>
                  updateSettings({ shortBreakDuration: Math.max(1, Number(e.target.value)) })
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Long Break (Min)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.longBreakDuration}
                onChange={(e) =>
                  updateSettings({ longBreakDuration: Math.max(1, Number(e.target.value)) })
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Alarm Tone</label>
              <select
                value={settings.alarmSound || "chime"}
                onChange={(e) => updateSettings({ alarmSound: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-800 cursor-pointer"
              >
                <option value="chime">Gentle Chime (Crystal Bell)</option>
                <option value="classic">Classic Alarm (Twin Bell)</option>
                <option value="digital">Digital Pulse (Beep)</option>
                <option value="bell">Morning Bell (Harmonic)</option>
                <option value="soft">Soft Reminder (Mellow)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Focus Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left Column: Timer Dial & Controls (2 Cols) */}
        <div
          className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 md:p-10 border shadow-xs flex flex-col items-center justify-center text-center relative overflow-hidden"
          style={{ borderColor: "var(--calendar-border)" }}
        >
          {/* Mode Switcher Tabs */}
          <div
            className="inline-flex rounded-2xl p-1 border mb-6 sm:mb-8 max-w-sm w-full"
            style={{ backgroundColor: "var(--calendar-header-bg)", borderColor: "var(--calendar-border)" }}
          >
            <button
              type="button"
              onClick={() => handleSelectType("focus")}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                sessionType === "focus"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-purple-700"
              }`}
            >
              Focus
            </button>
            <button
              type="button"
              onClick={() => handleSelectType("short_break")}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                sessionType === "short_break"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-purple-700"
              }`}
            >
              Short Break
            </button>
            <button
              type="button"
              onClick={() => handleSelectType("long_break")}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                sessionType === "long_break"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-purple-700"
              }`}
            >
              Long Break
            </button>
          </div>

          {/* Circular Countdown Display */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center mb-6 sm:mb-8">
            {/* SVG Circular Progress Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="var(--calendar-border)"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke={themePrimary}
                strokeWidth="6"
                strokeDasharray="276.46"
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500 ease-linear"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl sm:text-5xl font-black text-gray-800 tracking-tight font-mono">
                {formatTime(remainingSeconds)}
              </span>
              <span className="text-xs font-bold tracking-wider text-purple-600 mt-1 uppercase">
                {sessionType === "focus"
                  ? "Focus Interval"
                  : sessionType === "short_break"
                  ? "Short Break"
                  : "Long Break"}
              </span>
              <span className="text-[11px] text-gray-400 mt-1 font-medium">
                Cycle #{cycleCount + 1} of {settings.cyclesBeforeLongBreak}
              </span>
            </div>
          </div>

          {/* Quick Duration Preset Chips (when idle) */}
          {!isRunning && !isPaused && (
            <div className="flex items-center gap-1.5 mb-6 flex-wrap justify-center">
              {sessionType === "focus"
                ? [15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        updateSettings({ focusDuration: mins });
                        setRemainingSeconds(mins * 60);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        settings.focusDuration === mins
                          ? "calendar-today-badge border-transparent"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))
                : [3, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        if (sessionType === "short_break") {
                          updateSettings({ shortBreakDuration: mins });
                          setRemainingSeconds(mins * 60);
                        } else {
                          updateSettings({ longBreakDuration: mins });
                          setRemainingSeconds(mins * 60);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 cursor-pointer"
                    >
                      {mins}m
                    </button>
                  ))}
            </div>
          )}

          {/* Controls Bar */}
          <div className="flex flex-col items-center w-full max-w-sm">
            <div className="flex items-center justify-center gap-6 w-full">
              {/* Reset Icon Button (Left) */}
              <button
                type="button"
                onClick={handleReset}
                disabled={actionLoading || (!isRunning && !isPaused && remainingSeconds === totalPlannedSec)}
                className="w-12 h-12 rounded-full border border-gray-200 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Reset timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Large Round Play/Pause Button (Center) */}
              <button
                type="button"
                onClick={isRunning ? handlePause : isPaused ? handleResume : handleStart}
                disabled={actionLoading}
                className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-50"
                aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
              >
                {isRunning ? (
                  <Pause className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white text-white translate-x-0.5" />
                )}
              </button>

              {/* Settings Toggle Button (Right) */}
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-12 h-12 rounded-full border border-gray-200 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition cursor-pointer"
                title="Timer settings"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>

            {/* Complete Early Button (when running or paused) */}
            {(isRunning || isPaused) && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={actionLoading}
                className="mt-4 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Session Finished Early</span>
              </button>
            )}

            {/* Optional Linked Task Selector */}
            <div className="w-full mt-6 text-left">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-bold text-gray-500">Current Task (Optional)</span>
                {selectedTaskId && (
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId("")}
                    disabled={isRunning || isPaused}
                    className="text-xs text-purple-600 hover:text-purple-800 cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div
                className="rounded-2xl border bg-white p-3 shadow-xs flex items-center justify-between gap-3"
                style={{ borderColor: "var(--calendar-border)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="p-2 rounded-xl shrink-0"
                    style={{ backgroundColor: "var(--calendar-cell-alt)", color: "var(--primary)" }}
                  >
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {selectedTaskId ? (
                      <p className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                        {tasks.find((t) => (t._id || t.id) === selectedTaskId)?.title || "Task Linked"}
                      </p>
                    ) : (
                      <select
                        value={selectedTaskId}
                        onChange={(e) => setSelectedTaskId(e.target.value)}
                        disabled={isRunning || isPaused}
                        className="bg-transparent text-xs sm:text-sm font-semibold text-gray-600 focus:outline-none cursor-pointer w-full"
                      >
                        <option value="">Select a task to focus on...</option>
                        {tasks.map((t) => (
                          <option key={t._id || t.id} value={t._id || t.id}>
                            [{t.priority}] {t.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {selectedTaskId && !isRunning && !isPaused && (
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId("")}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Today's Focus Stats, History & Background Info (1 Col) */}
        <div className="space-y-5">
          {/* Today's Focus Stats Card */}
          <div
            className="bg-white rounded-3xl p-5 border shadow-xs space-y-3.5"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <h3 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" /> Today's Focus Summary
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div
                className="p-3 rounded-2xl border"
                style={{ backgroundColor: "var(--calendar-cell-alt)", borderColor: "var(--calendar-border)" }}
              >
                <p className="text-xs font-semibold text-gray-500">Today's Focus</p>
                <p className="text-xl font-extrabold text-purple-700 mt-1">
                  {historySummary.todayFocusMinutes || 0}m
                </p>
              </div>
              <div
                className="p-3 rounded-2xl border"
                style={{ backgroundColor: "var(--calendar-cell-alt)", borderColor: "var(--calendar-border)" }}
              >
                <p className="text-xs font-semibold text-gray-500">Completed Sessions</p>
                <p className="text-xl font-extrabold text-purple-700 mt-1">
                  {historySummary.totalCompletedSessions || 0}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 text-[11px] text-purple-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>
                Timestamp-anchored timing guarantees exact elapsed seconds, even if you switch apps or your device sleeps.
              </span>
            </div>
          </div>

          {/* Recent Completed Sessions History List */}
          <div
            className="bg-white rounded-3xl p-5 border shadow-xs space-y-3"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <h3 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" /> Recent Completed Sessions
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No recorded focus sessions yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {history.map((s) => (
                  <div
                    key={s._id}
                    className="p-2.5 rounded-xl border border-gray-100 hover:border-purple-200 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-gray-800">
                        <span>{s.sessionType === "focus" ? "🎯 Focus" : "☕ Break"}</span>
                        <span className="text-gray-400 font-normal">
                          ({Math.round((s.actualElapsedSeconds || 0) / 60)}m)
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.task?.title ? `Task: ${s.task.title}` : "General Focus"} •{" "}
                        {new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browser Background Alert Transparency Info */}
          <div
            className="bg-white rounded-3xl p-4 sm:p-5 border shadow-xs space-y-2 text-xs"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <button
              type="button"
              onClick={() => setShowLimitationHelp(!showLimitationHelp)}
              className="w-full flex items-center justify-between font-bold text-gray-700 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span>How Background Alarms Work</span>
              </div>
              {showLimitationHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLimitationHelp && (
              <div className="pt-2 text-[11px] text-gray-500 space-y-2 border-t mt-2">
                <p>
                  <strong>• Tab Switch or In-App Navigation:</strong> 100% accurate. The timer anchors to its target end timestamp and instantly reconciles.
                </p>
                <p>
                  <strong>• Background or Screen Lock:</strong> Delivers native OS notifications via Service Worker and audible alert chimes upon wake.
                </p>
                <p>
                  <strong>• Closed Browser:</strong> Scheduled push notifications are delivered to subscribed devices via Tasklert's server-side push engine.
                </p>
                <p>
                  <strong>• Power Off:</strong> Web standards cannot wake powered-off hardware or override aggressive OS battery kill daemons without native Android alarm permissions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completion Alert Modal (Layer 1 Foreground Experience) */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 border shadow-2xl text-center space-y-4"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 mx-auto flex items-center justify-center animate-bounce">
              {completedSessionInfo?.mode === "focus" ? (
                <Sparkles className="w-8 h-8" />
              ) : (
                <Coffee className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-black text-gray-800">
                {completedSessionInfo?.mode === "focus"
                  ? "Focus Sprint Finished! 🎯"
                  : "Break Completed! ☕"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {completedSessionInfo?.mode === "focus"
                  ? "Great momentum! You completed your scheduled focus block."
                  : "Hope you enjoyed your breather! Ready to dive back into deep work?"}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.stop();
                  setShowCompletionModal(false);
                  handleStart();
                }}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                {completedSessionInfo?.mode === "focus"
                  ? "Start Break Now"
                  : "Start Next Focus Session"}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.stop();
                  setShowCompletionModal(false);
                }}
                className="w-full py-2 px-4 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-xs cursor-pointer"
              >
                Dismiss Alarm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FocusTimerPage;
