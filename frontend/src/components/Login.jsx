import React, { useEffect, useState, useRef } from "react";
import { LogIn, Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { notify } from "../utils/toastManager";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SocialAuthButtons from "./SocialAuthButtons";
import { TasklertIcon } from "./TasklertLogo";
import { useModalAccessibility } from "../utils/scrollLock";
import { API_BASE_URL } from "../config/api";

const INITIAL_FORM = { email: "", password: "" };

const Login = ({ onSubmit, onSwitchMode, showSwitchLink = true }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot Password Modal States
  const forgotModalRef = useRef(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  useModalAccessibility({
    isOpen: showForgotModal,
    onClose: () => setShowForgotModal(false),
    modalRef: forgotModalRef,
  });
  const [forgotStep, setForgotStep] = useState(1); // 1: request OTP, 2: verify OTP & new password
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ text: "", type: "" });

  const navigate = useNavigate();
  const url = API_BASE_URL;

  // Handle OAuth callback parameters (via secure single-use auth code or legacy token fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthCode = params.get("oauth_code");
    const oauthSuccess = params.get("oauth_success");
    const token = params.get("token");
    const userId = params.get("userId");
    const name = params.get("name");
    const email = params.get("email");
    const avatar = params.get("avatar");
    const provider = params.get("provider") || "Social";
    const error = params.get("error");

    if (error) {
      notify.error(decodeURIComponent(error));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Modern secure flow: exchange single-use authorization code
    if (oauthCode) {
      // Clear URL query parameters immediately to prevent reuse / history leakage
      window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(true);

      (async () => {
        try {
          const { data } = await axios.post(`${url}/api/auth/exchange`, { code: oauthCode });
          if (data.success && data.token) {
            localStorage.setItem("token", data.token);
            if (data.user?.id) localStorage.setItem("userId", data.user.id);

            onSubmit?.({ token: data.token, userId: data.user.id, ...data.user });
            const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
            notify.success(`Welcome, ${data.user?.name || "User"}! Successfully signed in via ${providerLabel}.`, { toastId: "oauth-welcome" });
            navigate("/", { replace: true });
          } else {
            notify.error(data.message || "Failed to finalize authentication.");
          }
        } catch (err) {
          console.error("OAuth code exchange error:", err);
          notify.error(err.response?.data?.message || "Failed to exchange authorization code.");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    // Legacy fallback
    if (oauthSuccess === "true" && token) {
      localStorage.setItem("token", token);
      if (userId) localStorage.setItem("userId", userId);

      const userObj = {
        id: userId,
        name: name || "User",
        email: email || "",
        avatar:
          avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=8B2CF5&color=fff`,
      };

      onSubmit?.({ token, userId, ...userObj });
      const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
      notify.success(`Welcome, ${name || "User"}! Successfully signed in via ${providerLabel}.`, { toastId: "oauth-welcome" });

      window.history.replaceState({}, document.title, "/");
      navigate("/", { replace: true });
      return;
    }

    // Restore regular session silently if token already in localStorage
    const savedToken = localStorage.getItem("token");
    const savedUserId = localStorage.getItem("userId");
    if (savedToken) {
      (async () => {
        try {
          const { data } = await axios.get(`${url}/api/user/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          if (data.success) {
            onSubmit?.({ token: savedToken, userId: savedUserId, ...data.user });
            navigate("/", { replace: true });
          } else {
            localStorage.clear();
          }
        } catch {
          localStorage.clear();
        }
      })();
    }
  }, [navigate, onSubmit, url]);

  // Handle Login Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${url}/api/user/login`, formData);
      if (!data.token) throw new Error(data.message || "Login failed");

      const userId = data.user?.id || "";

      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", userId);

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
      }

      setFormData(INITIAL_FORM);
      onSubmit?.({ token: data.token, userId, ...data.user });

      notify.success(`Welcome back, ${data.user?.name || "User"}!`, { toastId: "login-welcome" });
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Login failed";
      notify.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Request Password Reset OTP
  const handleRequestForgotOtp = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage({ text: "", type: "" });
    try {
      const { data } = await axios.post(`${url}/api/user/forgot-password/request-otp`, {
        email: forgotEmail,
      });
      setForgotStep(2);
      setForgotMessage({
        text: data.message || `Password reset code sent to ${forgotEmail}.`,
        type: "success",
      });
    } catch (err) {
      setForgotMessage({
        text: err.response?.data?.message || "Failed to send reset code. Please check your email address.",
        type: "error",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  // Reset Password with OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage({ text: "", type: "" });
    try {
      const { data } = await axios.post(`${url}/api/user/forgot-password/reset`, {
        email: forgotEmail,
        otp: forgotOtp,
        newPassword,
      });
      notify.success(data.message || "Password reset successfully!");
      setShowForgotModal(false);
      setForgotStep(1);
      setForgotEmail("");
      setForgotOtp("");
      setNewPassword("");
    } catch (err) {
      setForgotMessage({
        text: err.response?.data?.message || "Password reset failed. Please check the code and try again.",
        type: "error",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSwitchMode = () => {
    notify.dismiss();
    onSwitchMode?.();
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-[#34445F] bg-[#111A2E] p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B2CF5] to-[#D946EF] shadow-lg shadow-[#8B2CF5]/30">
          <TasklertIcon size={32} idPrefix="login-card" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#F8FAFC]">Welcome back</h2>
        <p className="mt-1 text-xs text-[#AAB8CF]">
          Sign in to your Tasklert workspace to manage tasks &amp; reminders
        </p>
      </div>

      {/* Social Logins */}
      <SocialAuthButtons />


      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#AAB8CF]">Email Address</label>
          <div className="group relative flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3.5 py-2.5 transition-all focus-within:border-[#8B2CF5] focus-within:ring-2 focus-within:ring-[#8B2CF5]/25 hover:border-[#34445F]/90">
            <Mail className="h-4 w-4 text-[#AAB8CF] group-focus-within:text-[#8B2CF5]" />
            <input
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="ml-2.5 w-full bg-transparent text-sm text-[#F8FAFC] placeholder-[#AAB8CF]/60 focus:outline-none"
              required
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold text-[#AAB8CF]">Password</label>
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotMessage({ text: "", type: "" });
              }}
              className="text-xs font-medium text-[#8B2CF5] hover:text-[#D946EF] hover:underline transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          <div className="group relative flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3.5 py-2.5 transition-all focus-within:border-[#8B2CF5] focus-within:ring-2 focus-within:ring-[#8B2CF5]/25 hover:border-[#34445F]/90">
            <Lock className="h-4 w-4 text-[#AAB8CF] group-focus-within:text-[#8B2CF5]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="ml-2.5 w-full bg-transparent text-sm text-[#F8FAFC] placeholder-[#AAB8CF]/60 focus:outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="ml-2 text-[#AAB8CF] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="rememberMe"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[#34445F] bg-[#19243A] accent-[#8B2CF5] text-[#8B2CF5] focus:ring-[#8B2CF5]/40 cursor-pointer"
          />
          <label htmlFor="rememberMe" className="ml-2 text-xs font-medium text-[#AAB8CF] cursor-pointer select-none">
            Remember me on this device
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-4 py-3 text-sm font-semibold text-[#F8FAFC] shadow-lg shadow-[#8B2CF5]/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Logging in...
            </span>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Sign In to Tasklert
            </>
          )}
        </button>
      </form>

      {/* Switch to SignUp */}
      {showSwitchLink && (
        <p className="mt-6 text-center text-xs text-[#AAB8CF]">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            className="font-semibold text-[#8B2CF5] transition-colors hover:text-[#D946EF] hover:underline cursor-pointer"
            onClick={handleSwitchMode}
          >
            Create an account
          </button>
        </p>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overscroll-none overflow-hidden animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowForgotModal(false);
            }
          }}
        >
          <div
            ref={forgotModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
            className="w-full max-w-md max-h-[90vh] max-h-[90dvh] flex flex-col rounded-2xl border border-[#34445F] bg-[#111A2E] p-6 shadow-2xl text-[#F8FAFC] overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#34445F] shrink-0">
              <div id="forgot-modal-title" className="flex items-center gap-2 text-[#F8FAFC] font-semibold text-base">
                <KeyRound className="h-5 w-5 text-[#8B2CF5]" />
                Reset Password
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-[#AAB8CF] hover:bg-[#19243A] hover:text-[#F8FAFC] transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {forgotMessage.text && (
              <div
                className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
                  forgotMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                {forgotMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                )}
                <span>{forgotMessage.text}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestForgotOtp} className="mt-4 space-y-4">
                <p className="text-xs text-[#AAB8CF] leading-5">
                  Enter your registered email address and we&apos;ll send you a 6-digit OTP code to reset your password.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#AAB8CF]">Email Address</label>
                  <div className="flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3 py-2 text-sm text-[#F8FAFC]">
                    <Mail className="h-4 w-4 text-[#AAB8CF] mr-2" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-transparent focus:outline-none placeholder-[#AAB8CF]/60"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-4 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
                >
                  {forgotLoading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
                <p className="text-xs text-[#AAB8CF] leading-5">
                  We sent a code to <strong className="text-[#D946EF]">{forgotEmail}</strong>. Enter the 6-digit code and your new password below.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#AAB8CF]">6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full rounded-xl border border-[#34445F] bg-[#19243A] px-3 py-2 text-center text-lg font-mono font-bold tracking-widest text-[#F8FAFC] focus:border-[#8B2CF5] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#AAB8CF]">New Password</label>
                  <div className="flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3 py-2 text-sm text-[#F8FAFC]">
                    <Lock className="h-4 w-4 text-[#AAB8CF] mr-2" />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-transparent focus:outline-none placeholder-[#AAB8CF]/60"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[#AAB8CF] hover:text-[#F8FAFC] ml-2"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex items-center gap-1 text-xs text-[#AAB8CF] hover:text-[#F8FAFC]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Change Email
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="rounded-xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-5 py-2.5 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
                  >
                    {forgotLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
