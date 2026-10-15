import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquareText,
  Paperclip,
  Send,
  Smile,
  X,
  XCircle,
  Trash2,
  User,
  Plus,
} from "lucide-react";

import { API_BASE_URL } from "../config/api";

const API_URL = API_BASE_URL;

const QUICK_EMOJIS = [
  "👍","👎","👌","🙂","😎","🤩","🎉",
  "❤️","💙","💚","💛",
  "😂","🙏","👏",
  "✨","🤝","🚀","⭐","💯","🎯","📌","🔥"
];

const MessageCenter = () => {
  const [channel, setChannel] = useState("email"); // 'email' | 'telegram' | 'whatsapp'
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reaction, setReaction] = useState("");
  const [files, setFiles] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const fileInputRef = useRef(null);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/messages`, {
        headers: authHeaders(),
      });
      setHistory(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const insertEmoji = (emoji) => {
    setMessage((prev) => `${prev}${emoji}`);
    setReaction(emoji);
    setShowEmoji(false);
  };

  const resetComposer = () => {
    setMessage("");
    setSubject("");
    setFiles([]);
    setReaction("");
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!recipient.trim()) {
      toast.error(
        channel === "email"
          ? "Enter recipient email address"
          : channel === "telegram"
          ? "Enter recipient Telegram username or chat ID"
          : "Enter recipient WhatsApp phone number"
      );
      return;
    }
    if (!message.trim() && files.length === 0) {
      toast.error("Write a message or attach a document");
      return;
    }

    // Direct WhatsApp / Telegram share integration
    if (channel === "whatsapp") {
      const cleanPhone = recipient.replace(/[^0-9]/g, "");
      const fullText = subject.trim() ? `*${subject.trim()}*\n\n${message.trim()}` : message.trim();
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(fullText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening WhatsApp chat...");
    } else if (channel === "telegram") {
      const cleanTg = recipient.replace("@", "").trim();
      const fullText = subject.trim() ? `**${subject.trim()}**\n\n${message.trim()}` : message.trim();
      const tgUrl = `https://t.me/${cleanTg}?text=${encodeURIComponent(fullText)}`;
      window.open(tgUrl, "_blank", "noopener,noreferrer");
      toast.success("Opening Telegram message...");
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel === "whatsapp" ? "sms" : channel);
      formData.append("recipient", recipient.trim());
      formData.append(
        "message",
        subject.trim() ? `Subject: ${subject.trim()}\n\n${message.trim()}` : message.trim()
      );
      if (subject.trim()) formData.append("subject", subject.trim());
      formData.append("reaction", reaction);
      files.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(data.message || "Message sent!");
      resetComposer();
      fetchHistory();
    } catch (err) {
      if (channel === "email" || channel === "sms") {
        const msg =
          err.response?.data?.message || err.message || "Could not send message";
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      await axios.delete(`${API_URL}/api/messages/${id}`, {
        headers: authHeaders(),
      });
      setHistory((prev) => prev.filter((item) => item._id !== id));
      toast.success("Message deleted");
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Could not delete message";
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-purple-100">
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-purple-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">QuickSend</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 mb-5">
          Email or message anyone straight from Tasklert — attach documents and dispatch updates in one tap.
        </p>

        {/* CHANNEL SEGMENTED TABS MATCHING SCREEN 10 */}
        <div className="flex rounded-2xl bg-purple-50/80 p-1 mb-5 border border-purple-100">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer text-center ${
              channel === "email"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => setChannel("telegram")}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer text-center ${
              channel === "telegram"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            Telegram
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer text-center ${
              channel === "whatsapp"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            WhatsApp
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          {/* TO FIELD MATCHING SCREEN 10 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              To <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={channel === "email" ? "email" : "text"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={
                  channel === "email"
                    ? "Enter email address..."
                    : channel === "telegram"
                    ? "@username or chat ID..."
                    : "+1234567890 (Phone number)..."
                }
                className="w-full rounded-xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                required
              />
              <div className="absolute right-3 text-purple-500 pointer-events-none">
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* SUBJECT FIELD MATCHING SCREEN 10 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              className="w-full rounded-xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
              required
            />
          </div>

          {/* MESSAGE FIELD MATCHING SCREEN 10 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Message <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowEmoji((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 cursor-pointer"
                title="Add emoji"
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Emoji</span>
              </button>
            </div>

            {showEmoji && (
              <div className="mb-2 flex flex-wrap gap-1.5 rounded-xl border border-purple-100 bg-purple-50/60 p-2 animate-fadeIn">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-lg px-2 py-1 text-lg transition hover:bg-white hover:scale-110 active:scale-95 cursor-pointer"
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full rounded-xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition resize-none leading-relaxed"
              required
            />
          </div>

          {/* ATTACHED FILES LIST */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {files.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-semibold text-purple-700"
                >
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-purple-400 hover:text-purple-700 cursor-pointer p-0.5 rounded-full hover:bg-purple-100 transition"
                    title="Remove file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ATTACHMENT BUTTON MATCHING SCREEN 10 */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Add Attachment</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* FULL-WIDTH PRIMARY CTA BUTTON MATCHING SCREEN 10 */}
          <button
            type="submit"
            disabled={sending}
            className="w-full py-3.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-lg shadow-purple-600/25 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Message...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Message</span>
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Emails deliver to any inbox. Text messages need Twilio configured
            in the backend — see <code>backend/.env</code>.
          </p>
        </form>
      </div>

      {/* HISTORY */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-purple-100">
        <h2 className="mb-4 text-base sm:text-lg font-semibold text-gray-800">
          Recent messages
        </h2>

        {loadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            Nothing sent yet — your first message will show up here.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li
                key={item._id}
                className="flex items-start gap-3 rounded-lg border border-purple-50 p-3 hover:bg-purple-50/40"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.channel === "email"
                      ? "bg-sky-100 text-sky-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}
                  title={`${item.channel === "email" ? "Email" : "Text"} message`}
                >
                  {item.channel === "email" ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <MessageSquareText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span 
                        onClick={() => {
                          setChannel(item.channel);
                          setRecipient(item.recipient);
                        }}
                        className="text-sm font-medium text-gray-800 hover:text-purple-600 cursor-pointer transition"
                        title="Click to copy recipient into composer"
                      >
                        {item.recipient}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.status === "sent" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {item.status === "sent" ? "Sent" : "Failed"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setChannel(item.channel);
                          setRecipient(item.recipient);
                          if (item.message) setMessage(item.message);
                          if (item.reaction) setReaction(item.reaction);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                          toast.info("Loaded message into composer");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 transition hover:bg-purple-100 cursor-pointer"
                        title="Reuse this recipient and message in composer"
                      >
                        <span>Reuse</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(item._id)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700 sm:px-3 cursor-pointer"
                        aria-label="Delete message"
                        title="Delete message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                  {item.message && (
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {item.message}
                    </p>
                  )}
                  {item.attachments?.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className="text-gray-400">
                        {item.attachments.length} attachment{item.attachments.length > 1 ? "s" : ""}:
                      </span>
                      {item.attachments.map((a, idx) =>
                        a.url ? (
                          <a
                            key={idx}
                            href={`${API_URL}${a.url.startsWith("/") ? "" : "/"}${a.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:underline cursor-pointer font-medium"
                            title={`Download ${a.filename}`}
                          >
                            <Paperclip className="w-3 h-3" />
                            {a.filename}
                          </a>
                        ) : (
                          <span key={idx} className="inline-flex items-center gap-1 text-gray-600">
                            <Paperclip className="w-3 h-3" />
                            {a.filename}
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {item.error && item.status === "failed" && (
                    <p className="mt-0.5 text-xs text-red-500">{item.error}</p>
                  )}
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MessageCenter;
