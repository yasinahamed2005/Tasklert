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
} from "lucide-react";
import TelegramWorkspace from "../components/telegram/TelegramWorkspace";
import EmailWorkspace from "../components/email/EmailWorkspace";
import TasklertMailDashboard from "../components/email/TasklertMailDashboard";
import TasklertMailModal from "../components/email/TasklertMailModal";

/**
 * QuickSend Workspace — Full Multi-Channel Communication Suite:
 * 1. Telegram (GramJS MTProto personal account integration — Full Screen Mobile & Desktop Experience)
 * 2. Email (Gmail & Outlook mailbox sync and compose)
 * 3. Tasklert Mail (Dedicated professional email sending with Action Required & custom branding)
 */
export default function MessageCenter() {
  const [activeChannel, setActiveChannel] = useState("tasklert_mail");
  const [telegramActiveChat, setTelegramActiveChat] = useState(null);
  const [activeTabNotice, setActiveTabNotice] = useState(null);
  const [isTasklertMailModalOpen, setIsTasklertMailModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(2);

  const containerRef = useRef(null);
  const image1Ref = useRef(null);
  const image2Ref = useRef(null);

  const handleShortcutClick = (label) => {
    setActiveTabNotice(`${label} workspace section is active.`);
    setTimeout(() => setActiveTabNotice(null), 3500);
  };

  const handleOpenCompose = (step = 2) => {
    setModalInitialStep(step);
    setIsTasklertMailModalOpen(true);
  };

  // Smoothly scroll down past Image 1 to stand at Image 2 ("QuickSend Channels") on mobile
  const scrollToImage2 = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768 && image2Ref.current && containerRef.current) {
      const topOffset = image2Ref.current.offsetTop;
      containerRef.current.scrollTo({
        top: topOffset,
        behavior: "smooth",
      });
    }
  }, []);

  useEffect(() => {
    if (activeChannel === "tasklert_mail") {
      const timer = setTimeout(scrollToImage2, 120);
      return () => clearTimeout(timer);
    }
  }, [activeChannel, scrollToImage2]);

  // Listen for QuickSend bottom nav taps to scroll down to Image 2 on mobile
  useEffect(() => {
    const handleQuickSendClick = () => {
      setActiveChannel("tasklert_mail");
      setTimeout(scrollToImage2, 80);
    };
    window.addEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
    return () => window.removeEventListener("tasklert:quicksend-clicked", handleQuickSendClick);
  }, [scrollToImage2]);

  const isTelegramActive = activeChannel === "telegram";
  // On mobile, if a conversation is open in Telegram, collapse outer header so chat window gets 100% viewport
  const isMobileTelegramChatOpen = isTelegramActive && Boolean(telegramActiveChat);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col min-h-0 overflow-y-auto md:overflow-hidden py-1 px-1 sm:px-2 md:px-3 scroll-smooth"
    >
      {/* ─── Top Header & Productivity Toolbar (Image 1) ─── */}
      <div
        ref={image1Ref}
        className={`shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 ${
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
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-extrabold tracking-normal">
                {isTelegramActive ? "Telegram" : "Workspace"}
              </span>
            </h1>
          </div>
          {!isTelegramActive && (
            <p className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span>Send messages and emails from one place. Communicate, schedule and stay productive.</span>
            </p>
          )}
        </div>

        {/* Productivity Shortcut Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleShortcutClick("Message Templates")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-xs font-bold text-purple-900 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <Copy className="w-3.5 h-3.5 text-purple-700" />
            <span className="hidden md:inline">Message</span>
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={() => handleShortcutClick("Scheduled Messages")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-xs font-bold text-purple-900 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <Clock className="w-3.5 h-3.5 text-purple-700" />
            <span className="hidden md:inline">Scheduled</span>
            <span>Messages</span>
          </button>

          <button
            type="button"
            onClick={() => handleShortcutClick("Activity")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200/90 bg-purple-50/80 hover:bg-purple-100 text-xs font-bold text-purple-900 transition shadow-2xs cursor-pointer active:scale-95"
          >
            <BarChart2 className="w-3.5 h-3.5 text-purple-700" />
            <span>Activity</span>
          </button>

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

      {/* ─── QuickSend Top Reference & Channel Selector Bar (Image 2 - Sticky on scroll) ─── */}
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

        {/* 3 Channel Selector Pills: 1. Tasklert Mail, 2. Email, 3. Telegram */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* 1. Tasklert Mail */}
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

          {/* 2. Google Mail */}
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

          {/* 3. Telegram */}
          <button
            type="button"
            onClick={() => setActiveChannel("telegram")}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeChannel === "telegram"
                ? "bg-sky-500 hover:bg-sky-600 text-white border border-sky-500 shadow-sm shadow-sky-500/20"
                : "bg-white hover:bg-sky-50/50 text-gray-700 hover:text-gray-900 border border-gray-200/90 shadow-2xs"
            }`}
          >
            <Send className={`w-3.5 h-3.5 -rotate-12 ${activeChannel === "telegram" ? "text-white" : "text-sky-500"}`} />
            <span>Telegram</span>
          </button>
        </div>
      </div>

      {/* ─── Main Communication Workspaces (Full Screen Height) ─── */}
      <div className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
        {/* 1. Telegram workspace: on mobile it opens as a dedicated full-screen app (fixed inset-0 z-50) */}
        {/* with top-left back button to return to QuickSend with user permission; on desktop it renders embedded */}
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
          />
        </div>

        {/* 2. Google Mail Workspace: on mobile it opens as a dedicated full-screen app (fixed inset-0 z-50) */}
        {/* with top-left back button to return to QuickSend; on desktop it renders embedded */}
        <div
          className={
            activeChannel === "email"
              ? "w-full h-full flex flex-col min-h-0 max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-white"
              : "hidden"
          }
        >
          <EmailWorkspace
            onBackToQuickSend={() => setActiveChannel("tasklert_mail")}
          />
        </div>

        {/* 3. Tasklert Mail Dedicated Workspace */}
        {activeChannel === "tasklert_mail" && (
          <div className="w-full flex-1 flex flex-col min-h-0">
            <TasklertMailDashboard onOpenCompose={handleOpenCompose} />
          </div>
        )}
      </div>

      {/* ─── 4-Step Interactive Tasklert Mail Modal Flow ─── */}
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
    </div>
  );
}
