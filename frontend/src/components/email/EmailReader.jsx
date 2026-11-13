import React, { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Trash2,
  Mail,
  Tag,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Star,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  CheckSquare,
  Bell,
  Download,
  FileText,
  Loader2,
  ChevronDown,
} from "lucide-react";
import DOMPurify from "dompurify";

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

const formatFullDate = (dateVal) => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (_) {
    return "";
  }
};

export default function EmailReader({
  email,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onTrash,
  onStar,
  onMarkUnread,
  onCreateTask,
  onSetFollowUp,
  onPrevEmail,
  onNextEmail,
  loading = false,
}) {
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  if (!email && !loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-purple-100/90 shadow-2xs text-center">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-3">
          <Mail className="w-6 h-6 text-purple-400" />
        </div>
        <h3 className="text-sm font-bold text-gray-700">No email selected</h3>
        <p className="text-xs text-gray-400 mt-1">Select an email from the list to read.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-purple-100/90 shadow-2xs">
        <Loader2 className="w-7 h-7 animate-spin text-purple-600 mb-2" />
        <span className="text-xs font-semibold text-gray-500">Loading message...</span>
      </div>
    );
  }

  const senderEmail = email.from?.includes("<")
    ? email.from.split("<")[1].replace(">", "").trim()
    : email.from || "";
  const senderName = email.fromName || (email.from?.includes("<") ? email.from.split("<")[0].replace(/"/g, "").trim() : "") || senderEmail || "Unknown";
  const initials = getInitials(senderName);
  const avatarColor = getAvatarColor(senderName);

  const rawHtml = email.htmlBody || email.body || "";

  // 1. Resolve or neutralize unresolved cid: schemes BEFORE DOMPurify parses the HTML.
  // This prevents the browser DOM parser from ever attempting to resolve cid: URLs, eliminating ERR_UNKNOWN_URL_SCHEME.
  const resolvedHtml = (rawHtml || "")
    .replace(
      /(src|srcset|background|poster|href|data-src)\s*=\s*["']?\s*cid:([^"'\s>]+)\s*["']?/gi,
      (match, attr, cid) => {
        const cleanCid = cid.replace(/^<|>$/g, "").trim();
        const found = (email.attachments || []).find(
          (a) =>
            a.contentId === cleanCid ||
            a.contentId === `<${cleanCid}>` ||
            a.filename === cleanCid ||
            a.attachmentId === cleanCid
        );
        if (found && (found.dataUrl || found.url)) {
          return `${attr}="${found.dataUrl || found.url}"`;
        }
        return `${attr}="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-cid="${cleanCid}"`;
      }
    )
    .replace(
      /url\(\s*["']?\s*cid:([^"'\)]+)\s*["']?\s*\)/gi,
      'url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")'
    )
    .replace(
      /(["'])\s*cid:([^"'\s>]+)\s*(["'])/gi,
      '$1data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7$3'
    );

  const cleanHtml = DOMPurify.sanitize(resolvedHtml, {
    FORBID_TAGS: ["script", "iframe", "form", "input"],
  });

  const attachments = email.attachments || [];

  return (
    <div className="w-full h-full flex flex-col justify-between p-3.5 sm:p-5 bg-white rounded-3xl border border-purple-100/90 shadow-2xs overflow-hidden">
      {/* ─── Top Action Toolbar ─── */}
      <div className="shrink-0 flex items-center justify-between pb-3 border-b border-purple-100/80 mb-3">
        {/* Left Toolbar Icons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer md:hidden"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSetFollowUp?.(email)}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="Add to Calendar / Event"
            aria-label="Calendar"
          >
            <Calendar className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onTrash?.(email)}
            className="p-1.5 rounded-xl hover:bg-red-50 text-gray-500 hover:text-red-600 transition cursor-pointer"
            title="Move to Trash"
            aria-label="Trash"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onMarkUnread?.(email)}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="Mark as Unread"
            aria-label="Mark unread"
          >
            <Mail className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {}}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="Labels"
            aria-label="Labels"
          >
            <Tag className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {}}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="More actions"
            aria-label="More"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Right Pagination Icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevEmail}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="Previous email"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onNextEmail}
            className="p-1.5 rounded-xl hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition cursor-pointer"
            title="Next email"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Pinned Subject & Sender Header Block ─── */}
      <div className="shrink-0 pb-3 border-b border-purple-100/80 mb-3 space-y-3">
        {/* Subject Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight break-words">
              {email.subject || "(No subject)"}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
              {email.folder || "Inbox"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onStar?.(email)}
            className={`p-1 rounded-lg transition cursor-pointer shrink-0 ${
              email.isStarred ? "text-amber-400" : "text-gray-300 hover:text-amber-400"
            }`}
            title={email.isStarred ? "Starred" : "Star email"}
          >
            <Star className={`w-4 h-4 ${email.isStarred ? "fill-amber-400" : ""}`} />
          </button>
        </div>

        {/* Sender Info Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            {/* Sender Initials Avatar */}
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-black shadow-2xs ${avatarColor}`}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-900">{senderName}</span>
                <span className="text-[11px] text-gray-500 font-medium truncate max-w-[200px] sm:max-w-xs">
                  &lt;{senderEmail}&gt;
                </span>
              </div>

              {/* "to me" dropdown */}
              <div className="relative inline-block mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowRecipientDropdown((p) => !p)}
                  className="flex items-center gap-0.5 text-[11px] text-gray-500 hover:text-purple-700 font-semibold cursor-pointer"
                >
                  <span>to me</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>

                {showRecipientDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-purple-100 rounded-2xl shadow-lg p-3 z-30 text-[11px] space-y-1">
                    <div>
                      <span className="font-bold text-gray-600">from: </span>
                      <span className="text-gray-800">{email.from}</span>
                    </div>
                    <div>
                      <span className="font-bold text-gray-600">to: </span>
                      <span className="text-gray-800">
                        {Array.isArray(email.to) ? email.to.join(", ") : email.to || ""}
                      </span>
                    </div>
                    {email.cc && (
                      <div>
                        <span className="font-bold text-gray-600">cc: </span>
                        <span className="text-gray-800">
                          {Array.isArray(email.cc) ? email.cc.join(", ") : email.cc}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-gray-600">date: </span>
                      <span className="text-gray-800">
                        {new Date(email.date || email.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date & Quick Action Icons */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-gray-400">
              {formatFullDate(email.date || email.createdAt)}
            </span>

            <button
              type="button"
              onClick={() => onReply?.(email)}
              className="p-1 hover:bg-purple-50 text-gray-400 hover:text-purple-700 rounded transition cursor-pointer"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onReplyAll?.(email)}
              className="p-1 hover:bg-purple-50 text-gray-400 hover:text-purple-700 rounded transition cursor-pointer"
              title="Reply All"
            >
              <ReplyAll className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {}}
              className="p-1 hover:bg-purple-50 text-gray-400 hover:text-purple-700 rounded transition cursor-pointer"
              title="More"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Scrollable Email Body Area ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 sm:pr-2 tg-custom-scrollbar">

        {/* ─── Email Body Content ─── */}
        <div className="text-xs sm:text-sm text-gray-800 leading-relaxed space-y-3 font-normal">
          {cleanHtml ? (
            <div
              className="prose prose-sm max-w-none gmail-html-content overflow-x-auto"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          ) : email.body ? (
            <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-800">
              {email.body}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
              (No message body)
            </div>
          )}
        </div>

        {/* ─── Real Attachments Card (Only rendered when real attachments exist) ─── */}
        {attachments && attachments.length > 0 && (
          <div className="mt-5 pt-3 border-t border-purple-50 space-y-2">
            <h4 className="text-[11px] font-bold text-gray-700">
              Attachments ({attachments.length})
            </h4>
            <div className="flex flex-wrap gap-2.5">
              {attachments.map((att, idx) => (
                <div
                  key={att.attachmentId || att.filename || idx}
                  className="inline-flex items-center gap-3 p-2.5 rounded-2xl border border-purple-100/90 bg-white hover:bg-purple-50/40 transition shadow-2xs max-w-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-[9px] shrink-0 shadow-xs uppercase">
                    {att.filename ? att.filename.split(".").pop().slice(0, 3) : "FILE"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {att.filename || "Attachment"}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Action Buttons Bar (Matches Screenshot Top Right & Bottom Right 2) ─── */}
      <div className="shrink-0 flex items-center justify-between gap-2.5 pt-3 border-t border-purple-100/80 mt-3">
        {/* Primary Actions: Reply, Reply All, Forward */}
        <div className="flex items-center gap-2 flex-1 sm:flex-none">
          <button
            type="button"
            onClick={() => onReply?.(email)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200/90 text-purple-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5 text-purple-700" />
            <span>Reply</span>
          </button>

          <button
            type="button"
            onClick={() => onReplyAll?.(email)}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <ReplyAll className="w-3.5 h-3.5 text-purple-700" />
            <span>Reply All</span>
          </button>

          <button
            type="button"
            onClick={() => onForward?.(email)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <Forward className="w-3.5 h-3.5 text-purple-700" />
            <span>Forward</span>
          </button>
        </div>

        {/* Right Tasklert Productivity Buttons (Desktop only) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateTask?.(email)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
            title="Convert this email into a Tasklert task"
          >
            <CheckSquare className="w-3.5 h-3.5 text-purple-700" />
            <span>Create Task</span>
          </button>

          <button
            type="button"
            onClick={() => onSetFollowUp?.(email)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-800 font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
            title="Set a reminder to follow up"
          >
            <Bell className="w-3.5 h-3.5 text-purple-700" />
            <span>Follow Up</span>
          </button>
        </div>
      </div>
    </div>
  );
}
