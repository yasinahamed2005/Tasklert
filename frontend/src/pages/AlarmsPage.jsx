import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  AlarmClock,
  Plus,
  Bell,
  Clock,
  Play,
  Square,
  Trash2,
  Volume2,
  RotateCw,
  Calendar,
  Sparkles,
  ArrowLeft,
  X,
  CheckCircle2,
  Sliders,
  Radio,
  Settings,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import AlarmModal from "../components/AlarmModal";
import { API_BASE_URL } from "../config/api";
import PageTransitionLoader from "../components/PageTransitionLoader";
import { showBrowserNotification } from "../utils/pushManager";

const API_BASE = `${API_BASE_URL}/api/reminders`;

const SOUND_OPTIONS = [
  { id: "digital", label: "Digital Beep (Electronic)" },
  { id: "classic", label: "Classic Alarm (Twin Bell)" },
  { id: "chime", label: "Gentle Chime (Crystal Bell)" },
  { id: "bell", label: "Morning Bell (Harmonic)" },
  { id: "soft", label: "Soft Reminder (Mellow)" },
];

const REPEAT_OPTIONS = [
  { id: "never", label: "Once (Ring One Time)" },
  { id: "daily", label: "Daily (Every Day)" },
  { id: "weekly", label: "Weekly (Once a Week)" },
];

