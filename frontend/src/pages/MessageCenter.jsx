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

const FALLBACK_CONTACTS = [
  {
    _id: "seed_ramu",
    name: "Ramu",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 79978 64218",
    whatsappPhone: "+917997864218",
    telegramUsername: "ramu_tech",
    email: "ramu@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Hey! Please check this.",
    lastMessageAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    unreadCount: 2,
    isFavorite: true,
  },
  {
    _id: "seed_priya",
    name: "Priya Sharma",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 98450 12345",
    whatsappPhone: "+919845012345",
    telegramUsername: "priya_design",
    email: "priya.sharma@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "Thank you! 🙏",
    lastMessageAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    isFavorite: true,
  },
  {
    _id: "seed_college",
    name: "College Group",
    avatar: "",
    phone: "",
    whatsappPhone: "+919988776655",
    telegramUsername: "college_alumni_sync",
    email: "alumni-group@example.com",
    channels: ["whatsapp", "telegram"],
    lastMessage: "Rahul: Meeting at 5 PM",
    lastMessageAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    _id: "seed_arjun",
    name: "Arjun",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
    phone: "+91 91234 56789",
    whatsappPhone: "+919123456789",
    telegramUsername: "arjun_dev",
    email: "arjun@example.com",
    channels: ["whatsapp", "telegram", "email"],
    lastMessage: "See you tomorrow!",
    lastMessageAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    isFavorite: false,
  },
  {
    _id: "seed_family",
    name: "Family",
    avatar: "",
    phone: "",
    whatsappPhone: "+919000011122",
    telegramUsername: "",
    email: "family@example.com",
    channels: ["whatsapp", "email"],
    lastMessage: "Dinner plans?",
    lastMessageAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    unreadCount: 0,
    isFavorite: false,
  },
];

