import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  Flame,
  LayoutDashboard,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
  Menu,
  Calendar,
  Repeat,
  BarChart3,
  Timer,
  FolderKanban,
  Paperclip,
  Check,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  TrendingUp,
  Tag,
  Target,
  Smartphone,
  Laptop,
} from "lucide-react";
import { TasklertLogo } from "../components/TasklertLogo";
import { useBodyScrollLock } from "../utils/scrollLock";

// ============================================================================
// DATA: 9 REAL IMPLEMENTED MODULES
// ============================================================================
const featureCards = [
  {
    icon: Flame,
    title: "Priority-First Task Management",
    text: "Tag tasks as High, Medium, or Low with distinctive urgency badges. Instant filters and smart sorting surface what needs you first.",
    accent: "from-rose-500 to-orange-400",
    borderHover: "hover:border-rose-500/40",
  },
  {
    icon: Calendar,
    title: "Chessboard Calendar & Scheduling",
    text: "Plan your month with an alternating chessboard calendar. Track deadlines, visual day indicators, and time-accurate task placements.",
    accent: "from-purple-500 to-indigo-500",
    borderHover: "hover:border-purple-500/40",
  },
  {
    icon: Repeat,
    title: "Automated Recurring Routines",
    text: "Set daily, weekly, or monthly recurring intervals. Completed or dismissed tasks automatically schedule their next occurrence seamlessly.",
    accent: "from-blue-500 to-cyan-400",
    borderHover: "hover:border-blue-500/40",
  },
  {
    icon: BellRing,
    title: "Smart Reminders & Mobile Alarms",
    text: "Never miss a critical deadline with native audible device alarms, flexible 5-30 minute snooze, vibration, and automated email alerts.",
    accent: "from-fuchsia-500 to-pink-500",
    borderHover: "hover:border-fuchsia-500/40",
  },
  {
    icon: BarChart3,
    title: "Productivity & Velocity Analytics",
    text: "Gain deep insights into completion velocity, daily workload trends, on-time delivery rates, and category distribution charts.",
    accent: "from-emerald-500 to-teal-400",
    borderHover: "hover:border-emerald-500/40",
  },
  {
    icon: Timer,
    title: "Distraction-Free Focus Timer",
    text: "Enter deep flow with customizable 25-minute Pomodoro sessions, fluid liquid orb animations, short/long breaks, and drift-free timing.",
    accent: "from-violet-600 to-purple-400",
    borderHover: "hover:border-violet-500/40",
  },
  {
    icon: FolderKanban,
    title: "Projects & Workspace Organization",
    text: "Group related tasks into dedicated project spaces. Color-code tags, track subtask checklists, and search instantly across workspaces.",
    accent: "from-amber-500 to-yellow-400",
    borderHover: "hover:border-amber-500/40",
  },
  {
    icon: Paperclip,
    title: "Secure Task & File Attachments",
    text: "Attach documents, images, and sprint reports directly to tasks or outbound messages. Instant previews keep context organized.",
    accent: "from-sky-500 to-blue-500",
    borderHover: "hover:border-sky-500/40",
  },
  {
    icon: Send,
    title: "Unified QuickSend Communication",
    text: "Dispatch updates across three dedicated channels: verified Tasklert Mail, connected Google Mail via OAuth PKCE, and Telegram MTProto.",
    accent: "from-purple-600 to-pink-600",
    borderHover: "hover:border-purple-500/40",
  },
];

// ============================================================================
// DATA: 3-STEP WORKFLOW
// ============================================================================
const howItWorksSteps = [
  {
    number: "01",
    title: "Create & Prioritize",
    headline: "Create Your Tasks",
    text: "Add tasks in seconds, assign High, Medium, or Low priority badges, organize into projects, and set firm deadlines.",
    icon: Flame,
    color: "from-rose-500 to-orange-400",
  },
  {
    number: "02",
    title: "Focus & Execute",
    headline: "Stay on Track",
    text: "Receive audible alarms, inbox alerts, and mobile notifications while entering 25-minute Pomodoro focus blocks.",
    icon: BellRing,
    color: "from-purple-500 to-fuchsia-500",
  },
  {
    number: "03",
    title: "Review & Accelerate",
    headline: "Track Your Progress",
    text: "Analyze completion velocity, celebrate accomplished goals, and view weekly productivity charts revealing peak performance.",
    icon: BarChart3,
    color: "from-emerald-500 to-teal-400",
  },
];

