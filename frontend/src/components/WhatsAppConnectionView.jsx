import React, { useState } from "react";
import {
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Key,
  Layers,
  Sparkles,
  QrCode,
  Info,
} from "lucide-react";

export default function WhatsAppConnectionView({
  waForm,
  setWaForm,
  handleTestConnection,
  handleSaveConnection,
  testingConnection,
  savingConnection,
  testResult,
  providers,
  onSeedDemoContacts,
  seedingDemo,
  onSwitchChannel,
}) {
  const [activeTab, setActiveTab] = useState(waForm.providerType || "web_direct");
  const [showQrPreview, setShowQrPreview] = useState(true);
  const [faqOpen, setFaqOpen] = useState({
    whyNoWebQr: true,
    personalScheduled: false,
    bans: false,
  });

  const isConnected = Boolean(providers?.whatsapp?.configured && providers?.whatsapp?.isUserAccount);
  const isError = providers?.whatsapp?.status === "error";

  const cleanPhone = (waForm.personalNumber || "").replace(/[^0-9]/g, "");
  const qrCodeUrl = cleanPhone.length >= 7
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://wa.me/${cleanPhone}`)}`
    : null;

  const toggleFaq = (key) => {
    setFaqOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setWaForm((prev) => ({ ...prev, providerType: tab }));
  };

  const onSubmitConnection = (e) => {
    e.preventDefault();
    handleSaveConnection("whatsapp");
  };

  return (
    <div className="w-full h-full overflow-y-auto p-4 sm:p-6 lg:p-8 bg-purple-50/20">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ========================================================= */}
        {/* 1. HERO HEADER                                            */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-100/40 via-green-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                    WhatsApp Connection
                  </h1>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected ({providers.whatsapp.accountIdentifier})
                    </span>
                  ) : isError ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Needs Attention
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      <Key className="w-3.5 h-3.5" />
                      First-Time Setup
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Connect your regular personal WhatsApp Messenger app or WhatsApp Business Cloud API.
                </p>
              </div>
            </div>

            {/* Quick Actions & Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition inline-flex items-center gap-1.5 shadow-2xs"
                title="Open genuine official WhatsApp Web in a separate tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>Open WhatsApp Web</span>
              </a>
              <button
                type="button"
                onClick={() => onSwitchChannel?.("telegram")}
                className="px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-bold text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer"
              >
                Switch to Telegram
              </button>
              <button
                type="button"
                onClick={() => onSwitchChannel?.("email")}
                className="px-3 py-1.5 rounded-xl border border-purple-200 text-xs font-bold text-gray-600 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer"
              >
                Switch to Email
              </button>
            </div>
          </div>

          {/* Error Banner if Any */}
          {isError && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Connection Issue:</span>{" "}
                {providers?.whatsapp?.lastError || "Your WhatsApp connection has expired or requires re-authentication."}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. CONNECTION METHOD SELECTOR TABS                        */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option A: Personal WhatsApp */}
          <button
            type="button"
            onClick={() => handleTabChange("web_direct")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
              activeTab === "web_direct"
                ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                : "bg-white/70 border-purple-100 hover:bg-white hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <Smartphone className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Recommended
              </span>
            </div>
            <h3 className="font-bold text-sm text-gray-900">Personal WhatsApp</h3>
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
              Normal WhatsApp app via official Click-to-Chat. Zero ban risk, no business account required.
            </p>
          </button>

          {/* Option B: WhatsApp Cloud API */}
          <button
            type="button"
            onClick={() => handleTabChange("cloud_api")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
              activeTab === "cloud_api"
                ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                : "bg-white/70 border-purple-100 hover:bg-white hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                Automated API
              </span>
            </div>
            <h3 className="font-bold text-sm text-gray-900">Business Cloud API</h3>
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
              Official Meta Graph API v20.0 for background sending and webhook delivery status.
            </p>
          </button>

          {/* Option C: Twilio WhatsApp */}
          <button
            type="button"
            onClick={() => handleTabChange("twilio")}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
              activeTab === "twilio"
                ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                : "bg-white/70 border-purple-100 hover:bg-white hover:border-purple-200"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                <Key className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Enterprise BSP
              </span>
            </div>
            <h3 className="font-bold text-sm text-gray-900">Twilio WhatsApp</h3>
            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
              Connect via Twilio Business Solution Provider using Account SID and Auth Token.
            </p>
          </button>
        </div>

        {/* ========================================================= */}
        {/* 3. CONNECTION FORM & CONFIGURATION PANEL                  */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-sm space-y-6">
          {/* TAB 1: PERSONAL WHATSAPP (WEB DIRECT) */}
          {activeTab === "web_direct" && (
            <div className="space-y-6">
              {/* Truth & Feasibility Notice */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>How Personal WhatsApp Works in Tasklert</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Meta's personal WhatsApp Web QR code is an internal desktop browser session that Meta does not make available to third-party applications. Any third-party service claiming to scrape WhatsApp Web or automate personal accounts risks permanent phone number bans.
                </p>
                <p className="text-xs text-emerald-800 leading-relaxed font-semibold">
                  Tasklert implements Meta's official Web Direct deep linking: you compose messages and schedule future reminders inside Tasklert, then click <strong>"Open &amp; Send in WhatsApp"</strong> to dispatch directly from your genuine WhatsApp app or WhatsApp Web.
                </p>
              </div>

              {/* Form Input */}
              <form onSubmit={onSubmitConnection} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1.5">
                        Your WhatsApp Phone Number (Sender Identity) *
                      </label>
                      <input
                        type="text"
                        required
                        value={waForm.personalNumber || ""}
                        onChange={(e) => setWaForm({ ...waForm, personalNumber: e.target.value })}
                        placeholder="+14155552671 or +919876543210"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Enter your international number with country code. Used for deep-link prefilling and contact verification.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-gray-700 space-y-1.5">
                      <p className="font-bold text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Capabilities with Personal WhatsApp:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-600">
                        <li>Compose WhatsApp messages to any real phone number or saved contact.</li>
                        <li>Schedule reminders for tomorrow 7 AM, 7 days, 20 days, or custom date/time.</li>
                        <li>1-Click dispatch to official WhatsApp Web or native desktop/mobile app.</li>
                        <li>Zero risk of Meta account bans or unauthorized session hijacking.</li>
                      </ul>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={savingConnection || testingConnection}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-200 hover:bg-emerald-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {savingConnection ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Connecting...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Connect Personal WhatsApp</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={testingConnection || !waForm.personalNumber}
                        onClick={() => handleTestConnection("whatsapp")}
                        className="py-2.5 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test Number"}
                      </button>
                    </div>
                  </div>

                  {/* Real Click-to-Chat QR Demonstration */}
                  <div className="border border-purple-100 rounded-2xl p-4 bg-purple-50/30 flex flex-col items-center text-center space-y-3">
                    <div className="flex items-center justify-between w-full pb-2 border-b border-purple-100">
                      <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        Legitimate Mobile QR Test
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQrPreview((p) => !p)}
                        className="text-[10px] font-bold text-purple-700 hover:underline"
                      >
                        {showQrPreview ? "Hide" : "Show"}
                      </button>
                    </div>

                    {showQrPreview && (
                      <>
                        <div className="w-40 h-40 bg-white p-2 rounded-2xl border border-purple-100 shadow-2xs flex items-center justify-center">
                          {qrCodeUrl ? (
                            <img
                              src={qrCodeUrl}
                              alt="WhatsApp Click-to-Chat QR"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-[11px] text-gray-400 p-2">
                              Enter your phone number to generate test QR
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-gray-600 max-w-xs">
                          Scan this QR code with your phone camera to test opening your official WhatsApp chat without any third-party credentials.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: WHATSAPP BUSINESS CLOUD API */}
          {activeTab === "cloud_api" && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                  <Info className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Official Meta WhatsApp Cloud API Setup</span>
                </div>
                <p className="text-xs text-sky-800 leading-relaxed">
                  The Cloud API allows Tasklert to automatically send outbound WhatsApp messages in the background without opening the WhatsApp app. Free tier includes 1,000 service conversations per month.
                </p>
              </div>

              <form onSubmit={onSubmitConnection} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Phone Number ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={waForm.phoneNumberId || ""}
                      onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })}
                      placeholder="e.g. 104829102938472"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      WhatsApp Business Account ID
                    </label>
                    <input
                      type="text"
                      value={waForm.businessAccountId || ""}
                      onChange={(e) => setWaForm({ ...waForm, businessAccountId: e.target.value })}
                      placeholder="e.g. 102938475610293"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Meta Permanent Access Token (System User) *
                  </label>
                  <input
                    type="password"
                    required
                    value={waForm.accessToken || ""}
                    onChange={(e) => setWaForm({ ...waForm, accessToken: e.target.value })}
                    placeholder="EAAGm0PX4ZCpsBA..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Your token is encrypted server-side with AES-256-GCM and never exposed to the browser.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingConnection || testingConnection}
                    className="py-2.5 px-5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-200 hover:bg-purple-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Save &amp; Connect Cloud API</span>
                  </button>

                  <button
                    type="button"
                    disabled={testingConnection || !waForm.phoneNumberId || !waForm.accessToken}
                    onClick={() => handleTestConnection("whatsapp")}
                    className="py-2.5 px-4 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test Live API"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: TWILIO WHATSAPP */}
          {activeTab === "twilio" && (
            <div className="space-y-4">
              <form onSubmit={onSubmitConnection} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Twilio Account SID *
                    </label>
                    <input
                      type="text"
                      required
                      value={waForm.accountSid || ""}
                      onChange={(e) => setWaForm({ ...waForm, accountSid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Twilio WhatsApp Sender Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={waForm.fromNumber || ""}
                      onChange={(e) => setWaForm({ ...waForm, fromNumber: e.target.value })}
                      placeholder="+14155238886"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Twilio Auth Token *
                  </label>
                  <input
                    type="password"
                    required
                    value={waForm.authToken || ""}
                    onChange={(e) => setWaForm({ ...waForm, authToken: e.target.value })}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white font-mono"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingConnection || testingConnection}
                    className="py-2.5 px-5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-md shadow-purple-200 hover:bg-purple-700 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Save &amp; Connect Twilio</span>
                  </button>

                  <button
                    type="button"
                    disabled={testingConnection || !waForm.accountSid || !waForm.authToken}
                    onClick={() => handleTestConnection("whatsapp")}
                    className="py-2.5 px-4 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test Twilio"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Test Result Callout */}
          {testResult && testResult.channel === "whatsapp" && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 ${
                testResult.success
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                  : "bg-red-50 text-red-900 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.latencyMs && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border shrink-0">
                  {testResult.latencyMs}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 4. PREVIEW DEMO CONTACTS ALTERNATIVE                      */}
        {/* ========================================================= */}
        <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Want to test the messaging UI first?
            </h4>
            <p className="text-[11px] text-amber-800">
              Load labeled demo contacts to explore the 3-panel chat interface and composer without configuring external credentials.
            </p>
          </div>
          <button
            type="button"
            disabled={seedingDemo}
            onClick={onSeedDemoContacts}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            {seedingDemo ? "Loading Demo..." : "Load Demo Contacts (Preview)"}
          </button>
        </div>

        {/* ========================================================= */}
        {/* 5. TRANSPARENT TECHNICAL FAQ                              */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-6 border border-purple-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-purple-100">
            <HelpCircle className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-gray-900">
              Frequently Asked Questions &amp; Technical Limitations
            </h3>
          </div>

          {/* FAQ 1 */}
          <div className="border border-purple-100 rounded-2xl p-3.5 space-y-2">
            <button
              type="button"
              onClick={() => toggleFaq("whyNoWebQr")}
              className="w-full flex items-center justify-between text-left font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span>Why doesn&apos;t Tasklert show a WhatsApp Web QR code to log into my personal chats?</span>
              {faqOpen.whyNoWebQr ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {faqOpen.whyNoWebQr && (
              <p className="text-xs text-gray-600 leading-relaxed pt-1 border-t border-purple-50">
                Meta does not provide an authorized public API for personal WhatsApp Web sessions. Any software that attempts to scrape WhatsApp Web or simulate browser QR pairing violates Meta&apos;s Terms of Service and triggers automated phone number bans. Tasklert complies with official standards by using direct Click-to-Chat linking.
              </p>
            )}
          </div>

          {/* FAQ 2 */}
          <div className="border border-purple-100 rounded-2xl p-3.5 space-y-2">
            <button
              type="button"
              onClick={() => toggleFaq("personalScheduled")}
              className="w-full flex items-center justify-between text-left font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span>Can scheduled personal WhatsApp messages send automatically without opening WhatsApp?</span>
              {faqOpen.personalScheduled ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {faqOpen.personalScheduled && (
              <p className="text-xs text-gray-600 leading-relaxed pt-1 border-t border-purple-50">
                Personal WhatsApp accounts require explicit user interaction to dispatch a message. Tasklert persistently stores your scheduled reminder in MongoDB and, at the due time, provides an immediate 1-click button to open WhatsApp with the text pre-filled. To send headless background messages automatically, connect WhatsApp Business Cloud API.
              </p>
            )}
          </div>

          {/* FAQ 3 */}
          <div className="border border-purple-100 rounded-2xl p-3.5 space-y-2">
            <button
              type="button"
              onClick={() => toggleFaq("bans")}
              className="w-full flex items-center justify-between text-left font-bold text-xs text-gray-800 cursor-pointer"
            >
              <span>Will my personal WhatsApp account be at risk of getting banned?</span>
              {faqOpen.bans ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {faqOpen.bans && (
              <p className="text-xs text-gray-600 leading-relaxed pt-1 border-t border-purple-50">
                No. Tasklert uses Meta&apos;s officially supported Click-to-Chat protocol (wa.me) for personal WhatsApp communication. It does not inspect your local cookies, inject scripts into WhatsApp Web, or run unofficial headless browser bots.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