export const AlarmsPage = () => {
  const navigate = useNavigate();
  const outletContext = useOutletContext?.() || {};
  const { refreshTasks } = outletContext;

  // Live real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Alarms list state
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeRingingAlarm, setActiveRingingAlarm] = useState(null);
  const [previewingSound, setPreviewingSound] = useState(null);
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'enabled'

  // New Alarm Form State
  const defaultHour = String(new Date().getHours()).padStart(2, "0");
  const defaultMinute = String((new Date().getMinutes() + 5) % 60).padStart(2, "0");
  const [alarmTime, setAlarmTime] = useState(`${defaultHour}:${defaultMinute}`);
  const [alarmTitle, setAlarmTitle] = useState("Morning Wakeup");
  const [alarmSound, setAlarmSound] = useState("digital");
  const [alarmVolume, setAlarmVolume] = useState(85);
  const [alarmRepeat, setAlarmRepeat] = useState("never");
  const [alarmSnooze, setAlarmSnooze] = useState(5);
  const [savingAlarm, setSavingAlarm] = useState(false);

  // Ref to track alarms that have fired today to avoid double-triggering within the same minute
  const firedTrackerRef = useRef(new Set());

  // Fetch all user alarms
  const fetchAlarms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(API_BASE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && Array.isArray(data.reminders)) {
        setAlarms(data.reminders);
      }
    } catch (err) {
      console.error("Failed to load alarms:", err);
      toast.error("Could not load alarms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  // TOGGLE ALARM ON / OFF
  const handleToggleAlarm = async (alarmId, currentEnabled) => {
    // Optimistic UI update
    setAlarms((prev) =>
      prev.map((a) =>
        a._id === alarmId ? { ...a, alarmEnabled: !currentEnabled } : a
      )
    );

    try {
      const token = localStorage.getItem("token");
      let res;
      try {
        res = await axios.patch(
          `${API_BASE}/${alarmId}/toggle`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (patchErr) {
        // Fallback to PUT if PATCH is ever restricted by network/proxy
        res = await axios.put(
          `${API_BASE}/${alarmId}/toggle`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      const data = res.data;

      if (data.success) {
        if (!currentEnabled) {
          toast.success("⏰ Alarm turned ON");
        } else {
          toast.info("Alarm turned OFF");
        }
        fetchAlarms();
        refreshTasks?.();
      }
    } catch (err) {
      // Revert optimistic update
      setAlarms((prev) =>
        prev.map((a) =>
          a._id === alarmId ? { ...a, alarmEnabled: currentEnabled } : a
        )
      );
      toast.error(err.response?.data?.message || "Failed to toggle alarm.");
    }
  };

  // DELETE ALARM
  const handleDeleteAlarm = async (alarmId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this alarm?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/${alarmId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Alarm deleted.");
      setAlarms((prev) => prev.filter((a) => a._id !== alarmId));
      fetchAlarms();
      refreshTasks?.();
    } catch (err) {
      toast.error("Failed to delete alarm.");
    }
  };

  // TEST RING ALARM (Immediate verification)
  const handleTestRing = (alarm) => {
    soundManager.stop();
    setActiveRingingAlarm({
      alarmId: alarm._id,
      title: `⏰ TEST RING: ${alarm.title || "Alarm"}`,
      body: `Testing alarm sound (${alarm.sound || "digital"}). Tap Dismiss or Snooze to stop.`,
      sound: alarm.sound || "digital",
      volume: alarm.volume || 85,
      priority: alarm.priority || "High",
      scheduledAt: new Date().toISOString(),
    });
  };

  // PREVIEW SOUND
  const handlePreviewSound = (soundId) => {
    if (previewingSound === soundId) {
      soundManager.stop();
      setPreviewingSound(null);
    } else {
      setPreviewingSound(soundId);
      soundManager.preview(soundId, alarmVolume);
      setTimeout(() => setPreviewingSound(null), 2500);
    }
  };

  // CREATE / SAVE NEW ALARM
  const handleSaveAlarm = async (e) => {
    e.preventDefault();
    if (!alarmTime) {
      toast.error("Please pick an alarm time.");
      return;
    }

    setSavingAlarm(true);
    try {
      const [hours, minutes] = alarmTime.split(":").map(Number);
      const targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);

      // If the chosen time today has already passed, schedule for tomorrow
      if (targetDate.getTime() <= Date.now()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const token = localStorage.getItem("token");
      const payload = {
        title: alarmTitle.trim() || "Alarm",
        scheduledAt: targetDate.toISOString(),
        sound: alarmSound,
        volume: Number(alarmVolume),
        repeat: alarmRepeat,
        snoozeDuration: Number(alarmSnooze),
        alarmEnabled: true,
        channels: { push: true, inApp: true, email: false },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      };

      const { data } = await axios.post(API_BASE, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        toast.success(
          `Alarm set for ${targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}! ⏰`
        );
        setShowAddModal(false);
        fetchAlarms();
        refreshTasks?.();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to set alarm.");
    } finally {
      setSavingAlarm(false);
    }
  };

  // REAL-TIME ALARM TICKER (Checks every second if an alarm is due)
  useEffect(() => {
    const checkAlarmsDue = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimestamp = now.getTime();

      alarms.forEach((alarm) => {
        if (!alarm.alarmEnabled) return;

        const alarmDate = new Date(alarm.scheduledAt);
        const alarmHours = alarmDate.getHours();
        const alarmMinutes = alarmDate.getMinutes();

        const minuteKey = `${alarm._id}-${now.toDateString()}-${currentHours}:${currentMinutes}`;

        // Check if hours and minutes match and hasn't fired in this minute
        const isTimeMatch = currentHours === alarmHours && currentMinutes === alarmMinutes;
        const isWithinWindow = Math.abs(currentTimestamp - alarmDate.getTime()) < 60000;

        if ((isTimeMatch || isWithinWindow) && !firedTrackerRef.current.has(minuteKey)) {
          firedTrackerRef.current.add(minuteKey);

          // Trigger ringing alarm modal and sound
          setActiveRingingAlarm({
            alarmId: alarm._id,
            title: `⏰ ${alarm.title || "Alarm"}`,
            body: alarm.message || `Alarm set for ${alarmDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} is ringing!`,
            sound: alarm.sound || "digital",
            volume: alarm.volume || 85,
            priority: alarm.priority || "High",
            scheduledAt: alarm.scheduledAt,
          });

          // Device vibration if supported (guarded against browser permissions)
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([400, 200, 400, 200, 600]);
            } catch (_) {}
          }

          // Safe cross-platform browser notification (Android Chrome + Desktop compatible)
          showBrowserNotification(`⏰ ${alarm.title || "Tasklert Alarm"}`, {
            body: `Alarm is ringing now!`,
            requireInteraction: true,
          });
        }
      });
    };

    const interval = setInterval(checkAlarmsDue, 1000);
    return () => clearInterval(interval);
  }, [alarms]);

  // Next upcoming alarm calculation
  const nextAlarm = useMemo(() => {
    const active = alarms
      .filter((a) => a.alarmEnabled)
      .map((a) => ({
        ...a,
        time: new Date(a.scheduledAt).getTime(),
      }))
      .filter((a) => a.time > Date.now())
      .sort((a, b) => a.time - b.time);

    return active[0] || null;
  }, [alarms]);

  const timeUntilNextAlarm = useMemo(() => {
    if (!nextAlarm) return null;
    const diffMs = nextAlarm.time - currentTime.getTime();
    if (diffMs <= 0) return "Ringing now!";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) return `in ${diffMins} minute${diffMins === 1 ? "" : "s"}`;
    return `in ${diffHours} hr ${diffMins} min`;
  }, [nextAlarm, currentTime]);

  const filteredAlarms = useMemo(() => {
    if (filterMode === "enabled") return alarms.filter((a) => a.alarmEnabled);
    return alarms;
  }, [alarms, filterMode]);

  return (
    <div className="p-2 sm:p-4 md:p-6 min-w-0 w-full space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* REAL-TIME ALARM MODAL (Rings with Sound, Snooze & Dismiss) */}
      {activeRingingAlarm && (
        <AlarmModal
          alarm={activeRingingAlarm}
          onClose={() => {
            soundManager.stop();
            setActiveRingingAlarm(null);
          }}
          onActionCompleted={() => {
            soundManager.stop();
            setActiveRingingAlarm(null);
            fetchAlarms();
            refreshTasks?.();
          }}
        />
      )}

      {/* TOP HEADER & REAL-TIME DIGITAL CLOCK */}
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-purple-100 p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-100 text-purple-600 shadow-xs shrink-0">
            <AlarmClock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Alarms &amp; Clock
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Exact-time alarms, daily schedules, Web Audio tones, and real-time ringing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Device Notification Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Set Alarm</span>
          </button>
        </div>
      </div>

      {/* LIVE DIGITAL CLOCK DISPLAY CARD */}
      <div className="bg-gradient-to-br from-purple-700 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-md text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

        <div className="text-xs sm:text-sm font-semibold text-purple-200 tracking-widest uppercase mb-1">
          {currentTime.toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>

        {/* Big Digital Clock */}
        <div className="text-4xl sm:text-6xl font-extrabold tracking-tight font-mono py-1">
          {currentTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>

        {/* Next Alarm Pill */}
        <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-purple-100 border border-white/20">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {nextAlarm
              ? `Next alarm: ${new Date(nextAlarm.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${timeUntilNextAlarm})`
              : "No alarms active"}
          </span>
        </div>
      </div>

      {/* FILTER TABS & ALARM COUNT */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-purple-50/80 p-1 border border-purple-100">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              filterMode === "all"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-gray-600 hover:text-purple-700"
            }`}
          >
            All Alarms ({alarms.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("enabled")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              filterMode === "enabled"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-gray-600 hover:text-purple-700"
            }`}
          >
            Active ON ({alarms.filter((a) => a.alarmEnabled).length})
          </button>
        </div>

        <button
          type="button"
          onClick={fetchAlarms}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer"
          title="Refresh alarms"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* ALARMS LIST */}
      {loading ? (
        <PageTransitionLoader message="Loading alarms..." minHeight="min-h-[35vh]" />
      ) : filteredAlarms.length === 0 ? (
        <div className="bg-white rounded-3xl border border-purple-100 p-8 sm:p-12 text-center shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <AlarmClock className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-gray-800">
            {filterMode === "enabled" ? "No Active Alarms" : "No Alarms Created Yet"}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
            Set an alarm with your favorite tone, repeat schedule, and wake up or stay on schedule in real-time.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-xs mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Set First Alarm</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlarms.map((alarm) => {
            const dateObj = new Date(alarm.scheduledAt || Date.now());
            const hours = dateObj.getHours();
            const minutes = String(dateObj.getMinutes()).padStart(2, "0");
            const period = hours >= 12 ? "PM" : "AM";
            const displayHours = hours % 12 || 12;
            const timeStr = `${String(displayHours).padStart(2, "0")}:${minutes}`;
            const isEnabled = Boolean(alarm.alarmEnabled);

            return (
              <div
                key={alarm._id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-4 ${
                  isEnabled
                    ? "border-purple-200 shadow-sm"
                    : "border-gray-200 opacity-60 bg-gray-50/50"
                }`}
              >
                {/* Left: Time, Title, Tags */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-gray-800 font-mono tracking-tight">
                      {timeStr}
                    </span>
                    <span className="text-xs font-bold text-purple-600 uppercase">
                      {period}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-gray-700 mt-0.5 truncate">
                    {alarm.title || "Alarm"}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-gray-500">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium text-[11px]">
                      🔔 {alarm.sound || "digital"}
                    </span>
                    {alarm.repeat && alarm.repeat !== "never" && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium text-[11px]">
                        🔁 {alarm.repeat}
                      </span>
                    )}
                    <span className="text-gray-400 text-[11px]">
                      {dateObj.toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>

                {/* Right: Test Button, ON/OFF Toggle Switch & Delete */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Test Ring Button */}
                  <button
                    type="button"
                    onClick={() => handleTestRing(alarm)}
                    className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition cursor-pointer border border-purple-100"
                    title="Test Ring this alarm"
                  >
                    <Play className="w-4 h-4 fill-purple-600" />
                  </button>

                  {/* MODERN SMARTPHONE ON / OFF TOGGLE SWITCH */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => handleToggleAlarm(alarm._id, isEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                      isEnabled ? "bg-purple-600" : "bg-gray-300"
                    }`}
                    title={isEnabled ? "Alarm is ON (Click to turn off)" : "Alarm is OFF (Click to turn on)"}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAlarm(alarm._id, e)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    title="Delete Alarm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / SET NEW ALARM MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-purple-100 p-5 sm:p-6 max-h-[92vh] overflow-y-auto animate-slideUp">
            {/* Grab Handle for Mobile */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-600">
                  <AlarmClock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Set New Alarm</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlarm} className="space-y-4">
              {/* TIME PICKER INPUT */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alarm Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={alarmTime}
                  onChange={(e) => setAlarmTime(e.target.value)}
                  className="w-full text-center text-3xl font-extrabold font-mono py-3 bg-purple-50/40 border border-purple-200 rounded-2xl text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
              </div>

              {/* ALARM LABEL / TITLE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alarm Label / Title
                </label>
                <input
                  type="text"
                  value={alarmTitle}
                  onChange={(e) => setAlarmTitle(e.target.value)}
                  placeholder="e.g. Morning Wakeup, Meeting, Gym..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* REPEAT SCHEDULE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Repeat Schedule
                </label>
                <select
                  value={alarmRepeat}
                  onChange={(e) => setAlarmRepeat(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {REPEAT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* ALARM SOUND PICKER WITH PREVIEW */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Alarm Sound Tone
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePreviewSound(alarmSound)}
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-purple-600" />
                    <span>{previewingSound === alarmSound ? "Playing..." : "Preview Sound"}</span>
                  </button>
                </div>
                <select
                  value={alarmSound}
                  onChange={(e) => setAlarmSound(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {SOUND_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* VOLUME SLIDER */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-purple-600" /> Alarm Volume
                  </span>
                  <span>{alarmVolume}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={alarmVolume}
                  onChange={(e) => setAlarmVolume(Number(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              {/* SNOOZE DURATION */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Snooze Duration (Minutes)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setAlarmSnooze(mins)}
                      className={`py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        alarmSnooze === mins
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-white text-gray-700 border-purple-100 hover:bg-purple-50"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingAlarm}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <AlarmClock className="w-4 h-4" />
                  <span>{savingAlarm ? "Scheduling..." : "Save Alarm"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlarmsPage;
