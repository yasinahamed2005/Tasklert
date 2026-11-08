

import React, { useState } from "react";
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
} from "lucide-react";

// Avatar initial color palette matching the reference screenshot
const AVATAR_COLORS = [
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-800",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-800",
];

const getInitials = (name = "") => {
  if (!name) return "EM";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
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

const MOBILE_FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "STARRED", label: "Starred", icon: Star },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "DRAFTS", label: "Drafts", icon: FileText },
  { id: "IMPORTANT", label: "Important", icon: AlertCircle },
  { id: "TRASH", label: "Trash", icon: Trash2 },
];

export default function EmailList({
  emails = [],
  selectedEmail,
  onSelectEmail,
  onStarEmail,
  activeCategory = "primary",
  onSelectCategory,
  categoryCounts = { promotions: 14, updates: 5, social: 0 },
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
  onBackToQuickSend,
}) {
  const [isMobileFolderMenuOpen, setIsMobileFolderMenuOpen] = useState(false);

  const categories = [
    { id: "primary", label: "Primary", icon: Inbox, count: 0 },
    {
      id: "promotions",
      label: "Promotions",
      icon: Tag,
      count: categoryCounts.promotions || 0,
      badgeColor: "bg-emerald-100 text-emerald-800",
    },
    { id: "social", label: "Social", icon: Users, count: categoryCounts.social || 0 },
    {
      id: "updates",
      label: "Updates",
      icon: Info,
      count: categoryCounts.updates || 0,
      badgeColor: "bg-amber-100 text-amber-800",
    },
  ];

  const currentFolderConfig = MOBILE_FOLDERS.find((f) => f.id === selectedFolder);
  const selectedFolderLabel = selectedLabel || (currentFolderConfig ? currentFolderConfig.label : selectedFolder);

  const displayRange = emails.length > 0
    ? `1-${emails.length} of ${totalCount || emails.length}`
    : "0 of 0";

  return (
    <div className="w-full h-full flex flex-col p-3 sm:p-3.5 bg-white rounded-3xl border border-purple-100/90 shadow-2xs overflow-hidden">
      {/* ─── Top Toolbar: Back (Mobile), Folder Switcher, Checkbox, Refresh, More, Pagination ─── */}
      <div className="shrink-0 flex items-center justify-between gap-2 pb-2.5 border-b border-purple-50">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Mobile Back Button to return to QuickSend */}
          {onBackToQuickSend && (
            <button
              type="button"
              onClick={onBackToQuickSend}
              className="md:hidden p-1.5 -ml-1 rounded-xl text-gray-700 hover:text-purple-700 hover:bg-purple-100/70 transition cursor-pointer shrink-0"
              title="Back to QuickSend"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
          )}

          {/* Mobile Folder Selector Dropdown */}
          <div className="relative md:hidden shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileFolderMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-black text-xs transition cursor-pointer shadow-2xs"
            >
              <span>{selectedFolderLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-purple-600" />
            </button>

            {isMobileFolderMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-purple-100 py-1.5 z-40 animate-fade-in">
                {MOBILE_FOLDERS.map((f) => {
                  const Icon = f.icon;
                  const isActive = selectedFolder === f.id && !selectedLabel;
                  const count = unreadCounts[f.id] || 0;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onSelectFolder?.(f.id);
                        setIsMobileFolderMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition cursor-pointer ${
                        isActive ? "bg-purple-50 text-purple-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-purple-600" : "text-gray-400"}`} />
                        <span>{f.label}</span>
                      </div>
                      {count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-xl border border-transparent hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer shrink-0"
            title="Refresh emails"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>
        </div>

        {/* Real Gmail Pagination */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
          <span>{displayRange}</span>
          <div className="flex items-center gap-0.5 ml-1">
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
      </div>

      {/* ─── Search Bar ─── */}
      <div className="shrink-0 my-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search mail..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-300 transition"
          />
        </div>
      </div>

      {/* ─── Gmail Category Tabs (Primary, Promotions, Social, Updates) ─── */}
      {isInbox && (
        <div className="shrink-0 grid grid-cols-4 gap-1 border-b border-purple-100/80 mb-2 pb-1">
          {categories.map(({ id, label, icon: Icon, count, badgeColor }) => {
            const isActive = activeCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCategory?.(id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer relative ${
                  isActive
                    ? "text-purple-700 bg-purple-50/90 shadow-2xs border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-800 hover:bg-purple-50/40"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-purple-600" : "text-gray-400"}`} />
                <span className="truncate">{label}</span>
                {count > 0 && badgeColor && (
                  <span className={`hidden sm:inline-block text-[9px] px-1 py-0.2 rounded-full font-bold shrink-0 ${badgeColor}`}>
                    {count} new
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Real Gmail Email Rows ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5 tg-custom-scrollbar">
        {loading && emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
            <span className="text-xs font-semibold">Loading your real Gmail messages...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-xs font-bold text-gray-700">No emails in this category</p>
            <p className="text-[11px] text-gray-400 mt-1">Your connected Gmail mailbox is empty here.</p>
          </div>
        ) : (
          emails.map((email) => {
            const isSelected = selectedEmail?._id === email._id || selectedEmail?.id === email.id;
            const isUnread = !email.isRead;
            const senderName = email.fromName || email.from?.split("<")[0]?.replace(/"/g, "").trim() || "Unknown";

            return (
              <div
                key={email._id || email.id}
                onClick={() => onSelectEmail(email)}
                className={`group flex items-center gap-2 p-2 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-purple-50/90 border-purple-300 shadow-2xs"
                    : isUnread
                    ? "bg-white hover:bg-purple-50/50 border-purple-100/90 font-bold"
                    : "bg-white/60 hover:bg-purple-50/30 border-purple-50/60"
                }`}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded-md border border-gray-300 group-hover:border-purple-400 flex items-center justify-center shrink-0 cursor-pointer transition"
                />

                {/* Star icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStarEmail(email);
                  }}
                  className={`p-0.5 transition cursor-pointer shrink-0 ${
                    email.isStarred
                      ? "text-amber-400"
                      : "text-gray-300 hover:text-amber-400"
                  }`}
                  title={email.isStarred ? "Starred" : "Star"}
                >
                  <Star className={`w-3.5 h-3.5 ${email.isStarred ? "fill-amber-400" : ""}`} />
                </button>

                {/* Sender Name */}
                <div className="w-24 sm:w-28 shrink-0 truncate">
                  <span
                    className={`text-xs truncate block ${
                      isUnread ? "font-black text-gray-900" : "font-medium text-gray-700"
                    }`}
                  >
                    {senderName}
                  </span>
                </div>

                {/* Subject & Snippet inline (Gmail style!) */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
                  <span
                    className={`text-xs truncate ${
                      isUnread ? "font-black text-gray-900" : "font-semibold text-gray-800"
                    }`}
                  >
                    {email.subject || "(no subject)"}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate font-normal">
                    - {email.snippet || ""}
                  </span>
                </div>

                {/* Attachment & Date */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {email.hasAttachment && (
                    <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />
                  )}
                  <span
                    className={`text-[11px] whitespace-nowrap shrink-0 ${
                      isUnread ? "font-bold text-gray-900" : "font-medium text-gray-400"
                    }`}
                  >
                    {email.displayDate || email.date?.slice(0, 10)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Mobile Floating Compose Button (Matches Screenshot Bottom Right 1) ─── */}
      {onCompose && (
        <button
          type="button"
          onClick={onCompose}
          className="md:hidden fixed bottom-20 right-5 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/30 flex items-center justify-center transition active:scale-95 cursor-pointer z-30"
          title="Compose Email"
        >
          <Edit3 className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}
