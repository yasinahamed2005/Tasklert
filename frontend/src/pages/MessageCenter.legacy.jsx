import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { toast } from "react-toastify";
import WhatsAppConnectionView from "../components/WhatsAppConnectionView.jsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Ban,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { API_BASE_URL } from "../config/api";
import { useModalAccessibility } from "../utils/scrollLock";

// Lazy-load emoji picker to maintain Lighthouse Mobile Performance at 90+
const EmojiPicker = lazy(() => import("emoji-picker-react"));

const QUICK_EMOJIS = [
  "👍", "🚀", "✅", "🎉", "❤️", "🔥", "💯", "⏰", "📌", "💡", "🤝", "⭐"
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
];

const MessageCenter = () => {
  // Channel Switcher: 'whatsapp' | 'telegram' | 'email'
  const [channel, setChannel] = useState(() => {
    return localStorage.getItem("tasklert_quicksend_channel") || "whatsapp";
  });

  // Left sidebar & contact selection
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);

  // Active Conversation Thread
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);

  // Composer Form State
  const [messageText, setMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [showCcDrawer, setShowCcDrawer] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState("");
  const [attachments, setAttachments] = useState([]);

  // Right Collapsible Contact Info Drawer
  const [showRightPanel, setShowRightPanel] = useState(false);

  // Modals State
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showCustomScheduleModal, setShowCustomScheduleModal] = useState(false);
  const [customScheduleDate, setCustomScheduleDate] = useState("");
  const [customScheduleTime, setCustomScheduleTime] = useState("");
  const [rescheduleMessageItem, setRescheduleMessageItem] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showScheduledQueueModal, setShowScheduledQueueModal] = useState(false);
  const [scheduledFilterTab, setScheduledFilterTab] = useState("all");
  const [scheduledSearch, setScheduledSearch] = useState("");

  // Template State
  const [templateSearch, setTemplateSearch] = useState("");
  const [templates, setTemplates] = useState(STARTER_TEMPLATES);

  // Async States
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [updatingScheduled, setUpdatingScheduled] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Provider Status State
  const [providers, setProviders] = useState({
    email: { configured: true, label: "Ready (SMTP)", provider: "smtp", sender: "noreply@tasklert.com" },
    telegram: { configured: false, label: "Setup required (Bot Token)", botUsername: null },
    whatsapp: { configured: false, label: "Setup required (Cloud API or Twilio)", provider: "none", senderNumber: null },
  });

  // Provider Connection Form State
  const [providerConfigTab, setProviderConfigTab] = useState("whatsapp");
  const [testingConnection, setTestingConnection] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [waForm, setWaForm] = useState({
    providerType: "web_direct",
    personalNumber: "",
    phoneNumberId: "",
    accessToken: "",
    businessAccountId: "",
    accountSid: "",
    authToken: "",
    fromNumber: "",
  });

  const [tgForm, setTgForm] = useState({
    botToken: "",
  });

  // Scheduled Queue Cache
  const [allScheduledMessages, setAllScheduledMessages] = useState([]);

  // Emoji Picker Popover
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // New Contact Form Data
  const [contactFormData, setContactFormData] = useState({
    name: "",
    phone: "",
    whatsappPhone: "",
    telegramUsername: "",
    email: "",
    notes: "",
    isFavorite: false,
  });

  // Detected IANA Timezone
  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const isWhatsAppConnected = Boolean(
    providers.whatsapp?.configured && providers.whatsapp?.isUserAccount
  );

  // DOM References
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const conversationEndRef = useRef(null);

  // Modal accessibility references
  const contactModalRef = useRef(null);
  const customScheduleModalRef = useRef(null);
  const rescheduleModalRef = useRef(null);
  const templateModalRef = useRef(null);
  const providerModalRef = useRef(null);
  const scheduledQueueModalRef = useRef(null);

  useModalAccessibility({ isOpen: showContactModal, onClose: () => setShowContactModal(false), modalRef: contactModalRef });
  useModalAccessibility({ isOpen: showCustomScheduleModal, onClose: () => setShowCustomScheduleModal(false), modalRef: customScheduleModalRef });
  useModalAccessibility({ isOpen: Boolean(rescheduleMessageItem), onClose: () => setRescheduleMessageItem(null), modalRef: rescheduleModalRef });
  useModalAccessibility({ isOpen: showTemplateModal, onClose: () => setShowTemplateModal(false), modalRef: templateModalRef });
  useModalAccessibility({ isOpen: showProviderModal, onClose: () => setShowProviderModal(false), modalRef: providerModalRef });
  useModalAccessibility({ isOpen: showScheduledQueueModal, onClose: () => setShowScheduledQueueModal(false), modalRef: scheduledQueueModalRef });

  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  // Outside click & escape listener for emoji picker
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
        emojiBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiPicker]);

  // Fetch Real Contacts
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/contacts`, {
        params: { channel, search: contactSearch },
        headers: authHeaders(),
      });
      const list = Array.isArray(data?.contacts) ? data.contacts : [];
      setContacts(list);

      // Select first contact if none selected or if current selected doesn't support active channel
      setSelectedContact((curr) => {
        if (!curr && list.length > 0) return list[0];
        if (curr && list.some((c) => c._id === curr._id)) {
          return list.find((c) => c._id === curr._id);
        }
        return list[0] || null;
      });
    } catch (err) {
      console.warn("fetchContacts API error:", err?.message);
    } finally {
      setLoadingContacts(false);
    }
  }, [channel, contactSearch]);

  // Fetch Providers
  const fetchProviders = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages/providers`, {
        headers: authHeaders(),
      });
      if (data?.providers) setProviders(data.providers);
    } catch (err) {
      console.error("fetchProviders error:", err);
    }
  }, []);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages/templates`, {
        headers: authHeaders(),
      });
      if (Array.isArray(data?.templates)) setTemplates(data.templates);
    } catch (err) {
      console.error("fetchTemplates error:", err);
    }
  }, []);

  // Fetch All Scheduled Messages across all contacts
  const fetchAllScheduled = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages`, {
        headers: authHeaders(),
      });
      setAllScheduledMessages(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("fetchAllScheduled error:", err);
    }
  }, []);

  // Fetch Real Conversation for Selected Contact
  const fetchConversation = useCallback(async (contact) => {
    if (!contact) {
      setMessages([]);
      return;
    }
    setLoadingConversation(true);
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/contacts/${contact._id}/conversation`,
        {
          params: { channel },
          headers: authHeaders(),
        }
      );
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      console.warn("fetchConversation error:", err?.message);
      setMessages([]);
    } finally {
      setLoadingConversation(false);
    }
  }, [channel]);

  // Initial Data Fetch
  useEffect(() => {
    fetchContacts();
    fetchProviders();
    fetchTemplates();
    fetchAllScheduled();
  }, [fetchContacts, fetchProviders, fetchTemplates, fetchAllScheduled]);

  // Re-fetch conversation whenever selected contact or channel changes
  useEffect(() => {
    if (selectedContact) {
      fetchConversation(selectedContact);
    }
  }, [selectedContact, channel, fetchConversation]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Draft Preservation across channel switches
  const getDraftKey = (ch, contactId) => `tasklert_chat_draft_${ch}_${contactId || "none"}`;

  const saveCurrentDraft = useCallback(() => {
    if (!selectedContact) return;
    const key = getDraftKey(channel, selectedContact._id);
    if (!messageText && !emailSubject && !emailCc && !emailBcc) {
      localStorage.removeItem(key);
      return;
    }
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          messageText,
          emailSubject,
          emailCc,
          emailBcc,
          reaction: selectedReaction,
        })
      );
    } catch (_) {}
  }, [channel, selectedContact, messageText, emailSubject, emailCc, emailBcc, selectedReaction]);

  const restoreDraft = useCallback((ch, contactId) => {
    if (!contactId) return;
    const key = getDraftKey(ch, contactId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw);
        setMessageText(d.messageText || "");
        setEmailSubject(d.emailSubject || "");
        setEmailCc(d.emailCc || "");
        setEmailBcc(d.emailBcc || "");
        setSelectedReaction(d.reaction || "");
        return;
      }
    } catch (_) {}
    setMessageText("");
    setEmailSubject("");
    setEmailCc("");
    setEmailBcc("");
    setSelectedReaction("");
  }, []);

  const handleChannelChange = (newChannel) => {
    if (newChannel === channel) return;
    saveCurrentDraft();
    setChannel(newChannel);
    localStorage.setItem("tasklert_quicksend_channel", newChannel);
    if (selectedContact) {
      restoreDraft(newChannel, selectedContact._id);
    }
  };

  const handleSelectContact = (contact) => {
    saveCurrentDraft();
    setSelectedContact(contact);
    restoreDraft(channel, contact._id);
  };

  // Channel-Specific Recipient Identifiers
  const activeRecipientIdentifier = useMemo(() => {
    if (!selectedContact) return "";
    switch (channel) {
      case "whatsapp":
        return selectedContact.whatsappPhone || selectedContact.phone || "";
      case "telegram":
        return selectedContact.telegramUsername || selectedContact.telegramChatId || "";
      case "email":
        return selectedContact.email || "";
      default:
        return selectedContact.phone || selectedContact.email || "";
    }
  }, [channel, selectedContact]);

  // Clean WhatsApp phone number for direct links
  const waCleanPhone = useMemo(() => {
    if (!selectedContact) return "";
    const p = selectedContact.whatsappPhone || selectedContact.phone || "";
    return p.replace(/[^0-9]/g, "");
  }, [selectedContact]);

  // WhatsApp Web Fallback link
  const waDirectUrl = useMemo(() => {
    if (!waCleanPhone) return "";
    const encoded = encodeURIComponent(messageText || "");
    return `https://wa.me/${waCleanPhone}${encoded ? `?text=${encoded}` : ""}`;
  }, [waCleanPhone, messageText]);

  // Telegram Direct link
  const tgDirectUrl = useMemo(() => {
    if (!selectedContact?.telegramUsername) return "";
    const cleanUser = selectedContact.telegramUsername.replace(/^@/, "");
    return `https://t.me/${cleanUser}`;
  }, [selectedContact]);

  // Has demo contacts currently loaded
  const hasDemoContacts = useMemo(() => {
    return contacts.some((c) => c.isDemo);
  }, [contacts]);

  // Seed Demo Contacts Handler
  const handleSeedDemoContacts = async () => {
    setSeedingDemo(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/contacts/demo/seed`,
        {},
        { headers: authHeaders() }
      );
      toast.success(data.message || "Loaded demo contacts for preview");
      await fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load demo contacts");
    } finally {
      setSeedingDemo(false);
    }
  };

  // Clear Demo Contacts Handler
  const handleClearDemoContacts = async () => {
    setClearingDemo(true);
    try {
      const { data } = await axios.delete(`${API_BASE_URL}/api/contacts/demo`, {
        headers: authHeaders(),
      });
      toast.info(data.message || "Cleared demo contacts");
      await fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear demo contacts");
    } finally {
      setClearingDemo(false);
    }
  };

  // File Upload Handling
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxFiles = 5;
    const maxSize = 15 * 1024 * 1024; // 15MB
    const validFiles = [];

    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`"${file.name}" exceeds the 15MB limit.`);
        continue;
      }
      validFiles.push(file);
    }

    setAttachments((prev) => [...prev, ...validFiles].slice(0, maxFiles));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Emoji Injection
  const handleEmojiSelect = (emojiData) => {
    const emoji = emojiData.emoji;
    insertTextAtCursor(emoji);
  };

  const insertTextAtCursor = (insertStr) => {
    const el = textareaRef.current;
    if (!el) {
      setMessageText((prev) => prev + insertStr);
      return;
    }
    const start = el.selectionStart ?? messageText.length;
    const end = el.selectionEnd ?? messageText.length;
    const updated = messageText.slice(0, start) + insertStr + messageText.slice(end);
    setMessageText(updated);
    setTimeout(() => {
      el.focus();
      const pos = start + insertStr.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  // Build FormData for multipart POST
  const buildMessageFormData = (scheduledTime = null) => {
    const fd = new FormData();
    fd.append("channel", channel);
    fd.append("recipient", activeRecipientIdentifier);
    if (selectedContact) fd.append("contactId", selectedContact._id);
    if (channel === "email" && emailSubject.trim()) fd.append("subject", emailSubject.trim());
    if (channel === "email" && emailCc.trim()) fd.append("cc", emailCc.trim());
    if (channel === "email" && emailBcc.trim()) fd.append("bcc", emailBcc.trim());
    fd.append("message", messageText.trim());
    if (selectedReaction) fd.append("reaction", selectedReaction);
    if (scheduledTime) {
      fd.append("scheduledAt", scheduledTime);
      fd.append("timeZone", userTimeZone);
    }
    attachments.forEach((file) => fd.append("attachments", file));
    return fd;
  };

  // Send Now Handler
  const handleSendNow = async () => {
    if (!selectedContact) {
      toast.error("Please select a recipient first.");
      return;
    }
    if (!activeRecipientIdentifier) {
      toast.error(`Contact "${selectedContact.name}" does not have an active ${channel} address/number.`);
      return;
    }
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("Email subject is required.");
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error("Please enter a message or attach a file.");
      return;
    }

    setSending(true);
    try {
      const fd = buildMessageFormData(null);
      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, fd, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        data.isWebDirect
          ? "Message recorded in Tasklert (Ready to send via WhatsApp)"
          : data.message || "Message sent successfully!"
      );

      setMessageText("");
      setAttachments([]);
      setSelectedReaction("");
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));

      if (data.log) {
        setMessages((prev) => [...prev, data.log]);
      }
      fetchContacts();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to send message";
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  // Schedule Preset Handler (Tomorrow 7:00 AM, In 7 Days, In 20 Days)
  const handleSchedulePreset = async (presetType) => {
    if (!selectedContact) {
      toast.error("Please select a recipient first.");
      return;
    }
    if (!activeRecipientIdentifier) {
      toast.error(`Contact "${selectedContact.name}" does not have an active ${channel} address/number.`);
      return;
    }
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("Email subject is required.");
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error("Please enter message content or attach a file.");
      return;
    }

    const now = new Date();
    let target = new Date();

    if (presetType === "tomorrow_7am") {
      target.setDate(target.getDate() + 1);
      target.setHours(7, 0, 0, 0);
    } else if (presetType === "in_7_days") {
      target.setDate(target.getDate() + 7);
      target.setHours(9, 0, 0, 0);
    } else if (presetType === "in_20_days") {
      target.setDate(target.getDate() + 20);
      target.setHours(9, 0, 0, 0);
    }

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    setScheduling(true);
    try {
      const fd = buildMessageFormData(target.toISOString());
      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, fd, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(
        `Scheduled for ${target.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })} at ${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${userTimeZone})`
      );

      setMessageText("");
      setAttachments([]);
      setSelectedReaction("");
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));

      if (data.log) {
        setMessages((prev) => [...prev, data.log]);
      }
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule message");
    } finally {
      setScheduling(false);
    }
  };

  // Custom Schedule Confirmation
  const handleConfirmCustomSchedule = async (e) => {
    e.preventDefault();
    if (!customScheduleDate || !customScheduleTime) {
      toast.error("Please select both a date and time");
      return;
    }

    const [hours, minutes] = customScheduleTime.split(":").map(Number);
    const targetDate = new Date(customScheduleDate);
    targetDate.setHours(hours, minutes, 0, 0);

    if (targetDate.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setScheduling(true);
    try {
      const fd = buildMessageFormData(targetDate.toISOString());
      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, fd, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(data.message || `Message scheduled for ${targetDate.toLocaleString()}`);
      setShowCustomScheduleModal(false);
      setMessageText("");
      setAttachments([]);
      setSelectedReaction("");
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));

      if (data.log) {
        setMessages((prev) => [...prev, data.log]);
      }
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule message");
    } finally {
      setScheduling(false);
    }
  };

  // Reschedule an existing scheduled message
  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleMessageItem) return;

    const { _id, scheduledDate, scheduledTime, message: newText, subject: newSubject } = rescheduleMessageItem;
    if (!scheduledDate || !scheduledTime) {
      toast.error("Please provide both date and time");
      return;
    }

    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const targetDate = new Date(scheduledDate);
    targetDate.setHours(hours, minutes, 0, 0);

    if (targetDate.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setUpdatingScheduled(true);
    try {
      const payload = {
        scheduledAt: targetDate.toISOString(),
        timeZone: userTimeZone,
        message: newText,
        subject: newSubject,
      };

      const { data } = await axios.patch(
        `${API_BASE_URL}/api/messages/${_id}`,
        payload,
        { headers: authHeaders() }
      );

      toast.success(data.message || "Message rescheduled successfully!");
      setRescheduleMessageItem(null);

      // Update in local conversation view
      setMessages((prev) => prev.map((m) => (m._id === _id ? data.log : m)));
      fetchAllScheduled();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("Conflict: This message is currently being dispatched by the scheduler and cannot be edited.");
      } else {
        toast.error(err.response?.data?.message || "Failed to reschedule message");
      }
    } finally {
      setUpdatingScheduled(false);
    }
  };

  // Cancel Scheduled Message
  const handleCancelScheduled = async (messageId) => {
    setCancellingId(messageId);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${messageId}/cancel`,
        {},
        { headers: authHeaders() }
      );

      toast.info(data.message || "Scheduled message cancelled");
      setMessages((prev) => prev.map((m) => (m._id === messageId ? data.log : m)));
      fetchAllScheduled();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("Conflict: This message is currently being dispatched by the scheduler and cannot be cancelled.");
      } else {
        toast.error(err.response?.data?.message || "Failed to cancel message");
      }
    } finally {
      setCancellingId(null);
    }
  };

  // Immediate Dispatch from Scheduled Queue ("Send Now")
  const handleDispatchImmediately = async (messageId) => {
    setActionLoadingId(messageId);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${messageId}/send-now`,
        {},
        { headers: authHeaders() }
      );

      toast.success(
        data.isWebDirect
          ? "Reminder marked as Ready to Send! Use 'Open in WhatsApp' when you wish to dispatch."
          : "Message dispatched immediately!"
      );
      setMessages((prev) => prev.map((m) => (m._id === messageId ? data.log : m)));
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to dispatch message immediately");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark a ready personal reminder as sent by user
  const handleMarkSent = async (messageId) => {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${messageId}/mark-sent`,
        {},
        { headers: authHeaders() }
      );
      toast.success(data?.message || "Message marked as sent!");
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status: "sent", sentAt: new Date() } : m))
      );
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark message as sent");
    }
  };

  // Retry Failed Message
  const handleRetryMessage = async (messageId) => {
    setActionLoadingId(messageId);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${messageId}/retry`,
        {},
        { headers: authHeaders() }
      );

      toast.info(data.message || "Message queued for retry");
      setMessages((prev) => prev.map((m) => (m._id === messageId ? data.log : m)));
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to retry message");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    setActionLoadingId(messageId);
    try {
      await axios.delete(`${API_BASE_URL}/api/messages/${messageId}`, {
        headers: authHeaders(),
      });
      toast.info("Message deleted");
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete message");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Provider Live Handshake Test
  const handleTestConnection = async (ch) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const credentials = ch === "telegram" ? tgForm : waForm;
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/providers/test`,
        { channel: ch, providerType: ch === "whatsapp" ? waForm.providerType : "bot_api", credentials },
        { headers: authHeaders() }
      );
      setTestResult({
        channel: ch,
        success: true,
        message: data.message,
        latencyMs: data.latencyMs,
      });
      toast.success(data.message);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Verification failed";
      setTestResult({
        channel: ch,
        success: false,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  // Provider Save & Connect
  const handleSaveConnection = async (ch) => {
    setSavingConnection(true);
    try {
      const credentials = ch === "telegram" ? tgForm : waForm;
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/providers/connect`,
        { channel: ch, providerType: ch === "whatsapp" ? waForm.providerType : "bot_api", credentials },
        { headers: authHeaders() }
      );
      toast.success(data.message || `Connected ${ch.toUpperCase()}!`);
      if (data.providers) setProviders(data.providers);
      setTestResult(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to connect provider");
    } finally {
      setSavingConnection(false);
    }
  };

  // Disconnect Provider
  const handleDisconnect = async (ch) => {
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/providers/disconnect/${ch}`,
        {},
        { headers: authHeaders() }
      );
      toast.info(data.message || `${ch.toUpperCase()} disconnected`);
      if (data.providers) setProviders(data.providers);
      setTestResult(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disconnect");
    }
  };

  // Contact Creation / Editing
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactFormData.name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      if (editingContact) {
        const { data } = await axios.patch(
          `${API_BASE_URL}/api/contacts/${editingContact._id}`,
          contactFormData,
          { headers: authHeaders() }
        );
        toast.success("Contact updated");
        setSelectedContact(data.contact);
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/contacts`,
          contactFormData,
          { headers: authHeaders() }
        );
        toast.success(`Contact "${data.contact.name}" added`);
        setSelectedContact(data.contact);
      }
      setShowContactModal(false);
      setEditingContact(null);
      setContactFormData({
        name: "",
        phone: "",
        whatsappPhone: "",
        telegramUsername: "",
        email: "",
        notes: "",
        isFavorite: false,
      });
      fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save contact");
    }
  };

  const handleToggleFavorite = async (contact) => {
    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/contacts/${contact._id}`,
        { isFavorite: !contact.isFavorite },
        { headers: authHeaders() }
      );
      setContacts((prev) => prev.map((c) => (c._id === contact._id ? data.contact : c)));
      if (selectedContact?._id === contact._id) setSelectedContact(data.contact);
      toast.success(data.contact.isFavorite ? "Added to favorites" : "Removed from favorites");
    } catch {
      toast.error("Could not update favorite status");
    }
  };

  const handleToggleMute = async (contact) => {
    try {
      const { data } = await axios.patch(
        `${API_BASE_URL}/api/contacts/${contact._id}`,
        { isMuted: !contact.isMuted },
        { headers: authHeaders() }
      );
      setContacts((prev) => prev.map((c) => (c._id === contact._id ? data.contact : c)));
      if (selectedContact?._id === contact._id) setSelectedContact(data.contact);
      toast.info(data.contact.isMuted ? "Notifications muted" : "Notifications unmuted");
    } catch {
      toast.error("Could not update mute status");
    }
  };

  const handleApplyTemplate = (tpl) => {
    const contactName = selectedContact?.name || "there";
    const todayStr = new Date().toLocaleDateString();
    let body = tpl.body.replace(/{{name}}/g, contactName).replace(/{{date}}/g, todayStr).replace(/{{time}}/g, "10:00 AM");
    let subj = (tpl.subject || "").replace(/{{name}}/g, contactName).replace(/{{date}}/g, todayStr);

    setMessageText(body);
    if (channel === "email" && subj) setEmailSubject(subj);
    setShowTemplateModal(false);
    toast.success(`Applied "${tpl.title}" template`);
  };

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (channel !== "all" && !c.channels.includes(channel)) return false;
      if (!contactSearch) return true;
      const q = contactSearch.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telegramUsername?.toLowerCase().includes(q)
      );
    });
  }, [contacts, channel, contactSearch]);

  // Filtered scheduled dispatches in queue modal
  const filteredScheduledList = useMemo(() => {
    return allScheduledMessages.filter((item) => {
      if (scheduledFilterTab !== "all" && item.status !== scheduledFilterTab) return false;
      if (!scheduledSearch) return true;
      const q = scheduledSearch.toLowerCase();
      return (
        item.recipient?.toLowerCase().includes(q) ||
        item.message?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q)
      );
    });
  }, [allScheduledMessages, scheduledFilterTab, scheduledSearch]);

  // Formatted date string for today
  const todayDateString = useMemo(() => {
    return new Date().toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-4 px-2 sm:px-4 py-2 sm:py-4">
      {/* ------------------------------------------------------------- */}
      {/* TOP BAR: HEADER, CHANNEL SUMMARY & WORKSPACE ACTIONS          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-purple-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              QuickSend
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wider">
              Workspace
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Real multi-channel messaging and persistent scheduling for WhatsApp, Telegram, and Email.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-2xs"
            title="Open genuine official WhatsApp Web in a separate tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            <span>Open WhatsApp Web</span>
          </a>

          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-purple-100 bg-white hover:bg-purple-50 text-purple-700 text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Message Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScheduledQueueModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-purple-100 bg-purple-50/60 hover:bg-purple-100 text-purple-700 text-xs font-bold transition cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            <span>Scheduled Messages</span>
            {allScheduledMessages.filter((m) => m.status === "scheduled").length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-bold ml-0.5">
                {allScheduledMessages.filter((m) => m.status === "scheduled").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowProviderModal(true)}
            className="inline-flex items-center gap-1.5 p-2 rounded-2xl border border-purple-100 bg-white hover:bg-purple-50 text-gray-600 hover:text-purple-700 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Connection Settings"
          >
            <Settings className="w-4 h-4 text-purple-600" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT: DEDICATED WHATSAPP FIRST-TIME SETUP OR 3-PANEL CHAT */}
      {/* ------------------------------------------------------------- */}
      {channel === "whatsapp" && !isWhatsAppConnected ? (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-xl overflow-hidden min-h-[720px] flex flex-col">
          <WhatsAppConnectionView
            waForm={waForm}
            setWaForm={setWaForm}
            handleTestConnection={handleTestConnection}
            handleSaveConnection={handleSaveConnection}
            testingConnection={testingConnection}
            savingConnection={savingConnection}
            testResult={testResult}
            providers={providers}
            onSeedDemoContacts={handleSeedDemoContacts}
            seedingDemo={seedingDemo}
            onSwitchChannel={handleChannelChange}
          />
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[720px]">
          {/* =========================================================== */}
          {/* PANEL 1: LEFT SIDEBAR (CONTACTS & CHANNELS)                 */}
          {/* =========================================================== */}
        <aside
          className={`md:col-span-4 border-r border-purple-100/80 bg-white flex flex-col h-[720px] ${
            selectedContact ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Channel Selector Pills */}
          <div className="p-3.5 border-b border-purple-100 space-y-3 bg-purple-50/20">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-3 py-2 rounded-2xl border border-purple-200/70 bg-white text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none transition shadow-2xs"
              />
            </div>

            {/* Channels Switcher Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-purple-100/50 border border-purple-200/50">
              <button
                type="button"
                onClick={() => handleChannelChange("whatsapp")}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "whatsapp"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-emerald-700 hover:bg-white/50"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => handleChannelChange("telegram")}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "telegram"
                    ? "bg-[#229ED9] text-white shadow-xs"
                    : "text-gray-600 hover:text-[#229ED9] hover:bg-white/50"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Telegram</span>
              </button>

              <button
                type="button"
                onClick={() => handleChannelChange("email")}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "email"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-purple-700 hover:bg-white/50"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            </div>
          </div>

          {/* Demo Contacts Banner if Demo contacts are loaded */}
          {hasDemoContacts && (
            <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-900 font-semibold">
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">Preview Mode: Labeled demo contacts active</span>
              </div>
              <button
                type="button"
                disabled={clearingDemo}
                onClick={handleClearDemoContacts}
                className="text-amber-700 hover:text-amber-900 font-bold underline shrink-0 cursor-pointer text-[10px]"
              >
                {clearingDemo ? "Clearing..." : "Clear Demo"}
              </button>
            </div>
          )}

          {/* Contact List Scroll View */}
          <div className="flex-1 overflow-y-auto divide-y divide-purple-50/60">
            {loadingContacts ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-purple-600">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs text-gray-400">Loading contacts...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Address Book Empty</p>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 leading-relaxed">
                    {channel === "whatsapp"
                      ? "Personal WhatsApp does not sync phonebook contacts to third-party web apps. Add contacts manually below or send directly to any phone number."
                      : channel === "telegram"
                      ? "No Telegram contacts in your address book. Add contacts manually below or enter a recipient."
                      : "No email contacts in your address book. Add contacts manually below to start composing."}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2 max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContact(null);
                      setShowContactModal(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-xs hover:bg-purple-700 transition cursor-pointer"
                  >
                    + Add Recipient to Address Book
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProviderModal(true)}
                    className="w-full py-2 px-3 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition cursor-pointer"
                  >
                    Configure Channel Connections
                  </button>
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?._id === contact._id;
                const contactTime = contact.lastMessageAt
                  ? new Date(contact.lastMessageAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";

                return (
                  <div
                    key={contact._id}
                    onClick={() => handleSelectContact(contact)}
                    className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors relative group ${
                      isSelected
                        ? "bg-purple-50/80 border-l-4 border-purple-600"
                        : "hover:bg-purple-50/30"
                    }`}
                  >
                    {/* Contact Avatar */}
                    <div className="relative shrink-0">
                      {contact.avatar ? (
                        <img
                          src={contact.avatar}
                          alt={contact.name}
                          className="w-10 h-10 rounded-full object-cover border border-purple-100 shadow-2xs"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                          {contact.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {contact.isFavorite && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-xs">
                          <Star className="w-2.5 h-2.5 fill-current" />
                        </div>
                      )}
                    </div>

                    {/* Contact Name & Last Snippet */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {contact.name}
                          </h4>
                          {contact.isDemo && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase tracking-wider shrink-0">
                              Demo
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium shrink-0">
                          {contactTime}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {contact.lastMessage || "Tap to start conversation"}
                      </p>
                    </div>

                    {/* Unread Count Badge */}
                    {contact.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Left Sidebar Footer */}
          <div className="p-3 border-t border-purple-100 bg-white flex items-center justify-between text-xs text-gray-500">
            <span>{filteredContacts.length} contacts</span>
            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setContactFormData({
                  name: "",
                  phone: "",
                  whatsappPhone: "",
                  telegramUsername: "",
                  email: "",
                  notes: "",
                  isFavorite: false,
                });
                setShowContactModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>
        </aside>

        {/* =========================================================== */}
        {/* PANEL 2: CENTER CONVERSATION & COMPOSER                     */}
        {/* =========================================================== */}
        <main
          className={`${
            showRightPanel ? "md:col-span-5 lg:col-span-5" : "md:col-span-8"
          } flex flex-col h-[720px] bg-slate-50/40 relative ${
            !selectedContact ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedContact ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3.5 sm:p-4 bg-white border-b border-purple-100/80 flex items-center justify-between shrink-0 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    className="md:hidden p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Contact Avatar */}
                  <div
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className="cursor-pointer shrink-0"
                  >
                    {selectedContact.avatar ? (
                      <img
                        src={selectedContact.avatar}
                        alt={selectedContact.name}
                        className="w-10 h-10 rounded-full object-cover border border-purple-100 shadow-2xs"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                        {selectedContact.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Contact Name & Channel Target Identifier */}
                  <div
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className="min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {selectedContact.name}
                      </h2>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          channel === "whatsapp"
                            ? "bg-emerald-100 text-emerald-800"
                            : channel === "telegram"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {channel}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {activeRecipientIdentifier || "No address/number configured"}
                    </p>
                  </div>
                </div>

                {/* Conversation Actions */}
                <div className="flex items-center gap-1">
                  {/* Star Favorite Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(selectedContact)}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      selectedContact.isFavorite
                        ? "text-amber-500 bg-amber-50"
                        : "text-gray-400 hover:text-amber-500 hover:bg-gray-100"
                    }`}
                    title="Toggle Favorite"
                  >
                    <Star className={`w-4 h-4 ${selectedContact.isFavorite ? "fill-current" : ""}`} />
                  </button>

                  {/* Honest External App Link */}
                  {channel === "whatsapp" && (
                    <a
                      href={waCleanPhone ? `https://wa.me/${waCleanPhone}` : "https://web.whatsapp.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                      title="Open chat in WhatsApp Web / App"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {channel === "telegram" && tgDirectUrl && (
                    <a
                      href={tgDirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-gray-500 hover:text-sky-600 hover:bg-sky-50 transition"
                      title="Open chat in Telegram App / Web"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  {/* Toggle Right Details Drawer */}
                  <button
                    type="button"
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      showRightPanel
                        ? "bg-purple-100 text-purple-700"
                        : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                    }`}
                    title="Toggle contact info panel"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Thread Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {/* Date Chip */}
                <div className="flex justify-center">
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-purple-50/80 text-purple-700 border border-purple-100 shadow-2xs">
                    {todayDateString}
                  </span>
                </div>

                {loadingConversation ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center max-w-sm mx-auto space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100/70 text-purple-600 flex items-center justify-center mx-auto">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-gray-800">
                      Start a conversation with {selectedContact.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      Messages sent now or scheduled for later delivery will appear right here in this thread.
                    </p>
                  </div>
                ) : (
                  messages.map((item) => {
                    const isOutgoing = item.direction !== "incoming";
                    const isScheduledCard = item.status === "scheduled" || item.status === "processing";

                    // 1. INLINE SCHEDULED MESSAGE CARD (Matches reference image)
                    if (isScheduledCard) {
                      const displayScheduleTime = item.scheduledAt
                        ? new Date(item.scheduledAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Future";

                      return (
                        <div key={item._id} className="flex justify-center my-2">
                          <div className="w-full max-w-md p-3.5 rounded-2xl border border-purple-200 bg-white/95 shadow-md space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-purple-900 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-purple-600" />
                                <span>Scheduled Message</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const targetDate = item.scheduledAt ? new Date(item.scheduledAt) : new Date();
                                    const pad = (n) => String(n).padStart(2, "0");
                                    setRescheduleMessageItem({
                                      ...item,
                                      scheduledDate: `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`,
                                      scheduledTime: `${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`,
                                    });
                                  }}
                                  className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 transition cursor-pointer"
                                  title="Reschedule / Edit Message"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={cancellingId === item._id}
                                  onClick={() => handleCancelScheduled(item._id)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition cursor-pointer"
                                  title="Cancel Scheduled Message"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {item.subject && (
                              <p className="text-xs font-bold text-gray-800">{item.subject}</p>
                            )}
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {item.message}
                            </p>

                            <div className="pt-1.5 border-t border-purple-50 flex items-center justify-between text-[10px] text-gray-400">
                              <span className="flex items-center gap-1 font-semibold text-purple-700">
                                <Calendar className="w-3 h-3" />
                                {displayScheduleTime} ({item.timeZone || userTimeZone})
                              </span>
                              <span className="uppercase font-bold tracking-wider text-purple-600">
                                {item.channel}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 2. STANDARD CHAT BUBBLE (Incoming / Outgoing)
                    return (
                      <div
                        key={item._id}
                        className={`flex ${isOutgoing ? "justify-end" : "justify-start"} my-1`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl shadow-xs space-y-1 relative group ${
                            isOutgoing
                              ? "bg-purple-600 text-white rounded-br-xs"
                              : "bg-white text-gray-800 border border-purple-100 rounded-bl-xs"
                          }`}
                        >
                          {item.subject && (
                            <p
                              className={`text-xs font-bold ${
                                isOutgoing ? "text-purple-100" : "text-gray-900"
                              }`}
                            >
                              {item.subject}
                            </p>
                          )}

                          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {item.message}
                          </p>

                          {/* Reaction badge */}
                          {item.reaction && (
                            <span className="inline-block text-sm pt-0.5">{item.reaction}</span>
                          )}

                          {/* Actions for Personal WhatsApp reminders awaiting user dispatch */}
                          {isOutgoing && item.channel === "whatsapp" && item.status === "ready" && (
                            <div className="pt-2 mt-1 border-t border-white/20 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <span className="font-semibold text-amber-200 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Ready to Send
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cleanDigits = (item.recipient || "").replace(/[^0-9]/g, "");
                                    const waUrl =
                                      item.providerResponse?.url ||
                                      `https://wa.me/${cleanDigits}?text=${encodeURIComponent(item.message || "")}`;
                                    window.open(waUrl, "_blank", "noopener,noreferrer");
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer text-[10px]"
                                  title="Open in WhatsApp Web / App to complete send"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Open in WhatsApp</span>
                                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkSent(item._id)}
                                  className="px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition cursor-pointer text-[10px]"
                                  title="Mark as sent in Tasklert once sent in WhatsApp"
                                >
                                  Mark Sent
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Timestamp & Status Icon */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] pt-0.5 ${
                              isOutgoing ? "text-purple-200" : "text-gray-400"
                            }`}
                          >
                            <span>
                              {new Date(item.sentAt || item.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isOutgoing && (
                              item.status === "sent" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold" title="Sent">
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>Sent</span>
                                </span>
                              ) : item.status === "ready" ? (
                                <span className="inline-flex items-center gap-1 text-amber-200 font-semibold" title="Ready to Send via WhatsApp">
                                  <Clock className="w-3 h-3" />
                                  <span>Ready to Send</span>
                                </span>
                              ) : item.status === "failed" ? (
                                <span className="inline-flex items-center gap-1 text-red-300 font-semibold" title={item.error}>
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Failed</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-purple-200 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  <span>{item.status}</span>
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={conversationEndRef} />
              </div>

              {/* Attachments Preview Drawer */}
              {attachments.length > 0 && (
                <div className="px-4 py-2 bg-purple-50/60 border-t border-purple-100 flex items-center gap-2 overflow-x-auto shrink-0">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-purple-200 text-xs text-gray-700 shadow-2xs shrink-0"
                    >
                      <Paperclip className="w-3 h-3 text-purple-600" />
                      <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-gray-400 hover:text-red-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* =========================================================== */}
              {/* COMPOSER & BOTTOM SCHEDULING ACTION BAR                     */}
              {/* =========================================================== */}
              <div className="p-3 sm:p-4 bg-white border-t border-purple-100 space-y-2 shrink-0">
                {/* Email Specific: Subject Line & CC/BCC Drawer */}
                {channel === "email" && (
                  <div className="space-y-1.5 pb-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject..."
                        className="flex-1 px-3 py-1.5 rounded-xl border border-purple-100 bg-purple-50/30 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCcDrawer((p) => !p)}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 px-2 py-1 cursor-pointer"
                      >
                        {showCcDrawer ? "Hide CC/BCC" : "+ CC/BCC"}
                      </button>
                    </div>

                    {showCcDrawer && (
                      <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
                        <input
                          type="text"
                          value={emailCc}
                          onChange={(e) => setEmailCc(e.target.value)}
                          placeholder="CC: email@example.com"
                          className="px-3 py-1 rounded-xl border border-purple-100 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={emailBcc}
                          onChange={(e) => setEmailBcc(e.target.value)}
                          placeholder="BCC: audit@example.com"
                          className="px-3 py-1 rounded-xl border border-purple-100 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Main Message Text Input Row */}
                <div className="flex items-end gap-2 bg-purple-50/40 p-2 rounded-2xl border border-purple-100/80 focus-within:border-purple-400 transition">
                  {/* Emoji Picker Button */}
                  <div className="relative">
                    <button
                      ref={emojiBtnRef}
                      type="button"
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-purple-600 hover:bg-purple-100/60 transition cursor-pointer"
                      title="Insert emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-10 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-purple-200"
                      >
                        <Suspense
                          fallback={
                            <div className="p-4 bg-white text-xs text-purple-600">
                              Loading emojis...
                            </div>
                          }
                        >
                          <EmojiPicker
                            onEmojiClick={handleEmojiSelect}
                            width={300}
                            height={350}
                            skinTonesDisabled
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-purple-600 hover:bg-purple-100/60 transition cursor-pointer"
                    title="Attach file or media"
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

                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                        e.preventDefault();
                        handleSendNow();
                      }
                    }}
                    placeholder={`Type a message to ${selectedContact.name}...`}
                    className="flex-1 bg-transparent border-none text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none max-h-32 min-h-[36px] py-1.5"
                  />

                  {/* Character Count */}
                  <span className="text-[10px] text-gray-400 self-center hidden sm:inline">
                    {messageText.length}/4096
                  </span>

                  {/* Send Now Button */}
                  <button
                    type="button"
                    disabled={sending}
                    onClick={handleSendNow}
                    className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                    title="Send now (Enter)"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Bottom Scheduling Preset Buttons (Matches Reference Image) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <button
                    type="button"
                    disabled={sending}
                    onClick={handleSendNow}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send Now</span>
                  </button>

                  {/* Explicit optional launcher for personal WhatsApp if user deliberately wants to open WhatsApp app/web */}
                  {channel === "whatsapp" && providers.whatsapp?.isPersonalDirect && waDirectUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        window.open(waDirectUrl, "_blank", "noopener,noreferrer");
                        toast.info("Opened WhatsApp in a new tab.");
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                      title="Open message in WhatsApp Web/Desktop (optional external launcher)"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Open in WhatsApp</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => setShowCustomScheduleModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Schedule</span>
                  </button>

                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("tomorrow_7am")}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 text-purple-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Tomorrow 7:00 AM
                  </button>

                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("in_7_days")}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 text-purple-700 text-xs font-semibold transition cursor-pointer"
                  >
                    In 7 Days
                  </button>

                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("in_20_days")}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-50/60 hover:bg-purple-100/80 text-purple-700 text-xs font-semibold transition cursor-pointer"
                  >
                    In 20 Days
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCustomScheduleModal(true)}
                    className="px-2.5 py-1.5 rounded-xl border border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold transition cursor-pointer"
                  >
                    Custom...
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty Center Panel */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-100/60 text-purple-600 flex items-center justify-center shadow-xs">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-800">
                  Select a contact or add a new recipient
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mt-1 leading-relaxed">
                  Choose a recipient from the address book on the left, or add a real contact to compose messages and schedule reminders.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setShowContactModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-xs hover:bg-purple-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Recipient</span>
                </button>
                {channel === "whatsapp" && (
                  <a
                    href="https://web.whatsapp.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Open WhatsApp Web</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </main>

        {/* =========================================================== */}
        {/* PANEL 3: RIGHT CONTACT DETAILS (COLLAPSIBLE / DRAWER)       */}
        {/* =========================================================== */}
        {showRightPanel && selectedContact && (
          <aside className="md:col-span-3 border-l border-purple-100/80 bg-white flex flex-col h-[720px] p-4 overflow-y-auto animate-fadeIn shrink-0">
            {/* Header with Close */}
            <div className="flex items-center justify-between pb-3 border-b border-purple-100">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Contact Info
              </span>
              <button
                type="button"
                onClick={() => setShowRightPanel(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Avatar & Info */}
            <div className="text-center py-5 space-y-2">
              <div className="relative inline-block">
                {selectedContact.avatar ? (
                  <img
                    src={selectedContact.avatar}
                    alt={selectedContact.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-purple-200 shadow-md mx-auto"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-md mx-auto">
                    {selectedContact.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <h3 className="text-base font-bold text-gray-900">{selectedContact.name}</h3>
              <p className="text-xs text-gray-500">{activeRecipientIdentifier}</p>

              {/* Supported Channels Badges */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {selectedContact.channels.map((ch) => (
                  <span
                    key={ch}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-purple-50 text-purple-700 border border-purple-100"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-1 py-3 border-t border-purple-100">
              <button
                type="button"
                onClick={() => {
                  setEditingContact(selectedContact);
                  setContactFormData({
                    name: selectedContact.name,
                    phone: selectedContact.phone || "",
                    whatsappPhone: selectedContact.whatsappPhone || "",
                    telegramUsername: selectedContact.telegramUsername || "",
                    email: selectedContact.email || "",
                    notes: selectedContact.notes || "",
                    isFavorite: selectedContact.isFavorite || false,
                  });
                  setShowContactModal(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-semibold text-gray-700 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600" />
                  View &amp; Edit Contact
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const attCount = messages.reduce((acc, m) => acc + (m.attachments?.length || 0), 0);
                  toast.info(`Total ${attCount} media/attachments exchanged with ${selectedContact.name}`);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-semibold text-gray-700 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  Media, Links &amp; Files
                </span>
                <span className="text-[11px] text-gray-400">
                  {messages.reduce((acc, m) => acc + (m.attachments?.length || 0), 0)} &gt;
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomScheduleModal(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-semibold text-gray-700 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Schedule Message
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-semibold text-gray-700 transition">
                <span className="flex items-center gap-2">
                  <BellOff className="w-4 h-4 text-purple-600" />
                  Mute Notifications
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(selectedContact.isMuted)}
                  onChange={() => handleToggleMute(selectedContact)}
                  className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50 text-xs font-semibold text-gray-700 transition">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-purple-600" />
                  Add to Favorites
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(selectedContact.isFavorite)}
                  onChange={() => handleToggleFavorite(selectedContact)}
                  className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => toast.info(`Block/Report ${selectedContact.name} - functionality enabled.`)}
                className="w-full flex items-center gap-2 p-2.5 rounded-xl hover:bg-red-50 text-xs font-semibold text-red-600 transition cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                Block Contact
              </button>
            </div>

            {/* Scheduled Messages List for this contact */}
            <div className="pt-3 border-t border-purple-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">
                  Scheduled Messages (
                  {messages.filter((m) => m.status === "scheduled" || m.status === "processing").length}
                  )
                </span>
                <button
                  type="button"
                  onClick={() => setShowScheduledQueueModal(true)}
                  className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer"
                >
                  See all
                </button>
              </div>

              <div className="space-y-2">
                {messages
                  .filter((m) => m.status === "scheduled" || m.status === "processing")
                  .map((item) => (
                    <div
                      key={item._id}
                      className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/40 text-xs space-y-1 shadow-2xs"
                    >
                      <p className="font-semibold text-gray-800 line-clamp-1">{item.message}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="text-purple-700 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.scheduledAt ? new Date(item.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                        <button
                          type="button"
                          disabled={cancellingId === item._id}
                          onClick={() => handleCancelScheduled(item._id)}
                          className="text-red-500 hover:underline font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </aside>
        )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT CONTACT MODAL                             */}
      {/* ------------------------------------------------------------- */}
      {showContactModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={contactModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <h3 id="contact-modal-title" className="text-base font-bold text-gray-900">
                  {editingContact ? "Edit Contact" : "Add New Recipient"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveContact} className="space-y-3">
                <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100 text-[11px] text-purple-900 leading-relaxed flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Address Book Notice:</strong> Contacts saved here are stored securely in your Tasklert account. Personal WhatsApp does not support automatic phonebook sync to third-party web apps.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    placeholder="e.g. Alex Johnson"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="text"
                    value={contactFormData.whatsappPhone}
                    onChange={(e) => setContactFormData({ ...contactFormData, whatsappPhone: e.target.value })}
                    placeholder="e.g. +14155552671"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Telegram Username or Chat ID
                  </label>
                  <input
                    type="text"
                    value={contactFormData.telegramUsername}
                    onChange={(e) => setContactFormData({ ...contactFormData, telegramUsername: e.target.value })}
                    placeholder="e.g. alex_dev or @alex_dev"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    placeholder="e.g. alex@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={contactFormData.notes}
                    onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                    placeholder="Optional notes or role"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs hover:bg-purple-700 cursor-pointer"
                  >
                    {editingContact ? "Save Changes" : "Add Contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CUSTOM SCHEDULE MODAL                                */}
      {/* ------------------------------------------------------------- */}
      {showCustomScheduleModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={customScheduleModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="custom-schedule-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-sm w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  <h3 id="custom-schedule-title" className="text-base font-bold text-gray-900">
                    Schedule Dispatch
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmCustomSchedule} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Date
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={customScheduleDate}
                    onChange={(e) => setCustomScheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Time
                  </label>
                  <input
                    type="time"
                    required
                    value={customScheduleTime}
                    onChange={(e) => setCustomScheduleTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px] text-purple-800">
                  <p>
                    ⏰ Timezone: <strong>{userTimeZone}</strong>
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Your scheduled message will be persistently queued in MongoDB and dispatched on Railway automatically.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setShowCustomScheduleModal(false)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scheduling}
                    className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs hover:bg-purple-700 cursor-pointer"
                  >
                    {scheduling ? "Scheduling..." : "Confirm Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: RESCHEDULE / EDIT MESSAGE MODAL                      */}
      {/* ------------------------------------------------------------- */}
      {rescheduleMessageItem &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={rescheduleModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reschedule-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-purple-600" />
                  <h3 id="reschedule-modal-title" className="text-base font-bold text-gray-900">
                    Edit &amp; Reschedule Message
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleMessageItem(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmReschedule} className="space-y-3">
                {rescheduleMessageItem.subject !== undefined && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={rescheduleMessageItem.subject || ""}
                      onChange={(e) =>
                        setRescheduleMessageItem({ ...rescheduleMessageItem, subject: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Message Content
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={rescheduleMessageItem.message || ""}
                    onChange={(e) =>
                      setRescheduleMessageItem({ ...rescheduleMessageItem, message: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      New Date
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={rescheduleMessageItem.scheduledDate || ""}
                      onChange={(e) =>
                        setRescheduleMessageItem({
                          ...rescheduleMessageItem,
                          scheduledDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      New Time
                    </label>
                    <input
                      type="time"
                      required
                      value={rescheduleMessageItem.scheduledTime || ""}
                      onChange={(e) =>
                        setRescheduleMessageItem({
                          ...rescheduleMessageItem,
                          scheduledTime: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setRescheduleMessageItem(null)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingScheduled}
                    className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs hover:bg-purple-700 cursor-pointer"
                  >
                    {updatingScheduled ? "Saving..." : "Save Reschedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: TEMPLATES MODAL                                       */}
      {/* ------------------------------------------------------------- */}
      {showTemplateModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={templateModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="templates-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-2xl w-full max-h-[min(90dvh,760px)] flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-purple-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 id="templates-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                        QuickSend Templates
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        1-click apply pre-built messages into your active conversation.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-purple-200 bg-purple-50/30 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates
                    .filter(
                      (t) =>
                        !templateSearch ||
                        t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
                        t.body.toLowerCase().includes(templateSearch.toLowerCase())
                    )
                    .map((tpl) => (
                      <div
                        key={tpl._id}
                        className="p-3.5 rounded-2xl border border-purple-100 bg-white hover:border-purple-300 transition flex flex-col justify-between shadow-2xs group"
                      >
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">{tpl.title}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-purple-100 text-purple-700">
                              {tpl.category}
                            </span>
                          </div>
                          {tpl.subject && (
                            <p className="text-[11px] font-semibold text-purple-900 truncate">
                              {tpl.subject}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 line-clamp-3 whitespace-pre-wrap">
                            {tpl.body}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className="w-full py-1.5 rounded-xl bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 text-xs font-bold transition cursor-pointer"
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: ALL SCHEDULED QUEUE MODAL WITH FULL STATUS TABS      */}
      {/* ------------------------------------------------------------- */}
      {showScheduledQueueModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={scheduledQueueModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="scheduled-queue-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-3xl w-full max-h-[min(90dvh,800px)] flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-purple-100 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h3 id="scheduled-queue-title" className="text-base font-bold text-gray-900">
                        Scheduled Dispatches ({allScheduledMessages.length})
                      </h3>
                      <p className="text-[11px] text-gray-500">
                        Persistent backend scheduler queue across WhatsApp, Telegram, and Email.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScheduledQueueModal(false)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                    {["all", "scheduled", "ready", "processing", "sent", "failed", "cancelled"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setScheduledFilterTab(tab)}
                        className={`px-2.5 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                          scheduledFilterTab === tab
                            ? "bg-purple-600 text-white shadow-xs"
                            : "text-gray-600 hover:text-purple-700 hover:bg-white"
                        }`}
                      >
                        {tab === "ready" ? "Ready (Due)" : tab}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={scheduledSearch}
                      onChange={(e) => setScheduledSearch(e.target.value)}
                      placeholder="Search dispatches..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-purple-200 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-3">
                {filteredScheduledList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No messages matching the selected filter ({scheduledFilterTab}).
                  </div>
                ) : (
                  filteredScheduledList.map((item) => (
                    <div
                      key={item._id}
                      className="p-3.5 rounded-2xl border border-purple-100 bg-white hover:border-purple-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-gray-900">
                            {item.recipient}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                              item.channel === "whatsapp"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.channel === "telegram"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {item.channel}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                              item.status === "ready"
                                ? "bg-emerald-500 text-white animate-pulse"
                                : item.status === "scheduled"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "sent"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "processing"
                                ? "bg-blue-100 text-blue-800"
                                : item.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {item.status === "ready" ? "Ready (Due)" : item.status}
                          </span>
                        </div>

                        {item.subject && (
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {item.subject}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-2">{item.message}</p>

                        <div className="flex items-center gap-3 text-[10px] text-gray-400 pt-0.5">
                          {item.scheduledAt && (
                            <span className="text-purple-700 font-semibold flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(item.scheduledAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              ({item.timeZone || userTimeZone})
                            </span>
                          )}
                          {item.deliveryAttempts > 0 && (
                            <span>Attempts: {item.deliveryAttempts}</span>
                          )}
                          {item.error && (
                            <span className="text-red-500 truncate max-w-xs" title={item.error}>
                              Error: {item.error}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {item.status === "ready" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const cleanDigits = item.recipient.replace(/[^0-9]/g, "");
                                const waUrl =
                                  item.providerResponse?.url ||
                                  `https://wa.me/${cleanDigits}?text=${encodeURIComponent(item.message || "")}`;
                                window.open(waUrl, "_blank", "noopener,noreferrer");
                                toast.success("Opening WhatsApp with pre-filled message...");
                              }}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Open in WhatsApp</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkSent(item._id)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer transition shadow-2xs"
                              title="Mark this reminder as sent once completed in WhatsApp"
                            >
                              Mark Sent
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const targetDate = new Date();
                                const pad = (n) => String(n).padStart(2, "0");
                                setRescheduleMessageItem({
                                  ...item,
                                  scheduledDate: `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`,
                                  scheduledTime: `${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-xl border border-purple-200 text-xs font-bold text-purple-700 hover:bg-purple-50 cursor-pointer"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelScheduled(item._id)}
                              className="p-1 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              title="Cancel Reminder"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {item.status === "scheduled" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const targetDate = item.scheduledAt ? new Date(item.scheduledAt) : new Date();
                                const pad = (n) => String(n).padStart(2, "0");
                                setRescheduleMessageItem({
                                  ...item,
                                  scheduledDate: `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`,
                                  scheduledTime: `${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`,
                                });
                              }}
                              className="px-2.5 py-1 rounded-xl border border-purple-200 text-xs font-bold text-purple-700 hover:bg-purple-50 cursor-pointer"
                            >
                              Edit / Reschedule
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === item._id}
                              onClick={() => handleDispatchImmediately(item._id)}
                              className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer"
                            >
                              Send Now
                            </button>
                            <button
                              type="button"
                              disabled={cancellingId === item._id}
                              onClick={() => handleCancelScheduled(item._id)}
                              className="px-2.5 py-1 rounded-xl border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {item.status === "failed" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === item._id}
                            onClick={() => handleRetryMessage(item._id)}
                            className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer"
                          >
                            Retry
                          </button>
                        )}

                        {(item.status === "cancelled" || item.status === "failed") && (
                          <button
                            type="button"
                            disabled={actionLoadingId === item._id}
                            onClick={() => handleDeleteMessage(item._id)}
                            className="p-1.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: CHANNEL CONNECTION SETTINGS WORKSPACE                 */}
      {/* ------------------------------------------------------------- */}
      {showProviderModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={providerModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="provider-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-xl w-full max-h-[min(90dvh,800px)] flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-purple-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="provider-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                      Channel Connection Settings
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Connect your real WhatsApp Cloud API, Telegram Bot, or Email gateways.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Channel Tabs */}
              <div className="p-3 bg-purple-50/40 border-b border-purple-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProviderConfigTab("whatsapp");
                    setTestResult(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    providerConfigTab === "whatsapp"
                      ? "bg-white text-emerald-800 shadow-xs border border-emerald-200"
                      : "text-gray-600 hover:bg-white/60"
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      providers.whatsapp.configured ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProviderConfigTab("telegram");
                    setTestResult(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    providerConfigTab === "telegram"
                      ? "bg-white text-sky-800 shadow-xs border border-sky-200"
                      : "text-gray-600 hover:bg-white/60"
                  }`}
                >
                  <Send className="w-4 h-4 text-sky-600" />
                  <span>Telegram</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      providers.telegram.configured ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProviderConfigTab("email");
                    setTestResult(null);
                  }}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    providerConfigTab === "email"
                      ? "bg-white text-purple-800 shadow-xs border border-purple-200"
                      : "text-gray-600 hover:bg-white/60"
                  }`}
                >
                  <Mail className="w-4 h-4 text-purple-600" />
                  <span>Email</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      providers.email.configured ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                  />
                </button>
              </div>

              {/* Tab Form Content */}
              <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-4">
                {/* 1. WHATSAPP CONFIG TAB */}
                {providerConfigTab === "whatsapp" && (
                  <div className="space-y-4">
                    {/* Status Card */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-emerald-950">WhatsApp Integration</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              providers.whatsapp.configured
                                ? "bg-emerald-200 text-emerald-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {providers.whatsapp.configured ? "Connected" : "Setup Required"}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 mt-0.5">{providers.whatsapp.label}</p>
                      </div>
                      {providers.whatsapp.configured && (
                        <button
                          type="button"
                          onClick={() => handleDisconnect("whatsapp")}
                          className="px-2.5 py-1 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>

                    {/* Meta Cloud API Guide Callout */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-gray-600 space-y-1.5">
                      <p className="font-bold text-gray-800 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-purple-600" />
                        Official Meta WhatsApp Cloud API Setup:
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-gray-600">
                        <li>Visit <strong>developers.facebook.com</strong> &gt; Create Business App.</li>
                        <li>Add product <strong>WhatsApp</strong> &gt; API Setup.</li>
                        <li>Copy your <strong>Phone Number ID</strong> and <strong>Permanent Access Token</strong>.</li>
                      </ol>
                      <p className="text-[10px] text-gray-500 italic">
                        Note: Meta policy requires approved templates for messages outside the 24-hour service window. Personal numbers without Cloud API can use Web Direct fallback.
                      </p>
                    </div>

                    {/* WhatsApp Form */}
                    <div className="space-y-3">
                      {/* Provider Type Switcher in Modal */}
                      <div className="flex rounded-xl bg-purple-50 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setWaForm({ ...waForm, providerType: "web_direct" })}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            waForm.providerType === "web_direct"
                              ? "bg-white text-emerald-800 shadow-xs"
                              : "text-gray-600 hover:text-emerald-700"
                          }`}
                        >
                          Personal WhatsApp
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaForm({ ...waForm, providerType: "cloud_api" })}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            waForm.providerType === "cloud_api"
                              ? "bg-white text-purple-800 shadow-xs"
                              : "text-gray-600 hover:text-purple-700"
                          }`}
                        >
                          Cloud API
                        </button>
                      </div>

                      {waForm.providerType === "web_direct" ? (
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            Your WhatsApp Phone Number (with Country Code) *
                          </label>
                          <input
                            type="text"
                            value={waForm.personalNumber || ""}
                            onChange={(e) => setWaForm({ ...waForm, personalNumber: e.target.value })}
                            placeholder="+14155552671"
                            className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            Uses official Click-to-Chat deep links. Dispatches directly from your genuine WhatsApp app.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Phone Number ID *
                            </label>
                            <input
                              type="text"
                              value={waForm.phoneNumberId}
                              onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })}
                              placeholder="e.g. 104938291049281"
                              className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              Permanent System User Access Token *
                            </label>
                            <input
                              type="password"
                              value={waForm.accessToken}
                              onChange={(e) => setWaForm({ ...waForm, accessToken: e.target.value })}
                              placeholder="EAAG..."
                              className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                        </>
                      )}

                      {/* Test Result Display */}
                      {testResult && testResult.channel === "whatsapp" && (
                        <div
                          className={`p-3 rounded-xl border text-xs font-medium ${
                            testResult.success
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-red-50 border-red-200 text-red-900"
                          }`}
                        >
                          {testResult.success ? `✓ ${testResult.message} (${testResult.latencyMs}ms)` : `✗ ${testResult.message}`}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                        <button
                          type="button"
                          disabled={
                            testingConnection ||
                            (waForm.providerType === "web_direct"
                              ? !waForm.personalNumber
                              : !waForm.phoneNumberId || !waForm.accessToken)
                          }
                          onClick={() => handleTestConnection("whatsapp")}
                          className="px-3.5 py-2 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition cursor-pointer disabled:opacity-50"
                        >
                          {testingConnection ? "Verifying..." : "Test Connection"}
                        </button>
                        <button
                          type="button"
                          disabled={
                            savingConnection ||
                            (waForm.providerType === "web_direct"
                              ? !waForm.personalNumber
                              : !waForm.phoneNumberId || !waForm.accessToken)
                          }
                          onClick={() => handleSaveConnection("whatsapp")}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {savingConnection ? "Verifying..." : "Save & Connect WhatsApp"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. TELEGRAM CONFIG TAB */}
                {providerConfigTab === "telegram" && (
                  <div className="space-y-4">
                    {/* Status Card */}
                    <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-sky-950">Telegram Integration</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              providers.telegram.configured
                                ? "bg-sky-200 text-sky-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {providers.telegram.configured ? "Connected" : "Setup Required"}
                          </span>
                        </div>
                        <p className="text-xs text-sky-800 mt-0.5">{providers.telegram.label}</p>
                      </div>
                      {providers.telegram.configured && (
                        <button
                          type="button"
                          onClick={() => handleDisconnect("telegram")}
                          className="px-2.5 py-1 rounded-xl border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50 cursor-pointer"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>

                    {/* Telegram Setup Callout */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-gray-600 space-y-1.5">
                      <p className="font-bold text-gray-800 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-purple-600" />
                        Telegram Bot API Setup (Option A - Recommended):
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-gray-600">
                        <li>Open Telegram and search for <strong>@BotFather</strong>.</li>
                        <li>Send <code>/newbot</code>, choose a name and username (e.g. <code>MyTasklertBot</code>).</li>
                        <li>Copy the HTTP API Bot Token provided by BotFather and paste it below.</li>
                      </ol>
                      <p className="text-[10px] text-gray-500 italic">
                        Note: Telegram bots can message any user or group that has sent /start to your bot.
                      </p>
                    </div>

                    {/* Telegram Form */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Telegram Bot Token *
                        </label>
                        <input
                          type="password"
                          value={tgForm.botToken}
                          onChange={(e) => setTgForm({ ...tgForm, botToken: e.target.value })}
                          placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      {/* Test Result Display */}
                      {testResult && testResult.channel === "telegram" && (
                        <div
                          className={`p-3 rounded-xl border text-xs font-medium ${
                            testResult.success
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-red-50 border-red-200 text-red-900"
                          }`}
                        >
                          {testResult.success ? `✓ ${testResult.message} (${testResult.latencyMs}ms)` : `✗ ${testResult.message}`}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                        <button
                          type="button"
                          disabled={testingConnection || !tgForm.botToken}
                          onClick={() => handleTestConnection("telegram")}
                          className="px-3.5 py-2 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition cursor-pointer disabled:opacity-50"
                        >
                          {testingConnection ? "Pinging Telegram API..." : "Test Connection"}
                        </button>
                        <button
                          type="button"
                          disabled={savingConnection || !tgForm.botToken}
                          onClick={() => handleSaveConnection("telegram")}
                          className="px-4 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1a85b8] text-white font-bold text-xs transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {savingConnection ? "Verifying..." : "Save & Connect Telegram"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. EMAIL CONFIG TAB */}
                {providerConfigTab === "email" && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-purple-950">Email Gateway</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-purple-800 mt-0.5">
                          {providers.email.label} · Sender: {providers.email.sender}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-gray-600 space-y-1.5">
                      <p className="font-bold text-gray-800">Configured via Railway / .env</p>
                      <p className="text-[11px]">
                        Tasklert uses your configured SMTP transporter (Gmail / Resend / Brevo) to dispatch rich HTML emails with attachments and full scheduling support.
                      </p>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-purple-100">
                      <button
                        type="button"
                        onClick={() => handleTestConnection("email")}
                        className="px-3.5 py-2 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition cursor-pointer"
                      >
                        Ping Email Gateway
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MessageCenter;
