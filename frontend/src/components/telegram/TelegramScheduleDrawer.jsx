import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  XCircle,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Send,
} from "lucide-react";
import {
  fetchTelegramScheduledMessages,
  cancelTelegramScheduledMessage,
} from "../../services/telegramApi";
import { toast } from "react-toastify";

export default function TelegramScheduleDrawer({
  onOpenScheduleModal,
  refreshTrigger,
}) {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadScheduled = () => {
    setLoading(true);
    fetchTelegramScheduledMessages()
      .then((data) => setScheduled(data))
      .catch((err) => console.warn("Failed to load scheduled messages:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadScheduled();
  }, [refreshTrigger]);

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this scheduled message?")) return;
    try {
      await cancelTelegramScheduledMessage(id);
      setScheduled((prev) =>
        prev.map((m) => (m._id === id ? { ...m, status: "cancelled" } : m))
      );
      toast.info("Scheduled message cancelled.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel message.");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "scheduled":
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold">
            Scheduled
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-bold flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Sending...
          </span>
        );
      case "sent":
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Sent
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 text-[10px] font-bold">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <aside className="border-l border-purple-100/80 bg-white flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-purple-100 flex items-center justify-between bg-purple-50/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-600" />
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Scheduled Queue
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="p-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
            title="Schedule New Message"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadScheduled}
            disabled={loading}
            className="p-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Scheduled Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading && scheduled.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
            <span className="text-[11px] text-gray-500">Checking scheduled queue...</span>
          </div>
        ) : scheduled.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-gray-800">No scheduled messages</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Schedule messages to contacts or groups for automatic background dispatch.
            </p>
          </div>
        ) : (
          scheduled.map((item) => (
            <div
              key={item._id}
              className="p-3 rounded-2xl border border-purple-100/80 bg-purple-50/20 hover:border-purple-200 transition space-y-2"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs font-bold text-gray-900 truncate">
                  {item.recipientName}
                </div>
                {getStatusBadge(item.status)}
              </div>

              <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                {item.message}
              </p>

              <div className="pt-1.5 border-t border-purple-100/60 flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1 font-medium text-purple-700">
                  <Clock className="w-3 h-3" />
                  {new Date(item.scheduledAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                {item.status === "scheduled" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(item._id)}
                    className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
