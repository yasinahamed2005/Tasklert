import React, { useState } from "react";
import {
  Send,
  Mail,
  Copy,
  Clock,
  BarChart2,
  Settings,
  ArrowDownRight,
  Zap,
  Info,
} from "lucide-react";
import TelegramWorkspace from "../components/telegram/TelegramWorkspace";
import EmailWorkspace from "../components/email/EmailWorkspace";
import TasklertMailDashboard from "../components/email/TasklertMailDashboard";
import TasklertMailModal from "../components/email/TasklertMailModal";

/**
 * QuickSend Workspace — Full Multi-Channel Communication Suite:
 * 1. Telegram (GramJS MTProto personal account integration)
 * 2. Email (Gmail & Outlook mailbox sync and compose)
 * 3. Tasklert Mail (Dedicated professional email sending with Action Required & custom branding)
 */
export default function MessageCenter() {
  const [activeChannel, setActiveChannel] = useState("tasklert_mail"); // Default to Tasklert Mail (Recommended)
  const [activeTabNotice, setActiveTabNotice] = useState(null);
  const [isTasklertMailModalOpen, setIsTasklertMailModalOpen] = useState(false);
  const [modalInitialStep, setModalInitialStep] = useState(2);

  const handleShortcutClick = (label) => {
    setActiveTabNotice(`${label} workspace section is active.`);
    setTimeout(() => setActiveTabNotice(null), 3500);
  };

  const handleOpenCompose = (step = 2) => {
    setModalInitialStep(step);
    setIsTasklertMailModalOpen(true);
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden py-1 px-1 sm:px-2 md:px-3">
      {/* ─── Top Header & Productivity Toolbar ─── */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Send className="w-4 h-4 -rotate-12 translate-x-px" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span>QuickSend</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-extrabold tracking-normal">
                Workspace
              </span>
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span>Send messages and emails from one place. Communicate, schedule and stay productive.</span>
          </p>
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

      {/* ─── QuickSend Top Reference Banner (Matching Design Image) ─── */}
      <div className="shrink-0 bg-white/95 backdrop-blur-xs rounded-2xl border border-purple-100 p-3 sm:p-4 mb-2.5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <div>
            <div className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <span>QuickSend</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">Send reminders, updates, or task requests instantly.</p>
          </div>
        </div>

        {/* 3 Channel Selector Pills: 1. Tasklert Mail, 2. Email, 3. Telegram */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          {/* 1. Tasklert Mail */}
          <button
            type="button"
            onClick={() => {
              setActiveChannel("tasklert_mail");
              handleOpenCompose(2);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              activeChannel === "tasklert_mail"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-emerald-600/20"
                : "bg-emerald-600/90 hover:bg-emerald-600 text-white border border-emerald-600"
            }`}
          >
            <Mail className="w-4 h-4 text-white" />
            <span>Tasklert Mail</span>
          </button>

          {/* 2. Email */}
          <button
            type="button"
            onClick={() => setActiveChannel("email")}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeChannel === "email"
                ? "bg-gray-100 text-gray-900 border-gray-300 shadow-xs"
                : "border-gray-200 bg-gray-50/70 hover:bg-gray-100 text-gray-700 hover:border-gray-300"
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-600" />
            <span>Email</span>
          </button>

          {/* 3. Telegram */}
          <button
            type="button"
            onClick={() => setActiveChannel("telegram")}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeChannel === "telegram"
                ? "bg-gray-100 text-gray-900 border-gray-300 shadow-xs"
                : "border-gray-200 bg-gray-50/70 hover:bg-gray-100 text-gray-700 hover:border-gray-300"
            }`}
          >
            <Send className="w-4 h-4 -rotate-12 text-emerald-600" />
            <span>Telegram</span>
          </button>
        </div>
      </div>

      {/* ─── Main Communication Workspaces ─── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* 1. Telegram workspace kept mounted in DOM to prevent re-initializing GramJS MTProto session */}
        <div className={activeChannel === "telegram" ? "w-full h-full flex flex-col min-h-0" : "hidden"}>
          <TelegramWorkspace />
        </div>

        {/* 2. Personal Mailbox Workspace */}
        {activeChannel === "email" && (
          <div className="w-full h-full flex flex-col min-h-0">
            <EmailWorkspace />
          </div>
        )}

        {/* 3. Tasklert Mail Dedicated Workspace */}
        {activeChannel === "tasklert_mail" && (
          <div className="w-full h-full flex flex-col min-h-0">
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
          // If on tasklert_mail channel, it will refresh the sent list
          setActiveChannel("tasklert_mail");
        }}
      />
    </div>
  );
}

