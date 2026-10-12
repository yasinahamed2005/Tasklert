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
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const QUICK_EMOJIS = [
  "👍","👎","👌","🙂","😎","🤩","🎉",
  "❤️","💙","💚","💛",
  "😂","🙏","👏",
  "✨","🤝","🚀","⭐","💯","🎯","📌","🔥"
];

const MessageCenter = () => {
  const [channel, setChannel] = useState("email");
  const [recipient, setRecipient] = useState("");
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
    setFiles([]);
    setReaction("");
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!recipient.trim()) {
      toast.error(
        channel === "email"
          ? "Enter the recipient's email address"
          : "Enter the recipient's phone number"
      );
      return;
    }
    if (!message.trim() && files.length === 0) {
      toast.error("Write a message or attach a document");
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", recipient.trim());
      formData.append("message", message.trim());
      formData.append("reaction", reaction);
      files.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(data.message || "Message sent!");
      resetComposer();
      fetchHistory();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Could not send message";
      toast.error(msg);
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
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-purple-100">
        <div className="flex items-center gap-2 mb-1">
          <Send className="w-5 h-5 text-purple-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Quick Send</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Email or text anyone straight from Tasklert — attach documents and
          send a quick reaction along with it.
        </p>

        {/* CHANNEL TOGGLE */}
        <div className="inline-flex rounded-full bg-purple-50 p-1 mb-4">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              channel === "email"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-purple-600"
            }`}
          >
            <Mail className="w-4 h-4" /> Email
          </button>
          <button
            type="button"
            onClick={() => setChannel("sms")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
              channel === "sms"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-500 hover:text-purple-600"
            }`}
          >
            <MessageSquareText className="w-4 h-4" /> Text Message
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          {/* RECIPIENT */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              {channel === "email" ? "Recipient email" : "Recipient phone number"}
            </label>
            <input
              type={channel === "email" ? "email" : "tel"}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={channel === "email" ? "name@example.com" : "+15551234567"}
              className="w-full rounded-lg border border-purple-100 px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* ATTACHED FILES */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span
                  key={`${file.name}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700"
                >
                  <Paperclip className="w-3 h-3" />
                  {file.name}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-purple-400 hover:text-purple-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* COMPOSER BAR */}
          <div className="rounded-2xl border border-purple-100 bg-white px-3 py-3 shadow-sm focus-within:ring-2 focus-within:ring-purple-500">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-full p-2 text-gray-500 transition hover:bg-purple-50 hover:text-purple-600"
                aria-label="Attach a document"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => setShowEmoji((prev) => !prev)}
                className="shrink-0 rounded-full p-2 text-gray-500 transition hover:bg-purple-50 hover:text-purple-600"
                aria-label="Add a quick reaction"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            {showEmoji && (
              <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border border-purple-100 bg-purple-50/60 p-2">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="rounded-lg px-2 py-1 text-lg transition hover:bg-white"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message"
              rows={5}
              className="min-h-[140px] w-full resize-none rounded-xl border border-purple-100 bg-purple-50/30 px-4 py-3 text-sm leading-6 text-gray-700 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="btn-primary-strong inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-md transition hover:shadow-lg disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
                Send
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
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
                      <span className="text-sm font-medium text-gray-800">
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

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(item._id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 hover:text-red-700 sm:px-3"
                      aria-label="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                  {item.message && (
                    <p className="mt-0.5 truncate text-sm text-gray-600">
                      {item.message}
                    </p>
                  )}
                  {item.attachments?.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {item.attachments.length} attachment
                      {item.attachments.length > 1 ? "s" : ""}:{" "}
                      {item.attachments.map((a) => a.filename).join(", ")}
                    </p>
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
