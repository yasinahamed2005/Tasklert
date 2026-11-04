import React from "react";
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
  Sparkles,
  Archive,
  Pin,
  VolumeX,
  Send,
  LogOut,
} from "lucide-react";
import TelegramAvatar from "./TelegramAvatar";

export default function TelegramChatList({
  chats = [],
  selectedChatId,
  onSelectChat,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onOpenContactsModal,
  loading = false,
  onRefresh,
  profile = null,
  connected = true,
  onDisconnect,
}) {
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

  // Compute counts
  const archivedCount = chats.filter((c) => c.folderId === 1).length;
  const unreadCountTotal = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Filter display chats
  let displayedChats = chats;
  if (filter === "archived") {
    displayedChats = chats.filter((c) => c.folderId === 1);
  } else if (filter === "unread") {
    displayedChats = chats.filter((c) => c.unreadCount > 0);
  } else if (filter === "private") {
    displayedChats = chats.filter((c) => c.type === "private" && c.folderId !== 1);
  } else if (filter === "groups") {
    displayedChats = chats.filter((c) => c.type === "group" && c.folderId !== 1);
  } else if (filter === "channels") {
    displayedChats = chats.filter((c) => c.type === "channel" && c.folderId !== 1);
  } else {
    // "all" tab hides archived chats (Telegram Desktop standard)
    displayedChats = chats.filter((c) => c.folderId !== 1);
  }

  // Sort pinned to the top
  displayedChats = [...displayedChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const scrollListRef = React.useRef(null);

  return (
    <aside className="border-r border-purple-100/80 bg-white flex flex-col h-full min-h-0 overflow-hidden select-none">
      {/* ─── Top Account Status Card (Matches Reference Image) ─── */}
      <div className="shrink-0 p-3 sm:p-3.5 border-b border-purple-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <Send className="w-4 h-4 fill-white -ml-0.5 mt-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-950">Telegram</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            </div>
            {profile?.username && (
              <span className="text-[10px] text-gray-400 font-mono block truncate">
                @{profile.username}
              </span>
            )}
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

      {/* ─── Search & Filters (Matching Screenshot) ─── */}
      <div className="shrink-0 p-3 pb-2 space-y-2 border-b border-purple-50 bg-purple-50/20">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search chats & contacts..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-purple-100 bg-white text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
            />
          </div>

          {/* New Chat Circular Purple Button */}
          <button
            type="button"
            onClick={onOpenContactsModal}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
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
            { id: "unread", label: unreadCountTotal > 0 ? `Unread (${unreadCountTotal})` : "Unread" },
            ...(archivedCount > 0 ? [{ id: "archived", label: `Archive (${archivedCount})` }] : []),
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
                    : "bg-white/80 border border-purple-100 text-gray-600 hover:text-purple-700 hover:bg-purple-50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Chat List Stream (Independently scrollable through ALL chats) ─── */}
      <div
        ref={scrollListRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-purple-50/60 tg-custom-scrollbar"
      >
        {loading && chats.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-7 h-7 text-purple-600 animate-spin mb-2" />
            <span className="text-xs text-gray-500 font-medium">Fetching real Telegram chats...</span>
          </div>
        ) : displayedChats.length === 0 ? (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-xs font-bold text-gray-800">No chats found</h4>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
              {search ? "No conversations match your search filter." : "Start a new conversation using the + button above."}
            </p>
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
                {/* Chat Avatar */}
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
                          ? "Saved Messages"
                          : chat.lastMessage?.text || "No messages yet"}
                      </span>
                    </p>

                    {/* Purple unread badge */}
                    {Number(chat.unreadCount) > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-600 text-white font-extrabold text-[10px] leading-tight shadow-2xs">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
