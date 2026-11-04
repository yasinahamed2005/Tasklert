import React, { useState, useEffect, useRef } from "react";
import { format, parse } from "date-fns";
import {
  Bell,
  BellOff,
  Clock,
  Calendar as CalendarIcon,
  Repeat,
  Volume2,
  VolumeX,
  Vibrate,
  FileText,
  Trash2,
  X,
  Check,
  Play,
  Square,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { deviceAlarmManager } from "../../utils/deviceAlarmManager";
import { useModalAccessibility } from "../../utils/scrollLock";

const SOUND_OPTIONS = [
  { id: "digital", label: "Tasklert Digital Pulse", desc: "Crisp modern electronic beep" },
  { id: "classic", label: "Classic Twin-Bell", desc: "Mechanical twin-bell ringing" },
  { id: "chime", label: "Gentle Crystal Chime", desc: "Peaceful 4-note chime" },
  { id: "bell", label: "Morning Harmonic Bell", desc: "Warm resonant morning bell" },
  { id: "soft", label: "Soft Ascending Reminder", desc: "Subtle 2-note reminder" },
  { id: "default", label: "Device Default Alarm", desc: "Standard system alert" },
];

const REPEAT_OPTIONS = [
  { id: "never", label: "Never (One-time)" },
  { id: "daily", label: "Every Day" },
  { id: "weekly", label: "Every Week" },
  { id: "monthly", label: "Every Month" },
  { id: "yearly", label: "Every Year" },
  { id: "custom", label: "Custom Interval..." },
];

const SNOOZE_PRESETS = [5, 10, 15, 30];

const ReminderModal = ({
  isOpen,
  onClose,
  initialDate,
  reminderToEdit,
  onReminderSaved,
  onReminderDeleted,
}) => {
  const modalRef = useRef(null);

  // Form states
  const [title, setTitle] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeHour, setTimeHour] = useState("09");
  const [timeMinute, setTimeMinute] = useState("00");
  const [timeAmPm, setTimeAmPm] = useState("AM");

  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [sound, setSound] = useState("digital");
  const [repeat, setRepeat] = useState("never");
  const [customDays, setCustomDays] = useState(2);
  const [snoozeDuration, setSnoozeDuration] = useState(5);
  const [isCustomSnooze, setIsCustomSnooze] = useState(false);
  const [customSnoozeMinutes, setCustomSnoozeMinutes] = useState(20);
  const [notes, setNotes] = useState("");

  // UI state
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useModalAccessibility({
    isOpen,
    onClose: () => {
      deviceAlarmManager.stopSound();
      onClose();
    },
    modalRef,
  });

  // Populate form on open or when editing
  useEffect(() => {
    if (!isOpen) {
      deviceAlarmManager.stopSound();
      setIsPlayingSound(false);
      return;
    }

    setErrorMsg("");

    if (reminderToEdit) {
      // Editing existing reminder
      setTitle(reminderToEdit.title || "");
      setNotes(reminderToEdit.notes || reminderToEdit.message || "");
      setAlarmEnabled(reminderToEdit.alarmEnabled !== false);
      setNotificationEnabled(reminderToEdit.notificationEnabled !== false);
      setVibrationEnabled(reminderToEdit.vibrationEnabled !== false);
      setSound(reminderToEdit.sound || reminderToEdit.soundType || "digital");
      setRepeat(reminderToEdit.repeat || "never");

      const snoozeVal = reminderToEdit.snoozeDuration || 5;
      if (SNOOZE_PRESETS.includes(snoozeVal)) {
        setSnoozeDuration(snoozeVal);
        setIsCustomSnooze(false);
      } else {
        setIsCustomSnooze(true);
        setCustomSnoozeMinutes(snoozeVal);
      }

      // Parse date & time
      let d = reminderToEdit.scheduledAt ? new Date(reminderToEdit.scheduledAt) : new Date();
      if (isNaN(d.getTime())) d = new Date();

      setDateStr(format(d, "yyyy-MM-dd"));
      let h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;

      setTimeHour(String(h).padStart(2, "0"));
      setTimeMinute(String(m).padStart(2, "0"));
      setTimeAmPm(ampm);
    } else {
      // Creating new reminder
      setTitle("");
      setNotes("");
      setAlarmEnabled(true);
      setNotificationEnabled(true);
      setVibrationEnabled(true);
      setSound("digital");
      setRepeat("never");
      setSnoozeDuration(5);
      setIsCustomSnooze(false);

      // Default date from calendar selection or today
      const baseDate = initialDate ? new Date(initialDate) : new Date();
      setDateStr(format(isNaN(baseDate.getTime()) ? new Date() : baseDate, "yyyy-MM-dd"));

      // Default time: next hour or 09:00 AM
      const now = new Date();
      let nextH = now.getHours() + 1;
      const ampm = nextH >= 12 && nextH < 24 ? "PM" : "AM";
      nextH = nextH % 12 || 12;
      setTimeHour(String(nextH).padStart(2, "0"));
      setTimeMinute("00");
      setTimeAmPm(ampm);
    }
  }, [isOpen, reminderToEdit, initialDate]);

  if (!isOpen) return null;

  // Sound preview test
  const handleToggleSoundPreview = () => {
    if (isPlayingSound) {
      deviceAlarmManager.stopSound();
      setIsPlayingSound(false);
    } else {
      setIsPlayingSound(true);
      deviceAlarmManager.previewSound(sound);
      setTimeout(() => {
        setIsPlayingSound(false);
      }, 3500);
    }
  };

  // Vibration test
  const handleTestVibration = () => {
    deviceAlarmManager.testVibration();
  };

  // Compute live recurrence description
  const getRecurrenceText = () => {
    const formattedTime = `${timeHour}:${timeMinute} ${timeAmPm}`;
    if (repeat === "never") return `Rings once at ${formattedTime}`;
    if (repeat === "daily") return `Rings every day at ${formattedTime}`;
    if (repeat === "weekly") {
      try {
        const d = parse(dateStr, "yyyy-MM-dd", new Date());
        return `Rings every week on ${format(d, "EEEE")} at ${formattedTime}`;
      } catch {
        return `Rings weekly at ${formattedTime}`;
      }
    }
    if (repeat === "monthly") return `Rings monthly on this day at ${formattedTime}`;
    if (repeat === "yearly") return `Rings every year on this date at ${formattedTime}`;
    if (repeat === "custom") return `Repeats every ${customDays} days at ${formattedTime}`;
    return "";
  };

  // Build scheduled UTC Date
  const buildScheduledDate = () => {
    if (!dateStr) return null;
    let h = parseInt(timeHour, 10);
    const m = parseInt(timeMinute, 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (timeAmPm === "PM" && h < 12) h += 12;
    if (timeAmPm === "AM" && h === 12) h = 0;

    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day, h, m, 0);
  };

  // Save handler
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Please enter what you want to remember.");
      return;
    }

    const scheduledDateObj = buildScheduledDate();
    if (!scheduledDateObj || isNaN(scheduledDateObj.getTime())) {
      setErrorMsg("Please select a valid date and time.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        title: title.trim(),
        notes: notes.trim(),
        message: notes.trim(),
        scheduledAt: scheduledDateObj.toISOString(),
        scheduledDate: dateStr,
        scheduledTime: `${timeHour}:${timeMinute} ${timeAmPm}`,
        alarmEnabled,
        notificationEnabled,
        vibrationEnabled,
        sound,
        soundType: sound,
        repeat,
        recurrence: {
          frequency: repeat,
          interval: repeat === "custom" ? Number(customDays) : 1,
        },
        snoozeDuration: isCustomSnooze ? Number(customSnoozeMinutes) : Number(snoozeDuration),
        source: "calendar_reminder",
        channels: {
          push: notificationEnabled,
          inApp: true,
          email: false,
        },
      };

      let savedReminder;
      if (reminderToEdit?._id) {
        // Update existing
        const res = await axios.put(
          `${API_BASE_URL}/api/reminders/${reminderToEdit._id}`,
          payload,
          { headers }
        );
        savedReminder = res.data.reminder;
      } else {
        // Create new
        const res = await axios.post(
          `${API_BASE_URL}/api/reminders`,
          payload,
          { headers }
        );
        savedReminder = res.data.reminder;
      }

      // Schedule real exact alarm on device / browser
      if (alarmEnabled) {
        await deviceAlarmManager.scheduleAlarm(savedReminder);
        // Request system permissions smoothly in background
        deviceAlarmManager.requestNotificationPermission().catch(() => {});
      } else {
        deviceAlarmManager.cancelAlarm(savedReminder._id);
      }

      deviceAlarmManager.stopSound();
      onReminderSaved?.(savedReminder);
      onClose();
    } catch (err) {
      console.error("Failed to save reminder:", err);
      setErrorMsg(err.response?.data?.message || err.message || "Failed to save reminder.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!reminderToEdit?._id) return;
    if (!window.confirm("Are you sure you want to delete this reminder?")) return;

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_BASE_URL}/api/reminders/${reminderToEdit._id}`, { headers });

      deviceAlarmManager.cancelAlarm(reminderToEdit._id);
      deviceAlarmManager.stopSound();
      onReminderDeleted?.(reminderToEdit._id);
      onClose();
    } catch (err) {
      console.error("Failed to delete reminder:", err);
      setErrorMsg(err.response?.data?.message || err.message || "Failed to delete reminder.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-modal-title"
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-purple-100 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-gray-800"
      >
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-purple-50 flex items-center justify-between bg-gradient-to-r from-purple-50/70 via-white to-purple-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm shadow-purple-300">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2
                id="reminder-modal-title"
                className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-1.5"
              >
                {reminderToEdit ? "Edit Reminder & Alarm" : "Create Reminder & Alarm"}
              </h2>
              <p className="text-xs text-purple-600 font-medium">
                Samsung-inspired exact device alerts & calendar alarms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              deviceAlarmManager.stopSound();
              onClose();
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR NOTIFICATION */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SCROLLABLE FORM BODY */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* FIELD 1: TITLE */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5">
              Reminder Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you want to remember?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden transition-all text-gray-900 text-sm font-medium placeholder:text-gray-400"
            />
          </div>

          {/* FIELD 2 & 3: DATE & TIME */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* DATE PICKER */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-purple-600" /> Date
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm text-gray-800 font-medium"
              />
            </div>

            {/* TIME PICKER */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" /> Time
              </label>
              <div className="flex items-center gap-1.5">
                {/* Hour */}
                <select
                  value={timeHour}
                  onChange={(e) => setTimeHour(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm font-semibold bg-white text-gray-800"
                >
                  {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-bold text-gray-400">:</span>
                {/* Minute */}
                <select
                  value={timeMinute}
                  onChange={(e) => setTimeMinute(e.target.value)}
                  className="flex-1 px-2.5 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm font-semibold bg-white text-gray-800"
                >
                  {["00", "05", "10", "15", "20", "25", "30", "35", "40", "41", "42", "45", "50", "55"].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    )
                  )}
                </select>
                {/* AM / PM */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => setTimeAmPm("AM")}
                    className={`px-2.5 py-2 text-xs font-bold transition-colors ${
                      timeAmPm === "AM"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeAmPm("PM")}
                    className={`px-2.5 py-2 text-xs font-bold transition-colors ${
                      timeAmPm === "PM"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* FIELD 4 & 5 & 8: TOGGLE SWITCHES (Alarm, Notification, Vibration) */}
          <div className="bg-purple-50/60 rounded-2xl p-3 border border-purple-100 space-y-2.5">
            {/* ALARM TOGGLE */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${alarmEnabled ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Phone Alarm Ringtone</span>
                  <span className="text-[11px] text-gray-500">
                    {alarmEnabled ? "Rings aloud like an alarm clock" : "Alarm sound is muted"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlarmEnabled(!alarmEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  alarmEnabled ? "bg-purple-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    alarmEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* NOTIFICATION TOGGLE */}
            <div className="flex items-center justify-between pt-2 border-t border-purple-100/60">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${notificationEnabled ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Device Notification</span>
                  <span className="text-[11px] text-gray-500">
                    {notificationEnabled ? "High-priority heads-up banner" : "No pop-up notification"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotificationEnabled(!notificationEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notificationEnabled ? "bg-purple-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notificationEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* VIBRATION TOGGLE & PREVIEW */}
            <div className="flex items-center justify-between pt-2 border-t border-purple-100/60">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${vibrationEnabled ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                  <Vibrate className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Vibration Pattern</span>
                  <span className="text-[11px] text-gray-500">
                    {vibrationEnabled ? "Vibrate on alert" : "Vibration off"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {vibrationEnabled && (
                  <button
                    type="button"
                    onClick={handleTestVibration}
                    className="text-[11px] font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2 py-0.5 rounded-md transition-colors"
                  >
                    Test
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVibrationEnabled(!vibrationEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    vibrationEnabled ? "bg-purple-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      vibrationEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* FIELD 6: REPEAT REMINDER */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-purple-600" /> Repeat
            </label>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm bg-white text-gray-800 font-medium"
            >
              {REPEAT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Custom repeat days input */}
            {repeat === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-600">Every</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center font-bold"
                />
                <span className="text-xs text-gray-600">days</span>
              </div>
            )}

            {/* Recurrence live preview pill */}
            <div className="mt-1.5 text-xs text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-purple-100">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>{getRecurrenceText()}</span>
            </div>
          </div>

          {/* FIELD 7: REMINDER SOUND & AUDITION TEST */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-purple-600" /> Sound & Ringtone
              </label>
              <button
                type="button"
                onClick={handleToggleSoundPreview}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                  isPlayingSound
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                }`}
              >
                {isPlayingSound ? (
                  <>
                    <Square className="w-3 h-3 fill-current" /> Stop
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Test Sound
                  </>
                )}
              </button>
            </div>
            <select
              value={sound}
              onChange={(e) => {
                setSound(e.target.value);
                if (isPlayingSound) {
                  deviceAlarmManager.stopSound();
                  setIsPlayingSound(false);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm bg-white text-gray-800 font-medium"
            >
              {SOUND_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.desc})
                </option>
              ))}
            </select>
          </div>

          {/* FIELD 9: SNOOZE OPTIONS */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5">
              Snooze Duration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SNOOZE_PRESETS.map((m) => {
                const active = !isCustomSnooze && snoozeDuration === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setIsCustomSnooze(false);
                      setSnoozeDuration(m);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                      active
                        ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {m} min
                  </button>
                );
              })}
            </div>
          </div>

          {/* FIELD 10: REMINDER NOTES */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-800 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-600" /> Notes & Context (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add extra details, reminders or links..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-hidden text-sm text-gray-800 placeholder:text-gray-400 resize-none"
            />
          </div>
        </form>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          {reminderToEdit?._id ? (
            <button
              type="button"
              disabled={isDeleting || isSaving}
              onClick={handleDelete}
              className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeleting ? "Deleting..." : "Delete"}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                deviceAlarmManager.stopSound();
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-98 rounded-xl shadow-md shadow-purple-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : reminderToEdit ? "Update Reminder" : "Save Reminder"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderModal;

