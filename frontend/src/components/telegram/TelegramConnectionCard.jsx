import React from "react";
import {
  Send,
  Shield,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function TelegramConnectionCard({ onConnect, isConfiguredOnServer = true }) {
  return (
    <div className="bg-white rounded-3xl border border-purple-100 shadow-xl overflow-hidden p-6 md:p-10 max-w-4xl mx-auto my-6 animate-page-enter">
      {/* Top Banner */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-xs font-bold text-purple-700 mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>QuickSend Telegram-First Integration</span>
        </div>

        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-sky-500 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-500/25 transition-transform duration-300 hover:scale-105">
            <Send className="w-10 h-10 -ml-1 mt-1 fill-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1.5 border-2 border-white shadow-sm" title="Ready to connect">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
          Connect Your Telegram Account
        </h2>
        <p className="text-sm md:text-base text-gray-600 mt-2.5 leading-relaxed font-normal">
          Link your personal Telegram account to manage real conversations, broadcast updates, and schedule time-sensitive messages directly inside your Tasklert workspace.
        </p>

        {/* CTA Button */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onConnect}
            className="telegram-connect-cta w-full sm:w-auto px-7 py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4 fill-white -ml-0.5" />
            Connect Telegram
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Status: <strong>Not Connected</strong></span>
        </div>
        {!isConfiguredOnServer && (
          <p className="mt-2 text-xs text-amber-700">
            Telegram connection is temporarily unavailable because the server is not configured.
          </p>
        )}
      </div>

      {/* Feature Pillars */}
      <div className="mt-12 pt-8 border-t border-purple-100/70 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/60 to-white border border-purple-100/80 hover:border-purple-200 transition shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3.5">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Genuine MTProto Protocol</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Direct personal account connection using Telegram's MTProto protocol. No bot limitations or external webhooks required.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-white border border-indigo-100/80 hover:border-indigo-200 transition shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3.5">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Public Multi-User Isolation</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Every Tasklert user has an isolated session encrypted with AES-256-GCM. Your chats and credentials are never shared.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/60 to-white border border-blue-100/80 hover:border-blue-200 transition shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3.5">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Persistent Scheduling</h3>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Schedule messages with exact timestamps. Tasklert background workers dispatch automatically even if your browser is closed.
          </p>
        </div>
      </div>
    </div>
  );
}
