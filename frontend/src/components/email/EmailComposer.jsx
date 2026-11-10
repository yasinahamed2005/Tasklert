import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  ChevronDown,
  Loader2,
  Clock,
  FileText,
  Bold,
  Italic,
  Underline,
  List,
  Link2,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Strikethrough,
  ListOrdered,
  Calendar,
  AlertCircle,
} from "lucide-react";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "text/plain", "audio/mpeg", "video/mp4",
];
const MAX_ATTACHMENT_SIZE_MB = 25;

// Recipient chip input
function RecipientInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState("");

  const addRecipient = (email) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (["Enter", "Tab", ",", ";"].includes(e.key)) {
      e.preventDefault();
      addRecipient(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input) addRecipient(input);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 min-h-[36px] px-3 py-1.5 border-b border-purple-100 focus-within:border-purple-400 transition">
      <span className="text-xs font-bold text-gray-500 shrink-0 w-6">{label}</span>
      {value.map((email) => (
        <span
          key={email}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-lg text-[11px] font-medium"
        >
          {email}
          <button
            type="button"
            onClick={() => onChange(value.filter((e) => e !== email))}
            className="text-purple-500 hover:text-purple-800 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-xs text-gray-800 placeholder:text-gray-400 outline-none py-1"
      />
    </div>
  );
}

// Simple rich-text toolbar
function RichTextToolbar({ editorRef }) {
  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  };

  const tools = [
    { icon: Bold, cmd: "bold", title: "Bold" },
    { icon: Italic, cmd: "italic", title: "Italic" },
    { icon: Underline, cmd: "underline", title: "Underline" },
    { icon: Strikethrough, cmd: "strikeThrough", title: "Strikethrough" },
    null, // divider
    { icon: AlignLeft, cmd: "justifyLeft", title: "Align Left" },
    { icon: AlignCenter, cmd: "justifyCenter", title: "Center" },
    { icon: AlignRight, cmd: "justifyRight", title: "Align Right" },
    null,
    { icon: List, cmd: "insertUnorderedList", title: "Bullet List" },
    { icon: ListOrdered, cmd: "insertOrderedList", title: "Numbered List" },
    null,
    {
      icon: Link2,
      title: "Insert Link",
      action: () => {
        const url = prompt("Enter URL:");
        if (url) exec("createLink", url);
      },
    },
    {
      icon: Type,
      title: "Clear Formatting",
      action: () => exec("removeFormat"),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-purple-100 flex-wrap">
      {tools.map((tool, i) =>
        tool === null ? (
          <div key={i} className="w-px h-4 bg-gray-200 mx-1" />
        ) : (
          <button
            key={i}
            type="button"
            title={tool.title}
            onMouseDown={(e) => {
              e.preventDefault();
              tool.action ? tool.action() : exec(tool.cmd);
            }}
            className="p-1.5 rounded-lg text-gray-700 hover:text-purple-700 hover:bg-purple-100/70 transition cursor-pointer"
          >
            <tool.icon className="w-3.5 h-3.5" />
          </button>
        )
      )}
    </div>
  );
}

export default function EmailComposer({
  isOpen,
  onClose,
  onSend,
  onSaveDraft,
  onSchedule,
  fromAccounts = [],
  defaultTo = [],
  defaultSubject = "",
  defaultBody = "",
  replyToEmail = null,
  mode = "compose", // "compose" | "reply" | "reply_all" | "forward"
  sending = false,
  savingDraft = false,
}) {
  const [from, setFrom] = useState(fromAccounts[0]?.email || "");
  const [to, setTo] = useState(defaultTo.length > 0 ? defaultTo : (replyToEmail ? [replyToEmail.from] : []));
  const [cc, setCc] = useState(mode === "reply_all" && replyToEmail?.cc ? (Array.isArray(replyToEmail.cc) ? replyToEmail.cc : [replyToEmail.cc]) : []);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState(
    defaultSubject ||
    (replyToEmail
      ? mode === "forward"
        ? `Fwd: ${replyToEmail.subject || ""}`
        : `Re: ${replyToEmail.subject || ""}`
      : "")
  );
  const [showCc, setShowCc] = useState(cc.length > 0);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState("");
  const [error, setError] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(
    "Asia/Kolkata"
  );

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftTimerRef = useRef(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && isOpen) {
      const quoteHtml = replyToEmail && (mode === "reply" || mode === "reply_all")
        ? `<br/><br/><div style="border-left:3px solid #a855f7;padding-left:12px;color:#6b7280;font-size:13px;">
            <p><strong>${replyToEmail.fromName || replyToEmail.from}</strong> wrote:</p>
            <div>${replyToEmail.htmlBody || replyToEmail.body || ""}</div>
           </div>`
        : mode === "forward" && replyToEmail
        ? `<br/><br/><div style="color:#6b7280;font-size:13px;">
            <p>---------- Forwarded message ----------</p>
            <p>From: ${replyToEmail.fromName || replyToEmail.from}</p>
            <p>Subject: ${replyToEmail.subject || ""}</p>
            <br/>
            ${replyToEmail.htmlBody || replyToEmail.body || ""}
           </div>`
        : defaultBody || "";

      editorRef.current.innerHTML = quoteHtml;
    }
  }, [isOpen]);

  // Update from when fromAccounts changes
  useEffect(() => {
    if (fromAccounts.length > 0 && !from) {
      setFrom(fromAccounts[0].email);
    }
  }, [fromAccounts]);

  // Auto-save draft debounced
  const triggerAutosave = useCallback(() => {
    if (!onSaveDraft) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const body = editorRef.current?.innerHTML || "";
      if (to.length === 0 && !subject && !body) return;
      onSaveDraft({ from, to, cc, bcc, subject, body, attachments });
    }, 3000);
  }, [from, to, cc, bcc, subject, attachments, onSaveDraft]);

  useEffect(() => () => clearTimeout(draftTimerRef.current), []);

  const handleAttach = (e) => {
    setAttachError("");
    const files = Array.from(e.target.files || []);
    const valid = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setAttachError(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
        setAttachError(`File too large (max ${MAX_ATTACHMENT_SIZE_MB} MB): ${file.name}`);
        continue;
      }
      valid.push(file);
    }
    setAttachments((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const handleSend = async () => {
    setError("");
    if (to.length === 0) {
      setError("Please add at least one recipient.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject cannot be empty.");
      return;
    }
    const body = editorRef.current?.innerHTML || "";
    try {
      await onSend({ from, to, cc, bcc, subject, body, attachments });
    } catch (err) {
      setError(err.message || "Failed to send email. Please try again.");
    }
  };

  const handleScheduleSend = async () => {
    setError("");
    if (to.length === 0) { setError("Add at least one recipient."); return; }
    if (!subject.trim()) { setError("Subject is required."); return; }
    if (!scheduleDate || !scheduleTime) { setError("Choose a date and time to schedule."); return; }
    const body = editorRef.current?.innerHTML || "";
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    try {
      await onSchedule({ from, to, cc, bcc, subject, body, attachments, scheduledAt, timeZone: scheduleTimezone });
    } catch (err) {
      setError(err.message || "Failed to schedule email.");
    }
  };

  if (!isOpen) return null;

  const minScheduleDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:w-[720px] sm:max-w-[95vw] sm:max-h-[90vh] sm:rounded-3xl shadow-2xl border border-purple-100 flex flex-col overflow-hidden">
        {/* ─── Composer Header ─── */}
        <div
          style={{ backgroundColor: "#7c3aed" }}
          className="shrink-0 px-4 py-3 bg-purple-600 flex items-center justify-between border-b border-purple-700/30"
        >
          <h2 className="text-sm font-black text-white tracking-wide">
            {mode === "reply" ? "Reply" : mode === "reply_all" ? "Reply All" : mode === "forward" ? "Forward" : "New Message"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSaveDraft?.({ from, to, cc, bcc, subject, body: editorRef.current?.innerHTML || "", attachments })}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-white/20 hover:bg-white/30 transition cursor-pointer"
            >
              Save Draft
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-white hover:bg-white/20 transition cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* ─── From Selector ─── */}
        {fromAccounts.length > 1 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-purple-100">
            <span className="text-xs font-bold text-gray-500 w-6">Fr</span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 bg-transparent text-xs text-gray-800 outline-none cursor-pointer"
            >
              {fromAccounts.map((acc) => (
                <option key={acc.email} value={acc.email}>
                  {acc.name ? `${acc.name} <${acc.email}>` : acc.email}
                </option>
              ))}
            </select>
          </div>
        )}
        {fromAccounts.length === 1 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-purple-100">
            <span className="text-xs font-bold text-gray-500 w-6">Fr</span>
            <span className="text-xs text-gray-700">{fromAccounts[0].name ? `${fromAccounts[0].name} <${fromAccounts[0].email}>` : fromAccounts[0].email}</span>
          </div>
        )}

        {/* ─── Recipients ─── */}
        <RecipientInput label="To" value={to} onChange={setTo} placeholder="Add recipients..." />

        {showCc && <RecipientInput label="CC" value={cc} onChange={setCc} placeholder="Add CC..." />}
        {showBcc && <RecipientInput label="BCC" value={bcc} onChange={setBcc} placeholder="Add BCC..." />}

        {/* CC / BCC toggles */}
        <div className="flex items-center gap-3 px-3 py-1 border-b border-purple-100">
          {!showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer">+ CC</button>
          )}
          {!showBcc && (
            <button type="button" onClick={() => setShowBcc(true)} className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer">+ BCC</button>
          )}
        </div>

        {/* ─── Subject ─── */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-purple-100">
          <span className="text-xs font-bold text-gray-500 w-6">Su</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); triggerAutosave(); }}
            placeholder="Subject"
            className="flex-1 bg-transparent text-xs text-gray-900 placeholder:text-gray-400 outline-none py-1 font-medium"
          />
        </div>

        {/* ─── Rich Text Toolbar ─── */}
        <RichTextToolbar editorRef={editorRef} />

        {/* ─── Editor Body ─── */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={triggerAutosave}
          className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-800 outline-none leading-relaxed min-h-[200px]"
          style={{ fontFamily: "inherit" }}
          data-placeholder="Write your message..."
        />

        {/* ─── Attachments display ─── */}
        {attachments.length > 0 && (
          <div className="shrink-0 px-4 py-2 border-t border-purple-100 flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-lg text-[11px] font-medium text-purple-800"
              >
                <Paperclip className="w-3 h-3" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <span className="text-purple-500">({(file.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  className="text-purple-400 hover:text-red-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Attach error */}
        {attachError && (
          <div className="shrink-0 px-4 py-1.5 border-t border-red-100 bg-red-50 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-700">{attachError}</p>
          </div>
        )}

        {/* Send error */}
        {error && (
          <div className="shrink-0 px-4 py-1.5 border-t border-red-100 bg-red-50 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <p className="text-[11px] text-red-700">{error}</p>
          </div>
        )}

        {/* ─── Schedule Panel ─── */}
        {showSchedule && (
          <div className="shrink-0 px-4 py-3 border-t border-purple-100 bg-purple-50/40 space-y-2">
            <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" /> Schedule Send
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={scheduleDate}
                min={minScheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
              <select
                value={scheduleTimezone}
                onChange={(e) => setScheduleTimezone(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              >
                {Intl.supportedValuesOf("timeZone").map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleScheduleSend}
                disabled={sending}
                className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-50"
              >
                Confirm Schedule
              </button>
              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ─── Bottom Toolbar ─── */}
        <div className="shrink-0 px-4 py-3 border-t border-purple-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Attach file */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(",")}
              onChange={handleAttach}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              className="p-2 rounded-xl text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Schedule */}
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              title="Schedule Send"
              className={`p-2 rounded-xl transition cursor-pointer ${showSchedule ? "text-purple-700 bg-purple-50" : "text-gray-500 hover:text-purple-700 hover:bg-purple-50"}`}
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Discard */}
            <button
              type="button"
              onClick={onClose}
              title="Discard"
              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Actions: Schedule Email & Send Now */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSchedule((prev) => !prev)}
              disabled={sending || to.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                showSchedule
                  ? "bg-purple-100 text-purple-800 border-purple-300"
                  : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
              }`}
              title="Schedule this email for future delivery"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule Email</span>
              <span className="sm:hidden">Schedule</span>
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || to.length === 0}
              style={{ backgroundColor: to.length === 0 ? "#a78bfa" : "#7c3aed" }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-black shadow-md shadow-purple-500/25 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer border border-purple-600"
            >
              {sending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> <span>Sending...</span></>
              ) : (
                <><Send className="w-3.5 h-3.5 text-white -rotate-12" /> <span>Send Now</span></>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* CSS for placeholder text */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

