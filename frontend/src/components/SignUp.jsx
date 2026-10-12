import React, { useState, useEffect, useRef } from "react";
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SocialAuthButtons from "./SocialAuthButtons";
import { TasklertIcon } from "./TasklertLogo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const INITIAL_FORM = { name: "", email: "", password: "" };
const RESEND_COOLDOWN_SECONDS = 60;

// Calculate password strength
const getPasswordStrength = (pass) => {
  if (!pass) return { score: 0, label: "Empty", color: "bg-slate-700", text: "text-[#AAB8CF]" };
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[A-Z]/.test(pass)) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  switch (score) {
    case 1:
      return { score: 25, label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
    case 2:
      return { score: 50, label: "Fair", color: "bg-amber-500", text: "text-amber-400" };
    case 3:
      return { score: 75, label: "Good", color: "bg-sky-500", text: "text-sky-400" };
    case 4:
      return { score: 100, label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" };
    default:
      return { score: 15, label: "Too short", color: "bg-rose-500", text: "text-rose-400" };
  }
};

const SignUp = ({ onSwitchMode, onSubmit, showSwitchLink = true }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState("form"); // "form" | "otp"
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState({ text: "", type: "" });
  const otpInputRef = useRef(null);

  const pwdStrength = getPasswordStrength(formData.password);

  // Handle OAuth callback parameters (e.g. ?oauth_success=true&token=... or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get("oauth_success");
    const token = params.get("token");
    const userId = params.get("userId");
    const name = params.get("name");
    const email = params.get("email");
    const avatar = params.get("avatar");
    const provider = params.get("provider") || "Social";
    const error = params.get("error");

    if (error) {
      toast.error(decodeURIComponent(error));
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

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
      toast.success(`Welcome, ${name || "User"}! Successfully signed in via ${providerLabel}.`);

      window.history.replaceState({}, document.title, "/");
      setTimeout(() => navigate("/", { replace: true }), 300);
    }
  }, [navigate, onSubmit]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === "otp") otpInputRef.current?.focus();
  }, [step]);

  // STEP 1: Validate details & request 6-digit OTP code to email
  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (!agreeTerms) {
      toast.error("Please agree to the Terms of Service & Privacy Policy to continue.");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const { data } = await axios.post(`${API_URL}/api/user/register/request-otp`, formData);
      setStep("otp");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({
        text: data?.message || `We sent a 6-digit code to ${formData.email}. Enter it below to finish creating your account.`,
        type: "success",
      });
    } catch (err) {
      console.error("Signup OTP request error:", err);
      setMessage({
        text: err.response?.data?.message || "An error occurred. Please check your details and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify the 6-digit code and create account
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setMessage({ text: "Please enter the complete 6-digit verification code.", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const { data } = await axios.post(`${API_URL}/api/user/register/verify-otp`, {
        email: formData.email,
        otp: otp.trim(),
      });

      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.id) {
          localStorage.setItem("userId", data.user.id);
        }
      }

      onSubmit?.({ token: data.token, ...data.user });

      toast.success("Registration successful! Welcome to Tasklert.");
      setFormData(INITIAL_FORM);
      setOtp("");
      setStep("form");

      if (!onSubmit && onSwitchMode) {
        setTimeout(() => onSwitchMode(), 400);
      } else {
        setTimeout(() => navigate("/"), 400);
      }
    } catch (err) {
      console.error("Signup OTP verify error:", err);
      setMessage({
        text: err.response?.data?.message || "Invalid or expired code. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const { data } = await axios.post(`${API_URL}/api/user/register/request-otp`, formData);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage({ text: data?.message || "A new 6-digit verification code has been sent to your email.", type: "success" });
    } catch (err) {
      setMessage({
        text: err.response?.data?.message || "Couldn't resend the code. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-[#34445F] bg-[#111A2E] p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B2CF5] to-[#D946EF] shadow-lg shadow-[#8B2CF5]/30">
          {step === "otp" ? (
            <ShieldCheck className="h-7 w-7 text-white" />
          ) : (
            <TasklertIcon size={32} idPrefix="signup-card" />
          )}
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#F8FAFC]">
          {step === "otp" ? "Verify Your Email" : "Create your account"}
        </h2>
        <p className="mt-1 text-xs text-[#AAB8CF]">
          {step === "otp"
            ? `Enter the 6-digit code sent to ${formData.email}`
            : "Start organizing tasks and set reminders with Tasklert"}
        </p>
      </div>

      {/* Message alert */}
      {message.text && (
        <div
          className={`mb-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-5 ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          ) : (
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {step === "form" ? (
        <>
          {/* Social Logins */}
          <SocialAuthButtons />


          {/* Registration Form */}
          <form onSubmit={handleSendOtp} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#AAB8CF]">Full Name</label>
              <div className="group relative flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3.5 py-2.5 transition-all focus-within:border-[#8B2CF5] focus-within:ring-2 focus-within:ring-[#8B2CF5]/25 hover:border-[#34445F]/90">
                <User className="h-4 w-4 text-[#AAB8CF] group-focus-within:text-[#8B2CF5]" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="ml-2.5 w-full bg-transparent text-sm text-[#F8FAFC] placeholder-[#AAB8CF]/60 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
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

            {/* Password with Strength Indicator */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#AAB8CF]">Password</label>
              <div className="group relative flex items-center rounded-xl border border-[#34445F] bg-[#19243A] px-3.5 py-2.5 transition-all focus-within:border-[#8B2CF5] focus-within:ring-2 focus-within:ring-[#8B2CF5]/25 hover:border-[#34445F]/90">
                <Lock className="h-4 w-4 text-[#AAB8CF] group-focus-within:text-[#8B2CF5]" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="ml-2.5 w-full bg-transparent text-sm text-[#F8FAFC] placeholder-[#AAB8CF]/60 focus:outline-none"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="ml-2 text-[#AAB8CF] hover:text-[#F8FAFC] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#AAB8CF]">Password strength:</span>
                    <span className={`font-semibold ${pwdStrength.text}`}>{pwdStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#19243A] border border-[#34445F]/50">
                    <div
                      className={`h-full transition-all duration-300 ${pwdStrength.color}`}
                      style={{ width: `${pwdStrength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Terms and Privacy Checkbox */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="agreeTerms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#34445F] bg-[#19243A] accent-[#8B2CF5] text-[#8B2CF5] focus:ring-[#8B2CF5]/40 cursor-pointer"
                required
              />
              <label htmlFor="agreeTerms" className="ml-2 text-xs leading-5 text-[#AAB8CF] cursor-pointer select-none">
                I agree to Tasklert&apos;s{" "}
                <span className="text-[#8B2CF5] hover:text-[#D946EF] hover:underline">Terms of Service</span> and{" "}
                <span className="text-[#8B2CF5] hover:text-[#D946EF] hover:underline">Privacy Policy</span>.
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
                  Sending verification code...
                </span>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Send Verification Code
                </>
              )}
            </button>
          </form>
        </>
      ) : (
        /* OTP Verification Form */
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="mb-2 block text-center text-xs font-semibold text-[#AAB8CF]">
              6-Digit Verification Code
            </label>
            <input
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-2xl border border-[#34445F] bg-[#19243A] py-3.5 text-center text-2xl font-mono font-bold tracking-[0.4em] text-[#F8FAFC] shadow-inner focus:border-[#8B2CF5] focus:outline-none focus:ring-2 focus:ring-[#8B2CF5]/25"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-4 py-3 text-sm font-semibold text-[#F8FAFC] shadow-lg shadow-[#8B2CF5]/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              "Verifying Code..."
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Verify &amp; Create Account
              </>
            )}
          </button>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setOtp("");
                setMessage({ text: "", type: "" });
              }}
              className="flex items-center gap-1 font-medium text-[#AAB8CF] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Edit details
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || loading}
              className="font-medium text-[#8B2CF5] hover:text-[#D946EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {/* Switch to Login */}
      {showSwitchLink && (
        <p className="mt-6 text-center text-xs text-[#AAB8CF]">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-semibold text-[#8B2CF5] transition-colors hover:text-[#D946EF] hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </p>
      )}
    </div>
  );
};

export default SignUp;
