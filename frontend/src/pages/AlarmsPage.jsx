import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  VolumeX,
  Volume1,
  RotateCw,
  Calendar,
  Sparkles,
  ArrowLeft,
  X,
  CheckCircle2,
  CheckCheck,
  Settings,
  ListTodo,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import AlarmModal from "../components/AlarmModal";
import { API_BASE_URL } from "../config/api";
import PageTransitionLoader from "../components/PageTransitionLoader";
import { showBrowserNotification } from "../utils/pushManager";
import { useModalAccessibility } from "../utils/scrollLock";

const API_BASE = `${API_BASE_URL}/api/reminders`;

const SOUND_OPTIONS = [
  { id: "digital", label: "Digital Beep (Electronic)" },
  { id: "classic", label: "Classic Alarm (Twin Bell)" },
  { id: "chime", label: "Gentle Chime (Crystal Bell)" },
  { id: "bell", label: "Morning Bell (Harmonic)" },
  { id: "soft", label: "Soft Reminder (Mellow)" },
];

const WEEKDAYS = [
  { id: 0, label: "S", name: "Sun" },
  { id: 1, label: "M", name: "Mon" },
  { id: 2, label: "T", name: "Tue" },
  { id: 3, label: "W", name: "Wed" },
  { id: 4, label: "T", name: "Thu" },
  { id: 5, label: "F", name: "Fri" },
  { id: 6, label: "S", name: "Sat" },
];

