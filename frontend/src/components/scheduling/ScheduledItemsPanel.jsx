import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  Plus,
  Send,
  Mail,
  MoreVertical,
  Clock,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchScheduledDeliveries,
  fetchScheduledStats,
  cancelScheduledDelivery,
  duplicateScheduledDelivery,
} from "../../services/unifiedScheduleApi";

/**
 * ScheduledItemsPanel — Desktop right-side panel matching the exact QuickSend 2.0 design
 */
export default function ScheduledItemsPanel({
  onOpenNewSchedule,
  onEditSchedule,
  refreshTrigger = 0,
}) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "tasklert_mail" | "google_mail" | "telegram"
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    tasklertMailCount: 0,
    googleMailCount: 0,
    telegramCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deliveriesRes, statsRes] = await Promise.all([
        fetchScheduledDeliveries({ channel: activeTab, status: "scheduled", limit: 30 }),
        fetchScheduledStats(),
      ]);

      setItems(deliveriesRes?.deliveries || []);
      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err) {
      console.error("Failed to load scheduled items:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleCancel = async (id, e) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!window.confirm("Are you sure you want to cancel this scheduled delivery?")) return;

    try {
      await cancelScheduledDelivery(id);
      toast.success("Delivery cancelled successfully.");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel delivery.");
    }
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      await duplicateScheduledDelivery(id);
      toast.success("Scheduled delivery duplicated.");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to duplicate.");
    }
  };

  const formatDateDisplay = (dateStr, tz = "IST") => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const day = d.getDate().toString().padStart(2, "0");
      const year = d.getFullYear();

      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      const hourStr = hours.toString().padStart(2, "0");

      return `${month} ${day}, ${year} | ${hourStr}:${minutes} ${ampm} (${tz.includes("Kolkata") || tz === "IST" ? "IST" : "UTC"})`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-80 lg:w-92 xl:w-96 h-full flex flex-col bg-white rounded-2xl border border-purple-100 shadow-xs overflow-hidden shrink-0">
      {/* 1. Header Bar */}
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">Scheduled Items</h3>
        </div>

        <button
          type="button"
          onClick={onOpenNewSchedule}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-2xs shadow-purple-600/20 transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Schedule</span>
        </button>
      </div>

      {/* 2. Channel Filter Tabs */}
      <div className="px-3 pt-2.5 pb-1 border-b border-gray-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 bg-gray-50/50">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "all"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          All ({stats.totalCount || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasklert_mail")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "tasklert_mail"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Tasklert Mail ({stats.tasklertMailCount || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("google_mail")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "google_mail"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Google Mail ({stats.googleMailCount || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("telegram")}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "telegram"
              ? "bg-purple-600 text-white shadow-2xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Telegram ({stats.telegramCount || 0})
        </button>
      </div>

      {/* 3. Items List Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scroll-smooth">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
            <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading scheduled deliveries...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 px-4 text-center text-gray-400">
            <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-700">No scheduled deliveries</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Click &quot;+ New Schedule&quot; to plan an upcoming message or email.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isTelegram = item.channel === "telegram";
            const isTasklertMail = item.channel === "tasklert_mail";
            const isGoogleMail = item.channel === "google_mail";

            return (
              <div
                key={item._id}
                className="relative group p-3 rounded-xl border border-gray-100 bg-white hover:border-purple-200 hover:shadow-xs transition-all duration-150"
              >
                {/* Top Row: Channel Icon + Title + Status + 3-dots */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Channel Icon Badge */}
                    {isTelegram && (
                      <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Send className="w-3 h-3 -rotate-12 translate-x-px" />
                      </div>
                    )}
                    {isGoogleMail && (
                      <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {isTasklertMail && (
                      <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-gray-900 truncate">
                        {isTelegram && `Telegram • ${item.recipientName || "Contact"}`}
                        {isGoogleMail && (item.recipientName ? `Google Mail • ${item.recipientName}` : "Google Mail")}
                        {isTasklertMail && `Tasklert Mail • ${item.recipientName || item.recipient}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold">
                      Scheduled
                    </span>

                    {/* 3-dots Action Menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === item._id ? null : item._id);
                        }}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                        aria-label="Actions"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuId === item._id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-6 z-30 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-xs text-gray-700 animate-fadeIn"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                              onEditSchedule?.(item);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-purple-50 hover:text-purple-700 transition text-left cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-purple-600" />
                            <span>Edit / Reschedule</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(item._id, e)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition text-left cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-gray-500" />
                            <span>Duplicate</span>
                          </button>

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            type="button"
                            onClick={(e) => handleCancel(item._id, e)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-50 text-rose-600 transition text-left cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 text-rose-500" />
                            <span>Cancel Schedule</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subject or Snippet */}
                {item.subject && (
                  <div className="text-xs font-semibold text-gray-800 truncate mb-0.5">
                    {item.subject}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed mb-2 font-normal">
                  {item.message}
                </p>

                {/* Bottom Row: Scheduled Date & Time Badge */}
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 pt-1.5 border-t border-gray-50">
                  <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                  <span>{formatDateDisplay(item.scheduledAt, item.timeZone)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

