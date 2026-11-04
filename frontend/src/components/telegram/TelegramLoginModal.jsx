import React, { useState, useEffect } from "react";
import {
  Send,
  Lock,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  sendTelegramCode,
  verifyTelegramCode,
  verifyTelegramPassword,
  cancelTelegramAuth,
} from "../../services/telegramApi";

export default function TelegramLoginModal({
  isOpen,
  onClose,
  onSuccess,
  isConfiguredOnServer = true,
  initialStep = "phone",
  initialPhoneNumber = "",
}) {
  const [step, setStep] = useState(initialStep); // "phone" | "code" | "password"
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("Telegram App");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep || "phone");
      setError("");
      setCode("");
      setPassword("");
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  // Step 1: Request Code
  const handleSendCode = async (e) => {
    e?.preventDefault();
    setError("");

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      setError("Please enter a valid phone number with country code (e.g. +919876543210 or +14155552671).");
      return;
    }

    if (!cleanPhone.startsWith("+")) {
      setError(`Please include your country code with a leading '+' (for example: +91${cleanPhone.replace(/\D/g, "")}).`);
      return;
    }

    setLoading(true);
    try {
      const res = await sendTelegramCode(cleanPhone);
      setDeliveryMethod(res.isCodeViaApp ? "Telegram App on another device" : "SMS");
      setStep("code");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Failed to send verification code. Please check your phone number."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Code
  const handleVerifyCode = async (e) => {
    e?.preventDefault();
    setError("");

    const cleanCode = code.trim().replace(/\s+/g, "");
    if (!cleanCode) {
      setError("Please enter the verification code sent by Telegram.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyTelegramCode(cleanCode);
      if (res.status === "waiting_for_password") {
        setPasswordHint(res.hint || "");
        setStep("password");
      } else if (res.status === "connected") {
        onSuccess(res.profile);
        onClose();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Invalid or expired verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify 2FA Password
  const handleVerifyPassword = async (e) => {
    e?.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your Telegram two-step verification password.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyTelegramPassword(password);
      if (res.status === "connected") {
        onSuccess(res.profile);
        onClose();
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Incorrect two-step verification password."
      );
    } finally {
      setLoading(false);
    }
  };

  // Cancel & Close
  const handleCancel = async () => {
    try {
      await cancelTelegramAuth();
    } catch (_) {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-md overflow-hidden transition-all duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-modal-title"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-purple-50/80 via-white to-blue-50/50 border-b border-purple-100/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Send className="w-6 h-6 -ml-0.5 mt-0.5 fill-white" />
              </div>
              <div>
                <h3
                  id="telegram-modal-title"
                  className="text-lg font-bold text-gray-900 tracking-tight"
                >
                  Connect Telegram
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Direct personal MTProto integration
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step === "phone"
                  ? "bg-purple-600"
                  : "bg-purple-300"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step === "code"
                  ? "bg-purple-600"
                  : step === "password"
                  ? "bg-purple-300"
                  : "bg-gray-200"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step === "password" ? "bg-purple-600" : "bg-gray-200"
              }`}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Server Unconfigured Warning */}
          {!isConfiguredOnServer && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Backend configuration note:</strong>
                <p className="mt-0.5 text-amber-700">
                  Ensure <code className="bg-amber-100 px-1 py-0.5 rounded">TELEGRAM_API_ID</code> and{" "}
                  <code className="bg-amber-100 px-1 py-0.5 rounded">TELEGRAM_API_HASH</code> are defined in your Railway / server environment.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* STEP 1: ENTER PHONE NUMBER */}
          {step === "phone" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Telegram Phone Number
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+14155552671 or +919876543210"
                    disabled={loading}
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-purple-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition shadow-2xs"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Include your country code with a leading <code className="bg-purple-50 text-purple-700 font-semibold px-1 rounded">+</code>. Telegram will send your login code to this number.
                </p>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100/70 text-xs text-purple-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Multi-User Isolation:</strong> Your personal session is encrypted with AES-256-GCM. Tasklert never shares accounts between users.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || !phoneNumber.trim()}
                  className="telegram-connect-cta px-5 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Send Login Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER VERIFICATION CODE */}
          {step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center py-1">
                <div className="text-xs font-semibold text-gray-700">
                  Verification code sent to:
                </div>
                <div className="text-sm font-bold text-purple-700 font-mono mt-0.5">
                  {phoneNumber}
                </div>
                <div className="inline-block mt-2 px-3 py-1 bg-sky-50 text-sky-700 border border-sky-100 rounded-full text-[11px] font-semibold">
                  Delivered via: {deliveryMethod}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 text-center">
                  Enter 5-digit Login Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  disabled={loading}
                  autoFocus
                  maxLength={10}
                  required
                  className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-3 rounded-2xl border border-purple-200 bg-white text-gray-900 placeholder:text-gray-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition shadow-2xs"
                />
                <p className="text-[11px] text-gray-500 text-center mt-1.5">
                  Check your Telegram app on your phone or desktop.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setError("");
                  }}
                  disabled={loading}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Change number
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={loading}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="telegram-connect-cta px-5 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Connect
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: TWO-STEP VERIFICATION (2FA) */}
          {step === "password" && (
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="text-center py-1">
                <div className="w-10 h-10 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="text-sm font-bold text-gray-900">
                  Two-Step Verification Enabled
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your Telegram account is protected with a cloud password.
                </p>
                {passwordHint && (
                  <div className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-xl inline-block">
                    Hint: <span className="font-semibold">{passwordHint}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Telegram Cloud Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your 2FA password"
                    disabled={loading}
                    autoFocus
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-purple-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Note: Tasklert never permanently stores your two-step verification password.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="telegram-connect-cta px-5 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Complete Login
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
