import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Mail,
  Copy,
  Clock,
  BarChart2,
  Settings,
  ArrowLeft,
  Calendar,
  Home,
  FileText,
  Zap,
} from "lucide-react";
import QuicksendOverview from "../components/quicksend/QuicksendOverview";
import QuicksendTemplates from "../components/quicksend/QuicksendTemplates";
import QuicksendLogs from "../components/quicksend/QuicksendLogs";
import QuicksendActivity from "../components/quicksend/QuicksendActivity";
import TelegramWorkspace from "../components/telegram/TelegramWorkspace";
import EmailWorkspace from "../components/email/EmailWorkspace";
import TasklertMailDashboard from "../components/email/TasklertMailDashboard";
import TasklertMailModal from "../components/email/TasklertMailModal";
import ScheduledWorkspace from "../components/scheduling/ScheduledWorkspace";
import ScheduleModal from "../components/scheduling/ScheduleModal";
import { fetchScheduledStats } from "../services/unifiedScheduleApi";

/**
 * Tasklert QuickSend — Complete UI/UX Redesign matching Desktop and Mobile PWA references:
 * 1. Overview Dashboard (Send From cards, Quick Actions, Recent Messages, This Week Overview, Scheduled Items)
 * 2. Templates (Reusable message & email templates with categories and placeholders)
 * 3. Logs (Full delivery audit trail across channels)
 * 4. Scheduled (Comprehensive unified scheduled workspace)
 * 5. Activity (Performance metrics, volume distribution, delivery health)
 * 6. Dedicated Channel Workspaces (Tasklert Mail, Google Mail, Telegram) with seamless back navigation
 */