export const AlarmsPage = () => {
  const navigate = useNavigate();
  const outletContext = useOutletContext?.() || {};
  const { refreshTasks, tasks = [] } = outletContext;

  // Filter pending tasks that can be linked to alarms
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => !t.completed);
  }, [tasks]);

  // Live real-time clock state (Samsung Clock style)
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
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [alarmSound, setAlarmSound] = useState("digital");
  const [alarmVolume, setAlarmVolume] = useState(85);
  const [alarmRepeat, setAlarmRepeat] = useState("never"); // 'never' | 'daily' | 'weekly'
  const [selectedDays, setSelectedDays] = useState(new Set([new Date().getDay()]));
  const [alarmSnooze, setAlarmSnooze] = useState(5);
  const [savingAlarm, setSavingAlarm] = useState(false);

  // Modal accessibility & body scroll lock
  const addModalRef = useRef(null);
  const handleCloseAddModal = useCallback(() => {
    soundManager.stop();
    setPreviewingSound(null);
    setShowAddModal(false);
  }, []);

  useModalAccessibility({
    isOpen: showAddModal,
    onClose: handleCloseAddModal,
    modalRef: addModalRef,
  });

  // Unambiguous 12-hour format display helper
  const formatted12Hour = useMemo(() => {
    const [hStr, mStr] = (alarmTime || "07:00").split(":");
    const h = Number(hStr) || 0;
    const m = mStr || "00";
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return {
      period,
      time12: `${String(h12).padStart(2, "0")}:${m} ${period}`,
    };
  }, [alarmTime]);

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

  // TEST RING ALARM (Immediate verification with task completion support)
  const handleTestRing = (alarm) => {
    soundManager.stop();
    setActiveRingingAlarm({
      alarmId: alarm._id,
      taskId: alarm.task?._id || alarm.task,
      title: `⏰ TEST RING: ${alarm.title || "Alarm"}`,
      body: `Testing alarm sound (${alarm.sound || "digital"}). Tap Dismiss & Complete to test full flow.`,
      sound: alarm.sound || "digital",
      volume: alarm.volume || 85,
      priority: alarm.priority || "High",
      scheduledAt: new Date().toISOString(),
    });
  };

  const previewTimerRef = useRef(null);

  // PREVIEW SOUND
  const handlePreviewSound = (soundId) => {
    soundManager.stop();
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    if (previewingSound === soundId) {
      setPreviewingSound(null);
    } else {
      setPreviewingSound(soundId);
      soundManager.preview(soundId, alarmVolume);
      previewTimerRef.current = setTimeout(() => {
        setPreviewingSound(null);
      }, 2500);
    }
  };


  // Toggle Day in Repeat Selector
  const handleToggleDay = (dayId) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayId)) {
        if (next.size > 1) next.delete(dayId); // Keep at least one
      } else {
        next.add(dayId);
      }
      // Update repeat mode based on selection
      if (next.size === 7) {
        setAlarmRepeat("daily");
      } else if (next.size === 1) {
        setAlarmRepeat("weekly");
      } else {
        setAlarmRepeat("weekly");
      }
      return next;
    });
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

      if (linkedTaskId) {
        payload.taskId = linkedTaskId;
      }

      const { data } = await axios.post(API_BASE, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        toast.success(
          `Alarm set for ${targetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}! ⏰`
        );
        setShowAddModal(false);
        setLinkedTaskId("");
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

          // Trigger ringing alarm modal with taskId passed for completion
          setActiveRingingAlarm({
            alarmId: alarm._id,
            taskId: alarm.task?._id || alarm.task,
            title: `⏰ ${alarm.title || "Alarm"}`,
            body: alarm.message || `Alarm set for ${alarmDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} is ringing!`,
            sound: alarm.sound || "digital",
            volume: alarm.volume || 85,
            priority: alarm.priority || "High",
            scheduledAt: alarm.scheduledAt,
          });

          // Device vibration if supported
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([400, 200, 400, 200, 600]);
            } catch (_) {}
          }

          // Safe cross-platform browser notification
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

  // Next upcoming active alarm calculation
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

  // Samsung Clock-style Relative Countdown Helper
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

  // Samsung Clock Day Active Checker
  const isDayActive = (alarm, dayIndex) => {
    if (alarm.repeat === "daily") return true;
    if (alarm.repeat === "weekly") {
      const scheduledDay = new Date(alarm.scheduledAt).getDay();
      return scheduledDay === dayIndex;
    }
    return false;
  };

  // Clock header values
  const clockHours = currentTime.getHours();
  const clockMinutes = String(currentTime.getMinutes()).padStart(2, "0");
  const clockSeconds = String(currentTime.getSeconds()).padStart(2, "0");
  const clockPeriod = clockHours >= 12 ? "PM" : "AM";
  const clockDisplayHours = clockHours % 12 || 12;
  const clockFormatted = `${String(clockDisplayHours).padStart(2, "0")}:${clockMinutes}`;

  return (
    <div className="p-2 sm:p-4 md:p-6 min-w-0 w-full space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* REAL-TIME ALARM MODAL (Samsung Clock Ringing Screen) */}
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

      {/* TOP HEADER & CONTROLS */}
      <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-purple-100 text-purple-600 shadow-xs shrink-0">
            <AlarmClock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Alarms &amp; Clock
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Exact-time alarms, daily schedules, Web Audio tones, and automatic task completion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => navigate("/settings?tab=alarms")}
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

      {/* SAMSUNG CLOCK LIVE DIGITAL CLOCK & NEXT ALARM HERO CARD */}
      <div className="bg-gradient-to-br from-[#7C3AED] via-[#8B2CF5] to-[#4F46E5] text-white rounded-3xl p-6 sm:p-8 shadow-md text-center relative overflow-hidden">
        {/* Subtle background ambient glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />

        {/* Date line */}
        <div className="text-xs sm:text-sm font-semibold text-purple-200 tracking-wider uppercase mb-1">
          {currentTime.toLocaleDateString([], {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>

        {/* Big Crisp Digital Time Display */}
        <div className="flex items-baseline justify-center gap-2 py-1">
          <span className="text-5xl sm:text-7xl font-extrabold tracking-tight font-mono drop-shadow-sm">
            {clockFormatted}
          </span>
          <div className="flex flex-col items-start leading-none">
            <span className="text-xs sm:text-sm font-mono text-purple-200 font-bold">
              :{clockSeconds}
            </span>
            <span className="text-sm sm:text-base font-extrabold text-purple-100">
              {clockPeriod}
            </span>
          </div>
        </div>

        {/* Samsung Clock Smart Next Alarm Countdown Banner */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs sm:text-sm font-semibold text-purple-100 border border-white/20 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-purple-200" />
          <span>
            {nextAlarm
              ? `Next alarm ${timeUntilNextAlarm} (${new Date(nextAlarm.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
              : "All alarms are currently off"}
          </span>
        </div>
      </div>

      {/* FILTER TABS & REFRESH */}
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

      {/* SAMSUNG CLOCK ALARMS LIST */}
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
            Set an alarm with your favorite tone, repeat schedule, and link to a task so stopping the alarm automatically completes the task.
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
            const isLinked = Boolean(alarm.task);
            const taskTitle = alarm.task?.title || (typeof alarm.task === "object" ? alarm.task?.title : null);

            return (
              <div
                key={alarm._id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3 sm:gap-4 ${
                  isEnabled
                    ? "border-purple-200/90 shadow-xs"
                    : "border-slate-200 opacity-60 bg-slate-50/40"
                }`}
              >
                {/* Left: Time, Title, Samsung Weekday Bubbles */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-800 font-mono tracking-tight">
                      {timeStr}
                    </span>
                    <span className="text-xs font-bold text-purple-600 uppercase">
                      {period}
                    </span>
                  </div>

                  {/* Alarm Title + Linked Task Badge */}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {alarm.title || "Alarm"}
                    </p>
                    {isLinked && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 text-[11px] font-semibold">
                        <CheckCheck className="w-3 h-3 text-purple-600" />
                        Linked to Task {taskTitle ? `(${taskTitle})` : ""}
                      </span>
                    )}
                  </div>

                  {/* Samsung Clock Style 7-Day Repeat Bubbles */}
                  <div className="flex items-center gap-1 mt-2">
                    {WEEKDAYS.map((day) => {
                      const active = isDayActive(alarm, day.id);
                      return (
                        <span
                          key={day.id}
                          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-colors ${
                            active && isEnabled
                              ? "bg-purple-600 text-white shadow-2xs"
                              : active && !isEnabled
                              ? "bg-slate-300 text-white"
                              : "text-slate-400 bg-slate-100"
                          }`}
                          title={`${day.name} ${active ? "(Active)" : "(Inactive)"}`}
                        >
                          {day.label}
                        </span>
                      );
                    })}

                    <span className="text-slate-400 text-[11px] font-medium ml-2">
                      🔔 {alarm.sound || "digital"}
                    </span>
                  </div>
                </div>

                {/* Right: Test Button, Samsung One UI Toggle Switch & Delete */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {/* Test Ring Button */}
                  <button
                    type="button"
                    onClick={() => handleTestRing(alarm)}
                    className="p-2 rounded-xl text-purple-600 hover:bg-purple-50 transition cursor-pointer border border-purple-100"
                    title="Test Ring this alarm"
                  >
                    <Play className="w-4 h-4 fill-purple-600" />
                  </button>

                  {/* SAMSUNG ONE UI PILL TOGGLE SWITCH */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => handleToggleAlarm(alarm._id, isEnabled)}
                    className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                      isEnabled ? "bg-purple-600" : "bg-slate-300"
                    }`}
                    title={isEnabled ? "Alarm is ON (Click to turn off)" : "Alarm is OFF (Click to turn on)"}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAlarm(alarm._id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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

      {/* SAMSUNG CLOCK INSPIRED SET NEW ALARM MODAL */}
      {showAddModal &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="set-alarm-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-none animate-fadeIn"
            onClick={handleCloseAddModal}
          >
          <div
            ref={addModalRef}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-purple-100 max-h-[min(90dvh,720px)] flex flex-col overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle for Mobile */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 sm:hidden" />

            {/* Modal Header (Fixed / Non-scrolling) */}
            <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <AlarmClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="set-alarm-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                    Set Alarm
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure time, repeat schedule &amp; optional linked task
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form wrapping scrollable content and fixed footer */}
            <form onSubmit={handleSaveAlarm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Modal Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 modal-content-scroll">
                {/* Alarm Time Input with 12-hour AM/PM readout */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alarm Time <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 bg-purple-50/40 border border-purple-200 rounded-2xl p-2.5 sm:p-3 focus-within:ring-2 focus-within:ring-purple-500 transition">
                    <input
                      type="time"
                      required
                      value={alarmTime}
                      onChange={(e) => setAlarmTime(e.target.value)}
                      className="flex-1 text-center text-3xl sm:text-4xl font-extrabold font-mono bg-transparent text-purple-950 focus:outline-none tracking-wider"
                    />
                    <div className="text-right border-l border-purple-200 pl-3 shrink-0">
                      <span className="text-xs sm:text-sm font-extrabold text-purple-700 uppercase block font-mono">
                        {formatted12Hour.period}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-semibold block">
                        {formatted12Hour.time12}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Alarm Label / Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alarm Label
                  </label>
                  <input
                    type="text"
                    value={alarmTitle}
                    onChange={(e) => setAlarmTitle(e.target.value)}
                    placeholder="e.g. Morning Wakeup, Deep Work, Workout..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                  />
                </div>

                {/* Link to Pending Task */}
                {pendingTasks.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <ListTodo className="w-3.5 h-3.5 text-purple-600" />
                        Link to Pending Task (Optional)
                      </span>
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        Auto-completes task on alarm dismiss
                      </span>
                    </label>
                    <select
                      value={linkedTaskId}
                      onChange={(e) => setLinkedTaskId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-100 bg-purple-50/30 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer transition"
                    >
                      <option value="">None (Standalone General Alarm)</option>
                      {pendingTasks.map((t) => (
                        <option key={t._id || t.id} value={t._id || t.id}>
                          📌 {t.title} {t.dueDate ? `(Due ${new Date(t.dueDate).toLocaleDateString()})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Repeat Schedule */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Repeat Schedule
                    </label>
                    <div className="flex gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          setAlarmRepeat("never");
                          setSelectedDays(new Set([new Date().getDay()]));
                        }}
                        className={`px-2.5 py-0.5 rounded-lg font-semibold transition cursor-pointer ${
                          alarmRepeat === "never"
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        Once
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAlarmRepeat("daily");
                          setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]));
                        }}
                        className={`px-2.5 py-0.5 rounded-lg font-semibold transition cursor-pointer ${
                          alarmRepeat === "daily"
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        Every Day
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                    {WEEKDAYS.map((day) => {
                      const isSelected = selectedDays.has(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          role="button"
                          aria-pressed={isSelected}
                          aria-label={`Repeat on ${day.name}`}
                          onClick={() => handleToggleDay(day.id)}
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition cursor-pointer ${
                            isSelected
                              ? "bg-purple-600 text-white shadow-xs scale-105"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                          title={day.name}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sound Tone Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alarm Sound Tone
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {SOUND_OPTIONS.map((snd) => {
                      const isSelected = alarmSound === snd.id;
                      const isPreviewing = previewingSound === snd.id;

                      return (
                        <div
                          key={snd.id}
                          onClick={() => setAlarmSound(snd.id)}
                          className={`px-3 py-2 rounded-xl border flex items-center justify-between cursor-pointer transition text-xs ${
                            isSelected
                              ? "border-purple-600 bg-purple-50/70 text-purple-900 shadow-2xs font-bold"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="truncate">{snd.label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewSound(snd.id);
                            }}
                            className={`p-1 rounded-lg text-purple-600 hover:bg-purple-100 transition cursor-pointer shrink-0 ${
                              isPreviewing ? "bg-purple-200 animate-pulse" : ""
                            }`}
                            title="Preview tone"
                          >
                            {isPreviewing ? (
                              <Square className="w-3 h-3 fill-purple-600" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Volume Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      {alarmVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      ) : alarmVolume < 50 ? (
                        <Volume1 className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-purple-600" />
                      )}
                      Alarm Volume
                    </span>
                    <span className="font-mono text-purple-600">{alarmVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={alarmVolume}
                    onChange={(e) => setAlarmVolume(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                {/* Snooze Duration */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Snooze Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 30].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setAlarmSnooze(mins)}
                        className={`py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                          alarmSnooze === mins
                            ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fixed Footer Actions (Always visible on laptops & mobile) */}
              <div className="p-3.5 sm:px-6 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAlarm}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <AlarmClock className="w-4 h-4" />
                  <span>{savingAlarm ? "Saving Alarm..." : "Save Alarm"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AlarmsPage;
