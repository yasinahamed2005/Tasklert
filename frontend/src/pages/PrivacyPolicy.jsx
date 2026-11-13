import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Lock,
  Eye,
  FileText,
  Mail,
  Clock,
  Server,
  Trash2,
  ExternalLink,
  BookOpen,
  Database,
  UserCheck,
} from "lucide-react";
import { TasklertLogo } from "../components/TasklertLogo";

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_EFFECTIVE_DATE = "November 12, 2026";
export const PRIVACY_LAST_UPDATED = "November 12, 2026";

const sections = [
  { id: "intro", number: "01", title: "Introduction" },
  { id: "collect", number: "02", title: "Information We Collect" },
  { id: "account-info", number: "03", title: "Account Information" },
  { id: "task-data", number: "04", title: "Task & Productivity Data" },
  { id: "calendar-data", number: "05", title: "Calendar & Reminder Information" },
  { id: "files", number: "06", title: "Uploaded Files & Attachments" },
  { id: "auth-info", number: "07", title: "Authentication Information" },
  { id: "oauth", number: "08", title: "Google & GitHub OAuth Integrations" },
  { id: "communication-data", number: "09", title: "Email & Communication Data" },
  { id: "usage", number: "10", title: "How We Use Information" },
  { id: "security", number: "11", title: "Data Storage & Security Measures" },
  { id: "cookies", number: "12", title: "Cookies & Session Management" },
  { id: "third-parties", number: "13", title: "Third-Party Service Providers" },
  { id: "sharing", number: "14", title: "Data Sharing & Disclosure" },
  { id: "retention", number: "15", title: "Data Retention" },
  { id: "deletion", number: "16", title: "Account Deletion" },
  { id: "rights", number: "17", title: "User Rights & Data Access" },
  { id: "children", number: "18", title: "Children's Privacy" },
  { id: "transfers", number: "19", title: "International Data Transfers" },
  { id: "changes", number: "20", title: "Changes to This Privacy Policy" },
  { id: "contact", number: "21", title: "Contact Information" },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("intro");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Set dark background
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.setProperty("background-color", "#020617", "important");
    document.body.style.setProperty("background-color", "#020617", "important");
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveSection(id);
      setMobileTocOpen(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-slate-950 text-slate-100 selection:bg-purple-600 selection:text-white"
      style={{ backgroundColor: "#020617" }}
    >
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <TasklertLogo size={36} textSize="text-xl" textColor="text-white" onClick={() => navigate("/")} />
            <span className="hidden sm:inline-block h-5 w-px bg-white/15" />
            <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-purple-300">
              Legal Documents
            </span>
          </div>

          {/* Quick Navigation Tabs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/terms"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-md shadow-purple-600/30"
            >
              Privacy Policy
            </Link>
            <button
              onClick={() => navigate("/signup")}
              className="hidden md:inline-flex items-center gap-1.5 ml-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 text-xs font-bold text-white shadow-md hover:brightness-110 transition active:scale-95 cursor-pointer"
            >
              <span>Back to Sign Up</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO HEADER BANNER ─── */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-purple-950/30 via-slate-950 to-slate-950 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Version {PRIVACY_VERSION}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Effective Date: {PRIVACY_EFFECTIVE_DATE}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              <span>Last Updated: {PRIVACY_LAST_UPDATED}</span>
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Tasklert Privacy Policy
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-300">
            This Privacy Policy explains how Tasklert collects, uses, protects, and discloses information when you use our productivity platform, task organizers, mobile alarm services, and QuickSend messaging tools.
          </p>
        </div>
      </div>

      {/* ─── MAIN CONTENT CONTAINER ─── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Mobile Collapsible TOC */}
        <div className="lg:hidden mb-8 rounded-2xl border border-white/10 bg-slate-900/90 p-4 shadow-xl">
          <button
            type="button"
            onClick={() => setMobileTocOpen(!mobileTocOpen)}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white">Table of Contents</span>
              <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                21 Sections
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`}
            />
          </button>

          {mobileTocOpen && (
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition text-left cursor-pointer ${
                    activeSection === s.id
                      ? "bg-purple-600 text-white font-bold"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="truncate">
                    {s.number}. {s.title}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* DESKTOP STICKY SIDEBAR (TOC) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 rounded-3xl border border-white/10 bg-slate-900/80 p-5 backdrop-blur-xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Privacy Sections</span>
                </span>
                <span className="text-[11px] font-semibold text-slate-400">21 Sections</span>
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-210px)] overflow-y-auto no-scrollbar pr-1">
                {sections.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollToSection(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition text-left cursor-pointer ${
                        isActive
                          ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <span className={`text-[10px] font-mono shrink-0 ${isActive ? "text-purple-200" : "text-slate-500"}`}>
                        {s.number}
                      </span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-slate-800">
                <Link
                  to="/terms"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/5 text-xs font-bold text-purple-300 hover:text-white transition group"
                >
                  <span>Read Terms of Service</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </Link>
              </div>
            </div>
          </aside>

          {/* MAIN DOCUMENT TEXT AREA */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-10 text-slate-300 leading-relaxed text-sm sm:text-base">
            {/* 1. Introduction */}
            <section id="intro" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 01</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">1. Introduction</h2>
              <p>
                Tasklert (&quot;Tasklert&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal data and privacy. We design our software around principles of data minimization: we collect only what is strictly required to provide our task scheduling, alarm reminders, calendar views, and communication services.
              </p>
              <p>
                We do not sell your personal data. We do not display third-party advertisements or use tracking pixels for marketing brokers. This Privacy Policy details the exact types of information we process, why we need it, and how you retain complete control over your data.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="collect" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 02</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">2. Information We Collect</h2>
              <p>
                We collect personal information directly from you when you register an account, configure your profile, create tasks, set alarms, upload attachments, or use our QuickSend communication modules.
              </p>
              <p>
                We categorize this data into specific operational sets described below.
              </p>
            </section>

            {/* 3. Account Information */}
            <section id="account-info" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 03</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">3. Account Information</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Full Name:</strong> Used to personalize your workspace and identify you to team members or recipients when you dispatch emails.</li>
                <li><strong>Email Address:</strong> Used as your unique account identifier, for authentication, for sending OTP verification codes, and for delivering task reminder notifications.</li>
                <li><strong>Password:</strong> When registering via email/password, your password is immediately salted and irreversibly hashed using <code>bcrypt</code> (10 rounds) before storage in our MongoDB Atlas database. We never see, store, or transmit plaintext passwords.</li>
                <li><strong>Profile Avatar:</strong> If you upload a profile image, it is securely stored in local or cloud storage and associated with your user ID.</li>
              </ul>
            </section>

            {/* 4. Task and Productivity Data */}
            <section id="task-data" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 04</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">4. Task &amp; Productivity Data</h2>
              <p>
                To provide task organization and scheduling, we store:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Task titles, descriptions, and checklists.</li>
                <li>Priority levels: <code>High</code>, <code>Medium</code>, and <code>Low</code>.</li>
                <li>Status values: <code>pending</code> and <code>completed</code>.</li>
                <li>Due dates, deadlines, and completion timestamps.</li>
                <li>Custom tags, project workspace categories, and color tags.</li>
                <li>Focus session logs: elapsed minutes and completed Pomodoro intervals.</li>
              </ul>
              <p>
                All task records are isolated by authenticated user ID (<code>owner: req.user._id</code>), ensuring strict cross-user data isolation.
              </p>
            </section>

            {/* 5. Calendar and Reminder Information */}
            <section id="calendar-data" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 05</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">5. Calendar &amp; Reminder Information</h2>
              <p>
                We store scheduled dates in UTC ISO format alongside your selected time zone string (e.g. <code>Asia/Kolkata</code>, <code>UTC</code>) to guarantee time-zone-accurate alarm triggering. We record snooze configurations (5, 10, 15, or 30 minutes), recurrence rules (daily, weekly, monthly), and sound preference identifiers.
              </p>
            </section>

            {/* 6. Uploaded Files and Attachments */}
            <section id="files" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 06</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">6. Uploaded Files &amp; Attachments</h2>
              <p>
                When you upload attachments to tasks or messages, files are stored on server disk volumes with cryptographically sanitized filenames (e.g., <code>avatar_userId_timestamp.ext</code>) and MIME-type validation. File access is scoped to the user session, and URLs are resolved dynamically through centralized API configuration.
              </p>
            </section>

            {/* 7. Authentication Information */}
            <section id="auth-info" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 07</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">7. Authentication &amp; Token Handling</h2>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>JSON Web Tokens (JWT):</strong> Upon sign-in, we generate a cryptographically signed JWT containing your user ID, valid for 24 hours. Tokens are stored in browser <code>localStorage</code> for authorized API requests.</li>
                <li><strong>OTP Verification Codes:</strong> 6-digit signup and password reset codes are hashed using bcrypt before database storage and automatically expire after 10 minutes. Attempt counters strictly limit verification to 5 attempts before code invalidation.</li>
                <li><strong>OAuth Handoff Codes:</strong> Social login handshakes utilize ephemeral, single-use 32-byte cryptographic tokens stored in MongoDB with a 60-second time-to-live, preventing token leakage in URL query parameters.</li>
              </ul>
            </section>

            {/* 8. Google and GitHub OAuth */}
            <section id="oauth" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 08</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">8. Google &amp; GitHub OAuth Integrations</h2>
              <p>
                When you log in or connect services using Google or GitHub:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-300">
                <li><strong>Basic Login Scopes:</strong> We receive only your public name, primary email address, provider account ID, and profile picture URL.</li>
                <li><strong>QuickSend Gmail Integration:</strong> If you connect Google Mail inside QuickSend, we request OAuth permissions to read threads and dispatch outbound emails on your behalf. Tokens are stored in encrypted MongoDB records.</li>
                <li><strong>Google API Compliance:</strong> Tasklert&apos;s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data to train generalized AI/ML models.</li>
              </ul>
            </section>

            {/* 9. Email and Communication Data */}
            <section id="communication-data" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 09</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">9. Email &amp; QuickSend Communication Data</h2>
              <p>
                For QuickSend deliveries, we store audit logs containing recipient addresses, subject lines, message snippets, timestamps, delivery statuses (<code>scheduled</code>, <code>sent</code>, <code>failed</code>), and error messages to provide delivery tracking in your workspace.
              </p>
              <p>
                For Telegram integration, MTProto session strings are stored encrypted in isolated database documents and are never sent to the browser client or third parties.
              </p>
            </section>

            {/* 10. How We Use Information */}
            <section id="usage" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 10</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">10. How We Use Information</h2>
              <p>We use the data we collect solely for the following operational purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Providing, maintaining, and personalizing your task workspace and calendar.</li>
                <li>Executing background scheduled reminders, audible alarms, and email alerts.</li>
                <li>Processing outbound messages requested via Tasklert Mail, Gmail, or Telegram.</li>
                <li>Calculating productivity analytics, completion velocity, and on-time statistics.</li>
                <li>Authenticating accounts, verifying identity via OTP, and preventing account fraud.</li>
                <li>Responding to user support inquiries and technical feedback.</li>
              </ul>
            </section>

            {/* 11. Data Storage and Security */}
            <section id="security" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 11</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">11. Data Storage &amp; Security Measures</h2>
              <p>
                Your data is stored in cloud database clusters provided by <strong>MongoDB Atlas</strong> with encryption at rest using industry-standard AES-256 encryption.
              </p>
              <p>
                All network communication between your browser, our Node.js/Express backend on Render, and our Vercel frontend is encrypted in transit using <strong>Transport Layer Security (TLS 1.2/1.3 / HTTPS)</strong>. We implement Cross-Origin Resource Sharing (CORS) whitelists, rate limiting, parameter validation, and HTML sanitization (DOMPurify) to prevent injection and cross-site scripting vulnerabilities.
              </p>
            </section>

            {/* 12. Cookies and Session Management */}
            <section id="cookies" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 12</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">12. Cookies &amp; Local Storage</h2>
              <p>
                Tasklert does not use advertising, tracking, or marketing cookies. We use browser <code>localStorage</code> and <code>sessionStorage</code> solely for essential technical functions:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><code>token</code>: Encrypted session token for authenticating API requests.</li>
                <li><code>userId</code>: Current user identifier for client-side state restoration.</li>
                <li><code>tasklert_signup_draft</code>: Temporary draft storage while viewing Terms or Privacy Policy.</li>
                <li><code>theme</code>: Light/dark mode visual preference.</li>
              </ul>
            </section>

            {/* 13. Third-Party Services */}
            <section id="third-parties" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 13</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">13. Third-Party Service Providers</h2>
              <p>
                We partner with trusted infrastructure providers who process data strictly on our instructions:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>MongoDB Atlas:</strong> Managed database hosting and storage.</li>
                <li><strong>Render:</strong> Backend Node.js API hosting and background worker scheduling.</li>
                <li><strong>Vercel:</strong> Frontend static web application hosting and CDN distribution.</li>
                <li><strong>SMTP / Nodemailer:</strong> Transactional email delivery for OTP codes and task reminders.</li>
                <li><strong>Google Cloud &amp; Telegram:</strong> Authentication and messaging APIs when voluntarily connected.</li>
              </ul>
            </section>

            {/* 14. Data Sharing */}
            <section id="sharing" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 14</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">14. Data Sharing &amp; Non-Disclosure</h2>
              <p>
                We do not sell, rent, trade, or monetize your personal data. We disclose your information only in the following limited situations:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Service Providers:</strong> With cloud infrastructure providers strictly to execute core application functionality.</li>
                <li><strong>Legal Requirements:</strong> If required by valid law, subpoena, or governmental regulation.</li>
                <li><strong>Safety &amp; Protection:</strong> To protect the rights, property, or safety of Tasklert, our users, or the public.</li>
              </ul>
            </section>

            {/* 15. Data Retention */}
            <section id="retention" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 15</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">15. Data Retention</h2>
              <p>
                We retain your account, tasks, calendar events, and messages for as long as your account remains active. Temporary data, such as OTP verification codes, are permanently purged within 10 minutes.
              </p>
            </section>

            {/* 16. Account Deletion */}
            <section id="deletion" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 16</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">16. Account Deletion &amp; Data Purging</h2>
              <p>
                You have the full right to delete your Tasklert account at any time. When you request account deletion through your Account Settings or by emailing support:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Your user record, email, and authentication hashes are deleted from MongoDB.</li>
                <li>All tasks, subtasks, projects, and reminders associated with your user ID are deleted.</li>
                <li>All connected email tokens, credentials, and Telegram session records are deleted.</li>
                <li>Uploaded attachments and avatars associated with your account are purged.</li>
              </ul>
            </section>

            {/* 17. User Rights */}
            <section id="rights" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 17</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">17. User Rights (GDPR &amp; CCPA Compliance)</h2>
              <p>Depending on your location, you have rights regarding your personal data:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Right of Access:</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong>Right to Rectification:</strong> Edit or correct inaccurate account and profile data.</li>
                <li><strong>Right to Erasure:</strong> Request permanent deletion of all your personal data.</li>
                <li><strong>Right to Data Portability:</strong> Export your task and activity history.</li>
                <li><strong>Right to Withdraw Consent:</strong> Revoke OAuth integration permissions at any time.</li>
              </ul>
            </section>

            {/* 18. Children's Privacy */}
            <section id="children" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 18</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">18. Children&apos;s Privacy</h2>
              <p>
                Tasklert is intended for general adult and professional use and is not directed to children under 13 (or under 16 in certain jurisdictions). We do not knowingly collect personal data from children. If we discover that a child has provided us with personal information, we will immediately delete such data.
              </p>
            </section>

            {/* 19. International Data Transfers */}
            <section id="transfers" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 19</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">19. International Data Transfers</h2>
              <p>
                Your information may be transferred to and maintained on computers and cloud infrastructure located outside of your state, province, or country where data protection laws may differ. Our cloud providers maintain strict security certifications (SOC 2, ISO 27001) ensuring robust protection across all transfer channels.
              </p>
            </section>

            {/* 20. Changes to This Privacy Policy */}
            <section id="changes" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 20</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">20. Changes to This Privacy Policy</h2>
              <p>
                We may revise this Privacy Policy periodically to reflect enhancements to our platform or legal requirements. When changes occur, we update the &quot;Last Updated&quot; date and policy version at the top of this document. Continued use of Tasklert following notice of changes constitutes acceptance of the revised policy.
              </p>
            </section>

            {/* 21. Contact Information */}
            <section id="contact" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md space-y-4">
              <span className="text-xs font-mono font-bold text-purple-400">Section 21</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">21. Contact Information</h2>
              <p>
                For questions regarding this Privacy Policy, your personal data, or to exercise your privacy rights, please reach out:
              </p>
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 space-y-2 text-xs sm:text-sm">
                <p className="flex items-center gap-2 text-slate-200">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span>Privacy Inquiries: <strong className="text-white">privacy@tasklert.com</strong></span>
                </p>
                <p className="flex items-center gap-2 text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Data Protection Officer: <strong className="text-white">Israth Yasin Ahamad</strong></span>
                </p>
                <p className="text-slate-400 text-xs">
                  Tasklert Productivity Workspace • Document Identifier: PRIV-V{PRIVACY_VERSION}
                </p>
              </div>
            </section>

            {/* Bottom Back Button */}
            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-purple-600/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Sign Up</span>
              </button>

              <Link
                to="/terms"
                className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <span>Read our Terms of Service</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

