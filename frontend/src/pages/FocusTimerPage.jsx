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
  ChevronRight,
  Settings2,
  X,
  Volume2,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import { API_BASE_URL } from "../config/api";

const DEFAULT_SETTINGS = {
  focusDuration: 25,     // minutes
  shortBreakDuration: 5, // minutes
  longBreakDuration: 15, // minutes
  cyclesBeforeLongBreak: 4,
};

export const FocusTimerPage = () => {
  const location = useLocation();

  // Settings
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("tasklert_focus_settings");
      return saved && saved !== "undefined" ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (e) {
      console.warn("Invalid focus settings in localStorage, resetting to defaults:", e);
      return DEFAULT_SETTINGS;
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  // Active Session State
  const [activeSession, setActiveSession] = useState(null);
  const [sessionType, setSessionType] = useState("focus"); // 'focus' | 'short_break' | 'long_break'
  const [selectedTaskId, setSelectedTaskId] = useState(location.state?.taskId || "");
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [historySummary, setHistorySummary] = useState({ totalCompletedSessions: 0, totalFocusMinutes: 0, todayFocusMinutes: 0 });
  const [_loading, setLoading] = useState(true);
  const [cycleCount, setCycleCount] = useState(0);

  // Authoritative seconds remaining
  const [remainingSeconds, setRemainingSeconds] = useState(settings.focusDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const handleAutoCompleteRef = useRef(null);
  const [actionLoading, setActionLoading] = useState(false);

  const timerIntervalRef = useRef(null);

  // Dynamic theme accent
  const themePrimary = useMemo(() => {
    if (typeof window === "undefined") return "#a855f7";
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
      "#a855f7"
    );
  }, []);

  // Save settings changes
  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem("tasklert_focus_settings", JSON.stringify(merged));
    if (!isRunning && !isPaused) {
      if (sessionType === "focus") setRemainingSeconds(merged.focusDuration * 60);
      else if (sessionType === "short_break") setRemainingSeconds(merged.shortBreakDuration * 60);
      else if (sessionType === "long_break") setRemainingSeconds(merged.longBreakDuration * 60);
    }
  };

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

  // Fetch focus history
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

  // Authoritatively re-calculate remaining time from session start/resume instant
  const syncLiveRemaining = useCallback((session) => {
    if (!session) return;
    const now = Date.now();
    let elapsed = Number(session.accumulatedSeconds) || 0;
    if (session.status === "running") {
      const resumedTime = session.lastResumedAt ? new Date(session.lastResumedAt).getTime() : now;
      const validResumedTime = isNaN(resumedTime) ? now : resumedTime;
      const delta = Math.max(0, Math.floor((now - validResumedTime) / 1000));
      elapsed += delta;
    }
    const planned = Number(session.plannedDuration) || (settings.focusDuration * 60);
    const remaining = Math.max(0, planned - elapsed);
    setRemainingSeconds(isFinite(remaining) ? remaining : planned);
    setIsRunning(session.status === "running");
    setIsPaused(session.status === "paused");
    setSessionType(session.sessionType || "focus");
    if (session.task?._id || session.task) {
      setSelectedTaskId(session.task._id || session.task);
    }
  }, [settings.focusDuration]);

  // Fetch active session from server on mount
  const checkActiveSession = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(`${API_BASE_URL}/api/focus/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && data.activeSession) {
        setActiveSession(data.activeSession);
        syncLiveRemaining(data.activeSession);
      } else {
        // Reset to default
        setRemainingSeconds(settings.focusDuration * 60);
        setIsRunning(false);
        setIsPaused(false);
      }
    } catch (err) {
      console.warn("Could not check active session:", err.message);
    } finally {
      setLoading(false);
    }
  }, [settings.focusDuration, syncLiveRemaining]);

  useEffect(() => {
    checkActiveSession();
    fetchTasks();
    fetchHistory();
  }, [checkActiveSession, fetchTasks, fetchHistory]);

  // Handle visibility changes (re-calculate accurately when user returns to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && activeSession) {
        checkActiveSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeSession, checkActiveSession]);

  // Handle countdown interval
  useEffect(() => {
    if (isRunning && remainingSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            handleAutoCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isRunning, remainingSeconds]);

  // START SESSION
  const handleStart = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in to track focus sessions.");
        return;
      }

      let plannedSec = settings.focusDuration * 60;
      if (sessionType === "short_break") plannedSec = settings.shortBreakDuration * 60;
      if (sessionType === "long_break") plannedSec = settings.longBreakDuration * 60;

      const { data } = await axios.post(
        `${API_BASE_URL}/api/focus/start`,
        {
          taskId: selectedTaskId || null,
          sessionType,
          plannedDuration: plannedSec,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setActiveSession(data.session);
        setRemainingSeconds(plannedSec);
        setIsRunning(true);
        setIsPaused(false);
        toast.info(
          sessionType === "focus"
            ? "Focus session started! Stay in the zone. 🚀"
            : "Break started! Stretch and recharge. ☕"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to start session");
    } finally {
      setActionLoading(false);
    }
  };

  // PAUSE SESSION
  const handlePause = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/focus/${activeSession._id}/pause`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setActiveSession(data.session);
        setIsRunning(false);
        setIsPaused(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to pause session");
    } finally {
      setActionLoading(false);
    }
  };

  // RESUME SESSION
  const handleResume = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/focus/${activeSession._id}/resume`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setActiveSession(data.session);
        setIsRunning(true);
        setIsPaused(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resume session");
    } finally {
      setActionLoading(false);
    }
  };

  // COMPLETE SESSION
  const handleComplete = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/focus/${activeSession._id}/complete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        // Play gentle chime (safely guarded against mobile autoplay policy)
        try {
          soundManager.preview("chime", 80);
        } catch (_) {}

        toast.success(
          sessionType === "focus"
            ? "Focus session complete! Great work! 🎯"
            : "Break ended! Ready for another session?"
        );

        // Advance cycle
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

        setActiveSession(null);
        setIsRunning(false);
        setIsPaused(false);
        fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete session");
    } finally {
      setActionLoading(false);
    }
  };

  handleAutoCompleteRef.current = () => {
    handleComplete();
  };

  // CANCEL SESSION (with safety confirmation)
  const handleCancel = async () => {
    if (!activeSession) return;
    if (!window.confirm("Are you sure you want to cancel this active focus session? Unfinished sessions will not be counted in productivity metrics.")) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/api/focus/${activeSession._id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.info("Session cancelled.");
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
      toast.error(err.response?.data?.message || "Failed to cancel session");
    } finally {
      setActionLoading(false);
    }
  };

  // Switch session type manually when timer is idle
  const handleSelectType = (type) => {
    if (isRunning || isPaused) {
      toast.info("Please pause or complete your active session before switching types.");
      return;
    }
    setSessionType(type);
    if (type === "focus") setRemainingSeconds(settings.focusDuration * 60);
    else if (type === "short_break") setRemainingSeconds(settings.shortBreakDuration * 60);
    else if (type === "long_break") setRemainingSeconds(settings.longBreakDuration * 60);
  };

  // Format time MM:SS
  const formatTime = (totalSec) => {
    const sec = isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Total duration for progress bar
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
    <div className="p-2 sm:p-4 md:p-6 min-w-0 w-full space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-purple-100 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-100/80 text-purple-600 shrink-0">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              Pomodoro Focus Timer
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Deep work intervals with authoritative session tracking and reliable recovery.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowSettings((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-white text-xs font-bold text-purple-700 hover:bg-purple-50 transition cursor-pointer shadow-xs"
          >
            <Settings2 className="w-4 h-4" />
            <span>Timer Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Modal / Drawer */}
      {showSettings && (
        <div className="bg-purple-50/80 rounded-2xl border border-purple-200 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-purple-600" /> Adjust Timer Durations
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-lg hover:bg-purple-200/50 text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Focus (Minutes)</label>
              <input
                type="number"
                min="5"
                max="90"
                value={settings.focusDuration}
                onChange={(e) => updateSettings({ focusDuration: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Short Break (Min)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.shortBreakDuration}
                onChange={(e) => updateSettings({ shortBreakDuration: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Long Break (Min)</label>
              <input
                type="number"
                min="5"
                max="45"
                value={settings.longBreakDuration}
                onChange={(e) => updateSettings({ longBreakDuration: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-gray-600 font-semibold mb-1">Cycles per Long Break</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.cyclesBeforeLongBreak}
                onChange={(e) => updateSettings({ cyclesBeforeLongBreak: Math.max(1, Number(e.target.value)) })}
                className="w-full bg-white border border-purple-200 rounded-lg p-2 font-bold text-gray-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Focus Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Timer Dial & Controls (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-10 border border-purple-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          {/* Mode Switcher Tabs */}
          <div className="inline-flex rounded-2xl bg-purple-50 p-1.5 border border-purple-100 mb-8 max-w-sm w-full">
            <button
              type="button"
              onClick={() => handleSelectType("focus")}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer ${
                sessionType === "focus"
                  ? "bg-purple-600 text-white shadow-sm"
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
                  ? "bg-purple-600 text-white shadow-sm"
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
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-purple-700"
              }`}
            >
              Long Break
            </button>
          </div>

          {/* Circular Countdown Display */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center mb-8">
            {/* SVG Circular Progress Ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-purple-100"
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
              <span className="text-xs font-bold tracking-wider text-purple-600 mt-1">
                {sessionType === "focus"
                  ? "Focus Time"
                  : sessionType === "short_break"
                  ? "Short Break"
                  : "Long Break"}
              </span>
              {sessionType === "focus" && (
                <span className="text-[11px] text-gray-400 mt-1">
                  Cycle #{cycleCount + 1} of {settings.cyclesBeforeLongBreak}
                </span>
              )}
            </div>
          </div>

          {/* Controls Bar Matching Screen 6 Mockup */}
          <div className="flex flex-col items-center w-full max-w-sm">
            <div className="flex items-center justify-center gap-6 w-full">
              {/* Reset Icon Button (Left) */}
              <button
                type="button"
                onClick={handleCancel}
                disabled={actionLoading || (!isRunning && !isPaused && remainingSeconds === totalPlannedSec)}
                className="w-11 h-11 rounded-full border border-purple-100 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition cursor-pointer disabled:opacity-30"
                title="Reset timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Large Round Purple Play/Pause Button (Center) */}
              <button
                type="button"
                onClick={isRunning ? handlePause : isPaused ? handleResume : handleStart}
                disabled={actionLoading}
                className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-md flex items-center justify-center transition active:scale-95 cursor-pointer disabled:opacity-50"
                aria-label={isRunning ? "Pause" : "Start"}
              >
                {isRunning ? (
                  <Pause className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Play className="w-7 h-7 fill-white text-white translate-x-0.5" />
                )}
              </button>

              {/* Settings Icon Button (Right) */}
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="w-11 h-11 rounded-full border border-purple-100 hover:bg-purple-50 text-gray-600 hover:text-purple-700 flex items-center justify-center transition cursor-pointer"
                title="Timer Settings"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>

            {/* Complete Button when session is in progress */}
            {(isRunning || isPaused) && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={actionLoading}
                className="mt-4 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Mark Session Completed</span>
              </button>
            )}

            {/* Current Task (Optional) Card Matching Screen 6 */}
            <div className="w-full mt-6 text-left">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-xs font-bold text-gray-500">Current Task (Optional)</span>
                {selectedTaskId && (
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId("")}
                    className="text-xs text-purple-600 hover:text-purple-800 cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="rounded-2xl border border-purple-100 bg-white p-3 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
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

                {selectedTaskId && (
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

        {/* Right Column: Today's Focus Overview & History (1 Col) */}
        <div className="space-y-6">
          {/* Focus Stats Card */}
          <div className="bg-white rounded-3xl p-5 border border-purple-100 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" /> Today's Focus Stats
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                <p className="text-xs font-semibold text-gray-500">Today's Focus</p>
                <p className="text-xl font-extrabold text-purple-700 mt-1">
                  {historySummary.todayFocusMinutes || 0}m
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                <p className="text-xs font-semibold text-gray-500">Completed Sessions</p>
                <p className="text-xl font-extrabold text-purple-700 mt-1">
                  {historySummary.totalCompletedSessions || 0}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-800 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Authoritative timing ensures elapsed seconds reflect real elapsed work without inflating stats on reload or tab suspension.
              </span>
            </div>
          </div>

          {/* Recent Completed Sessions History List */}
          <div className="bg-white rounded-3xl p-5 border border-purple-100 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" /> Recent Sessions
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No recorded focus sessions yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
        </div>
      </div>
    </div>
  );
};

export default FocusTimerPage;
