import React, { useState } from "react";
import {
  X,
  Phone,
  AtSign,
  Users,
  Image as ImageIcon,
  FileText,
  Bell,
  Search,
  Download,
  Copy,
  Check,
  Shield,
  Radio,
  Bookmark,
} from "lucide-react";
import TelegramAvatar from "./TelegramAvatar";
import { getTelegramMediaUrl } from "../../services/telegramApi";
import { toast } from "react-toastify";

export default function TelegramContactInfoPanel({
  chat,
  messages = [],
  onClose,
  onSearchInChat,
}) {
  const [activeTab, setActiveTab] = useState("media");
  const [copied, setCopied] = useState(false);

  if (!chat) return null;

  const isSelf = Boolean(chat.isSelf);
  const isGroup = chat.type === "group" || Boolean(chat.isGroup);
  const isChannel = chat.type === "channel" || Boolean(chat.isChannel);

  // Extract shared media from loaded messages
  const sharedPhotos = messages.filter((m) => m.media && m.media.type === "photo");
  const sharedDocs = messages.filter((m) => m.media && m.media.type !== "photo");

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="h-full bg-white border-l border-purple-100 flex flex-col select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-3.5 px-4 border-b border-purple-100 flex items-center justify-between bg-purple-50/20">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
          {isGroup ? "Group Info" : isChannel ? "Channel Info" : isSelf ? "Cloud Storage" : "Contact Details"}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition cursor-pointer"
            title="Close Info Panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area (Independently scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-5 tg-custom-scrollbar">
        {/* Profile Card */}
        <div className="flex flex-col items-center text-center">
          <TelegramAvatar chat={chat} size="xl" showBadge={false} className="mb-3 ring-4 ring-purple-100" />
          <h2 className="text-sm font-extrabold text-gray-900 leading-tight">
            {isSelf ? "Saved Messages" : chat.title}
          </h2>

          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
            {isSelf ? (
              <span className="text-purple-600 font-semibold">Personal cloud storage</span>
            ) : isGroup ? (
              <span>{chat.participantsCount ? `${chat.participantsCount} members` : "Telegram Group"}</span>
            ) : isChannel ? (
              <span>{chat.participantsCount ? `${chat.participantsCount} subscribers` : "Broadcast Channel"}</span>
            ) : chat.isUser ? (
              <span className="text-emerald-600 font-semibold">online</span>
            ) : (
              <span>{chat.phone || "Telegram user"}</span>
            )}
          </div>
        </div>

        {/* Quick Contact Credentials */}
        <div className="bg-purple-50/50 rounded-2xl p-3 border border-purple-100/70 space-y-2.5 text-xs">
          {chat.username && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600 min-w-0">
                <AtSign className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-mono truncate">@{chat.username}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(`@${chat.username}`)}
                className="text-gray-400 hover:text-purple-700 p-1 cursor-pointer"
                title="Copy username"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {chat.phone && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600 min-w-0">
                <Phone className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-mono truncate">{chat.phone}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(chat.phone)}
                className="text-gray-400 hover:text-purple-700 p-1 cursor-pointer"
                title="Copy phone"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-gray-500 text-[11px] pt-1 border-t border-purple-100/60">
            <span>Peer ID</span>
            <span className="font-mono text-gray-700">{chat.id}</span>
          </div>
        </div>

        {/* Shared Media & Documents Tabs */}
        <div className="space-y-2.5">
          <div className="flex items-center border-b border-purple-100 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                activeTab === "media"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media ({sharedPhotos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("docs")}
              className={`pb-2 px-3 flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                activeTab === "docs"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Docs ({sharedDocs.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "media" ? (
            sharedPhotos.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No shared photos in this conversation.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto tg-custom-scrollbar">
                {sharedPhotos.map((m) => (
                  <a
                    key={m.id}
                    href={getTelegramMediaUrl(chat.id, m.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-purple-100 hover:opacity-90 transition group relative"
                  >
                    <img
                      src={getTelegramMediaUrl(chat.id, m.id)}
                      alt="Shared media"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </a>
                ))}
              </div>
            )
          ) : sharedDocs.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">
              No shared documents or files.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto tg-custom-scrollbar">
              {sharedDocs.map((m) => (
                <a
                  key={m.id}
                  href={getTelegramMediaUrl(chat.id, m.id)}
                  download
                  className="p-2 rounded-xl bg-purple-50/50 hover:bg-purple-100/60 border border-purple-100 flex items-center justify-between text-xs transition group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="truncate text-gray-800 font-medium">{m.media?.filename || "Document"}</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-700 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
