import React, { useState } from "react";
import {
  X,
  Mail,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Server,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Globe,
  Loader2,
  Info,
} from "lucide-react";
import { connectSmtpAccount } from "../../services/emailApi";
import { toast } from "react-toastify";

export default function EmailAccountModal({
  isOpen,
  onClose,
  accountInfo,
  onRefresh,
}) {
  const [showConfig, setShowConfig] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    host: "smtp.gmail.com",
    port: 465,
    user: "taskflow.iya@gmail.com",
    pass: "",
    from: "TaskFlow Mail <mailer@taskflow.in>",
  });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await connectSmtpAccount(smtpForm);
      toast.success("Mail service configuration updated and verified!");
      onRefresh?.();
      setShowConfig(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to connect mail service.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshClick = async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
      toast.info("Connection status refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-5 bg-gradient-to-br from-purple-50/90 via-white to-blue-50/50 border-b border-purple-100/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
              <Mail className="w-6 h-6 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-gray-900 tracking-tight">
                  TaskFlow Mail
                </h3>
                <CheckCircle className="w-4 h-4 fill-blue-500 text-white" />
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {accountInfo?.identity || "mailer@taskflow.in"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Status Overview Card */}
          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">Connection Status:</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Gateway
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Proposed Sender Identity:</span>
              <span className="font-bold text-purple-900 font-mono">
                {accountInfo?.identity || "mailer@taskflow.in"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Active Dispatch Gateway:</span>
              <span className="font-bold text-gray-800 font-mono">
                {accountInfo?.activeSender || "taskflow.iya@gmail.com"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Last Synchronized:</span>
              <span className="font-medium text-gray-700">
                {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (Live)
              </span>
            </div>
          </div>

          {/* Normal Internet Email Explanation Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Real Internet Email Delivery</span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              Emails sent through <strong>TaskFlow Mail</strong> are authentic internet emails delivered directly to any mailbox (Gmail, Yahoo, Outlook, college or company domains).
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              <strong>Your recipients do NOT need Tasklert</strong> or any special app — they receive normal emails and can reply from their standard email application.
            </p>
          </div>

          {/* Domain & DNS Setup Card */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <Globe className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Domain Verification &amp; DNS Checklist (`taskflow.in`)</span>
            </div>

            <p className="text-[11px] text-amber-900 leading-relaxed">
              `mailer@taskflow.in` is configured as your primary branded identity. To guarantee 100% inbox deliverability directly under the `taskflow.in` domain, add the following DNS records to your domain provider:
            </p>

            <div className="space-y-1.5 text-[11px] font-mono bg-white/80 p-2.5 rounded-xl border border-amber-200/70 text-gray-800">
              <div><strong className="text-purple-700 font-sans">SPF:</strong> v=spf1 include:_spf.google.com ~all</div>
              <div><strong className="text-purple-700 font-sans">DKIM:</strong> 2048-bit TXT record on taskflow.in</div>
              <div><strong className="text-purple-700 font-sans">DMARC:</strong> v=DMARC1; p=quarantine; rua=mailto:dmarc@taskflow.in</div>
              <div><strong className="text-purple-700 font-sans">MX:</strong> Inbound MX records configured for mailer@taskflow.in</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={refreshing}
              className="flex-1 py-2 px-3 rounded-xl border border-purple-200 text-xs font-bold text-purple-700 hover:bg-purple-50 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh Status</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfig((p) => !p)}
              className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Server className="w-3.5 h-3.5" />
              <span>{showConfig ? "Hide Settings" : "Configure Mail Service"}</span>
            </button>
          </div>

          {/* Optional Custom SMTP Form */}
          {showConfig && (
            <form onSubmit={handleSaveSmtp} className="p-4 rounded-2xl bg-white border border-purple-200 space-y-3 pt-4">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-600" />
                <span>Custom SMTP / Email Gateway Settings</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Username / User Email</label>
                  <input
                    type="text"
                    value={smtpForm.user}
                    onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">App Password</label>
                  <input
                    type="password"
                    placeholder="Enter Google App Password or SMTP password"
                    value={smtpForm.pass}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400/30 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

