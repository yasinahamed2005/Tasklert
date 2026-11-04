import React, { useState } from "react";
import {
  Send,
  Mail,
  Copy,
  Clock,
  BarChart2,
  Settings,
  ArrowDownRight,
} from "lucide-react";
import TelegramWorkspace from "../components/telegram/TelegramWorkspace";
import EmailWorkspace from "../components/email/EmailWorkspace";

/**
 * QuickSend Workspace — Exactly as designed in the TaskFlow reference layout:
 * - Active Channels: Telegram and TaskFlow Email (WhatsApp is preserved on the backend but hidden from visible selector)
 * - Header with QuickSend branding, "Workspace" pill badge, and productivity shortcuts (Message Templates, Scheduled Messages, Activity, Settings)
 * - Seamless channel switching without resetting connection states
 */
export default function MessageCenter() {
  const [activeChannel, setActiveChannel] = useState("email"); // Default to Email workspace
  const [activeTabNotice, setActiveTabNotice] = useState(null);

  const handleShortcutClick = (label) => {
    setActiveTabNotice(`${label} workspace section is active.`);
    setTimeout(() => setActiveTabNotice(null), 3500);
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

      {/* ─── Channel Switcher Tabs ─── */}
      <div className="shrink-0 flex items-center justify-between gap-2 mb-2 sm:mb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveChannel("telegram")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              activeChannel === "telegram"
                ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/20"
                : "border-purple-200/70 bg-white/80 text-gray-700 hover:text-purple-700 hover:bg-purple-50/50"
            }`}
          >
            <Send className={`w-3.5 h-3.5 ${activeChannel === "telegram" ? "fill-white text-white" : "text-purple-600"}`} />
            <span>Telegram</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel("email")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              activeChannel === "email"
                ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/20"
                : "border-purple-200/70 bg-white/80 text-gray-700 hover:text-purple-700 hover:bg-purple-50/50"
            }`}
          >
            <Mail className={`w-3.5 h-3.5 ${activeChannel === "email" ? "text-white" : "text-purple-600"}`} />
            <span>Email</span>
          </button>
        </div>

        {activeTabNotice && (
          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100 animate-fade-in hidden sm:inline-block">
            {activeTabNotice}
          </span>
        )}
      </div>

      {/* ─── Main Communication Workspaces ─── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Telegram workspace kept mounted in DOM to prevent re-initializing GramJS MTProto session */}
        <div className={activeChannel === "telegram" ? "w-full h-full flex flex-col min-h-0" : "hidden"}>
          <TelegramWorkspace />
        </div>

        {/* TaskFlow Mail Workspace */}
        {activeChannel === "email" && (
          <div className="w-full h-full flex flex-col min-h-0">
            <EmailWorkspace />
          </div>
        )}
      </div>
    </div>
  );
}