export default function MessageCenter() {
  // Navigation view: "overview" (default) | "channel" | "templates" | "logs" | "scheduled" | "activity"
  const [mainView, setMainView] = useState("overview");
  const [activeChannel, setActiveChannel] = useState("tasklert_mail"); // "tasklert_mail" | "email" | "telegram"
  const [telegramActiveChat, setTelegramActiveChat] = useState(null);

  // Modals state
  const [isTasklertMailModalOpen, setIsTasklertMailModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(2);
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

  const handleOpenCompose = (step = 2) => {
    setModalInitialStep(step);
    setIsTasklertMailModalOpen(true);
  };

  const handleSelectChannel = (channelKey) => {
    setActiveChannel(channelKey);
    setMainView("channel");
  };

  const handleUseTemplate = (template) => {
    setScheduleModalProps({
      channel: template.channel === "all" ? "tasklert_mail" : template.channel,
      recipient: "",
      recipientName: "",
      subject: template.subject,
      message: template.body,
      peerType: "user",
      editingItem: null,
    });
    setIsScheduleModalOpen(true);
  };

  // Listen for QuickSend bottom nav taps to reset to overview on mobile
  useEffect(() => {
    const handleQuickSendClick = () => {
      setMainView("overview");
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
    return () => window.removeEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
  }, []);

  const isTelegramActive = mainView === "channel" && activeChannel === "telegram";
  const isMobileTelegramChatOpen = isTelegramActive && Boolean(telegramActiveChat);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col min-h-0 overflow-y-auto md:overflow-y-auto py-2 px-2 sm:px-4 md:px-6 scroll-smooth tg-custom-scrollbar"
    >
      {/* ========================================================================= */}
      {/* QUICKSEND HERO INTRODUCTION & TOP NAVIGATION BAR (Phases 2C, 2D & 5B, 5C)  */}
      {/* ========================================================================= */}
      {(!isMobileTelegramChatOpen || window.innerWidth >= 768) && (
        <div className="shrink-0 mb-5 relative rounded-3xl bg-gradient-to-r from-[#FAF7FF] via-[#F6F0FE] to-[#F1E8FD] border border-purple-100/90 p-4 sm:p-6 shadow-2xs overflow-hidden">
          {/* Subtle Decorative Wave Illustration on top-right (Matches Desktop Reference) */}
          <div className="absolute right-0 top-0 bottom-0 w-48 sm:w-80 pointer-events-none overflow-hidden opacity-60">
            <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" preserveAspectRatio="none">
              <path
                d="M320 0C240 10 180 60 160 140H320V0Z"
                fill="url(#waveGrad1)"
              />
              <path
                d="M320 40C260 50 210 90 200 140H320V40Z"
                fill="url(#waveGrad2)"
              />
              <defs>
                <linearGradient id="waveGrad1" x1="160" y1="0" x2="320" y2="140" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#E4D5FB" stopOpacity="0.7" />
                  <stop stopColor="#D2BAF9" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="waveGrad2" x1="200" y1="40" x2="320" y2="140" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#C19FF7" stopOpacity="0.5" />
                  <stop stopColor="#9C6CF3" stopOpacity="0.25" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="relative z-10 flex flex-col space-y-4">
            {/* Title & Introduction Row */}
            <div className="flex items-start gap-3.5">
              {/* Outlined Purple Paperplane Icon matching screenshot */}
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white border border-purple-200/80 shadow-2xs flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6 text-[#7629E8] stroke-[2.2] -rotate-12 translate-x-px"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-[#17133D] tracking-tight">
                    QuickSend
                  </h1>
                  <span className="bg-[#EFE8FD] text-[#7629E8] text-xs font-black px-2.5 py-0.5 rounded-full">
                    Workspace
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#77738F] font-medium mt-0.5 leading-relaxed">
                  Send messages, emails, or task updates instantly or schedule them for later.
                </p>
              </div>
            </div>

            {/* Horizontal Navigation Tabs (Overview, Templates, Logs, Scheduled, Activity) */}
            <div className="bg-white/95 backdrop-blur-xs rounded-2xl border border-purple-100 p-1 flex items-center gap-1 sm:gap-2 shadow-2xs overflow-x-auto scrollbar-none w-full sm:w-fit">
              {/* 1. Overview (Default) */}
              <button
                type="button"
                onClick={() => setMainView("overview")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 select-none ${
                  mainView === "overview"
                    ? "bg-[#EFE8FD] text-[#7629E8] shadow-2xs"
                    : "text-[#77738F] hover:text-[#17133D] hover:bg-purple-50/50"
                }`}
              >
                <Home className="w-4 h-4 text-[#7629E8]" />
                <span>Overview</span>
              </button>

              {/* 2. Templates */}
              <button
                type="button"
                onClick={() => setMainView("templates")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 select-none ${
                  mainView === "templates"
                    ? "bg-[#EFE8FD] text-[#7629E8] shadow-2xs"
                    : "text-[#77738F] hover:text-[#17133D] hover:bg-purple-50/50"
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>Templates</span>
              </button>

              {/* 3. Logs */}
              <button
                type="button"
                onClick={() => setMainView("logs")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 select-none ${
                  mainView === "logs"
                    ? "bg-[#EFE8FD] text-[#7629E8] shadow-2xs"
                    : "text-[#77738F] hover:text-[#17133D] hover:bg-purple-50/50"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Logs</span>
              </button>

              {/* 4. Scheduled */}
              <button
                type="button"
                onClick={() => setMainView("scheduled")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 select-none ${
                  mainView === "scheduled"
                    ? "bg-[#EFE8FD] text-[#7629E8] shadow-2xs"
                    : "text-[#77738F] hover:text-[#17133D] hover:bg-purple-50/50"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Scheduled</span>
                {scheduledTotalCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-purple-200 text-purple-900">
                    {scheduledTotalCount}
                  </span>
                )}
              </button>

              {/* 5. Activity */}
              <button
                type="button"
                onClick={() => setMainView("activity")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 select-none ${
                  mainView === "activity"
                    ? "bg-[#EFE8FD] text-[#7629E8] shadow-2xs"
                    : "text-[#77738F] hover:text-[#17133D] hover:bg-purple-50/50"
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>Activity</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN VIEW CONTENT CONTAINER                                               */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* VIEW 1: OVERVIEW DASHBOARD (Desktop 2-Column & Mobile PWA Reference) */}
        {mainView === "overview" && (
          <QuicksendOverview
            onSelectChannel={handleSelectChannel}
            onOpenCompose={() => handleOpenCompose(2)}
            onOpenSchedule={handleOpenSchedule}
            onViewAllLogs={() => setMainView("logs")}
            onViewAllScheduled={() => setMainView("scheduled")}
            onEditSchedule={handleEditSchedule}
            refreshTrigger={scheduleRefreshTrigger}
          />
        )}

        {/* VIEW 2: TEMPLATES SECTION */}
        {mainView === "templates" && (
          <QuicksendTemplates
            onUseTemplate={handleUseTemplate}
            onBackToOverview={() => setMainView("overview")}
          />
        )}

        {/* VIEW 3: LOGS SECTION */}
        {mainView === "logs" && (
          <QuicksendLogs
            onSelectChannel={handleSelectChannel}
            onBackToOverview={() => setMainView("overview")}
          />
        )}

        {/* VIEW 4: SCHEDULED WORKSPACE */}
        {mainView === "scheduled" && (
          <div className="w-full flex-1 flex flex-col min-h-0 animate-fadeIn">
            <ScheduledWorkspace
              onOpenNewSchedule={handleOpenSchedule}
              onEditSchedule={handleEditSchedule}
              refreshTrigger={scheduleRefreshTrigger}
            />
          </div>
        )}

        {/* VIEW 5: ACTIVITY & ANALYTICS */}
        {mainView === "activity" && (
          <QuicksendActivity onSelectChannel={handleSelectChannel} />
        )}

        {/* VIEW 6: DEDICATED CHANNEL WORKSPACES (Tasklert Mail, Google Mail, Telegram) */}
        {mainView === "channel" && (
          <div className="w-full flex-1 flex flex-col min-h-0 animate-fadeIn">
            {/* Top Back & Channel Switcher Bar */}
            <div
              className={`shrink-0 flex items-center justify-between bg-white rounded-2xl border border-purple-100 p-2 sm:p-2.5 mb-3 shadow-2xs ${
                isMobileTelegramChatOpen ? "hidden md:flex" : "flex"
              }`}
            >
              <button
                type="button"
                onClick={() => setMainView("overview")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition cursor-pointer active:scale-95 select-none"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Overview</span>
              </button>

              {/* 3 Channel Selector Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {/* Tasklert Mail */}
                <button
                  type="button"
                  onClick={() => setActiveChannel("tasklert_mail")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                    activeChannel === "tasklert_mail"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-white hover:bg-emerald-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tasklert Mail</span>
                  <span className="sm:hidden">Mail</span>
                </button>

                {/* Google Mail */}
                <button
                  type="button"
                  onClick={() => setActiveChannel("email")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                    activeChannel === "email"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white hover:bg-blue-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Google Mail</span>
                  <span className="sm:hidden">Gmail</span>
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={() => setActiveChannel("telegram")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer select-none ${
                    activeChannel === "telegram"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-white hover:bg-purple-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 -rotate-12" />
                  <span>Telegram</span>
                </button>
              </div>
            </div>

            {/* Workspace Renderers */}
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Tasklert Mail Workspace */}
              {activeChannel === "tasklert_mail" && (
                <div className="w-full flex-1 flex flex-col min-h-0">
                  <TasklertMailDashboard
                    onOpenCompose={handleOpenCompose}
                    onOpenSchedule={handleOpenSchedule}
                  />
                </div>
              )}

              {/* Google Mail Workspace */}
              {activeChannel === "email" && (
                <div className="w-full flex-1 flex flex-col min-h-0 max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white">
                  <EmailWorkspace
                    onBackToQuickSend={() => setMainView("overview")}
                    onOpenSchedule={handleOpenSchedule}
                  />
                </div>
              )}

              {/* Telegram Workspace */}
              {activeChannel === "telegram" && (
                <div className="w-full flex-1 flex flex-col min-h-0 max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white">
                  <TelegramWorkspace
                    onActiveChatChange={(chat) => setTelegramActiveChat(chat)}
                    onBackToQuickSend={() => setMainView("overview")}
                    onOpenSchedule={handleOpenSchedule}
                  />
                </div>
              )}
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
          setMainView("channel");
        }}
        onSentSuccess={() => {
          setScheduleRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* ─── Unified QuickSend Schedule Modal / Mobile Bottom Sheet ─── */}
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
