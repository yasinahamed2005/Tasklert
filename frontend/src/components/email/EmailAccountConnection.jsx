import React, { useState } from "react";
import {
  Mail,
  Chrome,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  LogOut,
  Settings,
  Info,
} from "lucide-react";

export default function EmailAccountConnection({
  accounts = [],
  onConnectGmail,
  onConnectOutlook,
  onConnectSmtp,
  onDisconnect,
  onRefresh,
  loading = false,
  connecting = false,
  connectingProvider = null,
}) {
  const [smtpForm, setSmtpForm] = useState({
    host: "",
    port: "587",
    user: "",
    pass: "",
    from: "",
    imapHost: "",
    imapPort: "993",
  });
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showSmtp, setShowSmtp] = useState(false);
  const [smtpError, setSmtpError] = useState("");

  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    setSmtpError("");
    if (!smtpForm.host || !smtpForm.user || !smtpForm.pass) {
      setSmtpError("SMTP host, username and password are required.");
      return;
    }
    try {
      await onConnectSmtp(smtpForm);
    } catch (err) {
      setSmtpError(err.message || "Failed to connect SMTP account.");
    }
  };

  const hasConnectedAccount = accounts.some((a) => a.status === "connected");

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ─── Header ─── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-blue-100/30 via-purple-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-md shrink-0">
                <Mail className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    Email Account
                  </h1>
                  {hasConnectedAccount ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Not Connected
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Connect your real email account to send, receive and manage mail inside Tasklert.
                </p>
              </div>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                title="Refresh connection status"
                className="p-2 rounded-xl text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {/* Security note */}
          <div className="mt-5 p-3 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-purple-900 leading-relaxed">
              <strong>Your privacy is protected.</strong> OAuth tokens and SMTP passwords are encrypted with AES-256-GCM before database storage. Tasklert never stores your email password in plain text and never shares your mailbox with other users.
            </p>
          </div>
        </div>

        {/* ─── Connected Accounts List ─── */}
        {accounts.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Connected Mailboxes</h2>
            {accounts.map((account) => (
              <div
                key={account._id || account.email}
                className="flex items-center justify-between p-3 rounded-2xl border border-purple-100 bg-purple-50/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 text-xs font-bold ${
                    account.provider === "gmail" ? "bg-red-500" :
                    account.provider === "outlook" ? "bg-blue-600" : "bg-gray-500"
                  }`}>
                    {account.provider === "gmail" ? "G" : account.provider === "outlook" ? "M" : "✉"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">{account.email || account.accountIdentifier}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        account.status === "connected"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {account.status === "connected" ? "Active" : account.status}
                      </span>
                      {account.lastSyncAt && (
                        <span className="text-[10px] text-gray-400">
                          Synced {new Date(account.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDisconnect?.(account._id)}
                  className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── Connection Options ─── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-800 mb-5">Connect a New Account</h2>

          {/* Gmail OAuth */}
          <div className="p-4 rounded-2xl border border-gray-200 hover:border-red-300 hover:bg-red-50/30 transition group">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <span className="text-red-600 font-black text-sm">G</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Gmail</div>
                  <div className="text-[11px] text-gray-500">Google OAuth 2.0 · Gmail API · Full inbox access</div>
                </div>
              </div>
              <button
                onClick={onConnectGmail}
                disabled={connecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                {connectingProvider === "gmail" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                Connect Gmail
              </button>
            </div>
          </div>

          {/* Outlook OAuth */}
          <div className="p-4 rounded-2xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition group">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-black text-sm">M</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Outlook / Microsoft 365</div>
                  <div className="text-[11px] text-gray-500">Microsoft OAuth 2.0 · Graph API · Full inbox access</div>
                </div>
              </div>
              <button
                onClick={onConnectOutlook}
                disabled={connecting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                {connectingProvider === "outlook" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                Connect Outlook
              </button>
            </div>
          </div>

          {/* SMTP / IMAP */}
          <div className="p-4 rounded-2xl border border-gray-200 hover:border-purple-300 transition">
            <button
              type="button"
              onClick={() => setShowSmtp((p) => !p)}
              className="w-full flex items-center justify-between gap-4 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4 text-purple-700" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-900">Other Provider (IMAP / SMTP)</div>
                  <div className="text-[11px] text-gray-500">Yahoo, ProtonMail, custom domain — any IMAP/SMTP provider</div>
                </div>
              </div>
              <span className="text-xs font-bold text-purple-700 shrink-0">
                {showSmtp ? "Hide" : "Configure"}
              </span>
            </button>

            {showSmtp && (
              <form onSubmit={handleSmtpSubmit} className="mt-4 space-y-3 pt-4 border-t border-purple-100">
                {smtpError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {smtpError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">SMTP Host *</label>
                    <input
                      type="text"
                      value={smtpForm.host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={smtpForm.port}
                      onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                      placeholder="587"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">IMAP Host</label>
                    <input
                      type="text"
                      value={smtpForm.imapHost}
                      onChange={(e) => setSmtpForm({ ...smtpForm, imapHost: e.target.value })}
                      placeholder="imap.gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">IMAP Port</label>
                    <input
                      type="number"
                      value={smtpForm.imapPort}
                      onChange={(e) => setSmtpForm({ ...smtpForm, imapPort: e.target.value })}
                      placeholder="993"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Email Address / Username *</label>
                    <input
                      type="email"
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">App Password *</label>
                    <div className="relative">
                      <input
                        type={showSmtpPass ? "text" : "password"}
                        value={smtpForm.pass}
                        onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                        placeholder="Use an App Password — not your main password"
                        className="w-full px-3 py-2 pr-10 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Encrypted with AES-256-GCM before storage. Never exposed to the browser.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={connecting}
                  className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {connectingProvider === "smtp" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing & Connecting...</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Connect SMTP Account</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ─── Important notice ─── */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong>Phase 2 Requirement:</strong> Gmail and Outlook OAuth requires configuring{" "}
            <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>,{" "}
            <code className="bg-amber-100 px-1 rounded">MICROSOFT_CLIENT_ID</code> and{" "}
            <code className="bg-amber-100 px-1 rounded">MICROSOFT_CLIENT_SECRET</code> in your Railway backend environment variables. SMTP/IMAP works immediately.
          </div>
        </div>
      </div>
    </div>
  );
}

