import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Send,
  Mail,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit2,
  Trash2,
  Copy,
  Repeat,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchScheduledDeliveries,
  fetchScheduledStats,
  cancelScheduledDelivery,
  duplicateScheduledDelivery,
} from "../../services/unifiedScheduleApi";

export default function ScheduledWorkspace({
  onOpenNewSchedule,
  onEditSchedule,
  refreshTrigger = 0,
}) {
  const [channelFilter, setChannelFilter] = useState("all"); // "all" | "tasklert_mail" | "google_mail" | "telegram"
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "upcoming" | "sent" | "failed" | "cancelled"
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    tasklertMailCount: 0,
    googleMailCount: 0,
    telegramCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
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
        fetchScheduledDeliveries({
          channel: channelFilter,
          status: statusFilter,
          search: searchQuery,
          limit: 100,
        }),
        fetchScheduledStats(),
      ]);

      setItems(deliveriesRes?.deliveries || []);
      if (statsRes) {
        setStats(statsRes);
      }
    } catch (err) {
      console.error("Failed to load scheduled items:", err);
      toast.error("Could not fetch scheduled items.");
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter, searchQuery]);

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
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto scroll-smooth">
      {/* ─── 1. Overview Statistics Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-4 shrink-0">
        <div className="p-3 rounded-2xl bg-white border border-purple-100 shadow-2xs">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Scheduled</p>
          <p className="text-xl font-black text-gray-900 mt-0.5">{stats.totalCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-emerald-100 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Tasklert Mail</p>
          <p className="text-xl font-black text-emerald-950 mt-0.5">{stats.tasklertMailCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-blue-100 shadow-2xs">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Google Mail</p>
          <p className="text-xl font-black text-blue-950 mt-0.5">{stats.googleMailCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-sky-100 shadow-2xs">
          <p className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Telegram</p>
          <p className="text-xl font-black text-sky-950 mt-0.5">{stats.telegramCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-purple-100 shadow-2xs">
          <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Upcoming</p>
          <p className="text-xl font-black text-purple-950 mt-0.5">{stats.upcomingCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-gray-100 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Delivered</p>
          <p className="text-xl font-black text-gray-900 mt-0.5">{stats.completedCount || 0}</p>
        </div>

        <div className="p-3 rounded-2xl bg-white border border-rose-100 shadow-2xs col-span-2 sm:col-span-1">
          <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Failed</p>
          <p className="text-xl font-black text-rose-950 mt-0.5">{stats.failedCount || 0}</p>
        </div>
      </div>

      {/* ─── 2. Search, Filter Chips, and Actions Bar ─── */}
      <div className="bg-white rounded-2xl border border-purple-100 p-3 sm:p-4 mb-3 shadow-2xs flex flex-col gap-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by recipient, subject, or message..."
              className="w-full rounded-xl border border-gray-200 pl-9 pr-3.5 py-2 text-xs sm:text-sm font-medium text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer"
              title="Refresh scheduled deliveries"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={onOpenNewSchedule}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold shadow-sm shadow-purple-600/25 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Schedule</span>
            </button>
          </div>
        </div>

        {/* Channel Filters */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 mr-1">Channel:</span>
            {[
              { id: "all", label: "All Channels" },
              { id: "tasklert_mail", label: "Tasklert Mail" },
              { id: "google_mail", label: "Google Mail" },
              { id: "telegram", label: "Telegram" },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannelFilter(c.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  channelFilter === c.id
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 mr-1">Status:</span>
            {[
              { id: "all", label: "All" },
              { id: "upcoming", label: "Upcoming" },
              { id: "sent", label: "Sent" },
              { id: "failed", label: "Failed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === s.id
                    ? "bg-purple-100 text-purple-900 border border-purple-300"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 3. Scheduled Items Grid / List ─── */}
      <div className="flex-1 space-y-3 pb-8">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Fetching scheduled deliveries from database...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 px-4 bg-white rounded-2xl border border-purple-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-gray-900">No scheduled deliveries found</h4>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Plan messages, notifications, or emails to be delivered automatically in the future.
            </p>
            <button
              type="button"
              onClick={onOpenNewSchedule}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm shadow-purple-600/25 hover:bg-purple-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule First Message</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item) => {
              const isTelegram = item.channel === "telegram";
              const isTasklertMail = item.channel === "tasklert_mail";
              const isGoogleMail = item.channel === "google_mail";

              const isSent = item.status === "sent";
              const isFailed = item.status === "failed";
              const isCancelled = item.status === "cancelled";

              return (
                <div
                  key={item._id}
                  className="bg-white rounded-2xl border border-gray-100 hover:border-purple-200 shadow-2xs p-4 flex flex-col justify-between transition-all duration-150 hover:shadow-xs"
                >
                  <div>
                    {/* Header: Channel Icon + Target + Status Badge + 3-dots */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isTelegram && (
                          <div className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Send className="w-3.5 h-3.5 -rotate-12 translate-x-px" />
                          </div>
                        )}
                        {isGoogleMail && (
                          <div className="w-7 h-7 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                            <Mail className="w-4 h-4" />
                          </div>
                        )}
                        {isTasklertMail && (
                          <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Mail className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-gray-900 truncate">
                            {isTelegram && `Telegram • ${item.recipientName || "Contact"}`}
                            {isGoogleMail && `Google Mail • ${item.recipientName || item.recipient}`}
                            {isTasklertMail && `Tasklert Mail • ${item.recipientName || item.recipient}`}
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium truncate">{item.recipient}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status Badge */}
                        {isSent ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Sent
                          </span>
                        ) : isFailed ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Failed
                          </span>
                        ) : isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-bold flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Scheduled
                          </span>
                        )}

                        {/* 3-dots Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === item._id ? null : item._id);
                            }}
                            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeMenuId === item._id && (
                            <div
                              ref={menuRef}
                              className="absolute right-0 top-6 z-30 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-xs text-gray-700 animate-fadeIn"
                            >
                              {!isSent && !isCancelled && (
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
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleDuplicate(item._id, e)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition text-left cursor-pointer"
                              >
                                <Copy className="w-3 h-3 text-gray-500" />
                                <span>Duplicate</span>
                              </button>

                              {!isSent && !isCancelled && (
                                <>
                                  <div className="my-1 border-t border-gray-100" />
                                  <button
                                    type="button"
                                    onClick={(e) => handleCancel(item._id, e)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-50 text-rose-600 transition text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-500" />
                                    <span>Cancel Delivery</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subject */}
                    {item.subject && (
                      <h5 className="text-xs font-bold text-gray-900 truncate mb-1">{item.subject}</h5>
                    )}

                    {/* Message Preview */}
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-3">
                      {item.message}
                    </p>

                    {/* Failure details if any */}
                    {isFailed && item.failureReason && (
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200/80 text-[11px] text-rose-700 mb-3">
                        <strong className="font-bold">Error:</strong> {item.failureReason}
                      </div>
                    )}
                  </div>

                  {/* Footer: Date & Time + Repeat info */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>{formatDateDisplay(item.scheduledAt, item.timeZone)}</span>
                    </div>

                    {item.repeat?.type && item.repeat.type !== "none" && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10px]">
                        <Repeat className="w-2.5 h-2.5" />
                        <span>{item.repeat.type}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

