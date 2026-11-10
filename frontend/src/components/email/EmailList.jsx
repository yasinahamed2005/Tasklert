import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RotateCw,
  Star,
  Paperclip,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Inbox,
  Tag,
  Users,
  Info,
  Edit3,
  ArrowLeft,
  ChevronDown,
  Send,
  FileText,
  AlertCircle,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  fetchScheduledDeliveries,
  fetchScheduledStats,
  sendNowScheduledDelivery,
  cancelScheduledDelivery,
} from "../../services/unifiedScheduleApi";
import { toast } from "react-toastify";

// Palette for avatar initials matching the reference screenshot
const AVATAR_COLORS = [
  "bg-purple-100 text-purple-700 border border-purple-200",
  "bg-amber-100 text-amber-800 border border-amber-200",
  "bg-teal-100 text-teal-700 border border-teal-200",
  "bg-blue-100 text-blue-700 border border-blue-200",
  "bg-rose-100 text-rose-700 border border-rose-200",
  "bg-orange-100 text-orange-800 border border-orange-200",
];

const getInitials = (name = "") => {
  if (!name) return "EM";
  const parts = name.trim().replace(/^["']|["']$/g, "").split(" ");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

const formatRowDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatScheduledDate = (isoStr) => {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

export default function EmailList({
  emails = [],
  selectedEmail,
  onSelectEmail,
  onStarEmail,
  activeCategory = "primary",
  onSelectCategory,
  categoryCounts = { promotions: 0, updates: 0, social: 0 },
  searchQuery = "",
  onSearchChange,
  onRefresh,
  loading = false,
  totalCount = 0,
  page = 1,
  onPrevPage,
  onNextPage,
  hasNextPage = false,
  hasPrevPage = false,
  isInbox = true,
  selectedFolder = "INBOX",
  onSelectFolder,
  selectedLabel = null,
  onSelectLabel,
  unreadCounts = {},
  onCompose,
  onOpenSchedule,
  onBackToQuickSend,
  accountEmail = "yasinahamadsk@gmail.com",
  isConnected = true,
}) {
  // Navigation tabs state: "INBOX" | "SENT" | "SCHEDULED" | "DRAFTS"
  const [activeNavTab, setActiveNavTab] = useState(
    selectedFolder === "SENT" ? "SENT" : selectedFolder === "DRAFTS" ? "DRAFTS" : "INBOX"
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Scheduled Google Mail items state
  const [scheduledItems, setScheduledItems] = useState([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch real scheduled deliveries for Google Mail channel
  const loadScheduledDeliveries = useCallback(async () => {
    try {
      setLoadingScheduled(true);
      const data = await fetchScheduledDeliveries({ channel: "google_mail", limit: 50 });
      if (data?.items) {
        setScheduledItems(data.items);
        setScheduledCount(data.items.filter((i) => i.status === "scheduled").length);
      }
    } catch (_) {
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  // Fetch stats for the tab badge
  const loadScheduledStatsBadge = useCallback(async () => {
    try {
      const stats = await fetchScheduledStats();
      if (stats?.google_mail !== undefined) {
        setScheduledCount(stats.google_mail);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadScheduledStatsBadge();
  }, [loadScheduledStatsBadge]);

  useEffect(() => {
    if (activeNavTab === "SCHEDULED") {
      loadScheduledDeliveries();
    }
  }, [activeNavTab, loadScheduledDeliveries]);

  // Sync external folder selection
  useEffect(() => {
    if (selectedFolder === "SENT") setActiveNavTab("SENT");
    else if (selectedFolder === "DRAFTS") setActiveNavTab("DRAFTS");
    else if (selectedFolder === "INBOX") setActiveNavTab("INBOX");
  }, [selectedFolder]);

  // Category Tabs Configuration
  const categories = [
    { id: "primary", label: "Primary", icon: Inbox, count: 0 },
    {
      id: "promotions",
      label: "Promotions",
      icon: Tag,
      count: categoryCounts.promotions || 0,
    },
    { id: "social", label: "Social", icon: Users, count: categoryCounts.social || 0 },
    {
      id: "updates",
      label: "Updates",
      icon: Info,
      count: categoryCounts.updates || 0,
    },
  ];

  // Scheduled Item Actions
  const handleSendNowScheduled = async (id) => {
    setActionLoadingId(id);
    try {
      await sendNowScheduledDelivery(id);
      toast.success("Scheduled email dispatched via Gmail API!");
      await loadScheduledDeliveries();
      loadScheduledStatsBadge();
    } catch (err) {
      toast.error(err.message || "Failed to dispatch email.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelScheduled = async (id) => {
    setActionLoadingId(id);
    try {
      await cancelScheduledDelivery(id);
      toast.info("Scheduled delivery cancelled.");
      await loadScheduledDeliveries();
      loadScheduledStatsBadge();
    } catch (err) {
      toast.error(err.message || "Failed to cancel delivery.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const displayRange = emails.length > 0
    ? `1-${emails.length} of ${totalCount || emails.length}`
    : "0 of 0";

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-3xl border border-purple-100 shadow-2xs overflow-hidden relative">
      
      {/* ========================================================================= */}
      {/* 1. GOOGLE MAIL TOP HEADER (Section 1)                                     */}
      {/* Back arrow, Gmail SVG Logo, Google Mail title, Connected badge, email      */}
      {/* ========================================================================= */}
      <div className="shrink-0 px-3.5 py-2.5 bg-white border-b border-purple-100/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Back Navigation Arrow */}
          {onBackToQuickSend && (
            <button
              type="button"
              onClick={onBackToQuickSend}
              className="p-1 -ml-1 rounded-xl text-gray-700 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer shrink-0"
              title="Back to QuickSend"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
          )}

          {/* Official 4-Color Gmail SVG Logo */}
          <div className="shrink-0 flex items-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M1.5 5.25V18.75C1.5 19.9926 2.50736 21 3.75 21H6.75V11.25L1.5 7.3125V5.25Z" fill="#4285F4"/>
              <path d="M17.25 21H20.25C21.4926 21 22.5 19.9926 22.5 18.75V5.25L17.25 11.25V21Z" fill="#34A853"/>
              <path d="M17.25 11.25V3L12 6.9375L6.75 3V11.25L12 15.1875L17.25 11.25Z" fill="#EA4335"/>
              <path d="M1.5 5.25L6.75 9.1875V3L1.5 5.25Z" fill="#FBBC04"/>
              <path d="M22.5 5.25L17.25 9.1875V3L22.5 5.25Z" fill="#C5221F"/>
            </svg>
          </div>

          {/* Title & Status Header */}
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 tracking-tight leading-none">
                Google Mail
              </span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-medium truncate mt-0.5">
              {accountEmail}
            </span>
          </div>
        </div>

        {/* Right Header Actions: Refresh & More */}
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            type="button"
            onClick={() => {
              if (activeNavTab === "SCHEDULED") loadScheduledDeliveries();
              else onRefresh?.();
            }}
            className="p-1.5 rounded-xl text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            title="Refresh mail"
          >
            <RotateCw className={`w-4 h-4 ${(loading || loadingScheduled) ? "animate-spin text-purple-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-xl text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            title="More folders"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* More Dropdown Menu */}
          {isMoreMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-purple-100 py-1.5 z-50 animate-fade-in text-xs font-bold text-gray-700">
              <button
                type="button"
                onClick={() => {
                  onSelectFolder?.("STARRED");
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50 hover:text-purple-700 transition"
              >
                <Star className="w-4 h-4 text-amber-500" />
                <span>Starred</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectFolder?.("IMPORTANT");
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-purple-50 hover:text-purple-700 transition"
              >
                <AlertCircle className="w-4 h-4 text-purple-600" />
                <span>Important</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectFolder?.("TRASH");
                  setIsMoreMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Trash</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIL NAVIGATION TABS (Section 2)                                        */}
      {/* Inbox (with unread badge), Sent, Scheduled, Drafts, More                  */}
      {/* ========================================================================= */}
      <div className="shrink-0 px-3.5 py-2 bg-purple-50/30 border-b border-purple-100/60 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {/* TAB 1: INBOX */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("INBOX");
              onSelectFolder?.("INBOX");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeNavTab === "INBOX"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-gray-700 hover:bg-purple-50 border border-purple-100"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
            {unreadCounts.INBOX > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeNavTab === "INBOX" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
                }`}
              >
                {unreadCounts.INBOX}
              </span>
            )}
          </button>

          {/* TAB 2: SENT */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("SENT");
              onSelectFolder?.("SENT");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeNavTab === "SENT"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-gray-700 hover:bg-purple-50 border border-purple-100"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent</span>
          </button>

          {/* TAB 3: SCHEDULED */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("SCHEDULED");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeNavTab === "SCHEDULED"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-gray-700 hover:bg-purple-50 border border-purple-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
            {scheduledCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeNavTab === "SCHEDULED" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
                }`}
              >
                {scheduledCount}
              </span>
            )}
          </button>

          {/* TAB 4: DRAFTS */}
          <button
            type="button"
            onClick={() => {
              setActiveNavTab("DRAFTS");
              onSelectFolder?.("DRAFTS");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer ${
              activeNavTab === "DRAFTS"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white text-gray-700 hover:bg-purple-50 border border-purple-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Drafts</span>
            {unreadCounts.DRAFTS > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 text-[10px] font-black">
                {unreadCounts.DRAFTS}
              </span>
            )}
          </button>

          {/* TAB 5: MORE */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-gray-600 hover:bg-purple-50 border border-purple-100 transition cursor-pointer"
          >
            <span>More</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH BAR (Section 3)                                                 */}
      {/* Rounded search with "Search in mail..." and filter icon                    */}
      {/* ========================================================================= */}
      <div className="shrink-0 px-3.5 py-2">
        <div className="relative flex items-center bg-gray-50/90 hover:bg-gray-100/80 focus-within:bg-white border border-purple-200/80 focus-within:border-purple-400 rounded-2xl px-3 py-1.5 transition shadow-2xs">
          <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in mail..."
            className="flex-1 py-0.5 bg-transparent text-xs sm:text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none font-medium"
          />
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-purple-600 transition cursor-pointer shrink-0"
            title="Search filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. EMAIL CATEGORY TABS (Section 4)                                        */}
      {/* Primary, Promotions, Social, Updates (Only shown on Inbox view)           */}
      {/* ========================================================================= */}
      {activeNavTab === "INBOX" && isInbox && (
        <div className="shrink-0 px-3.5 pb-2">
          <div className="grid grid-cols-4 gap-1.5">
            {categories.map(({ id, label, icon: Icon, count }) => {
              const isActive = activeCategory === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectCategory?.(id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-gray-100/80 hover:bg-purple-50 text-gray-600 hover:text-purple-700"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-gray-400"}`} />
                  <span className="truncate text-[11px] sm:text-xs">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subheader: Range + Pagination (Inbox / Sent / Drafts) */}
      {activeNavTab !== "SCHEDULED" && (
        <div className="shrink-0 px-3.5 py-1 flex items-center justify-between text-[11px] text-gray-500 font-semibold border-b border-purple-50">
          <span>{displayRange}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!hasPrevPage && page <= 1}
              onClick={onPrevPage}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              title="Newer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!hasNextPage}
              onClick={onNextPage}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-purple-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              title="Older"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. EMAIL LIST – MAIN UI (Section 5 & 6) or SCHEDULED VIEW (Section 9)     */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5 tg-custom-scrollbar">
        {activeNavTab === "SCHEDULED" ? (
          /* ─── SCHEDULED GOOGLE MAIL LIST (Section 9) ─── */
          loadingScheduled ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
              <span className="text-xs font-semibold">Loading scheduled deliveries...</span>
            </div>
          ) : scheduledItems.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-gray-800">No Scheduled Emails</h4>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                Schedule future Google Mail deliveries from the Compose dialog. They will be dispatched automatically by the background worker.
              </p>
            </div>
          ) : (
            scheduledItems.map((item) => {
              const isProcessing = actionLoadingId === item._id;
              return (
                <div
                  key={item._id}
                  className="p-3 rounded-2xl border border-purple-100 bg-white hover:bg-purple-50/40 shadow-2xs transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 truncate">
                        <span>To:</span>
                        <span className="truncate text-purple-700">{item.recipient}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-800 truncate mt-0.5">
                        {item.subject || "(no subject)"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                        item.status === "sent"
                          ? "bg-purple-100 text-purple-700"
                          : item.status === "failed"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.status === "sent" ? "Delivered" : item.status === "failed" ? "Failed" : "Scheduled"}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500 line-clamp-2 font-normal leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-purple-50 text-[11px]">
                    <div className="flex items-center gap-1 text-purple-700 font-semibold">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatScheduledDate(item.scheduledAt)} ({item.timeZone || "IST"})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === "scheduled" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSendNowScheduled(item._id)}
                            disabled={isProcessing}
                            className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] transition cursor-pointer"
                          >
                            Send Now
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelScheduled(item._id)}
                            disabled={isProcessing}
                            className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Cancel schedule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* ─── NORMAL GMAIL EMAIL LIST (Section 5 & 6) ─── */
          loading && emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
              <span className="text-xs font-semibold">Loading your real Gmail messages...</span>
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-16 px-4">
              <p className="text-xs font-bold text-gray-700">No emails in this folder</p>
              <p className="text-[11px] text-gray-400 mt-1">Your connected Gmail mailbox is empty here.</p>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedEmail?._id === email._id || selectedEmail?.id === email.id;
              const isUnread = !email.isRead;
              const senderName =
                email.fromName || email.from?.split("<")[0]?.replace(/"/g, "").trim() || "Google Mail";

              return (
                <div
                  key={email._id || email.id}
                  onClick={() => onSelectEmail?.(email)}
                  className={`group flex items-start gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-purple-50 border-purple-300 shadow-2xs"
                      : isUnread
                      ? "bg-white hover:bg-purple-50/50 border-purple-100 shadow-2xs"
                      : "bg-white/70 hover:bg-purple-50/30 border-purple-50/70"
                  }`}
                >
                  {/* Sender Avatar Circle with Initials (Section 6) */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs select-none ${getAvatarColor(
                      senderName
                    )}`}
                  >
                    {getInitials(senderName)}
                  </div>

                  {/* Middle Content Section */}
                  <div className="flex-1 min-w-0 pr-1">
                    {/* Row 1: Sender Name & Date */}
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs truncate block ${
                          isUnread ? "font-black text-gray-950" : "font-medium text-gray-700"
                        }`}
                      >
                        {senderName}
                      </span>
                      <span
                        className={`text-[11px] whitespace-nowrap shrink-0 ${
                          isUnread ? "font-black text-purple-700" : "font-medium text-gray-400"
                        }`}
                      >
                        {email.displayDate || formatRowDate(email.date)}
                      </span>
                    </div>

                    {/* Row 2: Email Subject */}
                    <p
                      className={`text-xs truncate leading-snug mb-0.5 ${
                        isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-800"
                      }`}
                    >
                      {email.subject || "(no subject)"}
                    </p>

                    {/* Row 3: Short Snippet Message Preview */}
                    <p className="text-[11px] text-gray-500 truncate font-normal leading-tight">
                      {email.snippet || ""}
                    </p>
                  </div>

                  {/* Right Actions: Attachment & Star */}
                  <div className="flex flex-col items-end justify-between self-stretch shrink-0 py-0.5">
                    {email.hasAttachment ? (
                      <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0 mb-1" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 mb-1" />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStarEmail?.(email);
                      }}
                      className={`p-0.5 transition cursor-pointer shrink-0 ${
                        email.isStarred ? "text-amber-400" : "text-gray-300 hover:text-amber-400"
                      }`}
                      title={email.isStarred ? "Starred" : "Star email"}
                    >
                      <Star className={`w-3.5 h-3.5 ${email.isStarred ? "fill-amber-400" : ""}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* ========================================================================= */}
      {/* 7. FLOATING COMPOSE BUTTON (Section 7)                                     */}
      {/* Purple background, white pencil icon, "Compose" label, rounded pill shape  */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={onCompose}
        className="md:hidden fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 px-4 py-3 sm:px-5 sm:py-3.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-600/30 flex items-center gap-2 font-bold text-xs sm:text-sm active:scale-95 transition cursor-pointer select-none"
        title="Compose Email"
      >
        <Edit3 className="w-4 h-4 stroke-2" />
        <span>Compose</span>
      </button>
    </div>
  );
}
