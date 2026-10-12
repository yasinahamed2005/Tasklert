import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  Flame,
  LayoutDashboard,
  Mail,
  MessageCircleHeart,
  Menu,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";
import { TasklertLogo } from "../components/TasklertLogo";

const features = [
  {
    icon: Flame,
    title: "Priority that actually helps",
    text: "Tag every task High, Medium, or Low the moment you create it. Your dashboard sorts and highlights what needs you first.",
    accent: "from-rose-500 to-orange-400",
  },
  {
    icon: BellRing,
    title: "Email reminders, on autopilot",
    text: "Due dates and overdue items land straight in your inbox, so nothing slips through because you forgot to check the app.",
    accent: "from-purple-500 to-pink-500",
  },
  {
    icon: LayoutDashboard,
    title: "One dashboard, the full picture",
    text: "Total tasks, completion rate, and what's due today — all live on a single screen that updates as you work.",
    accent: "from-purple-600 to-fuchsia-600",
  },
  {
    icon: Send,
    title: "QuickSend messenger",
    text: "Message anyone straight from Tasklert — an email to their inbox or a text to their phone, documents included.",
    accent: "from-emerald-500 to-teal-500",
  },
];

const steps = [
  {
    title: "1. Add your tasks",
    text: "Create a task, set a due date, and choose a priority in a few quick taps.",
  },
  {
    title: "2. Watch the clock",
    text: "Smart reminders and email alerts fire automatically as deadlines approach.",
  },
  {
    title: "3. Stay connected",
    text: "Use QuickSend to email or text updates and documents without leaving the app.",
  },
];

const stats = [
  { label: "Tasks completed", value: "12.4K+" },
  { label: "Active teams", value: "850+" },
  { label: "On-time rate", value: "94%" },
];

