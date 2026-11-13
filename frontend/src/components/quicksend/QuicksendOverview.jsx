import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Send,
  Mail,
  Plus,
  Calendar,
  Clock,
  Paperclip,
  CheckCircle2,
  MoreVertical,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Trash2,
  Zap,
  BarChart2,
  RefreshCw,
  Edit2,
  Check,
} from "lucide-react";
import {
  fetchQuicksendOverview,
  sendNowScheduledDelivery,
  cancelScheduledDelivery,
} from "../../services/unifiedScheduleApi";
import { toast } from "react-toastify";

// Official 4-color Gmail SVG Icon
const GmailLogo = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
    <path
      d="M1.5 5.25V18.75C1.5 19.9926 2.50736 21 3.75 21H6.75V10.5L12 14.25L17.25 10.5V21H20.25C21.4926 21 22.5 19.9926 22.5 18.75V5.25C22.5 3.59315 20.6068 2.65685 19.3 3.6375L12 9.1125L4.7 3.6375C3.39315 2.65685 1.5 3.59315 1.5 5.25Z"
      fill="#EA4335"
    />
    <path
      d="M1.5 5.25C1.5 3.59315 3.39315 2.65685 4.7 3.6375L12 9.1125L6.75 13.5V21H3.75C2.50736 21 1.5 19.9926 1.5 18.75V5.25Z"
      fill="#4285F4"
    />
    <path
      d="M22.5 5.25C22.5 3.59315 20.6068 2.65685 19.3 3.6375L12 9.1125L17.25 13.5V21H20.25C21.4926 21 22.5 19.9926 22.5 18.75V5.25Z"
      fill="#34A853"
    />
    <path
      d="M17.25 10.5L12 14.25L6.75 10.5V21H17.25V10.5Z"
      fill="#FBBC04"
    />
  </svg>
);

// Official Telegram Blue Logo with Paperplane
const TelegramLogo = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#229ED9" />
    <path
      d="M5.4 11.9L17.8 7.2C18.4 7 18.9 7.4 18.7 8L16.6 17.6C16.4 18.2 15.8 18.4 15.3 18.1L11.7 15.4L9.9 17.1C9.7 17.3 9.5 17.5 9.1 17.5L9.4 13.7L16.3 7.5C16.6 7.2 16.2 7 15.8 7.3L7.3 12.6L3.6 11.4C3 11.2 3 10.8 3.7 10.5"
      fill="white"
    />
  </svg>
);

