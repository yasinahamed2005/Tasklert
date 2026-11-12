import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Plus,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Paperclip,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Zap,
  Sparkles,
  User,
  Calendar,
  X,
  Repeat,
} from "lucide-react";
import { toast } from "react-toastify";
import DOMPurify from "dompurify";
import { TasklertMailIcon, SimpleMailIcon } from "../TasklertLogo";
import {
  fetchTasklertSentMails,
  fetchTasklertDrafts,
  deleteTasklertMail,
  resendTasklertMail,
} from "../../services/emailApi";
import { fetchScheduledDeliveries, cancelScheduledDelivery } from "../../services/unifiedScheduleApi";

export default function TasklertMailDashboard({ onOpenCompose, onOpenSchedule }) {
  const [activeTab, setActiveTab] = useState("sent"); // "sent" | "scheduled" | "drafts"
  const [emails, setEmails] = useState([]);
  const [scheduledItems, setScheduledItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [totalCount, setTotalCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);

  // Email Detail Drawer / Modal
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [isResending, setIsResending] = useState(false);

  // Load emails and scheduled deliveries
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch scheduled count for tab badge
      fetchScheduledDeliveries({ channel: "tasklert_mail", status: "scheduled" })
        .then((res) => setScheduledCount(res?.deliveries?.length || 0))
        .catch(() => {});

      if (activeTab === "sent") {
        const data = await fetchTasklertSentMails({
          search: searchQuery,
          priority: selectedPriority,
        });
        setEmails(data.messages || []);
        setTotalCount(data.totalCount || 0);
      } else if (activeTab === "scheduled") {
        const data = await fetchScheduledDeliveries({
          channel: "tasklert_mail",
          search: searchQuery,
        });
        setScheduledItems(data.deliveries || []);
        setTotalCount(data.deliveries?.length || 0);
      } else {
        const data = await fetchTasklertDrafts();
        setEmails(data.drafts || []);
        setTotalCount(data.drafts?.length || 0);
      }
    } catch (err) {
      console.warn("Could not load Tasklert Mail records:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, selectedPriority]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Delete email record
  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm("Remove this email from your Tasklert Mail history? (The recipient's email will not be deleted)")) {
      return;
    }
    try {
      await deleteTasklertMail(id);
      toast.success("Removed from history.");
      if (selectedEmail?._id === id) setSelectedEmail(null);
      loadEmails();
    } catch (err) {
      toast.error("Could not delete record.");
    }
  };

  // Resend email
  const handleResend = async (id) => {
    setIsResending(true);
    try {
      await resendTasklertMail(id);
      toast.success("Email resent successfully via Tasklert Mail!");
      loadEmails();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend email.");
    } finally {
      setIsResending(false);
    }
  };

  // Copy recipient
  const handleCopyRecipient = (recipient, e) => {
    e?.stopPropagation();
    navigator.clipboard?.writeText(recipient);
    toast.info(`Copied ${recipient} to clipboard.`);
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-white border-0 sm:border sm:border-gray-100 sm:rounded-2xl sm:shadow-xs md:overflow-hidden">
      
      {/* ─── Top Banner (Official Tasklert Mail Logo & Branding) ─── */}
      <div className="shrink-0 p-3 sm:p-4 bg-gradient-to-r from-emerald-50/70 via-white to-purple-50/30 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-3">
          {/* Circular Tasklert Mail Brand Logo (Image 2 reference + Tasklert brand ring) */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-100/90 bg-white">
            <TasklertMailIcon size={38} className="rounded-full" idPrefix="tasklert-mail-logo" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-emerald-950 tracking-tight">
                Tasklert Mail
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200/60">
                Pro Delivery
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
              Send professional emails directly from Tasklert with verified sender attribution.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onOpenCompose?.(2)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Compose Tasklert Mail</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenSchedule?.({ channel: "tasklert_mail" })}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95 shrink-0"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* ─── Navigation Tabs & Search Toolbar ─── */}
      <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2.5">
        
        {/* Tabs: Sent Mail vs Scheduled vs Drafts */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("sent")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "sent"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <span>Sent Mail</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "sent" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                {activeTab === "sent" ? totalCount : emails.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scheduled")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "scheduled"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Scheduled</span>
              {scheduledCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === "scheduled" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
                }`}>
                  {scheduledCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("drafts")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "drafts"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              Drafts
            </button>
          </div>

          {/* Mobile Refresh Button */}
          <button
            type="button"
            onClick={loadEmails}
            title="Refresh"
            className="sm:hidden p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-md ml-auto">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by recipient, subject..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 focus:border-emerald-500 bg-white text-xs outline-none transition"
            />
          </div>

          {activeTab === "sent" && (
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="action_required">⚡ Action Required</option>
              <option value="important">⭐ Important</option>
              <option value="normal">Normal</option>
            </select>
          )}

          <button
            type="button"
            onClick={loadEmails}
            title="Refresh"
            className="hidden sm:inline-flex p-1.5 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Mail List Body (Clean, Flat, Simple Rows) ─── */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-medium">Loading Tasklert Mail records...</span>
          </div>
        ) : activeTab === "scheduled" ? (
          scheduledItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <div className="w-14 h-14 rounded-3xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 mb-3 shadow-2xs">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-gray-900">No scheduled Tasklert Mails</h3>
              <p className="text-xs text-gray-500 max-w-xs mt-1 mb-4">
                Schedule emails to be sent automatically at a future date and time.
              </p>
              <button
                type="button"
                onClick={() => onOpenSchedule?.({ channel: "tasklert_mail" })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule a Tasklert Mail</span>
              </button>
            </div>
          ) : (
            scheduledItems.map((item) => (
              <div
                key={item._id}
                className="py-3 px-3 sm:px-4 hover:bg-purple-50/30 transition cursor-pointer flex items-center justify-between gap-3 group active:bg-gray-100/70"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/70 shadow-2xs">
                    <SimpleMailIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-gray-900 truncate max-w-[170px] sm:max-w-xs">
                        To: {item.recipient}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                        Scheduled
                      </span>
                    </div>
                    {item.subject && (
                      <p className="text-xs font-bold text-gray-800 truncate mt-0.5">
                        {item.subject}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                      {item.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] font-bold text-purple-700 flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3 text-purple-500" />
                      <span>{new Date(item.scheduledAt).toLocaleDateString()}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">
                      {new Date(item.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm("Cancel this scheduled email?")) return;
                      try {
                        await cancelScheduledDelivery(item._id);
                        toast.success("Scheduled email cancelled.");
                        loadEmails();
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to cancel.");
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition"
                    title="Cancel Schedule"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-2xs">
              <SimpleMailIcon size={26} />
            </div>
            <h3 className="text-sm font-extrabold text-gray-900">No {activeTab === "sent" ? "sent emails" : "drafts"} found</h3>
            <p className="text-xs text-gray-500 max-w-xs mt-1 mb-4">
              {searchQuery
                ? "No emails matched your search query."
                : "You haven't composed any Tasklert Mails yet. Compose a message to any external inbox."}
            </p>
            <button
              type="button"
              onClick={() => onOpenCompose?.(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose your first Tasklert Mail</span>
            </button>
          </div>
        ) : (
          emails.map((mail) => (
            <div
              key={mail._id}
              onClick={() => setSelectedEmail(mail)}
              className="py-3 px-3 sm:px-4 hover:bg-emerald-50/30 transition cursor-pointer flex items-center justify-between gap-3 group active:bg-gray-100/70"
            >
              {/* Left Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Simple Mail Icon (Image 2 style) */}
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/70 shadow-2xs">
                  <SimpleMailIcon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-gray-900 truncate max-w-[170px] sm:max-w-xs">
                      To: {mail.to?.join(", ") || "Unknown Recipient"}
                    </span>
                    
                    {/* Priority Badge */}
                    {mail.priority === "action_required" && (
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[9px] sm:text-[10px] font-extrabold">
                        ⚡ Action Required
                      </span>
                    )}
                    {mail.priority === "important" && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] sm:text-[10px] font-extrabold">
                        ⭐ Important
                      </span>
                    )}

                    {/* Delivery Status */}
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[9px] sm:text-[10px] font-bold border border-emerald-200/60 inline-flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Sent</span>
                    </span>
                  </div>

                  <p className="text-xs text-gray-800 font-semibold truncate mt-0.5">
                    {mail.subject || "(No Subject)"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {mail.snippet || mail.body?.slice(0, 100) || ""}
                  </p>
                </div>
              </div>

              {/* Right Meta & Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {mail.hasAttachment && (
                  <span className="text-gray-400" title="Has attachments">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                )}
                <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 whitespace-nowrap">
                  {new Date(mail.date || mail.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-600 transition" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mobile Floating Action Button to Compose Tasklert Mail */}
      <button
        type="button"
        onClick={() => onOpenCompose?.(2)}
        className="md:hidden fixed bottom-18 right-4 z-30 p-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        title="Compose Tasklert Mail"
        aria-label="Compose Tasklert Mail"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* ─── Email Detail Modal / Drawer ─── */}
      {selectedEmail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEmail(null);
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-purple-100 flex flex-col overflow-hidden max-h-[88vh] animate-scaleUp">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-purple-50 bg-purple-50/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 truncate max-w-xs">
                    {selectedEmail.subject || "(No Subject)"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Sent via Tasklert Mail • {new Date(selectedEmail.date || selectedEmail.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Meta Details */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Priority & Delivery Badge */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-purple-50">
                <div className="flex items-center gap-2">
                  {selectedEmail.priority === "action_required" && (
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-extrabold">
                      ⚡ Action Required
                    </span>
                  )}
                  {selectedEmail.priority === "important" && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
                      ⭐ Important
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                    ✓ Sent / Provider Accepted
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyRecipient(selectedEmail.to?.[0])}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition"
                    title="Copy recipient"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(selectedEmail._id, e)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-700 hover:bg-red-50 transition"
                    title="Delete from history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* To, From & CC */}
              <div className="p-3.5 rounded-2xl bg-purple-50/40 border border-purple-100 space-y-1.5 text-xs">
                <div>
                  <span className="font-bold text-gray-500 w-12 inline-block">To:</span>
                  <span className="font-semibold text-gray-900">{selectedEmail.to?.join(", ")}</span>
                </div>
                {selectedEmail.cc?.length > 0 && (
                  <div>
                    <span className="font-bold text-gray-500 w-12 inline-block">CC:</span>
                    <span className="font-medium text-gray-800">{selectedEmail.cc.join(", ")}</span>
                  </div>
                )}
                <div>
                  <span className="font-bold text-gray-500 w-12 inline-block">From:</span>
                  <span className="font-medium text-gray-800">
                    {selectedEmail.fromName || "Tasklert User"} &lt;{selectedEmail.from}&gt;
                  </span>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Message Body</h4>
                <div
                  className="p-4 rounded-2xl border border-gray-200 bg-white text-xs leading-relaxed text-gray-800 overflow-x-auto whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      (selectedEmail.htmlBody || selectedEmail.body || selectedEmail.snippet || "")
                        .replace(
                          /(src|srcset|background|poster)\s*=\s*["']?\s*cid:([^"'\s>]+)\s*["']?/gi,
                          '$1="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"'
                        )
                        .replace(
                          /url\(\s*["']?\s*cid:([^"'\)]+)\s*["']?\s*\)/gi,
                          'url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")'
                        ),
                      { FORBID_TAGS: ["script", "iframe", "form", "input"] }
                    ),
                  }}
                />
              </div>

              {/* Attachments if any */}
              {selectedEmail.attachments?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Attachments ({selectedEmail.attachments.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.attachments.map((att, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-900"
                      >
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>{att.filename}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-purple-50 bg-gray-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 transition"
              >
                Close
              </button>

              <button
                type="button"
                disabled={isResending}
                onClick={() => handleResend(selectedEmail._id)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
              >
                <Repeat className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                <span>{isResending ? "Resending..." : "Resend Email"}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

