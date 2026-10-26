import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Smile,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  X,
  XCircle,
} from "lucide-react";

import { API_BASE_URL, resolveAttachmentUrl } from "../config/api";
import { useModalAccessibility } from "../utils/scrollLock";

// Lazy-load emoji picker to keep initial bundle tiny and Lighthouse Mobile Performance at 90+
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const QUICK_EMOJIS = [
  "👍", "🤝", "🚀", "🎉", "❤️", "🔥", "💯", "⭐", "✅", "⏰", "📌", "💡"
];

const STARTER_TEMPLATES = [
  {
    _id: "starter_task_update",
    title: "Task Progress Update",
    category: "Productivity",
    channel: "all",
    subject: "Task Update: {{task}}",
    body: "Hi {{name}},\n\nHere is a quick update on {{task}}: it is currently progressing on schedule and expected to finish by {{date}}.\n\nBest regards,\nTasklert Team",
    placeholders: ["{{name}}", "{{task}}", "{{date}}"],
    isStarter: true,
  },
  {
    _id: "starter_meeting_reminder",
    title: "Meeting Reminder",
    category: "Schedule",
    channel: "all",
    subject: "Reminder: Upcoming Meeting on {{date}}",
    body: "Hi {{name}},\n\nFriendly reminder regarding our sync scheduled for {{date}} at {{time}}.\n\nPlease let me know if you need to reschedule.",
    placeholders: ["{{name}}", "{{date}}", "{{time}}"],
    isStarter: true,
  },
  {
    _id: "starter_project_handover",
    title: "Project Deliverable & Handover",
    category: "Productivity",
    channel: "all",
    subject: "Deliverable Handover: {{task}}",
    body: "Hi {{name}},\n\nThe deliverable for {{task}} has been completed. All relevant documents and logs are available in Tasklert.\n\nThank you!",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_quick_followup",
    title: "Quick Follow-Up",
    category: "Communication",
    channel: "all",
    subject: "Quick follow-up on {{task}}",
    body: "Hi {{name}},\n\nJust checking in regarding {{task}}. Let me know if you have any questions or need anything from my side.\n\nThanks!",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_deadline_alert",
    title: "Upcoming Deadline Alert",
    category: "Urgent",
    channel: "all",
    subject: "Urgent: {{task}} Due on {{date}}",
    body: "Hi {{name}},\n\nAlert: The deadline for {{task}} is approaching on {{date}}.\n\nPlease ensure all pending items are resolved before submission.",
    placeholders: ["{{name}}", "{{task}}", "{{date}}"],
    isStarter: true,
  },
  {
    _id: "starter_approval_request",
    title: "Review & Approval Request",
    category: "Workflow",
    channel: "all",
    subject: "Approval Requested: {{task}}",
    body: "Hi {{name}},\n\nCould you please take a moment to review and approve {{task}}?\n\nYour feedback would be greatly appreciated.",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_standup_summary",
    title: "Daily Standup Summary",
    category: "Status",
    channel: "all",
    subject: "Standup Summary - {{date}}",
    body: "Daily Standup:\n- Completed: {{task}}\n- Today's Focus: Priority objectives\n- Blockers: None\n\nDate: {{date}}",
    placeholders: ["{{task}}", "{{date}}"],
    isStarter: true,
  },
];

