import React, { useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Users,
  MessageSquare,
  Radio,
  Check,
  CheckCheck,
  RefreshCw,
  Loader2,
  Archive,
  Pin,
  Send,
  LogOut,
  X,
  ArrowLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import TelegramAvatar from "./TelegramAvatar";

export default function TelegramChatList({
  chats = [],
  selectedChatId,
  onSelectChat,
  filter = "all",
  onFilterChange,
  search = "",
  onSearchChange,
  onOpenContactsModal,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onRefresh,
  profile = null,
  connected = true,
  onDisconnect,
  onOpenSchedule,
  onBackToQuickSend,
}) {
  const scrollListRef = useRef(null);

  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();

      if (isToday) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }

      const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return d.toLocaleDateString([], { weekday: "short" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch (_) {
      return "";
    }
  };

  const formatUnreadCount = (count) => {
    const n = Number(count) || 0;
    if (n <= 0) return null;
    if (n >= 10000) return `${Math.floor(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  // Compute total unread & archived counts
  const archivedChats = chats.filter((c) => c.folderId === 1);
  const archivedCount = archivedChats.length;
  const archivedUnreadCount = archivedChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const mainChats = chats.filter((c) => c.folderId !== 1);
  const unreadCountTotal = mainChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Filter chats by active tab
  let displayedChats = chats;
  if (filter === "archived") {
    displayedChats = chats.filter((c) => c.folderId === 1);
  } else if (filter === "unread") {
    displayedChats = chats.filter((c) => c.folderId !== 1 && c.unreadCount > 0);
  } else if (filter === "private") {
    displayedChats = chats.filter((c) => c.folderId !== 1 && (c.type === "private" || c.isUser));
  } else if (filter === "groups") {
    displayedChats = chats.filter((c) => c.folderId !== 1 && (c.type === "group" || c.isGroup));
  } else if (filter === "channels") {
    displayedChats = chats.filter((c) => c.folderId !== 1 && (c.type === "channel" || c.isChannel));
  } else {
    // "all" view hides archived chats (Telegram standard)
    displayedChats = chats.filter((c) => c.folderId !== 1);
  }

  // Sort pinned chats to top, then by last message date descending
  displayedChats = [...displayedChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const dateA = a.lastMessage?.date ? new Date(a.lastMessage.date).getTime() : 0;
    const dateB = b.lastMessage?.date ? new Date(b.lastMessage.date).getTime() : 0;
    return dateB - dateA;
  });

  // Infinite scroll trigger when reaching bottom of conversation list
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      if (hasMore && !loadingMore && !loading && onLoadMore) {
        onLoadMore();
      }
    }
  };

  const isArchivedMode = filter === "archived";

  return (
    <aside className="border-r border-purple-100 bg-white flex flex-col h-full min-h-0 overflow-hidden select-none">
      {/* ─── Top Account Status Card ─── */}
      <div className="shrink-0 p-3 sm:p-3.5 border-b border-purple-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackToQuickSend && (
            <button
              type="button"
              onClick={onBackToQuickSend}
              className="p-1.5 -ml-1.5 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 cursor-pointer transition active:scale-95 flex items-center gap-1 shrink-0"
              title="Return to Tasklert QuickSend"
            >
              <ArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <Send className="w-4 h-4 fill-white -ml-0.5 mt-0.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-950">Telegram</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            </div>
            {profile?.username ? (
              <span className="text-[10px] text-gray-400 font-mono block truncate">
                @{profile.username}
              </span>
            ) : profile?.firstName ? (
              <span className="text-[10px] text-gray-400 block truncate">
                {profile.firstName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-xl text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            title="Refresh Chats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>
          {onDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="p-1.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              title="Disconnect Account"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Search & Category Filter Pills ─── */}
      <div className="shrink-0 p-3 pb-2 space-y-2 border-b border-purple-50 bg-purple-50/20">
        {/* Search Bar with Clear Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats, groups & channels..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-purple-100 bg-white text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={onOpenContactsModal}
            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Categories / Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: "all", label: "All" },
            { id: "private", label: "Private" },
            { id: "groups", label: "Groups" },
            { id: "channels", label: "Channels" },
            { id: "unread", label: unreadCountTotal > 0 ? `Unread (${formatUnreadCount(unreadCountTotal)})` : "Unread" },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`py-1 px-3 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-white/90 border border-purple-100 text-gray-600 hover:text-purple-700 hover:bg-purple-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Archived Header Bar (When in Archived View) ─── */}
      {isArchivedMode && (
        <div className="shrink-0 px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Chats</span>
          </button>
          <span className="text-[11px] font-bold text-slate-500">
            Archived Chats ({displayedChats.length})
          </span>
        </div>
      )}

      {/* ─── Chat List Stream (Independently scrollable) ─── */}
      <div
        ref={scrollListRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-purple-50/60 tg-custom-scrollbar"
      >
        {/* ─── Archived Chats Row (Telegram Mobile standard at top of list) ─── */}
        {!isArchivedMode && !search && filter === "all" && (
          <button
            type="button"
            onClick={() => onFilterChange("archived")}
            className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-purple-50/50 transition cursor-pointer border-b border-purple-50 group"
          >
            <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:bg-purple-100 group-hover:text-purple-700 transition">
              <Archive className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold text-gray-900 group-hover:text-purple-900">
                  Archived Chats
                </h4>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400">
                  {archivedCount > 0 ? `${archivedCount} archived chat${archivedCount > 1 ? "s" : ""}` : "No archived chats"}
                </span>
                {archivedUnreadCount > 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-500 text-white font-black text-[10px]">
                    {formatUnreadCount(archivedUnreadCount)}
                  </span>
                )}
              </div>
            </div>
          </button>
        )}

        {/* Loading initial chats */}
        {loading && chats.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-7 h-7 text-purple-600 animate-spin mb-2" />
            <span className="text-xs text-gray-500 font-medium">Loading Telegram conversations...</span>
          </div>
        ) : displayedChats.length === 0 ? (
          <div className="py-20 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-gray-800">
              {filter === "unread"
                ? "You're all caught up!"
                : isArchivedMode
                ? "No archived chats"
                : "No conversations found"}
            </h4>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[220px]">
              {search
                ? `No chats match "${search}". Try another keyword.`
                : filter === "unread"
                ? "No unread conversations right now."
                : isArchivedMode
                ? "You haven't archived any conversations yet."
                : "Select + above to start a conversation with any contact."}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="mt-3 px-3 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          displayedChats.map((chat) => {
            const isSelected = String(chat.id) === String(selectedChatId);
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition cursor-pointer border-l-4 ${
                  isSelected
                    ? "bg-purple-50/80 border-l-purple-600 shadow-2xs"
                    : "border-l-transparent hover:bg-purple-50/40"
                }`}
              >
                {/* Chat Avatar with initials fallback */}
                <TelegramAvatar chat={chat} size="md" />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {chat.isSelf ? "Saved Messages" : chat.title}
                      </h4>
                      {chat.pinned && (
                        <Pin className="w-3 h-3 text-purple-600 shrink-0 fill-purple-600 rotate-45" />
                      )}
                    </div>
                    {chat.lastMessage?.date && (
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {formatTime(chat.lastMessage.date)}
                      </span>
                    )}
                  </div>

                  {/* Last message preview */}
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                      {chat.lastMessage?.out && (
                        <CheckCheck className="w-3 h-3 text-purple-600 shrink-0 inline" />
                      )}
                      <span>
                        {chat.isSelf && !chat.lastMessage?.text
                          ? "Cloud Storage"
                          : chat.lastMessage?.text || "No messages yet"}
                      </span>
                    </p>

                    {/* Telegram-style unread badge */}
                    {Number(chat.unreadCount) > 0 && (
                      <span className="shrink-0 min-w-[20px] px-1.5 py-0.5 rounded-full bg-purple-600 text-white font-black text-[10px] leading-tight text-center shadow-2xs">
                        {formatUnreadCount(chat.unreadCount)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {/* Loading more chats pagination indicator */}
        {loadingMore && (
          <div className="py-3 flex justify-center items-center gap-2 text-purple-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[11px] text-gray-500 font-medium">Loading more chats...</span>
          </div>
        )}
      </div>

      {/* ─── Mobile / Desktop Bottom Action Bar matching reference screenshot ─── */}
      <div className="shrink-0 p-2.5 bg-white border-t border-purple-100 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenContactsModal}
          className="flex-1 py-2 px-3 rounded-2xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5 -rotate-12" />
          <span>New Message</span>
        </button>

        {onOpenSchedule && (
          <button
            type="button"
            onClick={onOpenSchedule}
            className="flex-1 py-2 px-3 rounded-2xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Message</span>
          </button>
        )}
      </div>
    </aside>
  );
}
