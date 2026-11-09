import React, { useState } from "react";
import {
  Clock,
  Calendar,
  Send,
  Trash2,
  Edit3,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  updateScheduledDelivery,
  cancelScheduledDelivery,
  sendNowScheduledDelivery,
} from "../../services/unifiedScheduleApi";
import { toast } from "react-toastify";

export default function TelegramScheduledMenuModal({
  isOpen,
  onClose,
  scheduledItem,
  onUpdated,
  onCancelled,
  onSentNow,
}) {
  const [activeTab, setActiveTab] = useState("menu"); // "menu" | "edit" | "reschedule" | "details"
  const [editText, setEditText] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!isOpen || !scheduledItem) return null;

  // Initialize edit fields when switching tabs
  const handleStartEdit = () => {
    setEditText(scheduledItem.text || scheduledItem.message || "");
    setActiveTab("edit");
  };

  const handleStartReschedule = () => {
    const target = new Date(scheduledItem.scheduledAt || Date.now() + 3600000);
    const dStr = target.toISOString().split("T")[0];
    const h = String(target.getHours()).padStart(2, "0");
    const m = String(target.getMinutes()).padStart(2, "0");
    setNewDate(dStr);
    setNewTime(`${h}:${m}`);
    setActiveTab("reschedule");
  };

  // 1. Save Edited Message
  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      setErrorMsg("Message body cannot be empty.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const id = scheduledItem.scheduledId || scheduledItem._id;
      const res = await updateScheduledDelivery(id, { message: editText.trim() });
      toast.success("Scheduled message updated.");
      onUpdated?.(res.delivery || { ...scheduledItem, text: editText.trim(), message: editText.trim() });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to update message.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Save Rescheduled Date/Time
  const handleSaveReschedule = async () => {
    if (!newDate || !newTime) {
      setErrorMsg("Please select both date and time.");
      return;
    }
    const [hrs, mins] = newTime.split(":").map(Number);
    const target = new Date(newDate);
    target.setHours(hrs, mins, 0, 0);

    if (target.getTime() <= Date.now() + 10000) {
      setErrorMsg("Rescheduled time must be at least 10 seconds in the future.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const id = scheduledItem.scheduledId || scheduledItem._id;
      const res = await updateScheduledDelivery(id, { scheduledAt: target.toISOString() });
      toast.success("Delivery rescheduled successfully.");
      onUpdated?.(res.delivery || { ...scheduledItem, scheduledAt: target.toISOString() });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to reschedule.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Send Now
  const handleSendNow = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const id = scheduledItem.scheduledId || scheduledItem._id;
      const res = await sendNowScheduledDelivery(id);
      toast.success("Message dispatched to Telegram!");
      onSentNow?.(res.delivery || scheduledItem);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to deliver message immediately.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Cancel Schedule
  const handleCancelSchedule = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const id = scheduledItem.scheduledId || scheduledItem._id;
      await cancelScheduledDelivery(id);
      toast.info("Scheduled message cancelled.");
      onCancelled?.(id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to cancel schedule.");
    } finally {
      setLoading(false);
    }
  };

  const formattedScheduled = (() => {
    try {
      const d = new Date(scheduledItem.scheduledAt);
      return d.toLocaleString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-purple-100 dark:border-slate-800 w-full max-w-sm sm:max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-purple-100 dark:border-slate-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                Scheduled Message
              </h3>
              <p className="text-[11px] text-purple-600 font-semibold truncate">
                {scheduledItem.status === "failed" ? "Delivery Failed" : "Pending Delivery"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: MAIN ACTION MENU */}
        {activeTab === "menu" && (
          <div className="p-5 space-y-4">
            {/* Scheduled preview card */}
            <div className="p-3.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/60 space-y-2">
              <p className="text-xs text-gray-800 dark:text-gray-200 font-medium leading-relaxed whitespace-pre-wrap break-words">
                "{scheduledItem.text || scheduledItem.message}"
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 pt-1 border-t border-purple-100 dark:border-purple-800/40">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{formattedScheduled}</span>
              </div>
            </div>

            {/* Confirmation Alert for Cancel */}
            {confirmCancel ? (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2.5">
                <p className="font-bold text-rose-900">Cancel this scheduled message?</p>
                <p className="text-rose-700">The message will not be sent to Telegram.</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelSchedule}
                    disabled={loading}
                    className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes, Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition cursor-pointer"
                  >
                    Keep Schedule
                  </button>
                </div>
              </div>
            ) : (
              /* Action Options List */
              <div className="space-y-1.5 text-xs font-semibold">
                {/* 1. Edit Message */}
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-transparent hover:border-purple-200 text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    <span>Edit Message</span>
                  </div>
                  <span className="text-[10px] text-gray-400">&rarr;</span>
                </button>

                {/* 2. Change Date & Time */}
                <button
                  type="button"
                  onClick={handleStartReschedule}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-transparent hover:border-purple-200 text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Change Date & Time</span>
                  </div>
                  <span className="text-[10px] text-gray-400">&rarr;</span>
                </button>

                {/* 3. Send Now */}
                <button
                  type="button"
                  onClick={handleSendNow}
                  disabled={loading}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                    <span className="font-bold">Send Now</span>
                  </div>
                  <span className="text-[10px] opacity-80">Deliver immediately</span>
                </button>

                {/* 4. View Details */}
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-gray-400" />
                    <span>View Details</span>
                  </div>
                  <span className="text-[10px] text-gray-400">&rarr;</span>
                </button>

                {/* 5. Cancel Schedule */}
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-rose-50 text-rose-600 transition cursor-pointer pt-2"
                >
                  <div className="flex items-center gap-2.5">
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Cancel Schedule</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EDIT MESSAGE */}
        {activeTab === "edit" && (
          <div className="p-5 space-y-3.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-200">
              Edit Message Text
            </label>
            <textarea
              rows={4}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded-2xl border border-purple-200 p-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              placeholder="Type your message..."
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("menu")}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: RESCHEDULE DATE & TIME */}
        {activeTab === "reschedule" && (
          <div className="p-5 space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                New Delivery Date
              </label>
              <input
                type="date"
                value={newDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                New Delivery Time
              </label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full rounded-xl border border-gray-200 p-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveReschedule}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Update Schedule"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("menu")}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: VIEW DETAILS */}
        {activeTab === "details" && (
          <div className="p-5 space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-gray-50 space-y-2">
              <div className="flex justify-between text-gray-500">
                <span>Status:</span>
                <span className="font-bold text-purple-700 capitalize">{scheduledItem.status}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Target:</span>
                <span className="font-bold text-gray-800">{scheduledItem.recipientName || scheduledItem.recipient}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Scheduled Time:</span>
                <span className="font-bold text-gray-800">{formattedScheduled}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Timezone:</span>
                <span className="font-bold text-gray-800">{scheduledItem.timeZone || "Asia/Kolkata (IST)"}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Channel:</span>
                <span className="font-bold text-purple-600">Telegram MTProto</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("menu")}
              className="w-full py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold transition cursor-pointer"
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

