import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Mail,
  Copy,
  Clock,
  BarChart2,
  Settings,
  ArrowDownRight,
  Zap,
  Calendar,
  Layers,
} from "lucide-react";
import TelegramWorkspace from "../components/telegram/TelegramWorkspace";
import EmailWorkspace from "../components/email/EmailWorkspace";
import TasklertMailDashboard from "../components/email/TasklertMailDashboard";
import TasklertMailModal from "../components/email/TasklertMailModal";
import ScheduledItemsPanel from "../components/scheduling/ScheduledItemsPanel";
import ScheduledWorkspace from "../components/scheduling/ScheduledWorkspace";
import ScheduleModal from "../components/scheduling/ScheduleModal";
import { fetchScheduledStats } from "../services/unifiedScheduleApi";

/**
 * QuickSend 2.0 Workspace — Unified Multi-Channel Communication & Scheduling Suite:
 * 1. Tasklert Mail (Internal branded email system with Pro Delivery & Action Required tracking)
 * 2. Google Mail (Connected Gmail OAuth mailbox sync and compose)
 * 3. Telegram (GramJS MTProto personal account integration)
 * 4. Unified Scheduled Messaging & Email Delivery (Runs durably on backend)
 */
export default function MessageCenter() {
  const [mainView, setMainView] = useState("channels"); // "channels" | "scheduled" | "activity"
  const [activeChannel, setActiveChannel] = useState("tasklert_mail"); // "tasklert_mail" | "email" | "telegram"
  const [telegramActiveChat, setTelegramActiveChat] = useState(null);
  const [activeTabNotice, setActiveTabNotice] = useState(null);

  // Tasklert Mail compose modal
  const [isTasklertMailModalOpen, setIsTasklertMailModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(2);

  // Unified Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalProps, setScheduleModalProps] = useState({
    channel: "telegram",
    recipient: "",
    recipientName: "",
    subject: "",
    message: "",
    peerType: "user",
    editingItem: null,
  });
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);
  const [scheduledTotalCount, setScheduledTotalCount] = useState(0);

  const containerRef = useRef(null);
  const image1Ref = useRef(null);
  const image2Ref = useRef(null);

  // Fetch live scheduled count for the top tab badge
  const loadScheduleCount = useCallback(async () => {
    try {
      const stats = await fetchScheduledStats();
      if (stats?.totalCount !== undefined) {
        setScheduledTotalCount(stats.totalCount);
      }
    } catch {
      // Ignore background error
    }
  }, []);

  useEffect(() => {
    loadScheduleCount();
  }, [loadScheduleCount, scheduleRefreshTrigger]);

  const handleShortcutClick = (label) => {
    if (label === "Scheduled") {
      setMainView("scheduled");
      return;
    }
    if (label === "Messages") {
      setMainView("channels");
      return;
    }
    setActiveTabNotice(`${label} section is active.`);
    setTimeout(() => setActiveTabNotice(null), 3500);
  };

  const handleOpenCompose = (step = 2) => {
    setModalInitialStep(step);
    setIsTasklertMailModalOpen(true);
  };

  // Open Unified Schedule Modal
  const handleOpenSchedule = (opts = {}) => {
    let targetChannel = opts.channel || (activeChannel === "email" ? "google_mail" : activeChannel);
    if (targetChannel === "email") targetChannel = "google_mail";

    let targetRecipient = opts.recipient || "";
    let targetRecipientName = opts.recipientName || "";
    let targetPeerType = "user";

    if (opts.activeChat) {
      targetRecipient = String(opts.activeChat.id || "");
      targetRecipientName = opts.activeChat.title || opts.activeChat.name || "";
      targetPeerType = opts.activeChat.isGroup || opts.activeChat.type === "group" ? "chat" : "user";
    }

    setScheduleModalProps({
      channel: targetChannel,
      recipient: targetRecipient,
      recipientName: targetRecipientName,
      subject: opts.subject || "",
      message: opts.message || "",
      peerType: targetPeerType,
      editingItem: null,
    });
    setIsScheduleModalOpen(true);
  };

  // Open Schedule Modal in edit mode
  const handleEditSchedule = (item) => {
    setScheduleModalProps({
      channel: item.channel,
      recipient: item.recipient,
      recipientName: item.recipientName,
      subject: item.subject || "",
      message: item.message || "",
      peerType: item.peerType || "user",
      editingItem: item,
    });
    setIsScheduleModalOpen(true);
  };

  // Smoothly scroll down past header to channels bar on mobile when switching to Tasklert Mail
  const scrollToImage2 = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && image2Ref.current && containerRef.current) {
      const topOffset = image2Ref.current.offsetTop;
      containerRef.current.scrollTo({
        top: topOffset,
        behavior: "smooth",
      });
    }
  }, []);

  // Listen for QuickSend bottom nav taps to reset view on mobile
  useEffect(() => {
    const handleQuickSendClick = () => {
      setMainView("channels");
      setActiveChannel("tasklert_mail");
      setTimeout(scrollToImage2, 80);
    };
    window.addEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
    return () => window.removeEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
  }, [scrollToImage2]);

  const isTelegramActive = mainView === "channels" && activeChannel === "telegram";
  // On mobile, if a conversation is open in Telegram, collapse outer header so chat window gets 100% viewport
  const isMobileTelegramChatOpen = isTelegramActive && Boolean(telegramActiveChat);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col min-h-0 overflow-y-auto md:overflow-hidden py-1 px-1 sm:px-2 md:px-3 scroll-smooth"
    >
      {/* ─── Top Header & Productivity Toolbar (Matches Desktop Reference) ─── */}
      <div
        ref={image1Ref}
        className={`shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5 ${
          isMobileTelegramChatOpen ? "hidden md:flex" : "flex"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Send className="w-4 h-4 -rotate-12 translate-x-px" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>QuickSend</span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-extrabold tracking-normal">
                {mainView === "scheduled"
                  ? "Scheduled"
                  : isTelegramActive
                  ? "Telegram"
                  : "Workspace"}
              </span>
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span>Send messages, emails, or task updates instantly or schedule them for later.</span>
          </p>
        </div>

        {/* Productivity Shortcut Navigation Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* 1. Templates */}
          <button
            type="button"
            onClick={() => handleShortcutClick("Templates")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-xs font-bold text-purple-900 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <Copy className="w-3.5 h-3.5 text-purple-700" />
            <span>Templates</span>
          </button>

          {/* 2. Messages (Channels View) */}
          <button
            type="button"
            onClick={() => handleShortcutClick("Messages")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 ${
              mainView === "channels"
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-900"
            }`}
          >
            <Send className="w-3.5 h-3.5 -rotate-12" />
            <span className="hidden sm:inline">Message</span>
            <span>Logs</span>
          </button>

          {/* 3. Scheduled (NEW QuickSend 2.0 Feature Launch Tab!) */}
          <button
            type="button"
            onClick={() => handleShortcutClick("Scheduled")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 ${
              mainView === "scheduled"
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled</span>
            {scheduledTotalCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  mainView === "scheduled" ? "bg-white/20 text-white" : "bg-purple-200 text-purple-900"
                }`}
              >
                {scheduledTotalCount}
              </span>
            )}
          </button>

          {/* 4. Activity */}
          <button
            type="button"
            onClick={() => handleShortcutClick("Activity")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-xs font-bold text-purple-900 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <BarChart2 className="w-3.5 h-3.5 text-purple-700" />
            <span>Activity</span>
          </button>

          {/* 5. Settings */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("taskflow:open-settings"))}
            className="p-2 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-purple-800 transition shadow-2xs cursor-pointer active:scale-95"
            title="Mail & QuickSend Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-purple-700" />
          </button>
        </div>
      </div>

      {/* Notice Banner if shortcut clicked */}
      {activeTabNotice && (
        <div className="shrink-0 mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl text-xs font-medium text-purple-800 animate-fadeIn">
          {activeTabNotice}
        </div>
      )}

      {/* ─── Channel Selector Bar (When in Channels View) ─── */}
      {mainView === "channels" && (
        <div
          ref={image2Ref}
          className={`shrink-0 sticky top-0 z-30 bg-white/95 backdrop-blur-md rounded-2xl border border-purple-100 p-2.5 sm:p-3 mb-2 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 ${
            isMobileTelegramChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
                <span>QuickSend Channels</span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium hidden sm:block">
                Switch between Tasklert Mail, personal Email, and native Telegram.
              </p>
            </div>
          </div>

          {/* 3 Channel Selector Pills: 1. Tasklert Mail, 2. Google Mail, 3. Telegram */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* 1. Tasklert Mail (Solid Green when active) */}
            <button
              type="button"
              onClick={() => setActiveChannel("tasklert_mail")}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChannel === "tasklert_mail"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-sm shadow-emerald-600/20"
                  : "bg-white hover:bg-emerald-50/50 text-gray-700 hover:text-gray-900 border border-gray-200/90 shadow-2xs"
              }`}
            >
              <Mail className={`w-3.5 h-3.5 ${activeChannel === "tasklert_mail" ? "text-white" : "text-emerald-600"}`} />
              <span>Tasklert Mail</span>
            </button>

            {/* 2. Google Mail (Solid Blue when active) */}
            <button
              type="button"
              onClick={() => setActiveChannel("email")}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChannel === "email"
                  ? "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow-sm shadow-blue-600/20"
                  : "bg-white hover:bg-blue-50/50 text-gray-700 hover:text-gray-900 border border-gray-200/90 shadow-2xs"
              }`}
            >
              <Mail className={`w-3.5 h-3.5 ${activeChannel === "email" ? "text-white" : "text-blue-600"}`} />
              <span>Google Mail</span>
            </button>

            {/* 3. Telegram (Solid Purple when active matching screenshot) */}
            <button
              type="button"
              onClick={() => setActiveChannel("telegram")}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeChannel === "telegram"
                  ? "bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 shadow-sm shadow-purple-600/20"
                  : "bg-white hover:bg-purple-50/50 text-gray-700 hover:text-gray-900 border border-gray-200/90 shadow-2xs"
              }`}
            >
              <Send className={`w-3.5 h-3.5 -rotate-12 ${activeChannel === "telegram" ? "text-white" : "text-purple-600"}`} />
              <span>Telegram</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content Views ─── */}
      <div className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
        {/* VIEW 1: UNIFIED SCHEDULED DASHBOARD */}
        {mainView === "scheduled" ? (
          <div className="w-full flex-1 flex flex-col min-h-0 animate-fadeIn">
            <ScheduledWorkspace
              onOpenNewSchedule={handleOpenSchedule}
              onEditSchedule={handleEditSchedule}
              refreshTrigger={scheduleRefreshTrigger}
            />
          </div>
        ) : (
          /* VIEW 2: CHANNELS WORKSPACES (With Desktop Right-Side ScheduledItemsPanel) */
          <div className="w-full flex-1 flex flex-row min-h-0 gap-3 md:overflow-hidden">
            {/* Left Channel Workspace (Full width on mobile, flexible on desktop) */}
            <div className="flex-1 min-w-0 h-full flex flex-col min-h-0 md:overflow-hidden">
              {/* Telegram */}
              <div
                className={
                  activeChannel === "telegram"
                    ? "w-full h-full flex flex-col min-h-0 max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white"
                    : "hidden"
                }
              >
                <TelegramWorkspace
                  onActiveChatChange={(chat) => setTelegramActiveChat(chat)}
                  onBackToQuickSend={() => setActiveChannel("tasklert_mail")}
                  onOpenSchedule={handleOpenSchedule}
                />
              </div>

              {/* Google Mail */}
              <div
                className={
                  activeChannel === "email"
                    ? "w-full h-full flex flex-col min-h-0 max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white"
                    : "hidden"
                }
              >
                <EmailWorkspace
                  onBackToQuickSend={() => setActiveChannel("tasklert_mail")}
                  onOpenSchedule={handleOpenSchedule}
                />
              </div>

              {/* Tasklert Mail */}
              {activeChannel === "tasklert_mail" && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                  <TasklertMailDashboard
                    onOpenCompose={handleOpenCompose}
                    onOpenSchedule={handleOpenSchedule}
                  />
                </div>
              )}
            </div>

            {/* Right Desktop Panel: Scheduled Items (Matching Desktop Reference Screenshot) */}
            <div className="hidden lg:flex shrink-0 h-full min-h-0">
              <ScheduledItemsPanel
                onOpenNewSchedule={handleOpenSchedule}
                onEditSchedule={handleEditSchedule}
                refreshTrigger={scheduleRefreshTrigger}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Tasklert Mail Interactive Compose Modal ─── */}
      <TasklertMailModal
        isOpen={isTasklertMailModalOpen}
        initialStep={modalInitialStep}
        onClose={() => setIsTasklertMailModalOpen(false)}
        onSwitchChannel={(channel) => {
          setActiveChannel(channel);
          setIsTasklertMailModalOpen(false);
        }}
        onSentSuccess={() => {
          setActiveChannel("tasklert_mail");
        }}
      />

      {/* ─── Unified QuickSend 2.0 Schedule Modal / Mobile Bottom Sheet ─── */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialChannel={scheduleModalProps.channel}
        initialRecipient={scheduleModalProps.recipient}
        initialRecipientName={scheduleModalProps.recipientName}
        initialSubject={scheduleModalProps.subject}
        initialMessage={scheduleModalProps.message}
        peerType={scheduleModalProps.peerType}
        editingItem={scheduleModalProps.editingItem}
        onScheduledSuccess={() => {
          setScheduleRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}