const Landing = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const navLink = "text-sm font-medium text-slate-200/80 hover:text-white transition-colors cursor-pointer";

  return (
    <div className="auth-page relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Background Glow Patterns */}
      <div className="auth-blob auth-blob-one" />
      <div className="auth-blob auth-blob-two" />
      <div className="auth-grid-pattern" />

      {/* STICKY NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <TasklertLogo
            size={40}
            textSize="text-2xl"
            textColor="text-white"
            onClick={() => navigate("/")}
          />

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className={navLink}>Features</a>
            <a href="#how-it-works" className={navLink}>How It Works</a>
            <a href="#quicksend" className={navLink}>QuickSend</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={() => navigate("/login")}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              Get Started Free
            </button>
          </div>

          <button
            className="rounded-lg p-2 text-white md:hidden cursor-pointer"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 px-6 py-5 md:hidden">
          <div className="flex items-center justify-between">
            <TasklertLogo
              size={36}
              textSize="text-xl"
              textColor="text-white"
              onClick={() => setMobileOpen(false)}
            />
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="cursor-pointer">
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="mt-10 flex flex-col gap-6 text-lg font-medium">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-slate-200 cursor-pointer">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="text-slate-200 cursor-pointer">How It Works</a>
            <a href="#quicksend" onClick={() => setMobileOpen(false)} className="text-slate-200 cursor-pointer">QuickSend</a>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 rounded-full border border-white/20 px-5 py-3 text-center font-medium text-white cursor-pointer"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-5 py-3 text-center font-semibold text-white cursor-pointer"
            >
              Get Started Free
            </button>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-10 lg:pt-16">
        <section className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-200 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-purple-300" />
            Productivity &amp; Task Reminder Workspace
          </div>

          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Get things done.{" "}
            <span className="bg-gradient-to-r from-purple-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
              Never miss a deadline.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Tasklert combines intelligent task priority management with automatic email reminders and quick messaging, keeping your workflow organized and stress-free.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15 cursor-pointer"
            >
              Sign In to Workspace
            </button>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 sm:max-w-md">
            {stats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5 text-center backdrop-blur-md">
                <p className="text-lg font-extrabold text-white sm:text-xl">{item.value}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-4 text-slate-300">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DASHBOARD PREVIEW MOCKUP WITH FLOATING REMINDER POPUP */}
        <section className="relative flex items-center justify-center pt-6 lg:pt-0">
          {/* Floating Task Reminder Alert Card */}
          <div className="absolute -top-3 right-0 sm:right-4 z-20 flex items-center gap-3 rounded-2xl border border-purple-400/40 bg-slate-900/95 p-3.5 shadow-2xl shadow-purple-950/80 backdrop-blur-xl animate-bounce-slow">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-md">
              <BellRing className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wide">⏰ Reminder Alert</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-300">Due Soon</span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5">Client proposal due in 2 hours</p>
              <p className="text-[10px] text-slate-400">Email alert dispatched to inbox</p>
            </div>
          </div>

          {/* Main Dashboard Interactive Preview Window */}
          <div className="w-full max-w-lg rounded-3xl border border-white/20 bg-slate-900/90 p-5 shadow-2xl shadow-purple-950/60 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white">Tasklert Workspace</span>
                  <p className="text-[10px] text-slate-400">Live Dashboard System</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Active
              </span>
            </div>

            {/* Filter Pills */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {["all", "high", "pending", "completed"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition cursor-pointer ${
                    activeTab === tab
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Quick Stat Cards */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-2.5 text-center">
                <p className="text-lg font-black text-slate-100">12</p>
                <p className="text-[10px] text-slate-400 font-medium">Total Tasks</p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-center">
                <p className="text-lg font-black text-rose-400">3</p>
                <p className="text-[10px] text-rose-300 font-medium">High Priority</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-center">
                <p className="text-lg font-black text-emerald-400">8</p>
                <p className="text-[10px] text-emerald-300 font-medium">Completed</p>
              </div>
            </div>

            {/* Simulated Live Task Items */}
            <div className="mt-4 space-y-2">
              {[
                { title: "Send onboarding docs to client", time: "Today, 4:00 PM", priority: "High", priorityColor: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
                { title: "Prepare weekly status report", time: "Today, 6:30 PM", priority: "Medium", priorityColor: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
                { title: "Review teammate's pull request", time: "Tomorrow, 10:00 AM", priority: "Low", priorityColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
              ].map((t) => (
                <div key={t.title} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/80 px-3.5 py-3 transition hover:border-slate-700">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-purple-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{t.title}</p>
                      <p className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {t.time}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${t.priorityColor}`}>
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>

            {/* Status Footer Alert */}
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-200">
              <Mail className="h-4 w-4 shrink-0 text-purple-400" />
              <span>Smart notifications active for all scheduled deadlines</span>
            </div>
          </div>
        </section>
      </main>

      {/* FEATURES SECTION */}
      <section id="features" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Everything your productive day needs
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
            Built for individuals and teams who want clarity, timely reminders, and fast execution without complex setup.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, text, accent }) => (
            <div
              key={title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10"
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2.5 text-xs leading-6 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">How Tasklert keeps you on track</h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md">
              <h3 className="text-base font-bold text-white">{step.title}</h3>
              <p className="mt-3 text-xs leading-6 text-slate-300">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* QUICKSEND SPOTLIGHT */}
      <section id="quicksend" className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-10">
        <div className="grid items-center gap-10 rounded-3xl border border-white/15 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-pink-500/10 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-200">
              <MessageCircleHeart className="h-4 w-4" />
              QuickSend Messenger
            </div>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
              Send emails or SMS straight from your dashboard
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">
              Need to send a quick project update or share a document? QuickSend lets you fire an email directly to any inbox or an SMS straight to any mobile device, complete with document attachments.
            </p>
            <ul className="mt-6 space-y-3 text-xs font-medium text-slate-200 sm:text-sm">
              {[
                "Real email delivery via backend mail server",
                "SMS delivery to mobile phone numbers",
                "Attach documents and task reports",
                "Instant delivery confirmation feedback",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/20 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-sm font-bold text-white">QuickSend Panel</span>
              <div className="flex gap-1.5">
                <span className="rounded-full bg-purple-600 px-3 py-1 text-[11px] font-semibold text-white">Email</span>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300">SMS</span>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="rounded-xl border border-slate-800 bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-200">
                To: <span className="text-purple-300">teammate@company.com</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-200">
                Here is the updated task report for today&apos;s sprint. Let me know your thoughts! 📎
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-3">
              <span className="text-slate-400 text-sm font-bold">+</span>
              <span className="text-slate-400 text-sm">📎</span>
              <span className="flex-1 text-xs text-slate-500">Type your message...</span>
              <div className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 p-2 shadow-md">
                <Send className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6 text-center backdrop-blur-md sm:p-8">
          <div className="mb-3 flex justify-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="h-5 w-5 fill-amber-400" />
            ))}
          </div>
          <p className="text-base leading-7 text-slate-100 sm:text-lg">
            &quot;Tasklert helped our team stop missing critical deadlines. The priority sorting, email reminders, and QuickSend feature made our workflow effortless.&quot;
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-purple-300">
            Riya Sharma — Product Lead
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-20 text-center sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-purple-600/20 via-fuchsia-600/10 to-pink-600/20 p-10 backdrop-blur-xl">
          <ShieldCheck className="mx-auto h-10 w-10 text-purple-300" />
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            Ready to build your focused routine?
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            Free to start. No credit card required.
          </p>
          <button
            onClick={() => navigate("/signup")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-purple-600/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
          >
            Create Your Free Account
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl border-t border-white/10 px-4 py-8 text-center text-xs text-slate-400 sm:px-6 lg:px-10">
        © {new Date().getFullYear()} Tasklert. All rights reserved. Built to keep your work organized and on time.
      </footer>
    </div>
  );
};

export default Landing;
