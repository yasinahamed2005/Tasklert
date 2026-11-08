import React, { useState, useEffect, useCallback, useRef } from "react";
import EmailSidebar from "./EmailSidebar";
import EmailList from "./EmailList";
import EmailReader from "./EmailReader";
import EmailComposer from "./EmailComposer";
import EmailAccountModal from "./EmailAccountModal";
import EmailOnboarding from "./EmailOnboarding";
import TaskModal from "../TaskModal";
import {
  fetchEmailAccountStatus,
  fetchEmailFolders,
  fetchEmailMessages,
  fetchEmailMessage,
  markEmailRead,
  starEmail,
  moveEmailToTrash,
  archiveEmail,
  sendEmail,
  saveDraft,
  scheduleEmail,
  getGmailAuthUrl,
  connectSmtpAccount,
} from "../../services/emailApi";
import { toast } from "react-toastify";
import { Sparkles, Mail, Loader2, ArrowRight } from "lucide-react";

export default function EmailWorkspace({ onBackToQuickSend }) {
  // ─── Account State ───
  const [personalAccount, setPersonalAccount] = useState(null);
  const [taskflowMail, setTaskflowMail] = useState({
    identity: "mailer@taskflow.in",
    displayName: "TaskFlow Mail",
    status: "ready",
    activeGateway: "taskflow.iya@gmail.com",
    isConfigured: true,
    domain: "taskflow.in",
    domainVerified: false,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  // ─── Mailbox Folders & Messages ───
  const [selectedFolder, setSelectedFolder] = useState("INBOX");
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [activeCategory, setActiveCategory] = useState("primary"); // "primary" | "promotions" | "social" | "updates"
  const [categoryCounts, setCategoryCounts] = useState({ promotions: 0, updates: 0, social: 0 });
  const [userLabels, setUserLabels] = useState([]);
  const [filterTab, setFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState({ INBOX: 0, DRAFTS: 0, STARRED: 0, SENT: 0, TRASH: 0 });
  const [labelCounts, setLabelCounts] = useState({});

  // ─── Modals State ───
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState("compose");
  const [composerReply, setComposerReply] = useState(null);
  const [sending, setSending] = useState(false);

  // Email to Task Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState(null);

  // Mobile View State
  const [mobileView, setMobileView] = useState("list"); // "list" | "reader"

  // Synchronization refs to prevent race-conditions and duplicate mark-read calls
  const markedReadIdsRef = useRef(new Set());
  const activeFetchingIdRef = useRef(null);

  // Load account status
  const loadAccountStatus = useCallback(async () => {
    try {
      const data = await fetchEmailAccountStatus();
      if (data?.connected && data.accounts && data.accounts.length > 0) {
        setPersonalAccount(data.accounts[0]);
        setIsConnected(true);
        setShowOnboarding(false);
      } else {
        setIsConnected(false);
        setPersonalAccount(null);
      }
      if (data?.taskflowMail) {
        setTaskflowMail(data.taskflowMail);
      }
    } catch (err) {
      console.warn("Account status check notice:", err.message);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountStatus();
  }, [loadAccountStatus]);

  // Handle OAuth redirect query parameters (e.g. ?channel=email&status=connected&email=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const connectedEmail = params.get("email");
    const errorMessage = params.get("message");

    if (status === "connected" && connectedEmail) {
      toast.success(`Personal Gmail (${connectedEmail}) connected successfully!`);
      const newUrl = window.location.pathname + (params.get("channel") ? "?channel=email" : "");
      window.history.replaceState({}, document.title, newUrl);
      loadAccountStatus();
    } else if (status === "error") {
      toast.error(errorMessage ? decodeURIComponent(errorMessage) : "Failed to connect Gmail account.");
      const newUrl = window.location.pathname + (params.get("channel") ? "?channel=email" : "");
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [loadAccountStatus]);

  // Connect Gmail Handler
  const handleConnectGmail = async () => {
    setConnecting(true);
    setConnectingProvider("gmail");
    try {
      const data = await getGmailAuthUrl();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.info(
          data?.message ||
            "Google OAuth credentials need to be configured in Railway/backend .env. You can connect immediately using the App Password / SMTP option below!"
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to initiate Gmail connection.");
    } finally {
      setConnecting(false);
      setConnectingProvider(null);
    }
  };

  // Connect SMTP / App Password Handler
  const handleConnectSmtp = async (smtpConfig) => {
    setConnecting(true);
    setConnectingProvider("smtp");
    try {
      const res = await connectSmtpAccount(smtpConfig);
      if (res?.success) {
        toast.success("Personal email connected successfully!");
        setIsConnected(true);
        setShowOnboarding(false);
        await loadAccountStatus();
        await loadEmails();
      } else {
        throw new Error(res?.message || "Connection failed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to connect email.");
      throw err;
    } finally {
      setConnecting(false);
      setConnectingProvider(null);
    }
  };

  // Listen for global settings trigger
  useEffect(() => {
    const handleOpenSettings = () => setShowAccountModal(true);
    window.addEventListener("taskflow:open-settings", handleOpenSettings);
    return () => window.removeEventListener("taskflow:open-settings", handleOpenSettings);
  }, []);

  // Load real folders and unread counts from Gmail
  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchEmailFolders();
      if (data?.unreadCounts) setUnreadCounts(data.unreadCounts);
      if (data?.categoryCounts) setCategoryCounts(data.categoryCounts);
      if (data?.userLabels) setUserLabels(data.userLabels);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (isConnected) loadFolders();
  }, [isConnected, loadFolders]);

  // Load real emails from Gmail API
  const loadEmails = useCallback(async () => {
    setLoadingEmails(true);
    try {
      const data = await fetchEmailMessages({
        folder: selectedFolder,
        category: activeCategory,
        label: selectedLabel,
        search: searchQuery,
        filter: filterTab,
      });

      const msgs = data?.messages || [];
      setEmails(msgs);
      if (data?.total !== undefined) setTotalCount(data.total);
      if (data?.unreadCounts) setUnreadCounts(data.unreadCounts);

      // Auto-select first email on desktop if none selected, but preserve active selection
      if (msgs.length > 0) {
        setSelectedEmail((prev) => {
          if (!prev) {
            return window.innerWidth >= 768 ? msgs[0] : null;
          }
          const found = msgs.find((m) => String(m._id || m.id) === String(prev._id || prev.id));
          return found || (window.innerWidth >= 768 ? msgs[0] : null);
        });
      } else {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.warn("Failed to load emails:", err.message);
    } finally {
      setLoadingEmails(false);
    }
  }, [selectedFolder, activeCategory, selectedLabel, searchQuery, filterTab]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Handle Select Email & lazy-load full MIME body from Gmail API if needed
  const handleSelectEmail = async (email) => {
    if (!email) return;
    const emailId = String(email._id || email.id);
    setSelectedEmail(email);
    setMobileView("reader");
    activeFetchingIdRef.current = emailId;

    const wasUnread = !email.isRead && !markedReadIdsRef.current.has(emailId);

    if (wasUnread) {
      markedReadIdsRef.current.add(emailId);

      // Optimistically mark this specific email read
      setEmails((prev) =>
        prev.map((e) => (String(e._id || e.id) === emailId ? { ...e, isRead: true } : e))
      );
      setSelectedEmail((prev) =>
        prev && String(prev._id || prev.id) === emailId ? { ...prev, isRead: true } : prev
      );
      setUnreadCounts((prev) => ({
        ...prev,
        INBOX: Math.max(0, (prev.INBOX || 1) - 1),
      }));

      // Synchronize to Gmail API
      markEmailRead(null, emailId, true).catch((err) => {
        console.warn("[Gmail Sync Error] Mark read failed:", err.message);
        markedReadIdsRef.current.delete(emailId);
      });
    }

    // Lazy load full body & attachments from Gmail API if not present
    if (!email.htmlBody && (!email.body || email.body.length < 100)) {
      try {
        const full = await fetchEmailMessage(null, emailId);
        // Only apply if user is still looking at this exact message
        if (activeFetchingIdRef.current === emailId && full?.message) {
          const updatedMsg = {
            ...full.message,
            // Preserve isRead = true if marked read in this session
            isRead: markedReadIdsRef.current.has(emailId) ? true : full.message.isRead,
          };
          setSelectedEmail(updatedMsg);
          setEmails((prev) =>
            prev.map((e) => (String(e._id || e.id) === emailId ? { ...e, ...updatedMsg } : e))
          );
        }
      } catch (_) {}
    }
  };

  // Handle Star
  const handleStarEmail = async (email) => {
    const targetId = email._id || email.id;
    const newStarred = !email.isStarred;

    setEmails((prev) =>
      prev.map((e) => ((e._id || e.id) === targetId ? { ...e, isStarred: newStarred } : e))
    );
    if ((selectedEmail?._id || selectedEmail?.id) === targetId) {
      setSelectedEmail((prev) => ({ ...prev, isStarred: newStarred }));
    }

    try {
      await starEmail(null, targetId, newStarred);
    } catch (_) {
      // Revert on failure
      setEmails((prev) =>
        prev.map((e) => ((e._id || e.id) === targetId ? { ...e, isStarred: !newStarred } : e))
      );
    }
  };

  // Handle Trash
  const handleTrashEmail = async (email) => {
    const targetId = email._id || email.id;
    setEmails((prev) => prev.filter((e) => (e._id || e.id) !== targetId));
    toast.success("Moved to Trash.");
    try {
      await moveEmailToTrash(null, targetId);
    } catch (_) {}
  };

  // Handle Mark as Unread
  const handleMarkUnread = async (email) => {
    if (!email) return;
    const targetId = String(email._id || email.id);
    markedReadIdsRef.current.delete(targetId);

    setEmails((prev) =>
      prev.map((e) => (String(e._id || e.id) === targetId ? { ...e, isRead: false } : e))
    );
    setSelectedEmail((prev) =>
      prev && String(prev._id || prev.id) === targetId ? { ...prev, isRead: false } : prev
    );
    setUnreadCounts((prev) => ({
      ...prev,
      INBOX: (prev.INBOX || 0) + 1,
    }));
    toast.info("Marked as unread.");
    try {
      await markEmailRead(null, targetId, false);
    } catch (_) {}
  };

  // Navigation: Next / Prev email
  const handleNextEmail = () => {
    if (!selectedEmail || emails.length === 0) return;
    const currentIndex = emails.findIndex(
      (e) => (e._id || e.id) === (selectedEmail._id || selectedEmail.id)
    );
    if (currentIndex >= 0 && currentIndex < emails.length - 1) {
      handleSelectEmail(emails[currentIndex + 1]);
    }
  };

  const handlePrevEmail = () => {
    if (!selectedEmail || emails.length === 0) return;
    const currentIndex = emails.findIndex(
      (e) => (e._id || e.id) === (selectedEmail._id || selectedEmail.id)
    );
    if (currentIndex > 0) {
      handleSelectEmail(emails[currentIndex - 1]);
    }
  };

  // Compose actions
  const handleOpenCompose = () => {
    setComposerMode("compose");
    setComposerReply(null);
    setComposerOpen(true);
  };

  const handleReply = (email) => {
    setComposerMode("reply");
    setComposerReply(email);
    setComposerOpen(true);
  };

  const handleReplyAll = (email) => {
    setComposerMode("reply_all");
    setComposerReply(email);
    setComposerOpen(true);
  };

  const handleForward = (email) => {
    setComposerMode("forward");
    setComposerReply(email);
    setComposerOpen(true);
  };

  // Send real email
  const handleSendEmail = async (emailData) => {
    setSending(true);
    try {
      const formData = new FormData();
      if (emailData.from) {
        formData.append("from", emailData.from);
      } else if (personalAccount?.email) {
        formData.append("from", `${personalAccount.displayName || personalAccount.email} <${personalAccount.email}>`);
      } else {
        formData.append("from", "TaskFlow Mail <mailer@taskflow.in>");
      }
      if (personalAccount?._id) {
        formData.append("accountId", personalAccount._id);
      }
      formData.append("to", JSON.stringify(emailData.to));
      formData.append("cc", JSON.stringify(emailData.cc || []));
      formData.append("bcc", JSON.stringify(emailData.bcc || []));
      formData.append("subject", emailData.subject);
      formData.append("body", emailData.body);
      emailData.attachments?.forEach((file) => formData.append("attachments", file));

      const token = localStorage.getItem("token");
      const { API_BASE_URL } = await import("../../config/api");
      const res = await fetch(`${API_BASE_URL}/api/email/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to send email.");

      toast.success("Email sent successfully!");
      setComposerOpen(false);
      loadEmails();
    } catch (err) {
      toast.error(err.message || "Failed to send email.");
      throw err;
    } finally {
      setSending(false);
    }
  };

  // Save Draft
  const handleSaveDraft = async (draftData) => {
    try {
      await saveDraft(draftData);
      toast.info("Draft saved.");
    } catch (_) {}
  };

  // Schedule email
  const handleScheduleEmail = async (scheduleData) => {
    try {
      await scheduleEmail(scheduleData);
      toast.success(`Email scheduled for ${new Date(scheduleData.scheduledAt).toLocaleString()}`);
      setComposerOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to schedule email.");
      throw err;
    }
  };

  // Email to Task Conversion
  const handleCreateTaskFromEmail = (email) => {
    setTaskInitialData({
      title: email.subject || "Follow up on email",
      description: `Task created from email from ${email.fromName || email.from}:\n\n${email.snippet || email.body?.slice(0, 200)}`,
      priority: "Medium",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    setTaskModalOpen(true);
  };

  // Follow-up Reminder trigger
  const handleSetFollowUp = (email) => {
    setTaskInitialData({
      title: `Follow up: ${email.subject || "Email Response"}`,
      description: `Waiting for reply from ${email.fromName || email.from}. Remind me if no reply is received.`,
      priority: "High",
      reminderEnabled: true,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    setTaskModalOpen(true);
  };

  if (initialLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-white/70 backdrop-blur-xs rounded-3xl border border-purple-100">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-3" />
        <span className="text-sm font-bold text-gray-700">Checking email accounts...</span>
      </div>
    );
  }

  // ─── First-time Onboarding View (Personal Email First) ───
  if (!isConnected && showOnboarding) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col">
        <EmailOnboarding
          onConnectGmail={handleConnectGmail}
          onConnectSmtp={handleConnectSmtp}
          onPreviewDemo={() => setShowOnboarding(false)}
          onBackToQuickSend={onBackToQuickSend}
          connecting={connecting}
          connectingProvider={connectingProvider}
          taskflowMail={taskflowMail}
        />

        {/* Global Settings Modal still accessible */}
        <EmailAccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
          accountInfo={taskflowMail}
          onRefresh={loadAccountStatus}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 flex flex-row gap-2.5 sm:gap-3 overflow-hidden pb-1 relative">
      {/* ─── Preview Banner if user opted to preview before connecting ─── */}
      {!isConnected && (
        <div className="absolute top-2 right-4 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-950/90 text-white text-xs font-bold shadow-lg backdrop-blur-xs border border-purple-400/30 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
          <span>Mailbox Preview Mode</span>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white text-[11px] font-black transition cursor-pointer shadow-xs"
          >
            Connect Personal Email
          </button>
        </div>
      )}

      {/* ─── COLUMN 1: LEFT EMAIL SIDEBAR (Fixed width, independently scrollable) ─── */}
      <div className="w-56 sm:w-60 lg:w-[245px] shrink-0 h-full min-h-0 flex flex-col hidden md:flex">
        <EmailSidebar
          selectedFolder={selectedFolder}
          onSelectFolder={(folder) => {
            setSelectedLabel(null);
            setSelectedFolder(folder);
          }}
          selectedLabel={selectedLabel}
          onSelectLabel={(label) => setSelectedLabel(label)}
          onCompose={handleOpenCompose}
          unreadCounts={unreadCounts}
          labelCounts={labelCounts}
          accountInfo={{ ...taskflowMail, userLabels }}
          personalAccount={personalAccount}
          isConnected={isConnected}
          onOpenOnboarding={() => setShowOnboarding(true)}
          onOpenAccountModal={() => setShowAccountModal(true)}
        />
      </div>

      {/* ─── COLUMN 2: MIDDLE EMAIL LIST (Fixed width, independently scrollable) ─── */}
      <div
        className={`w-full md:w-80 lg:w-[350px] shrink-0 h-full min-h-0 flex flex-col ${
          mobileView === "reader" ? "hidden md:flex" : "flex"
        }`}
      >
        <EmailList
          emails={emails}
          selectedEmail={selectedEmail}
          onSelectEmail={handleSelectEmail}
          onStarEmail={handleStarEmail}
          activeCategory={activeCategory}
          onSelectCategory={(cat) => setActiveCategory(cat)}
          categoryCounts={categoryCounts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={loadEmails}
          loading={loadingEmails}
          totalCount={totalCount || emails.length}
          isInbox={selectedFolder === "INBOX" && !selectedLabel}
          selectedFolder={selectedFolder}
          onSelectFolder={(folder) => {
            setSelectedLabel(null);
            setSelectedFolder(folder);
          }}
          selectedLabel={selectedLabel}
          onSelectLabel={(label) => setSelectedLabel(label)}
          unreadCounts={unreadCounts}
          onCompose={handleOpenCompose}
          onBackToQuickSend={onBackToQuickSend}
        />
      </div>

      {/* ─── COLUMN 3: RIGHT EMAIL READER (Flex-1, independently scrollable) ─── */}
      <div
        className={`flex-1 min-w-0 h-full min-h-0 flex flex-col ${
          mobileView === "list" ? "hidden md:flex" : "flex"
        }`}
      >
        <EmailReader
          email={selectedEmail}
          onClose={() => setMobileView("list")}
          onReply={handleReply}
          onReplyAll={handleReplyAll}
          onForward={handleForward}
          onTrash={handleTrashEmail}
          onStar={handleStarEmail}
          onMarkUnread={handleMarkUnread}
          onCreateTask={handleCreateTaskFromEmail}
          onSetFollowUp={handleSetFollowUp}
          onPrevEmail={handlePrevEmail}
          onNextEmail={handleNextEmail}
        />
      </div>

      {/* ─── EMAIL COMPOSER MODAL ─── */}
      <EmailComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSend={handleSendEmail}
        onSaveDraft={handleSaveDraft}
        onSchedule={handleScheduleEmail}
        fromAccounts={
          personalAccount
            ? [
                { email: personalAccount.email, name: personalAccount.displayName || personalAccount.email },
                { email: "mailer@taskflow.in", name: "TaskFlow Mail (Optional Gateway)" },
              ]
            : [{ email: "mailer@taskflow.in", name: "TaskFlow Mail" }]
        }
        replyToEmail={composerReply}
        mode={composerMode}
        sending={sending}
      />

      {/* ─── TASKFLOW MAIL ACCOUNT & DOMAIN MODAL ─── */}
      <EmailAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        accountInfo={taskflowMail}
        onRefresh={loadAccountStatus}
      />

      {/* ─── TASKLERT PRODUCTIVITY: EMAIL TO TASK MODAL ─── */}
      {taskModalOpen && (
        <TaskModal
          isOpen={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false);
            setTaskInitialData(null);
          }}
          onSave={() => {
            setTaskModalOpen(false);
            setTaskInitialData(null);
            toast.success("Task created from email successfully!");
          }}
          initialData={taskInitialData}
        />
      )}
    </div>
  );
}