export function QuicksendOverview({
  onSelectChannel,
  onOpenCompose,
  onOpenSchedule,
  onViewAllLogs,
  onViewAllScheduled,
  onEditSchedule,
  refreshTrigger = 0,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: {
      messagesSent: 0,
      emailsSent: 0,
      scheduled: 0,
      pending: 0,
    },
    recentMessages: [],
    scheduledItems: [],
  });

  // Action dropdowns
  const [activeRecentMenuId, setActiveRecentMenuId] = useState(null);
  const [activeSchedMenuId, setActiveSchedMenuId] = useState(null);
  const [actionInProgressId, setActionInProgressId] = useState(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveRecentMenuId(null);
      setActiveSchedMenuId(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchQuicksendOverview();
      if (res?.success) {
        setData({
          stats: res.stats || {
            messagesSent: 0,
            emailsSent: 0,
            scheduled: 0,
            pending: 0,
          },
          recentMessages: res.recentMessages || [],
          scheduledItems: res.scheduledItems || [],
        });
      }
    } catch (err) {
      console.warn("Failed to load QuickSend overview:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Handle immediate dispatch for a scheduled item
  const handleSendNow = async (id, e) => {
    e.stopPropagation();
    try {
      setActionInProgressId(id);
      setActiveSchedMenuId(null);
      const res = await sendNowScheduledDelivery(id);
      if (res.success) {
        toast.success("Delivery dispatched successfully!");
        loadData();
      } else {
        toast.error(res.message || "Failed to dispatch delivery.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to send now.");
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle cancellation for a scheduled item
  const handleCancel = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to cancel this scheduled delivery?")) {
      return;
    }
    try {
      setActionInProgressId(id);
      setActiveSchedMenuId(null);
      const res = await cancelScheduledDelivery(id);
      if (res.success) {
        toast.success("Scheduled delivery cancelled.");
        loadData();
      } else {
        toast.error(res.message || "Failed to cancel.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to cancel.");
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 animate-fadeIn space-y-6">
      {/* ========================================================================= */}
      {/* 2-COLUMN DESKTOP / 1-COLUMN MOBILE LAYOUT (Phases 3, 4 & 5)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: ~68% width on Desktop (Send From, Quick Actions, Recents) */}
        {/* ======================================================================= */}
        <div className="lg:col-span-8 flex flex-col space-y-6 min-w-0">
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SECTION 1: SEND FROM                                               */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div>
            <div className="mb-3">
              <h2 className="text-base sm:text-lg font-black text-[#17133D] tracking-tight">
                Send From
              </h2>
              <p className="text-xs text-[#77738F] font-medium">
                Choose a channel to send or schedule.
              </p>
            </div>

            {/* Desktop: 3 in a row. Mobile: 3 full-width horizontal cards matching reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Card 1: Tasklert Mail */}
              <div
                onClick={() => onSelectChannel?.("tasklert_mail")}
                className="group bg-white rounded-2xl border border-purple-100 hover:border-purple-300 p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 sm:gap-0"
              >
                {/* Mobile: Row Layout (Icon left, Title+Subtitle center) | Desktop: Column Layout */}
                <div className="flex sm:block items-center gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-between sm:mb-3 shrink-0">
                    <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 sm:w-4 sm:h-4 text-purple-600" />
                    </div>
                    <span className="hidden sm:inline-block bg-[#E8F8F1] text-[#079B68] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#BCECD7]">
                      Pro Delivery
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#17133D] group-hover:text-purple-700 transition">
                        Tasklert Mail
                      </h3>
                      <span className="sm:hidden bg-[#E8F8F1] text-[#079B68] text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border border-[#BCECD7]">
                        Pro Delivery
                      </span>
                    </div>
                    <p className="text-xs text-[#77738F] mt-0.5 sm:mt-1 leading-relaxed truncate sm:whitespace-normal">
                      Send professional emails with verified sender.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end text-purple-600 shrink-0 sm:mt-4 sm:pt-2 sm:border-t sm:border-purple-50/60">
                  <ArrowRight className="w-4 h-4 hidden sm:block group-hover:translate-x-1 transition duration-150" />
                  <ChevronRight className="w-5 h-5 sm:hidden text-gray-400 group-hover:text-purple-600 transition" />
                </div>
              </div>

              {/* Card 2: Google Mail */}
              <div
                onClick={() => onSelectChannel?.("email")}
                className="group bg-white rounded-2xl border border-purple-100 hover:border-purple-300 p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 sm:gap-0"
              >
                <div className="flex sm:block items-center gap-3 min-w-0 flex-1">
                  <div className="sm:mb-3 shrink-0">
                    <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-2xs">
                      <GmailLogo className="w-5 h-5 sm:w-5 sm:h-5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#17133D] group-hover:text-purple-700 transition">
                      Google Mail
                    </h3>
                    <p className="text-xs text-[#77738F] mt-0.5 sm:mt-1 leading-relaxed truncate sm:whitespace-normal">
                      Use your connected Gmail account.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end text-purple-600 shrink-0 sm:mt-4 sm:pt-2 sm:border-t sm:border-purple-50/60">
                  <ArrowRight className="w-4 h-4 hidden sm:block group-hover:translate-x-1 transition duration-150" />
                  <ChevronRight className="w-5 h-5 sm:hidden text-gray-400 group-hover:text-purple-600 transition" />
                </div>
              </div>

              {/* Card 3: Telegram */}
              <div
                onClick={() => onSelectChannel?.("telegram")}
                className="group bg-white rounded-2xl border border-purple-100 hover:border-purple-300 p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-row sm:flex-col items-center sm:items-stretch justify-between gap-3 sm:gap-0"
              >
                <div className="flex sm:block items-center gap-3 min-w-0 flex-1">
                  <div className="sm:mb-3 shrink-0">
                    <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0">
                      <TelegramLogo className="w-8 h-8 sm:w-8 sm:h-8" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#17133D] group-hover:text-purple-700 transition">
                      Telegram
                    </h3>
                    <p className="text-xs text-[#77738F] mt-0.5 sm:mt-1 leading-relaxed truncate sm:whitespace-normal">
                      Send messages to your Telegram contacts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end text-purple-600 shrink-0 sm:mt-4 sm:pt-2 sm:border-t sm:border-purple-50/60">
                  <ArrowRight className="w-4 h-4 hidden sm:block group-hover:translate-x-1 transition duration-150" />
                  <ChevronRight className="w-5 h-5 sm:hidden text-gray-400 group-hover:text-purple-600 transition" />
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SECTION 2: QUICK ACTIONS                                           */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#17133D] tracking-tight mb-3">
              Quick Actions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Action 1: Compose Message */}
              <button
                type="button"
                onClick={onOpenCompose}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#7629E8] hover:bg-[#6520CD] text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/25 flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer select-none"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Compose Message</span>
              </button>

              {/* Action 2: Schedule Message */}
              <button
                type="button"
                onClick={() => onOpenSchedule?.()}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#FAF7FF] hover:bg-[#F3ECFE] text-[#7629E8] border border-purple-300 font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer select-none"
              >
                <Calendar className="w-4 h-4 text-[#7629E8]" />
                <span>Schedule Message</span>
              </button>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SECTION 3: RECENT MESSAGES                                         */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-purple-50">
              <h2 className="text-base sm:text-lg font-black text-[#17133D] tracking-tight">
                Recent Messages
              </h2>

              <button
                type="button"
                onClick={onViewAllLogs}
                className="text-xs font-bold text-[#7629E8] hover:text-[#5B1EB8] flex items-center gap-1 cursor-pointer transition select-none group"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-2xl bg-gray-50/70">
                    <div className="w-9 h-9 rounded-xl bg-gray-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data.recentMessages.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                  <Mail className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-gray-800">No recent messages yet</p>
                <p className="text-xs text-gray-400 mt-0.5 max-w-xs">
                  Your sent, scheduled, and incoming communications will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-purple-50/80">
                {data.recentMessages.map((item) => {
                  const isTg = item.channel === "telegram";
                  const isGm = item.channel === "google_mail";
                  const isScheduled = item.status === "scheduled";

                  return (
                    <div
                      key={item.id}
                      className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-purple-50/30 px-2 rounded-2xl transition duration-150"
                    >
                      {/* Left: Channel Icon + Text */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Channel Icon */}
                        <div className="shrink-0">
                          {isTg ? (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center">
                              <TelegramLogo className="w-8 h-8" />
                            </div>
                          ) : isGm ? (
                            <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-2xs">
                              <GmailLogo className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-[#E8F8F1] text-[#079B68] border border-[#BCECD7] flex items-center justify-center">
                              <Mail className="w-4 h-4 text-[#079B68]" />
                            </div>
                          )}
                        </div>

                        {/* Title & Preview */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-[#17133D] truncate">
                            {item.recipient}
                          </p>
                          <p className="text-[11px] sm:text-xs text-[#77738F] truncate mt-0.5 font-normal">
                            {item.preview || item.subject || "(No message text)"}
                          </p>
                        </div>
                      </div>

                      {/* Right: Attachment + Status Badge + Date + Three-dot Menu */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {item.hasAttachment && (
                          <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        )}

                        {/* Status Badge */}
                        {isScheduled ? (
                          <span className="inline-flex items-center gap-1 bg-[#F4EEFB] text-[#7629E8] border border-purple-200 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-[#7629E8]" />
                            <span>Scheduled</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-[#E8F8F1] text-[#079B68] text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-[#079B68]" />
                            <span>Sent</span>
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-[11px] text-[#77738F] whitespace-nowrap min-w-[55px] text-right font-medium">
                          {item.displayDate}
                        </span>

                        {/* Three-dot Action Trigger */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRecentMenuId(activeRecentMenuId === item.id ? null : item.id);
                              setActiveSchedMenuId(null);
                            }}
                            className="p-1 rounded-lg hover:bg-purple-100/60 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                            title="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeRecentMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white rounded-2xl shadow-xl border border-purple-100 py-1.5 animate-fadeIn">
                              {isScheduled ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handleSendNow(item.id, e)}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-purple-600" />
                                    <span>Send Now</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveRecentMenuId(null);
                                      onEditSchedule?.(item);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                    <span>Edit Schedule</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCancel(item.id, e)}
                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    <span>Cancel Delivery</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRecentMenuId(null);
                                    onSelectChannel?.(isTg ? "telegram" : isGm ? "email" : "tasklert_mail");
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Open Channel</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: ~32% width on Desktop (This Week Overview, Scheduled)     */}
        {/* ======================================================================= */}
        <div className="lg:col-span-4 flex flex-col space-y-6 min-w-0">
          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SECTION A: THIS WEEK OVERVIEW (Phase 4A)                           */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center gap-2 mb-3.5">
              <BarChart2 className="w-4 h-4 text-[#7629E8]" />
              <h2 className="text-sm font-black text-[#17133D] tracking-tight">
                This Week Overview
              </h2>
            </div>

            {/* 4 Stat Cards in a row */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {/* Tile 1: Messages Sent */}
              <div className="bg-[#FAF7FF] rounded-2xl p-2.5 sm:p-3 border border-purple-100 flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#7629E8] flex items-center justify-center mb-1.5">
                  <Send className="w-3.5 h-3.5 -rotate-12" />
                </div>
                <span className="text-base sm:text-lg font-black text-[#17133D] leading-tight">
                  {loading ? "…" : data.stats.messagesSent}
                </span>
                <span className="text-[10px] text-[#77738F] font-medium mt-0.5 leading-tight">
                  Messages Sent
                </span>
              </div>

              {/* Tile 2: Emails Sent */}
              <div className="bg-[#F0F7FF] rounded-2xl p-2.5 sm:p-3 border border-blue-100 flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-[#2878D0] flex items-center justify-center mb-1.5">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span className="text-base sm:text-lg font-black text-[#17133D] leading-tight">
                  {loading ? "…" : data.stats.emailsSent}
                </span>
                <span className="text-[10px] text-[#77738F] font-medium mt-0.5 leading-tight">
                  Emails Sent
                </span>
              </div>

              {/* Tile 3: Scheduled */}
              <div className="bg-[#FAF7FF] rounded-2xl p-2.5 sm:p-3 border border-purple-100 flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-[#7629E8] flex items-center justify-center mb-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className="text-base sm:text-lg font-black text-[#17133D] leading-tight">
                  {loading ? "…" : data.stats.scheduled}
                </span>
                <span className="text-[10px] text-[#77738F] font-medium mt-0.5 leading-tight">
                  Scheduled
                </span>
              </div>

              {/* Tile 4: Pending */}
              <div className="bg-[#FFFBF0] rounded-2xl p-2.5 sm:p-3 border border-amber-100 flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="text-base sm:text-lg font-black text-[#17133D] leading-tight">
                  {loading ? "…" : data.stats.pending}
                </span>
                <span className="text-[10px] text-[#77738F] font-medium mt-0.5 leading-tight">
                  Pending
                </span>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* SECTION B: SCHEDULED ITEMS (Phase 4B)                              */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-purple-100 p-4 sm:p-5 shadow-2xs flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-purple-50">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#7629E8]" />
                <h2 className="text-sm font-black text-[#17133D] tracking-tight">
                  Scheduled Items
                </h2>
              </div>

              <button
                type="button"
                onClick={onViewAllScheduled}
                className="text-xs font-bold text-[#7629E8] hover:text-[#5B1EB8] flex items-center gap-1 cursor-pointer transition select-none group"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-3 rounded-2xl bg-gray-50/70 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : data.scheduledItems.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center flex-1">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-800">No scheduled deliveries</p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-[200px]">
                  Use "Schedule Message" to plan upcoming messages and emails.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-purple-50/80">
                {data.scheduledItems.map((item) => {
                  const isTg = item.channel === "telegram";
                  const isGm = item.channel === "google_mail";

                  return (
                    <div
                      key={item.id}
                      className="py-3 flex items-start justify-between gap-3 hover:bg-purple-50/30 px-1.5 rounded-2xl transition duration-150"
                    >
                      {/* Left: Channel icon + Title + Recipient + Time */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {isTg ? (
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center">
                              <TelegramLogo className="w-6 h-6" />
                            </div>
                          ) : isGm ? (
                            <div className="w-7 h-7 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-2xs">
                              <GmailLogo className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-[#E8F8F1] text-[#079B68] border border-[#BCECD7] flex items-center justify-center">
                              <Mail className="w-3.5 h-3.5 text-[#079B68]" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#17133D] truncate leading-tight">
                            {item.subject}
                          </p>
                          <p className="text-[11px] text-[#77738F] truncate mt-0.5">
                            {item.recipient}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 font-medium">
                            <Clock className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                            <span>{item.formattedTime}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: Status Pill & Menu */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="bg-[#E8F8F1] text-[#079B68] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#BCECD7]">
                          Scheduled
                        </span>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSchedMenuId(activeSchedMenuId === item.id ? null : item.id);
                              setActiveRecentMenuId(null);
                            }}
                            className="p-1 rounded-lg hover:bg-purple-100/60 text-gray-400 hover:text-gray-700 transition cursor-pointer"
                            title="Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {activeSchedMenuId === item.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-40 bg-white rounded-2xl shadow-xl border border-purple-100 py-1.5 animate-fadeIn">
                              <button
                                type="button"
                                disabled={actionInProgressId === item.id}
                                onClick={(e) => handleSendNow(item.id, e)}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Zap className="w-3.5 h-3.5 text-purple-600" />
                                <span>Send Now</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSchedMenuId(null);
                                  onEditSchedule?.(item);
                                }}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-gray-700 hover:bg-purple-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                <span>Edit / Reschedule</span>
                              </button>

                              <button
                                type="button"
                                disabled={actionInProgressId === item.id}
                                onClick={(e) => handleCancel(item.id, e)}
                                className="w-full px-3 py-1.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuicksendOverview;

