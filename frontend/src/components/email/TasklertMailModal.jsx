import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Mail,
  Check,
  CheckCircle,
  Paperclip,
  Clock,
  Sparkles,
  AlertCircle,
  FileText,
  ChevronDown,
  Loader2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Calendar,
  Zap,
} from "lucide-react";
import { toast } from "react-toastify";
import { sendTasklertMail } from "../../services/emailApi";
import { TASKLERT_EMAIL_TEMPLATES } from "./tasklertEmailTemplates";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip", "text/plain",
];
const MAX_ATTACHMENT_SIZE_MB = 25;

export default function TasklertMailModal({
  isOpen = false,
  onClose,
  initialStep = 1, // 1: Select Channel, 2: Compose, 3: Confirmation, 4: Success
  onSwitchChannel,
  onSentSuccess,
}) {
  const [step, setStep] = useState(initialStep || 1);
  const [selectedChannel, setSelectedChannel] = useState("tasklert_mail"); // "tasklert_mail" | "telegram" | "email"

  // Sender info (from authenticated user in localStorage)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Compose State
  const [toRecipients, setToRecipients] = useState([]);
  const [toInput, setToInput] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccRecipients, setCcRecipients] = useState([]);
  const [ccInput, setCcInput] = useState("");
  const [bccRecipients, setBccRecipients] = useState([]);
  const [bccInput, setBccInput] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal"); // "normal" | "important" | "action_required"
  const [actionDeadline, setActionDeadline] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentResultData, setSentResultData] = useState(null);

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // Sync step if opened with a specific step
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep || 1);
      // Refresh current user
      try {
        const stored = localStorage.getItem("user");
        if (stored) setCurrentUser(JSON.parse(stored));
      } catch (_) {}
    } else {
      // Reset if closed
      setIsSending(false);
    }
  }, [isOpen, initialStep]);

  // Recipient chip helper
  const addRecipientChip = (rawEmail, type = "to") => {
    const trimmed = rawEmail.trim().replace(/,/g, "");
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      toast.warn(`"${trimmed}" is not a valid email address.`);
      return;
    }

    if (type === "to") {
      if (!toRecipients.includes(trimmed)) setToRecipients([...toRecipients, trimmed]);
      setToInput("");
    } else if (type === "cc") {
      if (!ccRecipients.includes(trimmed)) setCcRecipients([...ccRecipients, trimmed]);
      setCcInput("");
    } else if (type === "bcc") {
      if (!bccRecipients.includes(trimmed)) setBccRecipients([...bccRecipients, trimmed]);
      setBccInput("");
    }
  };

  const removeRecipientChip = (email, type = "to") => {
    if (type === "to") setToRecipients(toRecipients.filter((e) => e !== email));
    else if (type === "cc") setCcRecipients(ccRecipients.filter((e) => e !== email));
    else if (type === "bcc") setBccRecipients(bccRecipients.filter((e) => e !== email));
  };

  // Attachment upload helper
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validFiles = [];
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds the ${MAX_ATTACHMENT_SIZE_MB}MB size limit.`);
        continue;
      }
      validFiles.push(file);
    }

    setAttachments([...attachments, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB";
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / 1024).toFixed(0) + " KB";
  };

  // Template selector
  const handleSelectTemplate = (templateId) => {
    const tpl = TASKLERT_EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    if (tpl.subject) setSubject(tpl.subject);
    if (tpl.priority) setPriority(tpl.priority);

    const userName = currentUser?.name || "Tasklert User";
    const populatedBody = tpl.body.replace("{sender_name}", userName);
    setMessage(populatedBody);
    if (editorRef.current) {
      editorRef.current.innerHTML = populatedBody.replace(/\n/g, "<br>");
    }
  };

  // Step 1: Channel Continue
  const handleChannelContinue = () => {
    if (selectedChannel === "tasklert_mail") {
      setStep(2);
    } else {
      onSwitchChannel?.(selectedChannel);
      onClose();
    }
  };

  // Step 2: Validate & Proceed to Confirmation (Step 3)
  const handleProceedToConfirmation = () => {
    // Flush any pending text in To input
    if (toInput.trim()) {
      addRecipientChip(toInput, "to");
    }

    const currentTo = toInput.trim()
      ? [...toRecipients, toInput.trim()]
      : toRecipients;

    if (!currentTo.length) {
      toast.warn("Please enter at least one recipient email.");
      return;
    }

    if (!subject.trim()) {
      toast.warn("Please enter an email subject.");
      return;
    }

    const editorContent = editorRef.current ? editorRef.current.innerHTML : message;
    if (!editorContent.trim() || editorContent === "<br>") {
      toast.warn("Please enter an email message.");
      return;
    }

    setMessage(editorContent);
    setStep(3);
  };

  // Step 3: Confirm & Send Outbound Email
  const handleConfirmAndSend = async () => {
    if (isSending) return;
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.append("to", JSON.stringify(toRecipients));
      if (ccRecipients.length) formData.append("cc", JSON.stringify(ccRecipients));
      if (bccRecipients.length) formData.append("bcc", JSON.stringify(bccRecipients));
      formData.append("subject", subject.trim());
      formData.append("message", message);
      formData.append("priority", priority);
      if (actionDeadline) formData.append("actionDeadline", actionDeadline);

      attachments.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await sendTasklertMail(formData);
      setSentResultData({
        recipients: toRecipients,
        subject,
        priority,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      toast.success("Email sent successfully via Tasklert Mail!");
      setStep(4);
      onSentSuccess?.();
    } catch (err) {
      console.error("Tasklert Mail send failure:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Reset and compose another
  const handleResetForAnother = () => {
    setToRecipients([]);
    setToInput("");
    setCcRecipients([]);
    setBccRecipients([]);
    setSubject("");
    setMessage("");
    setPriority("normal");
    setActionDeadline("");
    setAttachments([]);
    setSelectedTemplate("");
    setSentResultData(null);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSending) onClose();
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-purple-100 flex flex-col overflow-hidden animate-scaleUp my-auto">
        
        {/* ========================================================
            STEP 1: SELECT CHANNEL MODAL (Design Reference Match)
            ======================================================== */}
        {step === 1 && (
          <div className="p-6 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-purple-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4 fill-white text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">QuickSend</h3>
                  <p className="text-xs text-gray-500">Choose how you want to send.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel Options Radio Cards: 1. Tasklert Mail, 2. Email, 3. Telegram */}
            <div className="space-y-3 py-5">
              {/* Option 1: Tasklert Mail */}
              <div
                onClick={() => setSelectedChannel("tasklert_mail")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedChannel === "tasklert_mail"
                    ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                    : "border-gray-100 hover:border-emerald-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">Tasklert Mail</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Send a professional mail from Tasklert.</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedChannel === "tasklert_mail" ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                }`}>
                  {selectedChannel === "tasklert_mail" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              {/* Option 2: Email */}
              <div
                onClick={() => setSelectedChannel("email")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedChannel === "email"
                    ? "border-purple-600 bg-purple-50/60 shadow-xs"
                    : "border-gray-100 hover:border-purple-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-gray-900">Email</span>
                    <p className="text-xs text-gray-500 mt-0.5">Sync and send via Gmail or Outlook.</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedChannel === "email" ? "border-purple-600 bg-purple-600" : "border-gray-300"
                }`}>
                  {selectedChannel === "email" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>

              {/* Option 3: Telegram */}
              <div
                onClick={() => setSelectedChannel("telegram")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedChannel === "telegram"
                    ? "border-purple-600 bg-purple-50/60 shadow-xs"
                    : "border-gray-100 hover:border-purple-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Send className="w-5 h-5 -rotate-12" />
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-gray-900">Telegram</span>
                    <p className="text-xs text-gray-500 mt-0.5">Send via connected Telegram account.</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedChannel === "telegram" ? "border-purple-600 bg-purple-600" : "border-gray-300"
                }`}>
                  {selectedChannel === "telegram" && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={handleChannelContinue}
              className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm shadow-md shadow-purple-600/25 transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <span>Continue</span>
              <span className="text-base">&rarr;</span>
            </button>
          </div>
        )}

        {/* ========================================================
            STEP 2: COMPOSE MAIL (Tasklert Mail Composer)
            ======================================================== */}
        {step === 2 && (
          <div className="flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-purple-50 bg-purple-50/30 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Tasklert Mail</h3>
                  <p className="text-xs text-gray-500">
                    From: <span className="font-semibold text-purple-700">{currentUser?.name || "Tasklert"}</span> ({currentUser?.email || "verified"})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Template & Priority Quick Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2">
                {/* Template Selector */}
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Ready-made Template
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-purple-200 bg-purple-50/40 text-purple-900 outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">⚡ Select a template...</option>
                    {TASKLERT_EMAIL_TEMPLATES.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.icon} {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selector */}
                <div className="sm:w-44">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={`w-full text-xs font-bold px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                      priority === "action_required"
                        ? "border-purple-500 bg-purple-100 text-purple-900"
                        : priority === "important"
                        ? "border-amber-400 bg-amber-50 text-amber-900"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <option value="normal">Normal</option>
                    <option value="important">⭐ Important</option>
                    <option value="action_required">⚡ Action Required</option>
                  </select>
                </div>
              </div>

              {/* Action Required Deadline if selected */}
              {priority === "action_required" && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200 animate-fadeIn">
                  <Calendar className="w-4 h-4 text-purple-700 shrink-0" />
                  <span className="text-xs font-bold text-purple-900">Response Deadline:</span>
                  <input
                    type="date"
                    value={actionDeadline}
                    onChange={(e) => setActionDeadline(e.target.value)}
                    className="text-xs px-2 py-1 rounded-lg border border-purple-200 bg-white text-gray-800 outline-none"
                  />
                  <span className="text-[11px] text-purple-600 italic ml-auto hidden sm:inline">
                    Highlighted in email
                  </span>
                </div>
              )}

              {/* To: Recipients Chips */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-700">To *</label>
                  <button
                    type="button"
                    onClick={() => setShowCcBcc(!showCcBcc)}
                    className="text-[11px] font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                  >
                    {showCcBcc ? "- Hide CC/BCC" : "+ Add CC/BCC"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl border border-gray-200 focus-within:border-purple-500 bg-white min-h-[46px] transition">
                  {toRecipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-900 rounded-xl text-xs font-semibold"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipientChip(email, "to")}
                        className="text-purple-500 hover:text-purple-900 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (["Enter", "Tab", ",", ";"].includes(e.key)) {
                        e.preventDefault();
                        addRecipientChip(toInput, "to");
                      }
                    }}
                    onBlur={() => addRecipientChip(toInput, "to")}
                    placeholder={toRecipients.length === 0 ? "tasklert@gmail.com, ..." : "Add another..."}
                    className="flex-1 min-w-[160px] text-xs text-gray-900 outline-none bg-transparent py-1 px-1"
                  />
                </div>
              </div>

              {/* Expandable CC & BCC */}
              {showCcBcc && (
                <div className="space-y-2.5 animate-fadeIn">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">CC</label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/50 min-h-[38px]">
                      {ccRecipients.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-800 rounded-lg text-xs font-medium">
                          {email}
                          <button type="button" onClick={() => removeRecipientChip(email, "cc")}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="email"
                        value={ccInput}
                        onChange={(e) => setCcInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (["Enter", ",", ";"].includes(e.key)) {
                            e.preventDefault();
                            addRecipientChip(ccInput, "cc");
                          }
                        }}
                        onBlur={() => addRecipientChip(ccInput, "cc")}
                        placeholder="cc@example.com"
                        className="flex-1 min-w-[120px] text-xs text-gray-800 outline-none bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">BCC</label>
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-gray-200 bg-gray-50/50 min-h-[38px]">
                      {bccRecipients.map((email) => (
                        <span key={email} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-800 rounded-lg text-xs font-medium">
                          {email}
                          <button type="button" onClick={() => removeRecipientChip(email, "bcc")}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="email"
                        value={bccInput}
                        onChange={(e) => setBccInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (["Enter", ",", ";"].includes(e.key)) {
                            e.preventDefault();
                            addRecipientChip(bccInput, "bcc");
                          }
                        }}
                        onBlur={() => addRecipientChip(bccInput, "bcc")}
                        placeholder="bcc@example.com"
                        className="flex-1 min-w-[120px] text-xs text-gray-800 outline-none bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={250}
                  placeholder="Action Required: Final Project Update"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 focus:border-purple-500 text-xs font-semibold text-gray-900 outline-none transition"
                />
              </div>

              {/* Rich-Text Message Area */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Message *</label>
                
                {/* Editor Container with formatting toolbar */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden focus-within:border-purple-500 transition">
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50/80 border-b border-gray-100 flex-wrap">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("bold", false, null);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("italic", false, null);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("underline", false, null);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Underline"
                    >
                      <Underline className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3.5 bg-gray-200 mx-1" />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("insertUnorderedList", false, null);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Bullet list"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        document.execCommand("insertOrderedList", false, null);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Numbered list"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const url = prompt("Enter hyperlink URL:");
                        if (url) document.execCommand("createLink", false, url);
                      }}
                      className="p-1 rounded text-gray-600 hover:text-purple-700 hover:bg-purple-100 transition"
                      title="Insert link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Editable Body */}
                  <div
                    ref={editorRef}
                    contentEditable
                    onInput={(e) => setMessage(e.currentTarget.innerHTML)}
                    className="w-full min-h-[140px] max-h-[220px] p-3 text-xs text-gray-800 outline-none overflow-y-auto leading-relaxed"
                    placeholder="Hi Meenakshi,\n\nPlease review the final project update and share your feedback by today.\n\nThank you,\nIsrath Yasin Ahamad"
                  />
                </div>
              </div>

              {/* Attachments Section */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt"
                />

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-purple-300 bg-gray-50 hover:bg-purple-50 text-xs font-bold text-gray-700 hover:text-purple-800 transition cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                    <span>Attach File (Optional)</span>
                  </button>
                  <span className="text-[11px] text-gray-400">PDF, Office, Images (Max 25MB)</span>
                </div>

                {/* Uploaded attachments list */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {attachments.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-900"
                      >
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>{file.name}</span>
                        <span className="text-[10px] text-purple-500 font-normal">
                          ({formatFileSize(file.size)})
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-purple-400 hover:text-purple-800 cursor-pointer ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-purple-50 bg-gray-50/50 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirmation}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Mail</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: SEND CONFIRMATION (Design Reference Match)
            ======================================================== */}
        {step === 3 && (
          <div className="p-6 sm:p-7 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Big Envelope with Green Checkmark (Design Reference) */}
            <div className="relative mb-4 mt-2">
              <div className="w-20 h-20 rounded-3xl bg-purple-100/70 border-2 border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
                <Mail className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>

            {/* Headline */}
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Send this mail?</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              A Tasklert Mail will be sent to{" "}
              <strong className="text-gray-800 font-extrabold">{toRecipients.join(", ")}</strong>
            </p>

            {/* Summary Details Card */}
            <div className="w-full mt-5 p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-left space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span className="text-xs font-bold text-gray-700">Subject:</span>
                <span className="text-xs text-gray-900 font-semibold">{subject}</span>
              </div>

              {attachments.length > 0 && (
                <div className="flex items-start gap-2">
                  <Paperclip className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span className="text-xs font-bold text-gray-700">Attachment:</span>
                  <span className="text-xs text-gray-900 font-semibold">
                    {attachments[0].name} ({formatFileSize(attachments[0].size)})
                    {attachments.length > 1 ? ` +${attachments.length - 1} more` : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-purple-100/60 text-[11px] text-gray-500">
                <span>From: <strong className="text-gray-800">{currentUser?.name || "Tasklert"}</strong> ({currentUser?.email})</span>
              </div>
            </div>

            {/* Actions: Edit vs Confirm & Send */}
            <div className="flex items-center gap-3 w-full mt-6">
              <button
                type="button"
                disabled={isSending}
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmAndSend}
                className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 4: SENT SUCCESSFULLY (Design Reference Match)
            ======================================================== */}
        {step === 4 && (
          <div className="p-6 sm:p-7 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-gray-400 hover:text-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Big Green Circle Checkmark (Design Reference) */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-4 border-emerald-50 text-emerald-600 flex items-center justify-center mb-3 mt-2 shadow-sm animate-scaleUp">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Mail Sent Successfully!</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm">
              Your Tasklert Mail has been sent to{" "}
              <strong className="text-gray-800 font-extrabold">{sentResultData?.recipients?.join(", ")}</strong>
            </p>

            {/* Highlight Card */}
            <div className="w-full mt-5 p-4 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center gap-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-purple-900 block">
                  {sentResultData?.priority === "action_required" ? "Action Required" : "Tasklert Delivery"}
                </span>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  The recipient will see this as a Tasklert email with your details.
                </p>
              </div>
            </div>

            {/* Actions: Send Another vs Close */}
            <div className="flex items-center gap-3 w-full mt-6">
              <button
                type="button"
                onClick={handleResetForAnother}
                className="flex-1 py-3 rounded-2xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-900 text-xs font-bold transition cursor-pointer"
              >
                Send Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