const MessageCenter = () => {
  // Composer Form State
  const [channel, setChannel] = useState("email"); // 'email' | 'telegram' | 'whatsapp'
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reaction, setReaction] = useState("");
  const [files, setFiles] = useState([]);
  const [draftId, setDraftId] = useState(null);

  // Scheduling State
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [userTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );

  // UI Interactive States
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showProviderDetails, setShowProviderDetails] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("General");
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Template Search & Category Filter State
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("All");

  // Async Execution States
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  // History & Filters State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyFilter, setHistoryFilter] = useState("all"); // 'all' | 'scheduled' | 'draft' | 'sent' | 'failed' | 'cancelled'
  const [historySearch, setHistorySearch] = useState("");

  // Providers & Templates Cache
  const [providers, setProviders] = useState({
    email: { configured: true, label: "Ready (SMTP / Resend / Brevo)", provider: "smtp" },
    telegram: { configured: false, label: "Setup required (TELEGRAM_BOT_TOKEN)", botUsername: null },
    whatsapp: { configured: false, label: "Setup required (Cloud API or Twilio)", provider: "none" },
    sms: { configured: false, label: "Setup required (Twilio)" },
  });
  const [templates, setTemplates] = useState(STARTER_TEMPLATES);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // References
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const templateModalRef = useRef(null);
  const saveTemplateModalRef = useRef(null);
  const savedSelectionRef = useRef({ start: 0, end: 0 });

  // Modal accessibility hooks (locks body scroll, handles Escape key, restores focus)
  useModalAccessibility({
    isOpen: showTemplateModal,
    onClose: () => setShowTemplateModal(false),
    modalRef: templateModalRef,
  });

  useModalAccessibility({
    isOpen: showSaveTemplateModal,
    onClose: () => setShowSaveTemplateModal(false),
    modalRef: saveTemplateModalRef,
  });

  // Outside-click and Escape listeners for WhatsApp-style Emoji Picker
  useEffect(() => {
    if (!showEmojiPicker) return;

    const handlePointerDown = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmojiPicker(false);
        textareaRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch Message History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages`, {
        headers: authHeaders(),
      });
      setHistory(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("fetchHistory error:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Fetch Provider Readiness Status
  const fetchProviders = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages/providers`, {
        headers: authHeaders(),
      });
      if (data?.providers) {
        setProviders(data.providers);
      }
    } catch (err) {
      console.error("fetchProviders error:", err);
    }
  }, []);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages/templates`, {
        headers: authHeaders(),
      });
      if (Array.isArray(data?.templates)) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("fetchTemplates error:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchProviders();
    fetchTemplates();
  }, [fetchHistory, fetchProviders, fetchTemplates]);

  // Track cursor position whenever user interacts with the textarea
  const handleTextareaSelection = (e) => {
    savedSelectionRef.current = {
      start: e.target.selectionStart ?? e.target.value.length,
      end: e.target.selectionEnd ?? e.target.value.length,
    };
  };

  // Insert Emoji at Saved Cursor Position in Textarea (WhatsApp-Style)
  const handleEmojiSelect = (emojiChar) => {
    const textarea = textareaRef.current;
    const currentMsg = message;
    let start = savedSelectionRef.current.start;
    let end = savedSelectionRef.current.end;

    if (typeof start !== "number" || start < 0 || start > currentMsg.length) {
      start = currentMsg.length;
      end = currentMsg.length;
    }

    const before = currentMsg.slice(0, start);
    const after = currentMsg.slice(end);
    const updated = before + emojiChar + after;
    const nextCursor = start + emojiChar.length;

    setMessage(updated);
    setReaction(emojiChar);
    savedSelectionRef.current = { start: nextCursor, end: nextCursor };

    // Seamlessly restore focus and caret right after the inserted emoji
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  // File Attachments
  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    const maxFiles = 5;
    const maxSize = 15 * 1024 * 1024; // 15 MB

    const validFiles = [];
    for (const file of picked) {
      if (file.size > maxSize) {
        toast.error(`"${file.name}" exceeds the 15MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    setFiles((prev) => [...prev, ...validFiles].slice(0, maxFiles));
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Clear / Reset Composer
  const resetComposer = () => {
    setRecipient("");
    setSubject("");
    setMessage("");
    setFiles([]);
    setReaction("");
    setDraftId(null);
    setIsScheduling(false);
    setScheduledDate("");
    setScheduledTime("");
    setShowQuickEmojis(false);
    setShowEmojiPicker(false);
  };

  // Populate Composer with Existing Message / Draft
  const loadIntoComposer = (item, isDraftEdit = false) => {
    setChannel(item.channel || "email");
    setRecipient(item.recipient || "");
    setSubject(item.subject || "");
    setMessage(item.message || "");
    setReaction(item.reaction || "");
    setDraftId(isDraftEdit ? item._id : null);

    if (item.status === "scheduled" && item.scheduledAt) {
      setIsScheduling(true);
      const sched = new Date(item.scheduledAt);
      const yyyy = sched.getFullYear();
      const mm = String(sched.getMonth() + 1).padStart(2, "0");
      const dd = String(sched.getDate()).padStart(2, "0");
      const hh = String(sched.getHours()).padStart(2, "0");
      const min = String(sched.getMinutes()).padStart(2, "0");
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
      setScheduledTime(`${hh}:${min}`);
    } else {
      setIsScheduling(false);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info(isDraftEdit ? "Draft loaded into composer" : "Message loaded into composer");
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!recipient.trim() && !message.trim() && files.length === 0) {
      toast.error("Please add a recipient or message content before saving draft");
      return;
    }

    setSavingDraft(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", recipient.trim() || "Unspecified");
      formData.append("subject", subject.trim());
      formData.append("message", message.trim());
      formData.append("reaction", reaction);
      formData.append("isDraft", "true");
      if (draftId) {
        formData.append("draftId", draftId);
      }
      files.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success("Draft saved successfully!");
      if (data?.log?._id) {
        setDraftId(data.log._id);
      }
      fetchHistory();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to save draft";
      toast.error(errMsg);
    } finally {
      setSavingDraft(false);
    }
  };

  // Send or Schedule Message
  const handleSend = async (e) => {
    e.preventDefault();

    if (!recipient.trim()) {
      toast.error(
        channel === "email"
          ? "Enter recipient email address"
          : channel === "telegram"
          ? "Enter recipient Telegram username or numeric chat ID"
          : "Enter recipient WhatsApp phone number with country code"
      );
      return;
    }

    if (!message.trim() && files.length === 0) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    // Scheduling Validation
    let combinedScheduledIso = null;
    if (isScheduling) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Please pick both a date and time for scheduled send");
        return;
      }
      const parsedSched = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(parsedSched.getTime())) {
        toast.error("Invalid scheduled date/time selected");
        return;
      }
      if (parsedSched.getTime() <= Date.now()) {
        toast.error("Scheduled delivery time must be in the future");
        return;
      }
      combinedScheduledIso = parsedSched.toISOString();
    }

    // Direct Device Fallback helper for WhatsApp Web link
    const waDirectUrl =
      channel === "whatsapp"
        ? `https://wa.me/${recipient.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
            subject ? `*${subject.trim()}*\n\n${message.trim()}` : message.trim()
          )}`
        : null;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", recipient.trim());
      formData.append("subject", subject.trim());
      formData.append("message", message.trim());
      formData.append("reaction", reaction);
      formData.append("timeZone", userTimeZone);

      if (combinedScheduledIso) {
        formData.append("scheduledAt", combinedScheduledIso);
      }
      if (draftId) {
        formData.append("draftId", draftId);
      }
      files.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(data.message || (isScheduling ? "Message scheduled!" : "Message sent!"));
      resetComposer();
      fetchHistory();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to process message";

      // If WhatsApp failed because provider credentials aren't set in backend, offer convenient direct link
      if (
        channel === "whatsapp" &&
        errMsg.toLowerCase().includes("not configured") &&
        waDirectUrl
      ) {
        toast.info("WhatsApp Cloud API not active — opening WhatsApp directly for you...");
        window.open(waDirectUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSending(false);
    }
  };

  // Cancel Scheduled Message
  const handleCancelScheduled = async (id) => {
    setCancellingId(id);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${id}/cancel`,
        {},
        { headers: authHeaders() }
      );
      toast.success(data.message || "Scheduled message cancelled");
      fetchHistory();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Could not cancel message";
      toast.error(errMsg);
    } finally {
      setCancellingId(null);
    }
  };

  // Retry Failed Message
  const handleRetryMessage = async (id) => {
    setRetryingId(id);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${id}/retry`,
        {},
        { headers: authHeaders() }
      );
      toast.success(data.message || "Message resent successfully");
      fetchHistory();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Retry failed";
      toast.error(errMsg);
    } finally {
      setRetryingId(null);
    }
  };

  // Delete Message from History
  const handleDeleteMessage = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/messages/${id}`, {
        headers: authHeaders(),
      });
      setHistory((prev) => prev.filter((item) => item._id !== id));
      if (draftId === id) setDraftId(null);
      toast.success("Message removed from history");
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Could not delete message";
      toast.error(errMsg);
    }
  };

  // Apply Template to Composer
  const handleApplyTemplate = (tpl) => {
    if (tpl.subject) {
      setSubject(tpl.subject);
    }
    if (tpl.body) {
      setMessage(tpl.body);
      savedSelectionRef.current = { start: tpl.body.length, end: tpl.body.length };
    }
    if (tpl.channel && tpl.channel !== "all") {
      setChannel(tpl.channel);
    }
    setShowTemplateModal(false);
    toast.success(`Loaded template: "${tpl.title}"`);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  // Compute Distinct Template Categories and Filtered Templates List
  const templateCategories = [
    "All",
    ...Array.from(new Set(templates.map((t) => t.category).filter(Boolean))),
  ];

  const filteredTemplates = templates.filter((tpl) => {
    // Category Filter
    if (templateCategory !== "All" && tpl.category !== templateCategory) {
      return false;
    }
    // Search Query (across title, subject, body, placeholders, category)
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase().trim();
      const inTitle = tpl.title?.toLowerCase().includes(q);
      const inSubject = tpl.subject?.toLowerCase().includes(q);
      const inBody = tpl.body?.toLowerCase().includes(q);
      const inCategory = tpl.category?.toLowerCase().includes(q);
      const inPlaceholders = tpl.placeholders?.some((p) => p.toLowerCase().includes(q));
      return inTitle || inSubject || inBody || inCategory || inPlaceholders;
    }
    return true;
  });

  // Save Current Message as Custom Template
  const handleSaveCustomTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateTitle.trim()) {
      toast.error("Please enter a title for the template");
      return;
    }
    if (!message.trim()) {
      toast.error("Message body cannot be empty");
      return;
    }

    setSavingTemplate(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/templates`,
        {
          title: newTemplateTitle.trim(),
          category: newTemplateCategory.trim() || "Custom",
          channel,
          subject: subject.trim(),
          body: message.trim(),
        },
        { headers: authHeaders() }
      );

      toast.success(data.message || "Template saved!");
      setShowSaveTemplateModal(false);
      setNewTemplateTitle("");
      fetchTemplates();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Could not save template";
      toast.error(errMsg);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Filter and Search History Items
  const filteredHistory = history.filter((item) => {
    // Tab Filter
    if (historyFilter !== "all" && item.status !== historyFilter) {
      return false;
    }
    // Search Query
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      const matchRecipient = item.recipient?.toLowerCase().includes(q);
      const matchSubject = item.subject?.toLowerCase().includes(q);
      const matchBody = item.message?.toLowerCase().includes(q);
      const matchChannel = item.channel?.toLowerCase().includes(q);
      return matchRecipient || matchSubject || matchBody || matchChannel;
    }
    return true;
  });

  // History Tab Badges Count
  const counts = {
    all: history.length,
    scheduled: history.filter((h) => h.status === "scheduled").length,
    draft: history.filter((h) => h.status === "draft").length,
    sent: history.filter((h) => h.status === "sent").length,
    failed: history.filter((h) => h.status === "failed").length,
    cancelled: history.filter((h) => h.status === "cancelled").length,
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-purple-100 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                QuickSend &amp; Dispatch
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Multi-channel messaging, scheduled deliveries, templates, and live tracking.
              </p>
            </div>
          </div>

          {/* Connection Readiness Pill */}
          <button
            type="button"
            onClick={() => setShowProviderDetails((prev) => !prev)}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50/60 text-purple-700 font-semibold hover:bg-purple-100 transition cursor-pointer"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                providers[channel]?.configured ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{channel.toUpperCase()}: {providers[channel]?.configured ? "Connected" : "Setup Needed"}</span>
            {showProviderDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* PROVIDER READINESS DETAILS DRAWER */}
        {showProviderDetails && (
          <div className="mt-4 mb-2 p-4 rounded-2xl bg-purple-50/40 border border-purple-100 text-xs space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-purple-600" />
                Channel Connection Readiness
              </span>
              <button
                type="button"
                onClick={fetchProviders}
                className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Email Status Card */}
              <div className="p-3 rounded-xl bg-white border border-purple-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-sky-500" /> Email
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        providers.email.configured
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {providers.email.configured ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-tight">
                    {providers.email.label}
                  </p>
                </div>
              </div>

              {/* Telegram Status Card */}
              <div className="p-3 rounded-xl bg-white border border-purple-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                      <Send className="w-3.5 h-3.5 text-blue-500" /> Telegram
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        providers.telegram.configured
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {providers.telegram.configured ? "Ready" : "Setup Required"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-tight">
                    {providers.telegram.label}
                  </p>
                </div>
                {providers.telegram.botUsername && (
                  <a
                    href={`https://t.me/${providers.telegram.botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center gap-1"
                  >
                    Open Bot <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* WhatsApp Status Card */}
              <div className="p-3 rounded-xl bg-white border border-purple-100 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-800 flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        providers.whatsapp.configured
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {providers.whatsapp.configured ? "Cloud API" : "Web Direct"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-tight">
                    {providers.whatsapp.label}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHANNEL SELECTION TABS */}
        <div className="flex rounded-2xl bg-purple-50/70 p-1 mb-5 border border-purple-100">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              channel === "email"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            <Mail className="w-4 h-4 text-sky-600" />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => setChannel("telegram")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              channel === "telegram"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            <Send className="w-4 h-4 text-blue-500" />
            <span>Telegram</span>
          </button>
          <button
            type="button"
            onClick={() => setChannel("whatsapp")}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              channel === "whatsapp"
                ? "bg-white text-purple-700 shadow-sm"
                : "text-gray-600 hover:text-purple-600"
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* COMPOSER FORM */}
        <form onSubmit={handleSend} className="space-y-4">
          {draftId && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-100/70 text-purple-800 text-xs">
              <span className="font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                Editing saved draft
              </span>
              <button
                type="button"
                onClick={() => setDraftId(null)}
                className="hover:underline text-purple-700 font-bold cursor-pointer"
              >
                Clear draft link
              </button>
            </div>
          )}

          {/* RECIPIENT FIELD */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                To <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">
                {channel === "email"
                  ? "Standard email format"
                  : channel === "telegram"
                  ? "@username or numeric chat ID"
                  : "E.164 phone with country code (e.g. +14155552671)"}
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type={channel === "email" ? "email" : "text"}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={
                  channel === "email"
                    ? "name@example.com"
                    : channel === "telegram"
                    ? "@username or numeric chat ID..."
                    : "+1234567890 (International phone)..."
                }
                className="w-full rounded-xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                required
              />
              <div className="absolute right-3 text-purple-500 pointer-events-none">
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* SUBJECT FIELD (Shown for Email or optional headline for chats) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Subject {channel === "email" ? <span className="text-rose-500">*</span> : <span className="text-gray-400 font-normal">(Optional heading)</span>}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={channel === "email" ? "Enter subject line..." : "Headline / Subject (optional)..."}
              className="w-full rounded-xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
              required={channel === "email"}
            />
          </div>

          {/* MESSAGE FIELD WITH WHATSAPP-STYLE INLINE EMOJI COMPOSER & TOOLBAR */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="block text-xs font-bold text-gray-700">
                Message <span className="text-rose-500">*</span>
              </label>

              {/* Composer Toolbar Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Template Button */}
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 px-2.5 py-1 rounded-xl font-semibold transition cursor-pointer"
                  title="Choose from reusable templates"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Templates</span>
                </button>

                {/* Quick Emoji Bar Toggle */}
                <button
                  type="button"
                  onClick={() => setShowQuickEmojis((prev) => !prev)}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-semibold transition cursor-pointer border ${
                    showQuickEmojis
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200/60"
                  }`}
                  title="Toggle quick emoji shortcuts"
                >
                  <Smile className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Quick</span>
                </button>

                {/* WhatsApp-Style Inline Emoji Picker Toggle Button */}
                <button
                  ref={emojiBtnRef}
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  aria-expanded={showEmojiPicker}
                  aria-haspopup="dialog"
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-semibold transition cursor-pointer border ${
                    showEmojiPicker
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "text-purple-700 bg-purple-50 hover:bg-purple-100 border-purple-200/60"
                  }`}
                  title="Toggle WhatsApp-style inline emoji picker"
                >
                  <span className="text-sm leading-none">😊</span>
                  <span>Emojis</span>
                </button>
              </div>
            </div>

            {/* Quick Emoji Bar */}
            {showQuickEmojis && (
              <div className="mb-2 flex flex-wrap gap-1.5 rounded-2xl border border-purple-100 bg-purple-50/70 p-2 animate-fadeIn">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                    className="rounded-xl px-2 py-1 text-lg transition hover:bg-white hover:scale-110 active:scale-95 cursor-pointer shadow-xs"
                    title={`Insert ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Main Message Textarea with Selection Caret Tracking */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTextareaSelection(e);
              }}
              onSelect={handleTextareaSelection}
              onClick={handleTextareaSelection}
              onKeyUp={handleTextareaSelection}
              placeholder="Type your message here... Use {{name}}, {{task}}, or {{date}} for dynamic values."
              rows={4}
              className="w-full rounded-2xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition resize-none leading-relaxed"
              required
            />
            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1">
              <span>Supports emoji, formatted text, and file attachments</span>
              <span>{message.length} characters</span>
            </div>

            {/* WHATSAPP-STYLE INLINE EMOJI PICKER POPOVER (ANCHORED DIRECTLY TO COMPOSER) */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                role="dialog"
                aria-label="WhatsApp-Style Emoji Picker"
                className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 md:left-auto md:right-0 w-full sm:w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-purple-200 z-30 overflow-hidden animate-fadeIn"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-purple-50 border-b border-purple-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">😊</span>
                    <span className="text-xs font-bold text-gray-800">
                      WhatsApp Emoji Composer
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/80 transition cursor-pointer"
                    aria-label="Close emoji picker"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Lazy-Loaded Emoji Picker */}
                <div className="p-1">
                  <Suspense
                    fallback={
                      <div className="h-64 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        <span className="text-xs text-gray-400">Loading emojis...</span>
                      </div>
                    }
                  >
                    <EmojiPicker
                      onEmojiClick={(emojiData) => handleEmojiSelect(emojiData.emoji)}
                      width="100%"
                      height={340}
                      previewConfig={{ showPreview: false }}
                      skinTonesDisabled
                      lazyLoadEmojis={true}
                      searchPlaceHolder="Search emojis (smile, fire, check...)"
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>

          {/* ATTACHMENTS LIST & UPLOADER */}
          <div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-800 shadow-2xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <span className="text-gray-400 font-normal">
                      ({formatFileSize(file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-purple-400 hover:text-purple-700 cursor-pointer p-0.5 rounded-full hover:bg-purple-200/60 transition"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={files.length >= 5}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition cursor-pointer disabled:opacity-50"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Add Attachment ({files.length}/5)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Save As Template Button */}
              {message.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTemplateTitle(subject || "Custom Template");
                    setShowSaveTemplateModal(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-purple-100 text-xs font-semibold text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                  title="Save this message as a reusable template"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save as Template</span>
                </button>
              )}
            </div>
          </div>

          {/* SCHEDULE SEND TOGGLE & PICKERS */}
          <div className="pt-2 border-t border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-gray-800">Scheduled Delivery</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isScheduling}
                  onChange={(e) => setIsScheduling(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {isScheduling && (
              <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-3 animate-fadeIn">
                <p className="text-[11px] text-gray-600">
                  Tasklert's atomic background worker will persistently dispatch this message at the exact time, even if you close your browser.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required={isScheduling}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required={isScheduling}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Timezone (IANA)
                    </label>
                    <input
                      type="text"
                      value={userTimeZone}
                      readOnly
                      title="Detected system timezone"
                      className="w-full rounded-xl border border-purple-100 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                    />
                  </div>
                </div>

                {scheduledDate && scheduledTime && (
                  <div className="text-xs font-semibold text-purple-800 bg-purple-100/60 p-2 rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      Will dispatch on: {scheduledDate} at {scheduledTime} ({userTimeZone})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS: SEND / SCHEDULE / DRAFT */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={sending}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/25 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isScheduling ? "Scheduling Message..." : "Sending Message..."}</span>
                </>
              ) : isScheduling ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Schedule Dispatch</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Message Now</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={savingDraft || sending}
              onClick={handleSaveDraft}
              className="w-full sm:w-auto py-3.5 px-5 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-700 font-bold text-xs sm:text-sm transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {savingDraft ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              ) : (
                <FileText className="w-4 h-4 text-purple-600" />
              )}
              <span>Save Draft</span>
            </button>

            {(recipient || message || files.length > 0) && (
              <button
                type="button"
                onClick={resetComposer}
                className="py-2 px-3 text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer"
                title="Clear current composer fields"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* QUICK SEND TEMPLATES MODAL (2-COLUMN ON LAPTOPS/DESKTOPS, ACCESSIBLE, SEARCHABLE, CATEGORY FILTERED) */}
      {showTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={templateModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="templates-modal-title"
              className="relative bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-2xl w-full max-h-[min(90dvh,760px)] flex flex-col overflow-hidden"
            >
              {/* STICKY MODAL HEADER */}
              <div className="p-4 sm:p-5 border-b border-purple-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-purple-500/20">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 id="templates-modal-title" className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                        QuickSend Templates
                      </h3>
                      <p className="text-[11px] sm:text-xs text-gray-500">
                        Search, preview placeholders, and apply pre-built or custom messages.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    aria-label="Close templates modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* SEARCH BAR */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates by title, keywords, or placeholders..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-purple-200 bg-purple-50/30 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full cursor-pointer"
                      aria-label="Clear template search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* CATEGORY FILTER PILLS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {templateCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategory(cat)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        templateCategory === cat
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-purple-50 text-gray-600 hover:bg-purple-100 hover:text-purple-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* SCROLLABLE TEMPLATES 2-COLUMN GRID */}
              <div className="overflow-y-auto modal-content-scroll p-4 sm:p-5 flex-1 space-y-3">
                {loadingTemplates ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                    <span className="text-xs text-gray-500">Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-purple-300" />
                    <p className="text-sm font-semibold text-gray-700">No matching templates found</p>
                    <p className="text-xs text-gray-400">
                      Try adjusting your search query or selected category.
                    </p>
                    {(templateSearch || templateCategory !== "All") && (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateSearch("");
                          setTemplateCategory("All");
                        }}
                        className="mt-2 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs hover:bg-purple-100 transition cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredTemplates.map((tpl) => (
                      <div
                        key={tpl._id}
                        onClick={() => handleApplyTemplate(tpl)}
                        className="p-3.5 rounded-2xl border border-purple-100 bg-white hover:border-purple-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <h4 className="font-bold text-xs sm:text-sm text-gray-900 group-hover:text-purple-700 transition">
                              {tpl.title}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 shrink-0 border border-purple-100">
                              {tpl.category || "General"}
                            </span>
                          </div>

                          {tpl.subject && (
                            <p className="text-[11px] font-semibold text-purple-900 mb-1 truncate">
                              Subj: {tpl.subject}
                            </p>
                          )}

                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2.5">
                            {tpl.body}
                          </p>
                        </div>

                        <div>
                          {/* Placeholders */}
                          {tpl.placeholders?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {tpl.placeholders.map((p) => (
                                <span
                                  key={p}
                                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-purple-50/60 border border-purple-100 text-purple-700"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="pt-2 border-t border-purple-50 flex items-center justify-between text-xs font-bold text-purple-700 group-hover:text-purple-900">
                            <span>Use Template</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="p-3.5 sm:p-4 bg-purple-50/50 border-t border-purple-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} found
                </span>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* SAVE CUSTOM TEMPLATE MODAL */}
      {showSaveTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={saveTemplateModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="save-template-modal-title"
              className="bg-white rounded-3xl shadow-2xl p-5 max-w-md w-full border border-purple-100"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 id="save-template-modal-title" className="text-base font-bold text-gray-900">
                  Save as Template
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveCustomTemplate} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Template Title</label>
                  <input
                    type="text"
                    value={newTemplateTitle}
                    onChange={(e) => setNewTemplateTitle(e.target.value)}
                    placeholder="e.g. Weekly Status Update"
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newTemplateCategory}
                    onChange={(e) => setNewTemplateCategory(e.target.value)}
                    placeholder="e.g. Workflow, Productivity"
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateModal(false)}
                    className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {savingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Template</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* DELIVERY TRACKING & RECENT MESSAGES */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-purple-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              Delivery Tracking &amp; History
            </h2>
            <p className="text-xs text-gray-500">
              Real-time delivery records, scheduled queues, drafts, and failure retries.
            </p>
          </div>

          {/* Search History */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search recipient or text..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-purple-100 bg-purple-50/20 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* STATUS FILTER PILLS */}
        <div className="flex flex-wrap gap-1.5 mb-5 pb-3 border-b border-purple-100/60">
          {[
            { key: "all", label: "All", count: counts.all },
            { key: "scheduled", label: "Scheduled", count: counts.scheduled },
            { key: "draft", label: "Drafts", count: counts.draft },
            { key: "sent", label: "Sent", count: counts.sent },
            { key: "failed", label: "Failed", count: counts.failed },
            { key: "cancelled", label: "Cancelled", count: counts.cancelled },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setHistoryFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                historyFilter === tab.key
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-purple-50/60 text-gray-600 hover:bg-purple-100/80 hover:text-purple-700"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  historyFilter === tab.key
                    ? "bg-purple-700 text-white"
                    : "bg-white text-purple-700 border border-purple-200"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* HISTORY LIST */}
        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-xs sm:text-sm text-gray-400">
            {historySearch || historyFilter !== "all"
              ? "No messages match your selected filters."
              : "No messages yet — your dispatched and scheduled updates will appear here."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div
                key={item._id}
                className="p-4 rounded-2xl border border-purple-100 hover:border-purple-200 bg-white hover:bg-purple-50/20 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
              >
                {/* Left: Channel Icon & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                      item.channel === "email"
                        ? "bg-sky-100 text-sky-600"
                        : item.channel === "telegram"
                        ? "bg-blue-100 text-blue-600"
                        : item.channel === "whatsapp"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-purple-100 text-purple-600"
                    }`}
                  >
                    {item.channel === "email" ? (
                      <Mail className="h-4 w-4" />
                    ) : item.channel === "telegram" ? (
                      <Send className="h-4 w-4" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span
                        onClick={() => loadIntoComposer(item, item.status === "draft")}
                        className="text-xs sm:text-sm font-bold text-gray-900 hover:text-purple-600 cursor-pointer truncate max-w-[200px] sm:max-w-[280px]"
                        title="Click to load into composer"
                      >
                        {item.recipient}
                      </span>

                      {/* Status Badges */}
                      {item.status === "scheduled" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>Scheduled for {new Date(item.scheduledAt).toLocaleString()}</span>
                        </span>
                      )}
                      {item.status === "sent" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Sent {item.sentAt ? new Date(item.sentAt).toLocaleTimeString() : ""}</span>
                        </span>
                      )}
                      {item.status === "draft" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700">
                          <FileText className="w-3 h-3 text-gray-500" />
                          <span>Draft</span>
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Failed</span>
                        </span>
                      )}
                      {item.status === "cancelled" && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-zinc-100 text-zinc-700">
                          <Ban className="w-3 h-3 text-zinc-500" />
                          <span>Cancelled</span>
                        </span>
                      )}
                    </div>

                    {item.subject && (
                      <p className="text-xs font-semibold text-purple-900 truncate">
                        {item.subject}
                      </p>
                    )}

                    {item.message && (
                      <p className="text-xs text-gray-600 line-clamp-1 break-words">
                        {item.message}
                      </p>
                    )}

                    {/* Attachments preview */}
                    {item.attachments?.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="text-gray-400">
                          {item.attachments.length} file{item.attachments.length > 1 ? "s" : ""}:
                        </span>
                        {item.attachments.map((att, idx) => (
                          att.path ? (
                            <a
                              key={idx}
                              href={resolveAttachmentUrl(att.path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 hover:underline border border-purple-100 font-medium"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              <span className="max-w-[110px] truncate">{att.filename}</span>
                            </a>
                          ) : (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-medium"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              <span className="max-w-[110px] truncate">{att.filename}</span>
                            </span>
                          )
                        ))}
                      </div>
                    )}

                    {/* Error explanation if failed */}
                    {item.status === "failed" && item.error && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                        Error: {item.error}
                      </p>
                    )}

                    <span className="text-[10px] text-gray-400 block mt-1">
                      Created: {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  {/* Cancel Scheduled Send */}
                  {item.status === "scheduled" && (
                    <button
                      type="button"
                      disabled={cancellingId === item._id}
                      onClick={() => handleCancelScheduled(item._id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 transition cursor-pointer disabled:opacity-50"
                      title="Cancel this scheduled dispatch"
                    >
                      {cancellingId === item._id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                      <span>Cancel</span>
                    </button>
                  )}

                  {/* Retry Failed */}
                  {item.status === "failed" && (
                    <button
                      type="button"
                      disabled={retryingId === item._id}
                      onClick={() => handleRetryMessage(item._id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 transition cursor-pointer disabled:opacity-50"
                      title="Retry sending this message now"
                    >
                      {retryingId === item._id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      <span>Retry</span>
                    </button>
                  )}

                  {/* Open in Composer / Reuse */}
                  <button
                    type="button"
                    onClick={() => loadIntoComposer(item, item.status === "draft")}
                    className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700 transition cursor-pointer"
                    title={item.status === "draft" ? "Open draft in composer" : "Reuse in composer"}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{item.status === "draft" ? "Edit" : "Reuse"}</span>
                  </button>

                  {/* Delete Item */}
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(item._id)}
                    className="p-1.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                    title="Delete message log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageCenter;
