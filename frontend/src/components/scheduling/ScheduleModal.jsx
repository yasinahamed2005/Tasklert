import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Globe,
  X,
  Send,
  Mail,
  Repeat,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  User,
  Users,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { createScheduledDelivery, updateScheduledDelivery } from "../../services/unifiedScheduleApi";

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(GMT+05:30) India Standard Time - IST" },
  { value: "UTC", label: "(GMT+00:00) Coordinated Universal Time - UTC" },
  { value: "America/New_York", label: "(GMT-05:00) Eastern Time - ET" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time - PT" },
  { value: "Europe/London", label: "(GMT+00:00) Greenwich Mean Time - GMT" },
  { value: "Europe/Paris", label: "(GMT+01:00) Central European Time - CET" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Gulf Standard Time - GST" },
  { value: "Asia/Singapore", label: "(GMT+08:00) Singapore Time - SGT" },
  { value: "Asia/Tokyo", label: "(GMT+09:00) Japan Standard Time - JST" },
];

const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Unified QuickSend 2.0 Schedule Modal & Mobile Bottom Sheet
 * Supports Tasklert Mail, Google Mail, and Telegram
 */
export default function ScheduleModal({
  isOpen,
  onClose,
  initialChannel = "telegram",
  initialRecipient = "",
  initialRecipientName = "",
  initialSubject = "",
  initialMessage = "",
  peerType = "user",
  editingItem = null,
  onScheduledSuccess,
}) {
  const [channel, setChannel] = useState(initialChannel);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [recipientName, setRecipientName] = useState(initialRecipientName);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [priority, setPriority] = useState("normal");
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [repeatType, setRepeatType] = useState("none");

  // Date and Time calculation (default: tomorrow at 10:00 AM)
  const defaultDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const [dateStr, setDateStr] = useState(defaultDateStr);
  const [timeStr, setTimeStr] = useState("10:00");
  const [timePeriod, setTimePeriod] = useState("AM"); // "AM" | "PM"

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync state when modal opens or editingItem changes
  useEffect(() => {
    if (editingItem) {
      setChannel(editingItem.channel || "telegram");
      setRecipient(editingItem.recipient || "");
      setRecipientName(editingItem.recipientName || "");
      setSubject(editingItem.subject || "");
      setMessage(editingItem.message || "");
      setPriority(editingItem.priority || "normal");
      setTimeZone(editingItem.timeZone || "Asia/Kolkata");
      setRepeatType(editingItem.repeat?.type || "none");

      if (editingItem.scheduledAt) {
        const d = new Date(editingItem.scheduledAt);
        setDateStr(d.toISOString().split("T")[0]);
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, "0");
        const period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        setTimeStr(`${hours.toString().padStart(2, "0")}:${minutes}`);
        setTimePeriod(period);
      }
    } else if (isOpen) {
      setChannel(initialChannel || "telegram");
      setRecipient(initialRecipient || "");
      setRecipientName(initialRecipientName || "");
      setSubject(initialSubject || "");
      setMessage(initialMessage || "");
      setPriority("normal");
      setTimeZone("Asia/Kolkata");
      setRepeatType("none");
      setDateStr(defaultDateStr);
      setTimeStr("10:00");
      setTimePeriod("AM");
      setErrorMsg(null);
    }
  }, [isOpen, editingItem, initialChannel, initialRecipient, initialRecipientName, initialSubject, initialMessage, defaultDateStr]);

  if (!isOpen) return null;

  // Max characters depending on channel
  const maxChars = channel === "telegram" ? 4096 : 10000;
  const currentChars = message.length;

  const handleTimePeriodToggle = (period) => {
    setTimePeriod(period);
  };

  const handleQuickPreset = (preset) => {
    const d = new Date();
    if (preset === "later_today") {
      d.setHours(d.getHours() + 3);
      setDateStr(d.toISOString().split("T")[0]);
      let h = d.getHours();
      const p = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setTimeStr(`${h.toString().padStart(2, "0")}:00`);
      setTimePeriod(p);
    } else if (preset === "tomorrow_morning") {
      d.setDate(d.getDate() + 1);
      setDateStr(d.toISOString().split("T")[0]);
      setTimeStr("09:00");
      setTimePeriod("AM");
    } else if (preset === "tomorrow_evening") {
      d.setDate(d.getDate() + 1);
      setDateStr(d.toISOString().split("T")[0]);
      setTimeStr("05:00");
      setTimePeriod("PM");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recipient.trim()) {
      setErrorMsg("Please provide a valid recipient.");
      return;
    }

    if (["tasklert_mail", "google_mail"].includes(channel)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipient.trim())) {
        setErrorMsg("Please enter a valid recipient email address.");
        return;
      }
    }

    if (!message.trim()) {
      setErrorMsg("Message body cannot be empty.");
      return;
    }

    // Construct target UTC date from dateStr + timeStr + timePeriod
    const [hRaw, mRaw] = (timeStr || "10:00").split(":");
    let hours = parseInt(hRaw, 10);
    const minutes = parseInt(mRaw, 10);

    if (timePeriod === "PM" && hours < 12) hours += 12;
    if (timePeriod === "AM" && hours === 12) hours = 0;

    const scheduledDateObj = new Date(`${dateStr}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`);

    if (isNaN(scheduledDateObj.getTime())) {
      setErrorMsg("Please select a valid date and time.");
      return;
    }

    if (scheduledDateObj.getTime() <= Date.now() + 15000) {
      setErrorMsg("Scheduled delivery time must be at least 15 seconds in the future.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        channel,
        recipient: recipient.trim(),
        recipientName: recipientName.trim() || recipient.trim(),
        peerType,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        scheduledAt: scheduledDateObj.toISOString(),
        timeZone,
        repeat: { type: repeatType },
      };

      if (editingItem?._id) {
        await updateScheduledDelivery(editingItem._id, payload);
        toast.success("Scheduled delivery updated successfully.");
      } else {
        const res = await createScheduledDelivery(payload);
        toast.success(`Message scheduled successfully for ${dateStr} at ${timeStr} ${timePeriod}.`);
        if (payload.channel === "telegram") {
          window.dispatchEvent(
            new CustomEvent("tasklert:telegram-scheduled", {
              detail: {
                delivery: res?.delivery || {
                  ...payload,
                  _id: res?.delivery?._id || `del_${Date.now()}`,
                  createdAt: new Date().toISOString(),
                  status: "scheduled",
                },
              },
            })
          );
        }
      }

      onScheduledSuccess?.();
      onClose();
    } catch (err) {
      console.error("Scheduling error:", err);
      const msg = err.response?.data?.message || err.message || "Failed to schedule delivery.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overscroll-none animate-fadeIn">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Box */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-purple-100 shadow-2xl flex flex-col max-h-[92vh] max-h-[92dvh] overflow-hidden z-10 animate-slideUp">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                <span>{editingItem ? "Edit Schedule" : "Schedule Message"}</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {channel === "telegram"
                  ? "Schedule a Telegram message for later delivery."
                  : channel === "google_mail"
                  ? "Schedule an email via your connected Google Mail."
                  : "Schedule a professional email via Tasklert Mail."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs sm:text-sm">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Channel Selector / Send via Dropdown */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Send via</label>
            <div className="relative">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={Boolean(editingItem)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition cursor-pointer pr-9"
              >
                <option value="telegram">Telegram {recipientName ? `(${recipientName})` : ""}</option>
                <option value="google_mail">Google Mail (Gmail API)</option>
                <option value="tasklert_mail">Tasklert Mail (Pro Verified Delivery)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 2. Recipient Input / Chip */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">To</label>
            {channel === "telegram" && recipientName ? (
              <div className="flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-bold text-purple-900">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>{recipientName}</span>
                  {peerType === "chat" && <span className="text-[10px] text-purple-500 font-normal">(Group)</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecipient("");
                    setRecipientName("");
                  }}
                  className="text-purple-400 hover:text-purple-700 transition"
                  title="Clear recipient"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <input
                type={channel === "telegram" ? "text" : "email"}
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  if (!recipientName) setRecipientName(e.target.value);
                }}
                placeholder={
                  channel === "telegram"
                    ? "Enter Telegram username or chat ID..."
                    : "recipient@example.com"
                }
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                required
              />
            )}
          </div>

          {/* 3. Subject (for Tasklert Mail and Google Mail) */}
          {["tasklert_mail", "google_mail"].includes(channel) && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject of the email"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                required
              />
            </div>
          )}

          {/* 4. Priority (for Tasklert Mail) */}
          {channel === "tasklert_mail" && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "normal", label: "Normal" },
                  { id: "important", label: "Important" },
                  { id: "action_required", label: "Action Required" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      priority === p.id
                        ? "bg-purple-100 border-purple-400 text-purple-900"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Message Body with Character Counter */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700">Message *</label>
              <span className={`text-[11px] font-mono ${currentChars > maxChars ? "text-rose-600 font-bold" : "text-gray-400"}`}>
                {currentChars} / {maxChars}
              </span>
            </div>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message to be delivered at the scheduled time..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition resize-none"
              required
            />
          </div>

          {/* 6. Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handleQuickPreset("later_today")}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 text-[11px] font-semibold text-gray-700 hover:text-purple-800 transition cursor-pointer"
            >
              Later Today (+3h)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset("tomorrow_morning")}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 text-[11px] font-semibold text-gray-700 hover:text-purple-800 transition cursor-pointer"
            >
              Tomorrow 9:00 AM
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset("tomorrow_evening")}
              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-purple-100 text-[11px] font-semibold text-gray-700 hover:text-purple-800 transition cursor-pointer"
            >
              Tomorrow 5:00 PM
            </button>
          </div>

          {/* 7. Date & Time Selection (Side by Side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span>Date *</span>
              </label>
              <input
                type="date"
                value={dateStr}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Time *</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                  required
                />
                <div className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTimePeriodToggle("AM")}
                    className={`px-2 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      timePeriod === "AM" ? "bg-purple-600 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTimePeriodToggle("PM")}
                    className={`px-2 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      timePeriod === "PM" ? "bg-purple-600 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 8. Timezone Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              <span>Timezone</span>
            </label>
            <div className="relative">
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-900 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition cursor-pointer pr-9"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 9. Repeat Option */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
              <Repeat className="w-3.5 h-3.5 text-purple-600" />
              <span>Repeat (Optional)</span>
            </label>
            <div className="relative">
              <select
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2 text-xs sm:text-sm font-medium text-gray-900 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition cursor-pointer pr-9"
              >
                {REPEAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 10. Confirmation Card Preview */}
          <div className="rounded-xl border border-purple-200/90 bg-gradient-to-br from-purple-50/90 to-indigo-50/60 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-purple-900">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Delivery Confirmation</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Your message will be delivered via{" "}
              <strong className="text-purple-900">
                {channel === "telegram"
                  ? "Telegram"
                  : channel === "google_mail"
                  ? "Google Mail"
                  : "Tasklert Mail"}
              </strong>{" "}
              to <strong className="text-gray-900">{recipientName || recipient || "selected recipient"}</strong> on{" "}
              <strong className="text-purple-900">
                {dateStr} at {timeStr} {timePeriod} ({timeZone})
              </strong>
              .
            </p>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 pb-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-600/25 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>{editingItem ? "Update Schedule" : "Schedule"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

