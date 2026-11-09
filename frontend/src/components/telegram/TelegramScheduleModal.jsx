import React, { useState } from "react";
import {
  Calendar,
  Clock,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { scheduleTelegramMessage } from "../../services/telegramApi";
import { toast } from "react-toastify";

export default function TelegramScheduleModal({
  isOpen,
  onClose,
  activeChat,
  initialMessage = "",
  onScheduledSuccess,
}) {
  const [message, setMessage] = useState(initialMessage);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (isOpen && initialMessage) {
      setMessage(initialMessage);
    }
  }, [isOpen, initialMessage]);

  if (!isOpen) return null;

  // Calculate default 1 hour from now formatted for datetime-local
  const getDefaultTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!activeChat?.id) {
      setError("Please select a recipient chat first.");
      return;
    }
    if (!message.trim()) {
      setError("Please write a message to schedule.");
      return;
    }
    if (!scheduledAt) {
      setError("Please choose a date and time in the future.");
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      setError("The scheduled time must be in the future.");
      return;
    }

    setLoading(true);
    try {
      const scheduled = await scheduleTelegramMessage({
        peerId: activeChat.id,
        peerType: activeChat.type || "user",
        recipientName: activeChat.title || "Telegram Contact",
        recipientHandle: activeChat.username ? `@${activeChat.username}` : activeChat.phone || "",
        message: message.trim(),
        scheduledAt: scheduledDate.toISOString(),
      });

      toast.success(`Message scheduled for ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      window.dispatchEvent(
        new CustomEvent("tasklert:telegram-scheduled", {
          detail: {
            delivery: {
              _id: scheduled?._id || `tg_sched_${Date.now()}`,
              channel: "telegram",
              recipient: activeChat.id,
              recipientName: activeChat.title,
              recipientHandle: activeChat.username ? `@${activeChat.username}` : "",
              message: message.trim(),
              scheduledAt: scheduledDate.toISOString(),
              createdAt: new Date().toISOString(),
              status: "scheduled",
            },
          },
        })
      );
      if (onScheduledSuccess) onScheduledSuccess(scheduled);
      onClose();
      setMessage("");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to schedule message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-purple-100/80 flex items-center justify-between bg-purple-50/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Schedule Telegram Message</h3>
              <p className="text-[11px] text-gray-500 font-medium">Automatic background dispatch</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Recipient
            </label>
            <div className="p-2.5 rounded-2xl bg-purple-50/50 border border-purple-100 text-xs font-semibold text-gray-800 flex items-center justify-between">
              <span>{activeChat?.title || "No chat selected"}</span>
              <span className="text-[10px] text-purple-600 font-mono capitalize">
                {activeChat?.type || "chat"}
              </span>
            </div>
          </div>

          {/* Message Text */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Message Content
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message you want to send automatically..."
              required
              className="w-full p-3 rounded-2xl border border-purple-100 bg-white text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs resize-none"
            />
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Scheduled Date & Time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={scheduledAt || getDefaultTime()}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
                className="w-full px-3.5 py-2.5 rounded-2xl border border-purple-100 bg-white text-xs text-gray-800 focus:border-purple-600 focus:outline-none transition shadow-2xs"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Tasklert background worker dispatches this message even if your browser is closed.
            </p>
          </div>

          {/* Footer Controls */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Confirm Schedule
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
