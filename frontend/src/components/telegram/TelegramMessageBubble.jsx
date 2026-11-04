import React from "react";
import {
  CheckCheck,
  Trash2,
  FileText,
  Download,
  Image as ImageIcon,
  BarChart2,
  MapPin,
  Mic,
  Music,
  ExternalLink,
} from "lucide-react";
import { getTelegramMediaUrl } from "../../services/telegramApi";

/**
 * Reusable, theme-aware Telegram message bubble component.
 * Adapts dynamically to the active Tasklert theme without page refreshes.
 */
export default function TelegramMessageBubble({
  msg,
  activeChat,
  onDeleteRequest,
  isFailedMedia = false,
  onMediaError,
}) {
  const isOut = Boolean(msg.out);

  const formatMsgTime = (isoString) => {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  };

  return (
    <div
      className={`flex items-end gap-2 group ${
        isOut ? "justify-end" : "justify-start"
      }`}
    >
      {/* Delete button (visible on hover) */}
      <button
        type="button"
        onClick={() => onDeleteRequest(msg)}
        className={`opacity-0 group-hover:opacity-100 text-gray-400 hover:text-rose-600 p-1 transition cursor-pointer shrink-0 ${
          isOut ? "order-first" : "order-last"
        }`}
        title="Delete message"
        aria-label="Delete message"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Bubble Container with Theme-Aware CSS Variables */}
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-2xs transition-all duration-150 ${
          isOut ? "rounded-br-xs" : "rounded-bl-xs border"
        }`}
        style={
          isOut
            ? {
                backgroundColor: "var(--tg-bubble-out-bg)",
                color: "var(--tg-bubble-out-text)",
              }
            : {
                backgroundColor: "var(--tg-bubble-in-bg)",
                color: "var(--tg-bubble-in-text)",
                borderColor: "var(--tg-bubble-in-border)",
              }
        }
      >
        {/* Sender Name in Group Conversations */}
        {!isOut && activeChat?.type === "group" && (msg.senderName || msg.fromName) && (
          <p className="text-[11px] font-bold text-purple-600 mb-1 leading-none select-none">
            {msg.senderName || msg.fromName}
          </p>
        )}
        {/* Media Content Attachment */}
        {msg.media && (
          <div className="mb-2 rounded-xl overflow-hidden">
            {/* 1. PHOTO */}
            {msg.media.type === "photo" ? (
              <div className="relative group/photo">
                {isFailedMedia ? (
                  <div className="p-3.5 rounded-xl bg-black/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon className="w-5 h-5 opacity-70 shrink-0" />
                      <span className="text-xs truncate font-medium">Telegram photo</span>
                    </div>
                    <a
                      href={getTelegramMediaUrl(activeChat.id, msg.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 transition shrink-0"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <>
                    <img
                      src={getTelegramMediaUrl(activeChat.id, msg.id)}
                      alt="Telegram media"
                      className="max-h-72 w-full object-cover rounded-xl"
                      loading="lazy"
                      onError={() => onMediaError?.(msg.id)}
                    />
                    <a
                      href={getTelegramMediaUrl(activeChat.id, msg.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition shadow-xs"
                      title="Download Photo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            ) : msg.media.type === "poll" ? (
              /* 2. POLL */
              <div className={`p-3.5 rounded-xl space-y-2.5 ${isOut ? "bg-black/15" : "bg-black/5"}`}>
                <div className="flex items-start gap-2">
                  <BarChart2 className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
                  <div>
                    <h4 className="text-xs font-bold leading-tight">{msg.media.question}</h4>
                    <p className="text-[10px] opacity-75 mt-0.5">
                      {msg.media.publicVoters ? "Public Poll" : "Anonymous Poll"}
                      {msg.media.multipleChoice ? " • Multiple Answers" : ""}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  {msg.media.answers?.map((ans, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                        isOut ? "bg-white/10 border-white/20" : "bg-white dark:bg-slate-800 border-purple-100 dark:border-slate-700"
                      }`}
                    >
                      <span>{ans.text}</span>
                      <span className="text-[10px] opacity-70">○</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] opacity-75 text-right pt-0.5">
                  {msg.media.totalVoters || 0} votes
                </div>
              </div>
            ) : msg.media.type === "location" ? (
              /* 3. LOCATION */
              <div className={`p-3 rounded-xl flex items-center justify-between gap-3 ${isOut ? "bg-black/15" : "bg-black/5"}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Location Pin</div>
                    <div className="text-[10px] opacity-75 font-mono">
                      {msg.media.latitude?.toFixed(4)}, {msg.media.longitude?.toFixed(4)}
                    </div>
                  </div>
                </div>
                <a
                  href={`https://maps.google.com/?q=${msg.media.latitude},${msg.media.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition shrink-0 ${
                    isOut ? "bg-white/20 hover:bg-white/30 text-white" : "bg-white text-purple-700 shadow-2xs hover:bg-purple-50"
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Map</span>
                </a>
              </div>
            ) : msg.media.type === "voice" ? (
              /* 4. VOICE NOTE */
              <div className={`p-3 rounded-xl space-y-2 ${isOut ? "bg-black/15" : "bg-black/5"}`}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Mic className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">Voice Message</div>
                    <div className="text-[10px] opacity-75">Audio note</div>
                  </div>
                </div>
                <audio
                  controls
                  src={getTelegramMediaUrl(activeChat.id, msg.id)}
                  className="w-full h-8"
                  preload="metadata"
                />
              </div>
            ) : (
              /* 5. DOCUMENT / FILE / AUDIO */
              <div
                className={`p-3 rounded-xl flex items-center justify-between gap-3 ${
                  isOut ? "bg-black/15" : "bg-black/5 border border-purple-100/50"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {msg.media.type === "audio" ? (
                    <Music className={`w-5 h-5 shrink-0 ${isOut ? "text-white" : "text-purple-600"}`} />
                  ) : (
                    <FileText className={`w-5 h-5 shrink-0 ${isOut ? "text-white" : "text-purple-600"}`} />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate leading-tight">
                      {msg.media.filename || "Attachment"}
                    </div>
                    {msg.media.size > 0 && (
                      <div className="text-[10px] opacity-75 mt-0.5">
                        {(msg.media.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                    )}
                  </div>
                </div>
                <a
                  href={getTelegramMediaUrl(activeChat.id, msg.id)}
                  download
                  className={`p-1.5 rounded-lg transition shrink-0 ${
                    isOut
                      ? "bg-white/20 hover:bg-white/30 text-white"
                      : "bg-white text-purple-700 shadow-2xs hover:bg-purple-50"
                  }`}
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Message Text */}
        {msg.text && (
          <p className="text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text font-normal">
            {msg.text}
          </p>
        )}

        {/* Metadata: Time, Edited status, and Delivery Ticks */}
        <div
          className="flex items-center justify-end gap-1 mt-1 text-[10px] select-none"
          style={{
            color: isOut ? "var(--tg-bubble-out-meta)" : "var(--tg-bubble-in-meta)",
          }}
        >
          {msg.isEdited && <span className="opacity-75">(edited)</span>}
          <span>{formatMsgTime(msg.date)}</span>
          {isOut && <CheckCheck className="w-3.5 h-3.5 inline stroke-2" />}
        </div>
      </div>
    </div>
  );
}