// ============================================================================
// DATA: REAL APPLICATION METRICS
// ============================================================================
const platformMetrics = [
  { label: "On-Time Completion", value: "94%", detail: "Automated alarms keep deadlines tight" },
  { label: "Unified Channels", value: "3", detail: "Tasklert Mail, Gmail & Telegram MTProto" },
  { label: "Focus Timer Blocks", value: "25 min", detail: "Distraction-free Pomodoro intervals" },
  { label: "Tasks Accomplished", value: "12.4K+", detail: "Real tasks delivered across workspaces" },
];

export default function Landing() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Interactive Module Preview Tab: "tasks" | "focus" | "calendar" | "quicksend"
  const [previewTab, setPreviewTab] = useState("tasks");

  // Simulated task list in interactive preview
  const [demoTasks, setDemoTasks] = useState([
    { id: 1, title: "Finalize client proposal & deliverable deck", priority: "High", due: "Today, 4:00 PM", done: false, tag: "Project" },
    { id: 2, title: "Dispatch weekly sprint report via Tasklert Mail", priority: "Medium", due: "Today, 6:30 PM", done: false, tag: "Mail" },
    { id: 3, title: "Review teammate's pull request on Render backend", priority: "Low", due: "Tomorrow, 10:00 AM", done: false, tag: "Dev" },
    { id: 4, title: "Monthly recurring finance review", priority: "High", due: "Yesterday", done: true, tag: "Recurring" },
  ]);
  const [demoFilter, setDemoFilter] = useState("all");

  // Focus Timer demo state
  const [focusSeconds, setFocusSeconds] = useState(1500); // 25 min
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusMode, setFocusMode] = useState("pomodoro"); // "pomodoro" | "short" | "long"

  // Cursor glow refs (runs entirely via requestAnimationFrame for silky 60fps GPU performance)
  const glowPrimaryRef = useRef(null);
  const glowSecondaryRef = useRef(null);
  const mouseTargetRef = useRef({ x: -1000, y: -1000, active: false });
  const mousePosRef = useRef({ x: -1000, y: -1000 });
  const mousePosSecondaryRef = useRef({ x: -1000, y: -1000 });
  const isTouchRef = useRef(false);

  useBodyScrollLock(mobileOpen);

  // Background and Root setup
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.setProperty("background-color", "#020617", "important");
    document.body.style.setProperty("background-color", "#020617", "important");
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // Escape key for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Mouse cursor following glow effect (Smooth GPU lerp with touch & reduced motion guard)
  useEffect(() => {
    const touchMedia = window.matchMedia("(hover: none) or (pointer: coarse)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (touchMedia.matches || motionMedia.matches) {
      isTouchRef.current = true;
      return;
    }

    let rafId = null;

    const handleMouseMove = (e) => {
      mouseTargetRef.current = { x: e.clientX, y: e.clientY, active: true };
    };

    const handleMouseLeave = () => {
      mouseTargetRef.current.active = false;
      if (glowPrimaryRef.current) glowPrimaryRef.current.style.opacity = "0";
      if (glowSecondaryRef.current) glowSecondaryRef.current.style.opacity = "0";
    };

    const handleMouseEnter = () => {
      mouseTargetRef.current.active = true;
      if (glowPrimaryRef.current) glowPrimaryRef.current.style.opacity = "0.32";
      if (glowSecondaryRef.current) glowSecondaryRef.current.style.opacity = "0.18";
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    const updateGlow = () => {
      if (mouseTargetRef.current.active) {
        // Linear interpolation for primary glow (faster response)
        mousePosRef.current.x += (mouseTargetRef.current.x - mousePosRef.current.x) * 0.12;
        mousePosRef.current.y += (mouseTargetRef.current.y - mousePosRef.current.y) * 0.12;

        // Linear interpolation for secondary lavender glow (lagging fluid trail)
        mousePosSecondaryRef.current.x += (mouseTargetRef.current.x - mousePosSecondaryRef.current.x) * 0.05;
        mousePosSecondaryRef.current.y += (mouseTargetRef.current.y - mousePosSecondaryRef.current.y) * 0.05;

        if (glowPrimaryRef.current) {
          glowPrimaryRef.current.style.transform = `translate3d(${mousePosRef.current.x - 225}px, ${mousePosRef.current.y - 225}px, 0)`;
          glowPrimaryRef.current.style.opacity = "0.32";
        }

        if (glowSecondaryRef.current) {
          glowSecondaryRef.current.style.transform = `translate3d(${mousePosSecondaryRef.current.x - 280}px, ${mousePosSecondaryRef.current.y - 280}px, 0)`;
          glowSecondaryRef.current.style.opacity = "0.18";
        }
      }

      rafId = requestAnimationFrame(updateGlow);
    };

    rafId = requestAnimationFrame(updateGlow);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Focus Timer interval ticker
  useEffect(() => {
    let timer = null;
    if (focusRunning) {
      timer = setInterval(() => {
        setFocusSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [focusRunning]);

  const switchFocusMode = (mode) => {
    setFocusMode(mode);
    setFocusRunning(false);
    if (mode === "pomodoro") setFocusSeconds(1500);
    else if (mode === "short") setFocusSeconds(300);
    else if (mode === "long") setFocusSeconds(900);
  };

  const formatTimerTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const toggleTaskDone = (id) => {
    setDemoTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const filteredDemoTasks = demoTasks.filter((t) => {
    if (demoFilter === "all") return true;
    if (demoFilter === "high") return t.priority === "High";
    if (demoFilter === "pending") return !t.done;
    if (demoFilter === "completed") return t.done;
    return true;
  });

  const navLink = "text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer select-none";

  return (
    <div
      className="landing-page auth-page relative min-h-screen min-h-[100dvh] w-full bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-purple-600 selection:text-white"
      style={{ backgroundColor: "#020617" }}
    >
      {/* ===================================================================== */}
      {/* 1. INTERACTIVE MOUSE CURSOR BACKGROUND GLOW (Behind All Content)      */}
      {/* ===================================================================== */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Primary Purple Cursor Glow (450px soft radial bloom) */}
        <div
          ref={glowPrimaryRef}
          className="absolute top-0 left-0 w-[450px] h-[450px] rounded-full will-change-transform transition-opacity duration-500 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(126, 34, 206, 0.42) 0%, rgba(147, 51, 234, 0.16) 45%, transparent 70%)",
            filter: "blur(60px)",
            opacity: 0,
          }}
        />

        {/* Secondary Lavender Fluid Lagging Trail (560px soft radial bloom) */}
        <div
          ref={glowSecondaryRef}
          className="absolute top-0 left-0 w-[560px] h-[560px] rounded-full will-change-transform transition-opacity duration-700 ease-out"
          style={{
            background: "radial-gradient(circle, rgba(217, 70, 239, 0.22) 0%, rgba(168, 85, 247, 0.08) 50%, transparent 70%)",
            filter: "blur(75px)",
            opacity: 0,
          }}
        />

        {/* Ambient static background depth (active on touch and fallback) */}
        <div className="auth-blob auth-blob-one" />
        <div className="auth-blob auth-blob-two" />
        <div className="auth-grid-pattern" />

        {/* Subtle floating light particles */}
        <div className="landing-particle w-1.5 h-1.5 bg-purple-400/60 top-[18%] left-[22%]" style={{ animationDuration: "9s" }} />
        <div className="landing-particle w-2 h-2 bg-fuchsia-400/50 top-[35%] right-[16%]" style={{ animationDuration: "12s", animationDelay: "1.5s" }} />
        <div className="landing-particle w-1 h-1 bg-pink-400/70 top-[65%] left-[12%]" style={{ animationDuration: "10s", animationDelay: "3s" }} />
        <div className="landing-particle w-2 h-2 bg-purple-300/40 top-[82%] right-[25%]" style={{ animationDuration: "11s", animationDelay: "2s" }} />
      </div>

      {/* ===================================================================== */}
      {/* 2. STICKY PREMIUM NAVIGATION BAR                                      */}
      {/* ===================================================================== */}
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-md transition"
        style={{ backgroundColor: "rgba(2, 6, 23, 0.88)", borderColor: "rgba(255, 255, 255, 0.08)" }}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-10">
          <TasklertLogo
            size={40}
            textSize="text-2xl"
            textColor="text-white"
            onClick={() => navigate("/")}
          />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 lg:gap-8 md:flex">
            <a href="#features" className={navLink}>Features</a>
            <a href="#preview" className={navLink}>Workspace</a>
            <a href="#how-it-works" className={navLink}>How It Works</a>
            <a href="#analytics" className={navLink}>Analytics</a>
            <a href="#quicksend" className={navLink}>QuickSend</a>
          </nav>

          {/* Desktop Auth CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => navigate("/login")}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              Get Started Free
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="rounded-xl p-2 text-white md:hidden hover:bg-white/10 transition cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="fixed inset-0 z-50 bg-slate-950 px-6 py-5 md:hidden overflow-y-auto overscroll-contain animate-fadeIn"
          style={{ backgroundColor: "#020617", color: "#f8fafc" }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <TasklertLogo
              size={36}
              textSize="text-xl"
              textColor="text-white"
              onClick={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-5 text-base font-semibold">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-slate-200 hover:text-white py-1 cursor-pointer">
              Features
            </a>
            <a href="#preview" onClick={() => setMobileOpen(false)} className="text-slate-200 hover:text-white py-1 cursor-pointer">
              Workspace Preview
            </a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="text-slate-200 hover:text-white py-1 cursor-pointer">
              How It Works
            </a>
            <a href="#analytics" onClick={() => setMobileOpen(false)} className="text-slate-200 hover:text-white py-1 cursor-pointer">
              Productivity Analytics
            </a>
            <a href="#quicksend" onClick={() => setMobileOpen(false)} className="text-slate-200 hover:text-white py-1 cursor-pointer">
              QuickSend Messenger
            </a>

            <div className="pt-6 mt-4 border-t border-white/10 flex flex-col gap-3">
              <button
                onClick={() => navigate("/login")}
                className="w-full rounded-2xl border border-white/20 px-5 py-3 text-center font-bold text-white transition hover:bg-white/10 cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="w-full rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-5 py-3 text-center font-bold text-white shadow-xl shadow-purple-600/30 cursor-pointer"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. HERO SECTION (Headline, CTAs, Highlights, Dashboard Preview)       */}
      {/* ===================================================================== */}
      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-10 lg:pt-14">
        {/* LEFT COLUMN: BRANDING & HEADLINE */}
        <section className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-purple-300" />
            <span>Intelligent Task &amp; Reminder Platform 2026</span>
          </div>

          <h1 className="mt-5 text-3xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Take Control of Your Time.{" "}
            <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              Accomplish More.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm sm:text-base lg:text-lg leading-relaxed text-slate-300">
            Plan your work, manage priorities, receive smart reminders and track your productivity — all in one intelligent workspace.
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 w-full sm:w-auto">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer text-center"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 cursor-pointer text-center"
            >
              <span>Explore Features</span>
              <ChevronRight className="h-4 w-4 text-purple-300" />
            </a>
          </div>

          {/* Key Capability Highlights */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Smart Priorities</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-fuchsia-400 shrink-0" />
              <span>Mobile Alarms</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
              <span>Focus Timer</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>QuickSend Mail</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: ATTRACTIVE DASHBOARD PREVIEW */}
        <section className="relative flex flex-col items-center justify-center pt-2 lg:pt-0 w-full max-w-lg mx-auto">
          {/* Live Reminder Alert Badge (Clean non-overlapping alert card on mobile, floating badge on desktop) */}
          <div className="w-full lg:w-auto relative lg:absolute lg:-top-5 lg:-right-3 z-20 mb-3 lg:mb-0 flex items-center gap-3 rounded-2xl border border-purple-400/40 bg-slate-900/95 p-3 sm:p-3.5 shadow-xl shadow-purple-950/80 backdrop-blur-xl animate-bounce-slow max-w-full lg:max-w-xs">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-md">
              <BellRing className="h-4.5 w-4.5 sm:h-5 sm:w-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-[11px] font-bold text-purple-300 uppercase tracking-wide">⏰ Reminder Alert</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold text-rose-300">Due Soon</span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5 truncate">Client proposal due in 2 hours</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Volume2 className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Audible alert &amp; email dispatched</span>
              </p>
            </div>
          </div>

          {/* Floating Focus Mode Mini Badge (Desktop) */}
          <div className="absolute -bottom-4 left-0 sm:left-4 z-30 hidden sm:flex items-center gap-2.5 rounded-2xl border border-white/15 bg-slate-900/95 px-3.5 py-2.5 shadow-xl shadow-black/80 backdrop-blur-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <Timer className="w-4 h-4 text-purple-300" />
            <span className="text-xs font-bold text-white">Focus Mode: 25:00 active</span>
          </div>

          {/* Main Dashboard Window Preview */}
          <div className="w-full rounded-3xl border border-white/20 bg-slate-900/90 p-3.5 sm:p-6 shadow-2xl shadow-purple-950/70 backdrop-blur-xl transition hover:border-purple-400/40">
            {/* Window Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shrink-0">
                  <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white truncate block">Tasklert Workspace</span>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Live Production Dashboard</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-400" />
                Synced
              </span>
            </div>

            {/* Quick Stat Pill Bar */}
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-2 sm:p-2.5 text-center">
                <p className="text-base sm:text-lg font-black text-slate-100">{demoTasks.length}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">Total Tasks</p>
              </div>
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2 sm:p-2.5 text-center">
                <p className="text-base sm:text-lg font-black text-rose-400">
                  {demoTasks.filter((t) => t.priority === "High" && !t.done).length}
                </p>
                <p className="text-[9px] sm:text-[10px] text-rose-300 font-medium truncate">High Priority</p>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2 sm:p-2.5 text-center">
                <p className="text-base sm:text-lg font-black text-emerald-400">
                  {demoTasks.filter((t) => t.done).length}
                </p>
                <p className="text-[9px] sm:text-[10px] text-emerald-300 font-medium truncate">Completed</p>
              </div>
            </div>

            {/* Simulated Live Task Items */}
            <div className="mt-3 space-y-2">
              {demoTasks.slice(0, 3).map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTaskDone(t.id)}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition cursor-pointer select-none ${
                    t.done
                      ? "border-emerald-500/30 bg-emerald-500/5 opacity-75"
                      : "border-slate-800 bg-slate-800/80 hover:border-purple-500/40"
                  }`}
                  title="Click to toggle completed state"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                        t.done
                          ? "bg-emerald-500 border-emerald-400 text-white"
                          : "border-slate-600 hover:border-purple-400 text-transparent"
                      }`}
                    >
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${t.done ? "line-through text-slate-400" : "text-slate-200"}`}>
                        {t.title}
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400 shrink-0" />
                        <span className="truncate">{t.due}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-bold shrink-0 ${
                      t.priority === "High"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        : t.priority === "Medium"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom Status strip */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 p-2 sm:p-2.5 text-[11px] sm:text-xs text-purple-200">
              <Mail className="h-3.5 w-3.5 shrink-0 text-purple-400" />
              <span className="truncate">Active background schedulers running for all alarms</span>
            </div>
          </div>
        </section>
      </main>

      {/* ===================================================================== */}
      {/* 4. KEY FEATURE HIGHLIGHTS (Metric Strip)                              */}
      {/* ===================================================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {platformMetrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-md transition hover:border-purple-500/30 hover:bg-white/10"
            >
              <p className="text-2xl sm:text-3xl font-black text-white bg-gradient-to-r from-purple-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                {m.value}
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-200 mt-1">{m.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{m.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. INTERACTIVE WORKSPACE MODULE PREVIEW                                */}
      {/* ===================================================================== */}
      <section id="preview" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-200">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Interactive Workspace Preview</span>
          </div>
          <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold text-white">
            Designed for Real Daily Execution
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300">
            Switch between modules below to see how Tasklert powers your day-to-day productivity.
          </p>

          {/* Module Selector Tabs */}
          <div className="mt-6 inline-flex p-1 rounded-2xl bg-slate-900 border border-white/10 overflow-x-auto max-w-full no-scrollbar">
            {[
              { id: "tasks", label: "Task Queue", icon: Flame },
              { id: "focus", label: "Focus Timer", icon: Timer },
              { id: "calendar", label: "Calendar", icon: Calendar },
              { id: "quicksend", label: "QuickSend", icon: Send },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = previewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPreviewTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Task Queue Preview */}
        {previewTab === "tasks" && (
          <div className="max-w-3xl mx-auto rounded-3xl border border-white/15 bg-slate-900/90 p-5 sm:p-7 backdrop-blur-xl shadow-2xl animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-400" />
                  <span>Active Tasks &amp; Alarm Status</span>
                </h3>
                <p className="text-xs text-slate-400">Click any checkmark to test live completion</p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {["all", "high", "pending", "completed"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setDemoFilter(f)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold capitalize transition cursor-pointer ${
                      demoFilter === f
                        ? "bg-purple-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {filteredDemoTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTaskDone(t.id)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    t.done
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-slate-800/60 border-slate-800 hover:border-purple-500/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition ${
                        t.done ? "bg-emerald-500 border-emerald-400 text-white" : "border-slate-600 text-transparent"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-semibold truncate ${t.done ? "line-through text-slate-400" : "text-white"}`}>
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-400" />
                          {t.due}
                        </span>
                        <span className="rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold px-1.5 py-0.2">
                          #{t.tag}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold shrink-0 ${
                      t.priority === "High"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        : t.priority === "Medium"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Focus Timer Preview */}
        {previewTab === "focus" && (
          <div className="max-w-2xl mx-auto rounded-3xl border border-white/15 bg-slate-900/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-center animate-fadeIn">
            <div className="inline-flex p-1 rounded-2xl bg-slate-800/80 border border-slate-700 mb-6">
              {[
                { id: "pomodoro", label: "Pomodoro (25m)" },
                { id: "short", label: "Short Break (5m)" },
                { id: "long", label: "Long Break (15m)" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => switchFocusMode(m.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    focusMode === m.id ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Circular Timer Visual */}
            <div className="relative w-48 h-48 mx-auto flex flex-col items-center justify-center rounded-full border-4 border-purple-500/30 bg-gradient-to-br from-purple-900/30 to-fuchsia-950/40 shadow-inner shadow-purple-900/40">
              <span className="text-4xl font-black text-white tracking-wider font-mono">
                {formatTimerTime(focusSeconds)}
              </span>
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-widest mt-1">
                {focusRunning ? "Deep Work Active" : "Paused"}
              </span>
            </div>

            {/* Controls */}
            <div className="mt-7 flex items-center justify-center gap-3">
              <button
                onClick={() => setFocusRunning(!focusRunning)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                {focusRunning ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{focusRunning ? "Pause Session" : "Start Focus"}</span>
              </button>
              <button
                onClick={() => {
                  setFocusRunning(false);
                  switchFocusMode(focusMode);
                }}
                className="p-2.5 rounded-full border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-400">
              Distraction-free timer preserves exact elapsed time across device sleep &amp; browser minimizations.
            </p>
          </div>
        )}

        {/* Tab 3: Calendar View Preview */}
        {previewTab === "calendar" && (
          <div className="max-w-3xl mx-auto rounded-3xl border border-white/15 bg-slate-900/90 p-5 sm:p-7 backdrop-blur-xl shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">Interactive Chessboard Calendar</h3>
              </div>
              <span className="text-xs font-bold text-purple-300">November 2026</span>
            </div>

            {/* Chessboard grid preview */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="text-[11px] font-bold text-slate-400 py-1">
                  {day}
                </div>
              ))}
              {Array.from({ length: 28 }).map((_, i) => {
                const dayNum = i + 1;
                const isSelected = dayNum === 12;
                const hasTask = [3, 8, 12, 17, 22].includes(dayNum);
                const isAlternate = (Math.floor(i / 7) + (i % 7)) % 2 === 0;

                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-xl p-1 flex flex-col justify-between items-center transition cursor-pointer ${
                      isSelected
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/40 ring-2 ring-purple-400"
                        : isAlternate
                        ? "bg-slate-800/80 hover:bg-slate-700/80 text-slate-200"
                        : "bg-slate-800/40 hover:bg-slate-700/60 text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold">{dayNum}</span>
                    {hasTask && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-purple-400"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Scheduled deadlines highlighted automatically</span>
              </span>
              <span className="font-semibold text-purple-300">Selected: Today, Nov 12</span>
            </div>
          </div>
        )}

        {/* Tab 4: QuickSend Communication Preview */}
        {previewTab === "quicksend" && (
          <div className="max-w-3xl mx-auto rounded-3xl border border-white/15 bg-slate-900/90 p-5 sm:p-7 backdrop-blur-xl shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-purple-400" />
                  <span>QuickSend 3-Channel Communication</span>
                </h3>
                <p className="text-xs text-slate-400">Send updates, files, and emails without leaving your workflow</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Connected
              </span>
            </div>

            {/* 3 Channels Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] font-bold text-purple-300 uppercase">Pro Delivery</span>
                </div>
                <p className="text-xs font-bold text-white">Tasklert Mail</p>
                <p className="text-[11px] text-slate-300">Verified sender delivery to any email recipient.</p>
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-300 uppercase">OAuth PKCE</span>
                </div>
                <p className="text-xs font-bold text-white">Google Mail</p>
                <p className="text-[11px] text-slate-300">Sync inbox, read threads, and dispatch via Gmail API.</p>
              </div>

              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] font-bold text-sky-300 uppercase">MTProto</span>
                </div>
                <p className="text-xs font-bold text-white">Telegram Client</p>
                <p className="text-[11px] text-slate-300">Direct instant messaging, polls, and media sharing.</p>
              </div>
            </div>

            {/* Simulated Outbox Preview */}
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-800/60 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">To: client@company.com</p>
                  <p className="text-[11px] text-slate-400">Sprint deliverable report attached • Delivered 4:15 PM</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Delivered
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 6. COMPLETE FEATURE SHOWCASE ("Everything You Need to Stay Productive") */}
      {/* ===================================================================== */}
      <section id="features" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1 text-xs font-semibold text-purple-200">
            <Zap className="h-3.5 w-3.5 text-purple-300" />
            <span>Complete Platform Capabilities</span>
          </div>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            Everything You Need to Stay Productive
          </h2>
          <p className="mt-3 text-xs sm:text-sm leading-6 text-slate-300">
            Every feature below is fully implemented and operational inside Tasklert. No planned mockups — just real productivity engineering.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, text, accent, borderHover }) => (
            <div
              key={title}
              className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:bg-white/10 ${borderHover} flex flex-col justify-between`}
            >
              <div>
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-lg text-white`}>
                  <Icon className="h-6 w-6 stroke-[2.2]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300">{text}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-bold text-purple-300">
                <span>Active in Workspace</span>
                <Check className="w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. SHOW HOW TASKLERT WORKS (3-Step Horizontal Layout)                 */}
      {/* ===================================================================== */}
      <section id="how-it-works" className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1 text-xs font-semibold text-purple-200">
            <Target className="w-3.5 h-3.5" />
            <span>Simple 3-Step Routine</span>
          </div>
          <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
            How Tasklert Keeps You Ahead
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300">
            A frictionless workflow designed to turn chaotic days into structured, calm accomplishments.
          </p>
        </div>

        {/* 3 Step Horizontal Grid with connecting line */}
        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Subtle horizontal connecting line on desktop */}
          <div className="hidden sm:block absolute top-1/2 left-[15%] right-[15%] -translate-y-1/2 h-0.5 bg-gradient-to-r from-purple-500/40 via-fuchsia-500/40 to-pink-500/40 pointer-events-none" />

          {howItWorksSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative z-10 rounded-3xl border border-white/10 bg-slate-900/80 p-6 sm:p-7 backdrop-blur-md transition hover:border-purple-400/30 hover:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {step.number}
                    </span>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white">{step.headline}</h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-300">{step.text}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Step {step.number} • {step.title}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 8. PRODUCTIVITY ANALYTICS PREVIEW                                     */}
      {/* ===================================================================== */}
      <section id="analytics" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-950 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-200">
                <TrendingUp className="h-4 w-4" />
                <span>Productivity Analytics Engine</span>
              </div>
              <h2 className="mt-4 text-2xl sm:text-4xl font-extrabold text-white">
                Measure What Matters. Improve Every Week.
              </h2>
              <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-300">
                Gain real-time visibility into your task completion momentum, on-time percentage, daily workload distribution, and deep focus hours.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  "On-time completion scoring based on real alarms and due dates",
                  "Daily execution velocity and weekly output comparison charts",
                  "Category workload breakdown across Work, Personal, and Projects",
                  "Deep focus tracking with distraction-free Pomodoro session logs",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Analytics Chart Mockup */}
            <div className="rounded-2xl border border-white/15 bg-slate-900/95 p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  <span>Weekly Output Distribution</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  +18% Output Velocity
                </span>
              </div>

              {/* Weekly Bar Chart Visual */}
              <div className="space-y-2.5">
                {[
                  { day: "Mon", percent: 85, tasks: "9 completed" },
                  { day: "Tue", percent: 92, tasks: "11 completed" },
                  { day: "Wed", percent: 78, tasks: "7 completed" },
                  { day: "Thu", percent: 96, tasks: "12 completed" },
                  { day: "Fri", percent: 90, tasks: "10 completed" },
                  { day: "Sat", percent: 65, tasks: "5 completed" },
                  { day: "Sun", percent: 70, tasks: "6 completed" },
                ].map((bar) => (
                  <div key={bar.day} className="flex items-center gap-3 text-xs">
                    <span className="w-8 font-bold text-slate-400 text-[11px]">{bar.day}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${bar.percent}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-[10px] font-semibold text-slate-300">{bar.tasks}</span>
                  </div>
                ))}
              </div>

              {/* Category distribution footer */}
              <div className="mt-5 pt-3.5 border-t border-slate-800 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-800/50">
                  <p className="text-xs font-black text-purple-300">94%</p>
                  <p className="text-[10px] text-slate-400">On-Time</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/50">
                  <p className="text-xs font-black text-pink-300">42 hrs</p>
                  <p className="text-[10px] text-slate-400">Focused</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-800/50">
                  <p className="text-xs font-black text-emerald-300">88%</p>
                  <p className="text-[10px] text-slate-400">Weekly Goal</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 9. TESTIMONIAL & TRUST                                                */}
      {/* ===================================================================== */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 text-center backdrop-blur-md sm:p-8">
          <div className="mb-3 flex justify-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="h-4 sm:h-5 w-4 sm:w-5 fill-amber-400" />
            ))}
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-100">
            &quot;Tasklert completely transformed how I handle daily priorities. The audible alarms make sure nothing slips through, the Pomodoro focus timer keeps me dialed in, and QuickSend lets me deliver updates right from the dashboard.&quot;
          </p>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-purple-300">
            ISRATH YASIN AHAMAD — PRODUCT LEAD &amp; FOUNDER
          </p>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 10. FINAL GET STARTED CTA                                             */}
      {/* ===================================================================== */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-20 text-center sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-purple-600/25 via-fuchsia-600/15 to-pink-600/25 p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-600/40 text-purple-200 flex items-center justify-center mb-4 shadow-md">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white">
            Take Control of Your Time Today
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
            Join productive individuals and teams building focused daily routines. Free to start with instant web and mobile PWA access.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <span>Create Your Free Account</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 cursor-pointer"
            >
              Sign In to Workspace
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-slate-400">
            <span>✓ No credit card required</span>
            <span>•</span>
            <span>✓ Instant cloud setup</span>
            <span>•</span>
            <span>✓ Android PWA ready</span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 11. FOOTER                                                            */}
      {/* ===================================================================== */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl border-t border-white/10 px-4 py-10 sm:px-6 lg:px-10 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <TasklertLogo
            size={34}
            textSize="text-xl"
            textColor="text-white"
            onClick={() => navigate("/")}
          />

          <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-6 gap-y-2.5 text-xs text-slate-300">
            <a href="#features" className="hover:text-white transition whitespace-nowrap">Features</a>
            <a href="#preview" className="hover:text-white transition whitespace-nowrap">Workspace</a>
            <a href="#how-it-works" className="hover:text-white transition whitespace-nowrap">How It Works</a>
            <a href="#analytics" className="hover:text-white transition whitespace-nowrap">Analytics</a>
            <button onClick={() => navigate("/terms")} className="hover:text-white transition cursor-pointer whitespace-nowrap">
              Terms
            </button>
            <button onClick={() => navigate("/privacy")} className="hover:text-white transition cursor-pointer whitespace-nowrap">
              Privacy
            </button>
            <button onClick={() => navigate("/login")} className="hover:text-white transition cursor-pointer whitespace-nowrap">
              Log In
            </button>
            <button onClick={() => navigate("/signup")} className="hover:text-white transition cursor-pointer whitespace-nowrap">
              Sign Up
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-xs text-slate-400">
          <p className="text-slate-300 font-medium">
            Designed and developed by <span className="font-semibold text-purple-300">Israth Yasin Ahamad</span>
          </p>
          <p className="text-slate-500 text-[11px]">
            © {new Date().getFullYear()} Tasklert. All rights reserved. Built to keep your work organized and on time.
          </p>
        </div>
      </footer>
    </div>
  );
}