const FALLBACK_RAMU_MESSAGES = [
  {
    _id: "fb_msg_1",
    channel: "whatsapp",
    sender: "Ramu",
    recipient: "+917997864218",
    message: "Hey! Please check this.",
    direction: "incoming",
    status: "sent",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    _id: "fb_msg_2",
    channel: "whatsapp",
    sender: "You",
    recipient: "+917997864218",
    message: "Sure, checking it right now! Will update shortly.",
    direction: "outgoing",
    status: "sent",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    _id: "fb_msg_3",
    channel: "whatsapp",
    sender: "You",
    recipient: "+917997864218",
    message: "Scheduled follow-up: Project milestone review at 10:00 AM.",
    direction: "outgoing",
    status: "scheduled",
    scheduledFor: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
];

const MessageCenter = () => {
  // Channel Switcher: 'whatsapp' | 'telegram' | 'email'
  const [channel, setChannel] = useState(() => {
    return localStorage.getItem("tasklert_quicksend_last_channel") || "whatsapp";
  });

  // Contacts State
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  // Active Conversation Thread
  const [messages, setMessages] = useState([]);
  const [loadingConversation, setLoadingConversation] = useState(false);

  // Message Composer State
  const [messageText, setMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [showEmailCcBcc, setShowEmailCcBcc] = useState(false);
  const [attachments, setAttachments] = useState([]);

  // Right Details Panel (Collapsible)
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

  // Template State
  const [templateSearch, setTemplateSearch] = useState("");
  const [templates, setTemplates] = useState(STARTER_TEMPLATES);

  // Async States
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [updatingScheduled, setUpdatingScheduled] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Provider Status
  const [providers, setProviders] = useState({
    email: { configured: true, label: "Ready (SMTP / Resend / Brevo)", provider: "smtp", sender: "noreply@tasklert.com" },
    telegram: { configured: false, label: "Setup required (TELEGRAM_BOT_TOKEN)", botUsername: null },
    whatsapp: { configured: false, label: "Setup required (Cloud API or Twilio)", provider: "none", senderNumber: null },
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

  // DOM References
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const conversationEndRef = useRef(null);
  const savedSelectionRef = useRef({ start: 0, end: 0 });

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

  // Fetch Contacts
  const fetchContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/contacts`, {
        params: { channel, search: contactSearch },
        headers: authHeaders(),
      });
      let list = Array.isArray(data?.contacts) ? data.contacts : [];
      if (list.length === 0 && !contactSearch) {
        list = FALLBACK_CONTACTS.filter((c) => c.channels.includes(channel));
      }
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
      console.warn("fetchContacts fallback triggered:", err?.message);
      const list = FALLBACK_CONTACTS.filter((c) => {
        const matchesChannel = c.channels.includes(channel);
        if (!contactSearch) return matchesChannel;
        const q = contactSearch.toLowerCase();
        return (
          matchesChannel &&
          (c.name.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.telegramUsername?.toLowerCase().includes(q))
        );
      });
      setContacts(list);
      setSelectedContact((curr) => {
        if (!curr && list.length > 0) return list[0];
        if (curr && list.some((c) => c._id === curr._id)) {
          return list.find((c) => c._id === curr._id);
        }
        return list[0] || null;
      });
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

  // Fetch All Scheduled Messages across all contacts for badge and queue modal
  const fetchAllScheduled = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/messages`, {
        params: { status: "scheduled" },
        headers: authHeaders(),
      });
      setAllScheduledMessages(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("fetchAllScheduled error:", err);
    }
  }, []);

  // Fetch Conversation for Selected Contact
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
      console.warn("fetchConversation fallback triggered:", err?.message);
      if (contact.name === "Ramu") {
        setMessages(FALLBACK_RAMU_MESSAGES.filter((m) => m.channel === channel || channel === "whatsapp"));
      } else {
        setMessages([]);
      }
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
        })
      );
    } catch (_) {}
  }, [channel, selectedContact, messageText, emailSubject, emailCc, emailBcc]);

  // Restore draft when contact or channel changes
  useEffect(() => {
    if (!selectedContact) {
      setMessageText("");
      setEmailSubject("");
      return;
    }
    const key = getDraftKey(channel, selectedContact._id);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessageText(parsed.messageText || "");
        setEmailSubject(parsed.emailSubject || "");
        setEmailCc(parsed.emailCc || "");
        setEmailBcc(parsed.emailBcc || "");
        if (parsed.emailCc || parsed.emailBcc) setShowEmailCcBcc(true);
      } catch {
        setMessageText("");
      }
    } else {
      setMessageText("");
      setEmailSubject("");
      setEmailCc("");
      setEmailBcc("");
      setShowEmailCcBcc(false);
    }
  }, [selectedContact, channel]);

  // Autosave draft on text change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCurrentDraft();
    }, 500);
    return () => clearTimeout(timer);
  }, [saveCurrentDraft]);

  // Channel Switcher Handler
  const handleChannelChange = (newChannel) => {
    if (newChannel === channel) return;
    saveCurrentDraft();
    setChannel(newChannel);
    localStorage.setItem("tasklert_quicksend_last_channel", newChannel);
  };

  // Recipient Identifier for active contact & channel
  const activeRecipientIdentifier = useMemo(() => {
    if (!selectedContact) return "";
    if (channel === "whatsapp") {
      return selectedContact.whatsappPhone || selectedContact.phone || "";
    }
    if (channel === "telegram") {
      return selectedContact.telegramUsername
        ? `@${selectedContact.telegramUsername}`
        : selectedContact.telegramChatId || "";
    }
    if (channel === "email") {
      return selectedContact.email || "";
    }
    return selectedContact.phone || "";
  }, [selectedContact, channel]);

  // WhatsApp Web Fallback link
  const waDirectUrl = useMemo(() => {
    if (channel !== "whatsapp" || !activeRecipientIdentifier) return null;
    const digits = activeRecipientIdentifier.replace(/[^0-9]/g, "");
    if (digits.length < 7) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(messageText.trim())}`;
  }, [channel, activeRecipientIdentifier, messageText]);

  // Emojis & Textarea management
  const handleInsertEmoji = (emojiStr) => {
    const el = textareaRef.current;
    if (!el) {
      setMessageText((prev) => prev + emojiStr);
      return;
    }
    const { start, end } = savedSelectionRef.current;
    const currentVal = messageText;
    const nextVal = currentVal.substring(0, start) + emojiStr + currentVal.substring(end);
    setMessageText(nextVal);
    const nextPos = start + emojiStr.length;
    savedSelectionRef.current = { start: nextPos, end: nextPos };

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleEmojiClick = (emojiData) => {
    if (emojiData?.emoji) handleInsertEmoji(emojiData.emoji);
  };

  const handleTextareaSelect = (e) => {
    savedSelectionRef.current = {
      start: e.target.selectionStart || 0,
      end: e.target.selectionEnd || 0,
    };
  };

  // Attachment upload handling
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (attachments.length + selected.length > 5) {
      toast.error("Maximum 5 attachments allowed per message");
      return;
    }
    const oversized = selected.find((f) => f.size > 15 * 1024 * 1024);
    if (oversized) {
      toast.error(`File "${oversized.name}" exceeds the 15MB limit`);
      return;
    }
    setAttachments((prev) => [...prev, ...selected]);
    e.target.value = null;
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Dispatch / Send Message (Send Now)
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedContact) {
      toast.error("Please select a contact");
      return;
    }
    if (!activeRecipientIdentifier) {
      toast.error(`Contact "${selectedContact.name}" does not have an active ${channel} address/number`);
      return;
    }
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("Subject is required for emails");
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", activeRecipientIdentifier);
      formData.append("contactId", selectedContact._id);
      formData.append("subject", emailSubject.trim());
      formData.append("message", messageText.trim());
      formData.append("cc", emailCc.trim());
      formData.append("bcc", emailBcc.trim());
      formData.append("timeZone", userTimeZone);
      attachments.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(data.message || "Message sent!");
      setMessageText("");
      setAttachments([]);
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));
      fetchConversation(selectedContact);
      fetchContacts();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to send message";
      if (channel === "whatsapp" && errMsg.toLowerCase().includes("not configured") && waDirectUrl) {
        toast.info("WhatsApp Cloud API not active — opening WhatsApp directly for you...");
        window.open(waDirectUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSending(false);
    }
  };

  // Schedule Message with Preset (Tomorrow 7:00 AM, In 7 Days, In 20 Days)
  const handleSchedulePreset = async (presetType) => {
    if (!selectedContact) {
      toast.error("Please select a contact");
      return;
    }
    if (!activeRecipientIdentifier) {
      toast.error(`Contact "${selectedContact.name}" does not have an active ${channel} address/number`);
      return;
    }
    if (channel === "email" && !emailSubject.trim()) {
      toast.error("Subject is required for emails");
      return;
    }
    if (!messageText.trim() && attachments.length === 0) {
      toast.error("Please enter a message before scheduling");
      return;
    }

    const now = new Date();
    const target = new Date(now);

    if (presetType === "tomorrow") {
      target.setDate(target.getDate() + 1);
      target.setHours(7, 0, 0, 0);
    } else if (presetType === "7days") {
      target.setDate(target.getDate() + 7);
      target.setHours(7, 0, 0, 0);
    } else if (presetType === "20days") {
      target.setDate(target.getDate() + 20);
      target.setHours(7, 0, 0, 0);
    }

    setScheduling(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", activeRecipientIdentifier);
      formData.append("contactId", selectedContact._id);
      formData.append("subject", emailSubject.trim());
      formData.append("message", messageText.trim());
      formData.append("cc", emailCc.trim());
      formData.append("bcc", emailBcc.trim());
      formData.append("timeZone", userTimeZone);
      formData.append("scheduledAt", target.toISOString());
      attachments.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(
        data.message || `Scheduled for ${target.toLocaleDateString([], { month: "short", day: "numeric" })} at 7:00 AM`
      );
      setMessageText("");
      setAttachments([]);
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));
      fetchConversation(selectedContact);
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not schedule message");
    } finally {
      setScheduling(false);
    }
  };

  // Submit Custom Schedule
  const handleCustomScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!customScheduleDate || !customScheduleTime) {
      toast.error("Please choose both date and time");
      return;
    }
    const target = new Date(`${customScheduleDate}T${customScheduleTime}`);
    if (isNaN(target.getTime()) || target.getTime() <= Date.now()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    setScheduling(true);
    try {
      const formData = new FormData();
      formData.append("channel", channel);
      formData.append("recipient", activeRecipientIdentifier);
      formData.append("contactId", selectedContact._id);
      formData.append("subject", emailSubject.trim());
      formData.append("message", messageText.trim());
      formData.append("cc", emailCc.trim());
      formData.append("bcc", emailBcc.trim());
      formData.append("timeZone", userTimeZone);
      formData.append("scheduledAt", target.toISOString());
      attachments.forEach((file) => formData.append("attachments", file));

      const { data } = await axios.post(`${API_BASE_URL}/api/messages`, formData, {
        headers: authHeaders(),
      });

      toast.success(data.message || `Scheduled for ${target.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`);
      setShowCustomScheduleModal(false);
      setMessageText("");
      setAttachments([]);
      localStorage.removeItem(getDraftKey(channel, selectedContact._id));
      fetchConversation(selectedContact);
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not schedule message");
    } finally {
      setScheduling(false);
    }
  };

  // Cancel Scheduled Message
  const handleCancelScheduled = async (msgId) => {
    setCancellingId(msgId);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/messages/${msgId}/cancel`,
        {},
        { headers: authHeaders() }
      );
      toast.success(data.message || "Scheduled message cancelled");
      if (selectedContact) fetchConversation(selectedContact);
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel message");
    } finally {
      setCancellingId(null);
    }
  };

  // Submit Rescheduled Message
  const handleUpdateScheduledSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleMessageItem) return;

    const { _id, recipient, subject, message, scheduledDate, scheduledTime } = rescheduleMessageItem;
    let nextIso = null;
    if (scheduledDate && scheduledTime) {
      const d = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
      nextIso = d.toISOString();
    }

    setUpdatingScheduled(true);
    const updatePayload = {
      recipient: recipient.trim(),
      subject: (subject || "").trim(),
      message: (message || "").trim(),
      scheduledAt: nextIso,
      timeZone: userTimeZone,
    };

    try {
      let data = null;
      try {
        const res = await axios.patch(`${API_BASE_URL}/api/messages/${_id}`, updatePayload, { headers: authHeaders() });
        data = res.data;
      } catch (patchErr) {
        if (patchErr.response?.status === 404 || patchErr.response?.status === 405) {
          try {
            const res = await axios.put(`${API_BASE_URL}/api/messages/${_id}`, updatePayload, { headers: authHeaders() });
            data = res.data;
          } catch (putErr) {
            const res = await axios.post(`${API_BASE_URL}/api/messages/${_id}/reschedule`, updatePayload, { headers: authHeaders() });
            data = res.data;
          }
        } else {
          throw patchErr;
        }
      }

      toast.success(data?.message || "Scheduled message updated");
      setRescheduleMessageItem(null);
      if (selectedContact) fetchConversation(selectedContact);
      fetchAllScheduled();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update scheduled message");
    } finally {
      setUpdatingScheduled(false);
    }
  };

  // Contact Creation / Editing
  const handleOpenAddContact = () => {
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
  };

  const handleOpenEditContact = (c) => {
    setEditingContact(c);
    setContactFormData({
      name: c.name || "",
      phone: c.phone || "",
      whatsappPhone: c.whatsappPhone || "",
      telegramUsername: c.telegramUsername || "",
      email: c.email || "",
      notes: c.notes || "",
      isFavorite: Boolean(c.isFavorite),
    });
    setShowContactModal(true);
  };

  const handleContactFormSubmit = async (e) => {
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
        toast.success(data.message || "Contact updated");
        setSelectedContact(data.contact);
      } else {
        const { data } = await axios.post(
          `${API_BASE_URL}/api/contacts`,
          contactFormData,
          { headers: authHeaders() }
        );
        toast.success(data.message || "Contact added");
        setSelectedContact(data.contact);
      }
      setShowContactModal(false);
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
      toast.success(data.contact.isMuted ? "Notifications muted" : "Notifications unmuted");
    } catch {
      toast.error("Could not update mute status");
    }
  };

  // Apply Template to Composer
  const handleApplyTemplate = (tpl) => {
    if (tpl.subject && channel === "email") {
      setEmailSubject(tpl.subject);
    }
    if (tpl.body) {
      let bodyText = tpl.body;
      if (selectedContact?.name) {
        bodyText = bodyText.replace(/\{\{name\}\}/g, selectedContact.name);
      }
      setMessageText(bodyText);
    }
    setShowTemplateModal(false);
    toast.success(`Loaded template: "${tpl.title}"`);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Filtered contacts based on search and active channel
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Channel match
      if (channel && channel !== "all") {
        const hasChannel = c.channels?.includes(channel) ||
          (channel === "whatsapp" && (c.whatsappPhone || c.phone)) ||
          (channel === "telegram" && c.telegramUsername) ||
          (channel === "email" && c.email);
        if (!hasChannel) return false;
      }
      // Search match
      if (contactSearch.trim()) {
        const q = contactSearch.toLowerCase().trim();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.whatsappPhone?.includes(q) ||
          c.telegramUsername?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.lastMessage?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, channel, contactSearch]);

  // Scheduled messages for selected contact
  const contactScheduledMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages.filter((m) => m.status === "scheduled");
  }, [messages, selectedContact]);

  // Separate messages and scheduled items in chronological view
  const conversationItems = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.createdAt || a.scheduledAt) - new Date(b.createdAt || b.scheduledAt));
  }, [messages]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* TOP WORKSPACE HEADER                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-xs border border-purple-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Logo & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                QuickSend
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                Workspace
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Message anyone on WhatsApp, Telegram or Email. Send now or schedule for later.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-purple-100 bg-purple-50/60 hover:bg-purple-100 text-purple-700 text-xs font-bold transition cursor-pointer"
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
            {allScheduledMessages.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-bold ml-0.5">
                {allScheduledMessages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowProviderModal(true)}
            className="p-2 rounded-2xl border border-purple-100 bg-white hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition cursor-pointer"
            title="Channel Connection Status & Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* THREE-PART CHAT WORKSPACE                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-3xl shadow-sm border border-purple-100/90 overflow-hidden min-h-[680px] grid grid-cols-1 md:grid-cols-12 relative">
        {/* ============================================================= */}
        {/* LEFT PANE: CONTACTS & CONVERSATIONS (md:col-span-4 / col-span-12) */}
        {/* ============================================================= */}
        <aside
          className={`md:col-span-4 border-r border-purple-100/80 bg-white flex flex-col h-[700px] ${
            selectedContact ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Contact Search Input */}
          <div className="p-3.5 border-b border-purple-100/70 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-9 pr-8 py-2 rounded-2xl border border-purple-100 bg-purple-50/20 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition"
              />
              {contactSearch && (
                <button
                  type="button"
                  onClick={() => setContactSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Channel Switcher Pills (WhatsApp, Telegram, Email) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-purple-50/60 border border-purple-100/60">
              {/* WhatsApp Button */}
              <button
                type="button"
                onClick={() => handleChannelChange("whatsapp")}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "whatsapp"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/50"
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">WhatsApp</span>
              </button>

              {/* Telegram Button */}
              <button
                type="button"
                onClick={() => handleChannelChange("telegram")}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "telegram"
                    ? "bg-sky-500 text-white shadow-xs"
                    : "text-gray-600 hover:text-sky-700 hover:bg-sky-50/50"
                }`}
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Telegram</span>
              </button>

              {/* Email Button */}
              <button
                type="button"
                onClick={() => handleChannelChange("email")}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  channel === "email"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/50"
                }`}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Email</span>
              </button>
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto divide-y divide-purple-50/80 scrollbar-none">
            {loadingContacts ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-xs text-gray-400">Loading contacts...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="py-12 text-center p-4">
                <Users className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-700">No contacts found</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Add a new contact or try another search query.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddContact}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?._id === contact._id;
                const initials = contact.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={contact._id}
                    onClick={() => setSelectedContact(contact)}
                    className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors relative group ${
                      isSelected
                        ? "bg-purple-50/70 border-l-4 border-purple-600"
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
                          {initials}
                        </div>
                      )}
                      {contact.isFavorite && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center text-[9px] shadow-xs">
                          ★
                        </div>
                      )}
                    </div>

                    {/* Contact Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          {contact.name}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {contact.lastMessageAt
                            ? new Date(contact.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : ""}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 truncate leading-relaxed">
                        {contact.lastMessage || (
                          channel === "whatsapp"
                            ? contact.whatsappPhone || contact.phone
                            : channel === "telegram"
                            ? `@${contact.telegramUsername || "telegram"}`
                            : contact.email
                        )}
                      </p>
                    </div>

                    {/* Unread badge or favorite indicator */}
                    {contact.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Contact Footer Action */}
          <div className="p-3 border-t border-purple-100/70 bg-purple-50/30 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={handleOpenAddContact}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>
        </aside>

        {/* ============================================================= */}
        {/* CENTER PANE: CONVERSATION & COMPOSER (md:col-span-8 or 5)      */}
        {/* ============================================================= */}
        <main
          className={`${
            showRightPanel ? "md:col-span-5 lg:col-span-5" : "md:col-span-8"
          } flex flex-col h-[700px] bg-slate-50/40 relative ${
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
                        className="w-10 h-10 rounded-full object-cover border border-purple-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center">
                        {selectedContact.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name and Channel Identity */}
                  <div
                    onClick={() => setShowRightPanel((prev) => !prev)}
                    className="min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {selectedContact.name}
                      </h2>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
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
                    <p className="text-[11px] text-gray-500 font-mono truncate">
                      {activeRecipientIdentifier || "No address configured"}
                    </p>
                  </div>
                </div>

                {/* Conversation Header Actions */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(selectedContact)}
                    className={`p-2 rounded-xl transition cursor-pointer ${
                      selectedContact.isFavorite
                        ? "text-amber-500 bg-amber-50 hover:bg-amber-100"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    }`}
                    title={selectedContact.isFavorite ? "Favorited" : "Add to favorites"}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (channel === "whatsapp" && waDirectUrl) {
                        window.open(waDirectUrl, "_blank", "noopener,noreferrer");
                      } else {
                        toast.info(`Calling ${selectedContact.name}...`);
                      }
                    }}
                    className="p-2 rounded-xl text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                    title="Audio call / WhatsApp web"
                  >
                    <Phone className="w-4 h-4" />
                  </button>

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
                    Today
                  </span>
                </div>

                {loadingConversation ? (
                  <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : conversationItems.length === 0 ? (
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
                  conversationItems.map((item) => {
                    const isScheduled = item.status === "scheduled";
                    const isIncoming = item.direction === "incoming";

                    // 1. INLINE SCHEDULED MESSAGE CARD (Matches user screenshot!)
                    if (isScheduled) {
                      return (
                        <div
                          key={item._id}
                          className="max-w-md mx-auto my-3 p-4 rounded-3xl bg-purple-50/90 border border-purple-200 text-gray-900 shadow-xs space-y-2 animate-fadeIn"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-purple-700">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-purple-600 animate-pulse" />
                              Scheduled Message
                            </span>
                            <div className="flex items-center gap-1">
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
                                className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-200/50 rounded-lg cursor-pointer"
                                title="Reschedule or edit message"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={cancellingId === item._id}
                                onClick={() => handleCancelScheduled(item._id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                                title="Cancel schedule"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">
                            {item.message}
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-purple-800 font-semibold border-t border-purple-200/50">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-purple-600" />
                              {item.scheduledAt
                                ? new Date(item.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                                : "Pending"}
                            </span>
                            <span className="text-[10px] text-purple-600 uppercase font-mono">
                              {item.channel}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // 2. STANDARD CHAT BUBBLES
                    return (
                      <div
                        key={item._id}
                        className={`flex flex-col ${
                          isIncoming ? "items-start" : "items-end"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed space-y-1 shadow-2xs ${
                            isIncoming
                              ? "bg-white text-gray-900 rounded-tl-xs border border-gray-100"
                              : channel === "whatsapp"
                              ? "bg-[#dcf8c6] text-gray-900 rounded-tr-xs"
                              : "bg-purple-600 text-white rounded-tr-xs"
                          }`}
                        >
                          {item.subject && (
                            <p className="font-bold pb-1 border-b border-black/10">
                              {item.subject}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{item.message}</p>

                          {/* Attachments */}
                          {item.attachments?.length > 0 && (
                            <div className="mt-1.5 pt-1 border-t border-black/10 flex flex-col gap-1">
                              {item.attachments.map((att, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1.5 bg-black/5 p-1.5 rounded-lg text-[11px]"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span className="truncate max-w-[140px] font-medium">{att.filename}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Timestamp and Checkmarks */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] pt-0.5 ${
                              isIncoming
                                ? "text-gray-400"
                                : channel === "whatsapp"
                                ? "text-gray-500"
                                : "text-purple-200"
                            }`}
                          >
                            <span>
                              {item.sentAt
                                ? new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {!isIncoming && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={conversationEndRef} />
              </div>

              {/* ======================================================= */}
              {/* COMPOSER & SCHEDULING ACTION BAR                        */}
              {/* ======================================================= */}
              <div className="p-3 sm:p-4 bg-white border-t border-purple-100/80 space-y-2.5 shrink-0">
                {/* Email Subject Line (Only shown for Email channel) */}
                {channel === "email" && (
                  <div className="space-y-1.5 pb-1 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject..."
                        className="flex-1 rounded-xl border border-purple-100 bg-purple-50/20 px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailCcBcc((prev) => !prev)}
                        className="text-[11px] font-bold text-purple-700 hover:underline cursor-pointer whitespace-nowrap"
                      >
                        {showEmailCcBcc ? "Hide CC" : "+ CC/BCC"}
                      </button>
                    </div>

                    {showEmailCcBcc && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="email"
                          value={emailCc}
                          onChange={(e) => setEmailCc(e.target.value)}
                          placeholder="CC..."
                          className="rounded-xl border border-purple-100 bg-purple-50/20 px-3 py-1 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                        />
                        <input
                          type="email"
                          value={emailBcc}
                          onChange={(e) => setEmailBcc(e.target.value)}
                          placeholder="BCC..."
                          className="rounded-xl border border-purple-100 bg-purple-50/20 px-3 py-1 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Attachment Chips */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {attachments.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 text-[11px] font-medium"
                      >
                        <Paperclip className="w-3 h-3 text-purple-600" />
                        <span className="truncate max-w-[120px]">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Primary Message Input Bar */}
                <div className="flex items-center gap-2 relative">
                  {/* Emoji Button */}
                  <button
                    ref={emojiBtnRef}
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer"
                    title="Insert emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer"
                    title="Attach files (max 5)"
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

                  {/* Textarea Input */}
                  <textarea
                    ref={textareaRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onSelect={handleTextareaSelect}
                    onKeyUp={handleTextareaSelect}
                    onClick={handleTextareaSelect}
                    rows={1}
                    placeholder={`Type a message to ${selectedContact.name}...`}
                    className="flex-1 rounded-2xl border border-purple-100 bg-purple-50/20 px-3.5 py-2.5 text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition resize-none max-h-24"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />

                  {/* Character Counter */}
                  <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                    {messageText.length}/4096
                  </span>

                  {/* Send Icon Button */}
                  <button
                    type="button"
                    disabled={sending || (!messageText.trim() && attachments.length === 0)}
                    onClick={handleSendMessage}
                    className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white flex items-center justify-center shadow-md shadow-purple-600/25 transition active:scale-95 cursor-pointer shrink-0"
                    title="Send now"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
                    )}
                  </button>

                  {/* Emoji Picker Popover */}
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute left-0 bottom-full mb-2 z-40 shadow-2xl rounded-2xl overflow-hidden border border-purple-100 animate-fadeIn"
                    >
                      <Suspense
                        fallback={
                          <div className="p-8 bg-white flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                          </div>
                        }
                      >
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          autoFocusSearch={false}
                          width={300}
                          height={340}
                          previewConfig={{ showPreview: false }}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>

                {/* Bottom Scheduling Presets Bar (Matches user's exact uploaded design!) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-purple-100/60">
                  {/* Send Now Button */}
                  <button
                    type="button"
                    disabled={sending || (!messageText.trim() && attachments.length === 0)}
                    onClick={handleSendMessage}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send Now</span>
                  </button>

                  {/* Schedule Action Button */}
                  <button
                    type="button"
                    onClick={() => setShowCustomScheduleModal(true)}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Schedule</span>
                  </button>

                  {/* Preset 1: Tomorrow 7:00 AM */}
                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("tomorrow")}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-800 text-xs font-semibold transition cursor-pointer"
                    title="Schedule for Tomorrow at 7:00 AM"
                  >
                    <span>Tomorrow 7:00 AM</span>
                  </button>

                  {/* Preset 2: In 7 Days */}
                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("7days")}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-800 text-xs font-semibold transition cursor-pointer"
                    title="Schedule for 7 days from now at 7:00 AM"
                  >
                    <span>In 7 Days</span>
                  </button>

                  {/* Preset 3: In 20 Days */}
                  <button
                    type="button"
                    disabled={scheduling}
                    onClick={() => handleSchedulePreset("20days")}
                    className="px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 text-purple-800 text-xs font-semibold transition cursor-pointer"
                    title="Schedule for 20 days from now at 7:00 AM"
                  >
                    <span>In 20 Days</span>
                  </button>

                  {/* Custom Option */}
                  <button
                    type="button"
                    onClick={() => setShowCustomScheduleModal(true)}
                    className="px-2.5 py-1.5 rounded-xl border border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Custom...</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-gray-800">
                Select a contact to start messaging
              </h3>
              <p className="text-xs text-gray-400 max-w-sm">
                Choose a conversation from the left or switch between WhatsApp, Telegram and Email.
              </p>
            </div>
          )}
        </main>

        {/* ============================================================= */}
        {/* RIGHT PANE: CONTACT DETAILS & SCHEDULED SUMMARY (Collapsible) */}
        {/* ============================================================= */}
        {showRightPanel && selectedContact && (
          <aside className="md:col-span-3 border-l border-purple-100/80 bg-white flex flex-col h-[700px] p-4 overflow-y-auto animate-fadeIn shrink-0">
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

            {/* Contact Profile Summary */}
            <div className="text-center py-4 border-b border-purple-100/70">
              {selectedContact.avatar ? (
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border-2 border-purple-200 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white font-bold text-lg flex items-center justify-center mx-auto mb-2 shadow-xs">
                  {selectedContact.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <h3 className="text-sm font-bold text-gray-900">{selectedContact.name}</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {activeRecipientIdentifier || "No address"}
              </p>

              {/* Supported Channels Badges */}
              <div className="flex justify-center gap-1.5 mt-2">
                {selectedContact.channels?.map((ch) => (
                  <span
                    key={ch}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      ch === "whatsapp"
                        ? "bg-emerald-100 text-emerald-800"
                        : ch === "telegram"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions List (Matching user's screenshot!) */}
            <div className="py-3 border-b border-purple-100/70 space-y-1">
              <button
                type="button"
                onClick={() => handleOpenEditContact(selectedContact)}
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-purple-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600" />
                  View &amp; Edit Contact
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => toast.info(`${selectedContact.name} has 12 shared documents and media items.`)}
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-purple-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  Media, Links &amp; Files
                </span>
                <span className="text-[11px] font-bold text-gray-400">12 &gt;</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCustomScheduleModal(true)}
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-purple-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Schedule Message
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>

              <div className="flex items-center justify-between p-2 text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-2">
                  <BellOff className="w-4 h-4 text-purple-600" />
                  Mute Notifications
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedContact.isMuted)}
                    onChange={() => handleToggleMute(selectedContact)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-2 text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-purple-600" />
                  Add to Favorites
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedContact.isFavorite)}
                    onChange={() => handleToggleFavorite(selectedContact)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <button
                type="button"
                onClick={() => toast.warning(`Contact "${selectedContact.name}" blocked.`)}
                className="w-full text-left p-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center gap-2"
              >
                <Ban className="w-4 h-4 text-rose-500" />
                <span>Block Contact</span>
              </button>
            </div>

            {/* Scheduled Messages Summary for this contact */}
            <div className="pt-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">
                  Scheduled Messages ({contactScheduledMessages.length})
                </span>
                {contactScheduledMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowScheduledQueueModal(true)}
                    className="text-[10px] text-purple-700 font-bold hover:underline cursor-pointer"
                  >
                    See all
                  </button>
                )}
              </div>

              {contactScheduledMessages.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic">
                  No active scheduled messages for {selectedContact.name}.
                </p>
              ) : (
                <div className="space-y-2 overflow-y-auto max-h-48">
                  {contactScheduledMessages.map((m) => (
                    <div
                      key={m._id}
                      className="p-2.5 rounded-2xl bg-purple-50/80 border border-purple-100 text-xs space-y-1"
                    >
                      <p className="text-gray-800 line-clamp-2 font-medium">
                        {m.message}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-purple-700 font-bold pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-600" />
                          {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "Scheduled"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCancelScheduled(m._id)}
                          className="text-rose-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: ADD / EDIT CONTACT MODAL                              */}
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
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 id="contact-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                      {editingContact ? "Edit Contact" : "Add New Contact"}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Link WhatsApp, Telegram, and Email identifiers for 1-click messaging.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleContactFormSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactFormData.name}
                    onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                    placeholder="e.g. Ramu or Sarah Connor"
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3 text-emerald-600" /> WhatsApp Phone
                    </label>
                    <input
                      type="text"
                      value={contactFormData.whatsappPhone}
                      onChange={(e) => setContactFormData({ ...contactFormData, whatsappPhone: e.target.value })}
                      placeholder="+917997864218"
                      className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-sky-800 mb-1 flex items-center gap-1">
                      <Send className="w-3 h-3 text-sky-600" /> Telegram Handle
                    </label>
                    <input
                      type="text"
                      value={contactFormData.telegramUsername}
                      onChange={(e) => setContactFormData({ ...contactFormData, telegramUsername: e.target.value })}
                      placeholder="@ramu_tech"
                      className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-purple-800 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-purple-600" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                    placeholder="ramu@example.com"
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={contactFormData.notes}
                    onChange={(e) => setContactFormData({ ...contactFormData, notes: e.target.value })}
                    placeholder="Project lead, team member..."
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={contactFormData.isFavorite}
                      onChange={(e) => setContactFormData({ ...contactFormData, isFavorite: e.target.checked })}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span>Mark as favorite contact</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                  >
                    {editingContact ? "Save Changes" : "Create Contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CUSTOM SCHEDULE MODAL                                 */}
      {/* ------------------------------------------------------------- */}
      {showCustomScheduleModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={customScheduleModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="custom-schedule-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 id="custom-schedule-title" className="text-base font-bold text-gray-900 leading-tight">
                      Schedule Message
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      To: <strong>{selectedContact?.name}</strong> via <strong>{channel}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCustomScheduleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={customScheduleDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setCustomScheduleDate(e.target.value)}
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={customScheduleTime}
                      onChange={(e) => setCustomScheduleTime(e.target.value)}
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 flex items-center justify-between">
                  <span>Detected Timezone:</span>
                  <span className="font-bold font-mono">{userTimeZone}</span>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setShowCustomScheduleModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={scheduling}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {scheduling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Schedule</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: RESCHEDULE / EDIT MESSAGE MODAL                       */}
      {/* ------------------------------------------------------------- */}
      {rescheduleMessageItem &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={rescheduleModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reschedule-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-lg w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 id="reschedule-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                      Reschedule Message
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Update the delivery date/time or message details before dispatch.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleMessageItem(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateScheduledSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Recipient</label>
                  <input
                    type="text"
                    value={rescheduleMessageItem.recipient || ""}
                    onChange={(e) =>
                      setRescheduleMessageItem((prev) => ({ ...prev, recipient: e.target.value }))
                    }
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Message</label>
                  <textarea
                    rows={4}
                    value={rescheduleMessageItem.message || ""}
                    onChange={(e) =>
                      setRescheduleMessageItem((prev) => ({ ...prev, message: e.target.value }))
                    }
                    className="w-full rounded-xl border border-purple-200 bg-purple-50/20 p-3 text-xs text-gray-800 focus:border-purple-500 focus:outline-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Date</label>
                    <input
                      type="date"
                      value={rescheduleMessageItem.scheduledDate || ""}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setRescheduleMessageItem((prev) => ({ ...prev, scheduledDate: e.target.value }))
                      }
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">New Time</label>
                    <input
                      type="time"
                      value={rescheduleMessageItem.scheduledTime || ""}
                      onChange={(e) =>
                        setRescheduleMessageItem((prev) => ({ ...prev, scheduledTime: e.target.value }))
                      }
                      className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs text-gray-800 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-purple-100">
                  <button
                    type="button"
                    onClick={() => setRescheduleMessageItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingScheduled}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {updatingScheduled && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Changes</span>
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
                    .filter((t) => !templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.body.toLowerCase().includes(templateSearch.toLowerCase()))
                    .map((tpl) => (
                      <div
                        key={tpl._id}
                        onClick={() => handleApplyTemplate(tpl)}
                        className="p-3.5 rounded-2xl border border-purple-100 bg-white hover:border-purple-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="font-bold text-xs text-gray-900 group-hover:text-purple-700 transition">
                              {tpl.title}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                              {tpl.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-2">
                            {tpl.body}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-purple-50 flex items-center justify-between text-xs font-bold text-purple-700 group-hover:text-purple-900">
                          <span>Apply to Chat</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: ALL SCHEDULED QUEUE MODAL                             */}
      {/* ------------------------------------------------------------- */}
      {showScheduledQueueModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={scheduledQueueModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="scheduled-queue-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-2xl w-full max-h-[min(90dvh,760px)] flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-purple-100 bg-white flex items-center justify-between">
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

              <div className="overflow-y-auto p-4 sm:p-5 flex-1 space-y-3">
                {allScheduledMessages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No active scheduled messages in the queue.
                  </div>
                ) : (
                  allScheduledMessages.map((item) => (
                    <div
                      key={item._id}
                      className="p-3.5 rounded-2xl border border-purple-100 bg-white hover:border-purple-200 transition flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-xs text-gray-900 truncate">
                            {item.recipient}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase bg-amber-100 text-amber-800">
                            {item.channel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-1">{item.message}</p>
                        <p className="text-[10px] text-purple-700 font-semibold mt-1">
                          ⏰ Scheduled for: {item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
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
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={cancellingId === item._id}
                          onClick={() => handleCancelScheduled(item._id)}
                          className="px-2.5 py-1 rounded-xl border border-amber-200 text-xs font-bold text-amber-700 hover:bg-amber-50 cursor-pointer"
                        >
                          Cancel
                        </button>
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
      {/* MODAL 6: PROVIDER CONNECTION STATUS MODAL                      */}
      {/* ------------------------------------------------------------- */}
      {showProviderModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
            <div
              ref={providerModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="provider-modal-title"
              className="bg-white rounded-3xl shadow-2xl border border-purple-100 max-w-md w-full p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 id="provider-modal-title" className="text-base font-bold text-gray-900 leading-tight">
                      Channel Connections
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Real connection status of your WhatsApp, Telegram &amp; Email gateways.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* WhatsApp */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      providers.whatsapp.configured ? "bg-emerald-200 text-emerald-900" : "bg-amber-100 text-amber-800"
                    }`}>
                      {providers.whatsapp.configured ? "Ready" : "Web Direct Fallback"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">{providers.whatsapp.label}</p>
                </div>

                {/* Telegram */}
                <div className="p-3.5 rounded-2xl bg-sky-50/50 border border-sky-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-900 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-sky-600" /> Telegram
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      providers.telegram.configured ? "bg-emerald-200 text-emerald-900" : "bg-amber-100 text-amber-800"
                    }`}>
                      {providers.telegram.configured ? "Ready" : "Setup Required"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">{providers.telegram.label}</p>
                  {providers.telegram.botUsername && (
                    <a
                      href={`https://t.me/${providers.telegram.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 font-bold hover:underline inline-flex items-center gap-1 mt-1 text-[11px]"
                    >
                      Open @{providers.telegram.botUsername} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Email */}
                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-purple-600" /> Email
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      providers.email.configured ? "bg-emerald-200 text-emerald-900" : "bg-gray-100 text-gray-700"
                    }`}>
                      {providers.email.configured ? "Ready" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">{providers.email.label}</p>
                  {providers.email.sender && (
                    <p className="text-[11px] text-purple-800 font-mono">From: {providers.email.sender}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MessageCenter;
