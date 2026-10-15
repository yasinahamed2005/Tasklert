import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Clock3,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TasklertIcon } from "./TasklertLogo";

const featureCards = [
  {
    title: "Plan Faster",
    text: "Capture tasks in seconds and organize by priority, deadline, and status.",
    icon: LayoutDashboard,
  },
  {
    title: "Stay Consistent",
    text: "Track pending and completed work with a clear workflow every day.",
    icon: Clock3,
  },
  {
    title: "Secure Access",
    text: "Your workspace is protected with token-based authentication.",
    icon: ShieldCheck,
  },
];

const quickStats = [
  { label: "Tasks Completed", value: "12.4K+" },
  { label: "Active Teams", value: "850+" },
  { label: "On-Time Rate", value: "94%" },
];

const AuthShell = ({ mode = "login", onSwitchToLogin, onSwitchToSignup, children }) => {
  const navigate = useNavigate();

  return (
    <div className="auth-page relative min-h-screen overflow-hidden bg-[#111A2E] text-[#F8FAFC]">
      <div className="auth-blob auth-blob-one" />
      <div className="auth-blob auth-blob-two" />
      <div className="auth-grid-pattern" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-5 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => navigate("/welcome")}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#AAB8CF] transition hover:text-[#F8FAFC] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </button>

        <div className="inline-flex items-center gap-1 rounded-full border border-[#34445F] bg-[#19243A]/80 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === "login"
                ? "bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] text-white shadow-sm"
                : "text-[#AAB8CF] hover:text-[#F8FAFC] hover:bg-[#222F49]"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={onSwitchToSignup}
            className={`rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              mode === "signup"
                ? "bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] text-white shadow-sm"
                : "text-[#AAB8CF] hover:text-[#F8FAFC] hover:bg-[#222F49]"
            }`}
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex flex-col justify-center min-h-[calc(100dvh-5rem)] px-3 py-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-10 lg:py-10">
        {/* Left Side: Branding and Highlights (Desktop only to prevent mobile scroll/whitespace) */}
        <section className="hidden lg:flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#8B2CF5]/40 bg-[#8B2CF5]/10 px-4 py-1.5 text-xs font-semibold text-[#D946EF]">
            <Sparkles className="h-4 w-4 text-[#8B2CF5]" />
            Task &amp; Reminder Workspace
          </div>

          <div className="mt-5 flex items-center gap-3">
            <TasklertIcon size={48} idPrefix="authshell" />
            <h1 className="text-4xl font-black tracking-tight text-[#F8FAFC] sm:text-5xl">
              Tasklert
            </h1>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-6 text-[#AAB8CF] sm:text-base">
            Tasklert is a modern productivity app that helps you create tasks, set priorities,
            receive timely reminders, and finish work on time. From daily to-dos to important
            deadlines, everything stays organized in one intelligent workspace.
          </p>

          <div className="mt-6 space-y-3">
            {featureCards.map(({ title, text, icon: Icon }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl border border-[#34445F]/70 bg-[#19243A]/60 p-4 backdrop-blur-sm"
              >
                <div className="mt-0.5 rounded-lg bg-[#222F49] p-2 text-[#8B2CF5]">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#F8FAFC]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#AAB8CF]">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-[#8B2CF5]/30 bg-gradient-to-br from-[#8B2CF5]/10 to-[#D946EF]/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-wider text-[#D946EF] uppercase">
                Productivity Snapshot
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                <BarChart3 className="h-3.5 w-3.5" />
                Trending Up
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {quickStats.map((item) => (
                <div key={item.label} className="rounded-lg bg-[#19243A]/80 border border-[#34445F]/60 p-2 text-center">
                  <p className="text-sm font-bold text-[#F8FAFC]">{item.value}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#AAB8CF]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-[#34445F]/70 bg-[#19243A]/60 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className="h-4 w-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-sm leading-6 text-[#F8FAFC]">
              &quot;Tasklert helped our team stop missing deadlines. The smart reminders,
              priority sorting, and clear workflow made task tracking effortless.&quot;
            </p>
            <p className="mt-2 text-xs font-medium text-[#D946EF]">
              Riya Sharma, Product Lead
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/welcome")}
            className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#D946EF] hover:text-[#f0abfc] transition-colors cursor-pointer w-fit text-left group"
          >
            <span>Build your focused routine with Tasklert</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </section>

        {/* Right Side: Authentication Card */}
        <section className="w-full flex items-center justify-center my-auto py-2 sm:py-4">{children}</section>
      </main>
    </div>
  );
};

export default AuthShell;