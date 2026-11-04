import React from "react";
import {
  Inbox,
  Star,
  AlertCircle,
  Send,
  FileText,
  Clock,
  Copy,
  Trash2,
  Plus,
  Edit3,
  CheckCircle,
  ChevronDown,
  Mail,
  Info,
} from "lucide-react";

const SYSTEM_FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: Inbox, badgeKey: "INBOX" },
  { id: "STARRED", label: "Starred", icon: Star, badgeKey: "STARRED" },
  { id: "SNOOZED", label: "Snoozed", icon: Clock },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "DRAFTS", label: "Drafts", icon: FileText, badgeKey: "DRAFTS" },
  { id: "IMPORTANT", label: "Important", icon: AlertCircle },
  { id: "TRASH", label: "Trash", icon: Trash2 },
  { id: "SPAM", label: "Spam", icon: AlertCircle },
];

const DEFAULT_LABELS = [
  { id: "College", label: "College", color: "bg-purple-500" },
  { id: "Placement", label: "Placement", color: "bg-blue-500" },
  { id: "Projects", label: "Projects", color: "bg-emerald-500" },
  { id: "Personal", label: "Personal", color: "bg-pink-500" },
];

export default function EmailSidebar({
  selectedFolder,
  onSelectFolder,
  selectedLabel,
  onSelectLabel,
  onCompose,
  unreadCounts = {},
  labelCounts = {},
  accountInfo,
  personalAccount = null,
  isConnected = false,
  onOpenOnboarding,
  onOpenAccountModal,
  collapsed = false,
}) {
  return (
    <div className="w-full h-full flex flex-col justify-between p-3 bg-white rounded-3xl border border-purple-100/90 shadow-2xs overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2.5">
        {/* ─── Account Card (Personal Email First) ─── */}
        {isConnected && personalAccount ? (
          <div
            onClick={onOpenAccountModal}
            className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-50/70 via-white to-purple-50/40 border border-purple-200/90 hover:border-purple-300 transition cursor-pointer group shadow-2xs shrink-0"
            title="Click to view email account details"
          >
            <div className="flex items-center gap-2.5">
              {/* Google G Logo if provider is gmail */}
              {personalAccount.provider === "gmail" ? (
                <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-2xs p-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  {personalAccount.displayName ? personalAccount.displayName.slice(0, 2).toUpperCase() : "EM"}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-900 truncate block">
                  {personalAccount.email}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected</span>
                  <ChevronDown className="w-2.5 h-2.5 text-gray-400 ml-0.5" />
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={onOpenOnboarding || onOpenAccountModal}
            className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-indigo-50/30 border-2 border-purple-200 hover:border-purple-400 transition cursor-pointer group shadow-2xs shrink-0"
            title="Click to connect your personal Gmail or email account"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-purple-600" />
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-xs font-black text-purple-900 tracking-tight block truncate">
                  Connect Personal Email
                </span>
                <p className="text-[10px] text-gray-500 font-medium truncate">
                  Gmail / IMAP / SMTP
                </p>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold shrink-0 shadow-2xs group-hover:bg-purple-700 transition">
                Connect
              </span>
            </div>
          </div>
        )}

        {/* ─── Primary Prominent Purple Compose Button ─── */}
        <button
          type="button"
          onClick={onCompose}
          style={{ backgroundColor: "#7c3aed" }}
          className="w-full py-2.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs shadow-md shadow-purple-500/25 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-purple-600 shrink-0"
          title="Compose New Email"
        >
          <Edit3 className="w-4 h-4 text-white stroke-2" />
          <span className="text-white font-extrabold text-xs tracking-wide">Compose</span>
        </button>

        {/* ─── Scrollable Navigation Folders & Labels ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 no-scrollbar pr-0.5 tg-custom-scrollbar">
          {SYSTEM_FOLDERS.map(({ id, label, icon: Icon, badgeKey }) => {
            const isActive = !selectedLabel && selectedFolder === id;
            const badgeCount = badgeKey ? unreadCounts[badgeKey] || 0 : 0;

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelectLabel(null);
                  onSelectFolder(id);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-purple-100/80 text-purple-900 shadow-2xs"
                    : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-purple-700" : "text-gray-400"}`} />
                  <span>{label}</span>
                </div>

                {badgeCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isActive ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}

          {/* ─── Labels Section (Real Gmail user labels e.g. Purchases, College) ─── */}
          <div className="pt-2">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Labels
              </span>
              <button
                type="button"
                className="p-0.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded transition cursor-pointer"
                title="Create new label"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              {(accountInfo?.userLabels && accountInfo.userLabels.length > 0
                ? accountInfo.userLabels
                : DEFAULT_LABELS
              ).map((lbl) => {
                const labelId = lbl.id || lbl.name || lbl.label;
                const labelName = lbl.name || lbl.label || lbl.id;
                const isActive = selectedLabel === labelId;
                const count = lbl.total || lbl.unread || labelCounts[labelId] || 0;

                return (
                  <button
                    key={labelId}
                    type="button"
                    onClick={() => onSelectLabel(isActive ? null : labelId)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-purple-100/70 text-purple-900"
                        : "text-gray-600 hover:text-purple-700 hover:bg-purple-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${lbl.color || "bg-purple-500"}`} />
                      <span>{labelName}</span>
                    </div>

                    {count > 0 && (
                      <span className="text-[11px] font-semibold text-gray-400">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom TaskFlow Mail Delivery Info Card ─── */}
      <div
        onClick={onOpenAccountModal}
        className="mt-2.5 p-2.5 rounded-2xl bg-purple-50/70 border border-purple-100/90 hover:border-purple-200 transition cursor-pointer space-y-0.5 shrink-0"
        title="View TaskFlow Mail Identity & Domain Setup Details"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Mail className="w-3 h-3 fill-white/20" />
            </div>
            <span className="text-[11px] font-bold text-purple-900">TaskFlow Mail</span>
          </div>
          <Info className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        </div>
        <p className="text-[10px] text-purple-800/80 leading-snug truncate">
          Sender: <strong>{accountInfo?.identity || "mailer@taskflow.in"}</strong>
        </p>
      </div>
    </div>
  );
}
