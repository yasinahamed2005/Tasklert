import React, { useState } from "react";
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Key,
  Server,
  Lock,
  Sparkles,
} from "lucide-react";

export default function EmailOnboarding({
  onConnectGmail,
  onConnectSmtp,
  onPreviewDemo,
  connecting = false,
  connectingProvider = null,
  taskflowMail = null,
}) {
  const [showSmtpForm, setShowSmtpForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    host: "smtp.gmail.com",
    port: "465",
    user: "",
    pass: "",
    from: "",
  });
  const [smtpError, setSmtpError] = useState("");

  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    setSmtpError("");
    if (!smtpForm.host || !smtpForm.user || !smtpForm.pass) {
      setSmtpError("Please provide SMTP host, email address, and app password.");
      return;
    }

    try {
      await onConnectSmtp(smtpForm);
    } catch (err) {
      setSmtpError(
        err.response?.data?.message || err.message || "Failed to verify and connect email account."
      );
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-3 py-4 sm:p-6 lg:p-8 flex justify-center">
      <div className="w-full max-w-2xl space-y-5 my-auto">
        {/* ─── Page Title Header ─── */}
        <div className="text-center space-y-1.5 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/80 border border-purple-200 text-purple-800 text-xs font-extrabold mb-1 shadow-2xs">
            <Mail className="w-3.5 h-3.5 text-purple-600" />
            <span>Tasklert Email Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Connect your email
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 max-w-lg mx-auto font-medium leading-relaxed">
            Connect your personal email account to send, receive and manage your emails directly inside Tasklert.
          </p>
        </div>

        {/* ─── PRIMARY SECTION: PERSONAL EMAIL CONNECTION ─── */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-purple-200/90 shadow-md space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-100/40 via-indigo-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />

          {/* Section badge */}
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <div>
              <span className="text-[11px] font-black text-purple-700 uppercase tracking-wider">
                Primary Account Connection
              </span>
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight mt-0.5">
                Personal Email
              </h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
              Recommended
            </span>
          </div>

          {/* Option A: Connect Gmail (Most Prominent) */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/20 hover:border-purple-400 transition-all shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {/* Official Google G Icon */}
                <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>

                <div>
                  <h3 className="text-sm font-black text-gray-900 tracking-tight">
                    Google / Personal Gmail
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Connect securely via official Google OAuth authorization.
                  </p>
                </div>
              </div>

              {/* Primary Connect Gmail Button — High contrast, vibrant purple */}
              <button
                type="button"
                onClick={onConnectGmail}
                disabled={connecting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md shadow-purple-300/40 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {connecting && connectingProvider === "gmail" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting Google...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Connect Gmail</span>
                  </>
                )}
              </button>
            </div>

            {/* Google Security Guarantee Note */}
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 flex items-start gap-2.5 text-xs text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Bank-Grade Multi-User Isolation:</strong> Tasklert never sees or stores your personal Google password. Tokens are encrypted server-side with AES-256-GCM.
              </div>
            </div>
          </div>

          {/* Option B: App Password / Custom SMTP / IMAP */}
          <div className="rounded-2xl border border-purple-100 bg-white hover:border-purple-200 transition p-4">
            <button
              type="button"
              onClick={() => setShowSmtpForm((p) => !p)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Connect with App Password (IMAP / SMTP)
                  </h4>
                  <p className="text-[11px] text-gray-500">
                    Yahoo, custom domain, college email, or Google 16-character App Password.
                  </p>
                </div>
              </div>

              <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition">
                <span>{showSmtpForm ? "Hide" : "Setup"}</span>
                {showSmtpForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>

            {showSmtpForm && (
              <form onSubmit={handleSmtpSubmit} className="mt-4 pt-4 border-t border-purple-100 space-y-3">
                {smtpError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{smtpError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Your Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      App Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={smtpForm.pass}
                        onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                        placeholder="16-character Google App Password or SMTP password"
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500 bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      SMTP Server Host
                    </label>
                    <input
                      type="text"
                      value={smtpForm.host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      value={smtpForm.port}
                      onChange={(e) => setSmtpForm({ ...smtpForm, port: e.target.value })}
                      placeholder="465"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400/30 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={connecting}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connecting && connectingProvider === "smtp" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Credentials...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify &amp; Connect Personal Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ─── SECONDARY SECTION: TASKFLOW MAIL IDENTITY ─── */}
        <div className="bg-white/80 rounded-3xl p-5 border border-purple-100 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                Additional Sending Identity
              </span>
              <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-1.5 mt-0.5">
                <span>TaskFlow Mail</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                  Optional
                </span>
              </h3>
            </div>

            {taskflowMail?.isConfigured ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ready as Gateway</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold">
                <span>Not Verified</span>
              </span>
            )}
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            TaskFlow Mail (<code className="font-mono text-purple-700 bg-purple-50 px-1 py-0.5 rounded">mailer@taskflow.in</code>) is an optional company/application sender identity. It does not replace your personal mailbox. Once your personal email is connected, you can optionally select TaskFlow Mail as an alternate sender when composing.
          </p>

          <div className="p-3 rounded-2xl bg-purple-50/50 border border-purple-100 text-[11px] text-purple-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <strong>Why connect personal email first?</strong> Connecting your personal Gmail gives you full access to your genuine inbox, your personal sent messages, and direct replies from friends and colleagues.
            </div>
          </div>
        </div>

        {/* ─── Preview Workspace Shortcut ─── */}
        {onPreviewDemo && (
          <div className="text-center pt-1 pb-4">
            <button
              type="button"
              onClick={onPreviewDemo}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>Explore Workspace Preview</span>
              <span className="text-purple-400">→</span>
            </button>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">
              You can test the 3-column email layout before connecting your personal account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
