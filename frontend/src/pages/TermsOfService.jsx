import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Calendar,
  Lock,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { TasklertLogo } from "../components/TasklertLogo";

export const TERMS_VERSION = "1.0";
export const TERMS_EFFECTIVE_DATE = "November 12, 2026";
export const TERMS_LAST_UPDATED = "November 12, 2026";

const sections = [
  { id: "intro", number: "01", title: "Introduction" },
  { id: "acceptance", number: "02", title: "Acceptance of Terms" },
  { id: "registration", number: "03", title: "Account Registration" },
  { id: "responsibilities", number: "04", title: "User Responsibilities" },
  { id: "content", number: "05", title: "Task Management & User Content" },
  { id: "reminders", number: "06", title: "Reminders & Notifications" },
  { id: "recurring", number: "07", title: "Recurring Tasks & Scheduling" },
  { id: "calendar", number: "08", title: "Calendar & Productivity Tools" },
  { id: "uploads", number: "09", title: "File Uploads & Attachments" },
  { id: "integrations", number: "10", title: "Email & Third-Party Integrations" },
  { id: "security", number: "11", title: "Account & System Security" },
  { id: "acceptable-use", number: "12", title: "Acceptable Use Policy" },
  { id: "availability", number: "13", title: "Service Availability & SLA" },
  { id: "third-party", number: "14", title: "Third-Party Services & Links" },
  { id: "intellectual-property", number: "15", title: "Intellectual Property Rights" },
  { id: "termination", number: "16", title: "Suspension & Termination" },
  { id: "liability", number: "17", title: "Limitation of Liability & Disclaimers" },
  { id: "changes", number: "18", title: "Changes to These Terms" },
  { id: "contact", number: "19", title: "Contact Information" },
];

export default function TermsOfService() {
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
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-md shadow-purple-600/30"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition"
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
              <FileText className="w-3.5 h-3.5" />
              <span>Version {TERMS_VERSION}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Effective Date: {TERMS_EFFECTIVE_DATE}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
              <span>Last Updated: {TERMS_LAST_UPDATED}</span>
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Tasklert Terms of Service
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-300">
            These Terms of Service govern your access to and use of Tasklert, our web applications, Android PWA, mobile alarms, calendar scheduling, and QuickSend communication features. Please read them carefully.
          </p>
        </div>
      </div>

      {/* ─── MAIN CONTENT CONTAINER (2-Column Desktop, 1-Column Mobile) ─── */}
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
                19 Sections
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
                  <span>Contents</span>
                </span>
                <span className="text-[11px] font-semibold text-slate-400">19 Sections</span>
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
                  to="/privacy"
                  className="w-full flex items-center justify-between p-2.5 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/5 text-xs font-bold text-purple-300 hover:text-white transition group"
                >
                  <span>Read Privacy Policy</span>
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
                Welcome to <strong>Tasklert</strong> (&quot;Tasklert&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), an intelligent task management, scheduling, alarm notification, and multi-channel communication platform accessible via our web application and progressive web application (PWA).
              </p>
              <p>
                These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User&quot;, &quot;you&quot;, or &quot;your&quot;) and Tasklert governing your access to and use of our website, services, applications, software, tools, and background features (collectively, the &quot;Service&quot;).
              </p>
            </section>

            {/* 2. Acceptance of Terms */}
            <section id="acceptance" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 02</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">2. Acceptance of Terms</h2>
              <p>
                By registering an account, clicking &quot;Create Account&quot;, &quot;Sign Up&quot;, or &quot;I agree to Tasklert&apos;s Terms of Service and Privacy Policy&quot;, or by accessing or using the Service, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our Privacy Policy.
              </p>
              <p>
                If you do not agree with any part of these Terms, you must immediately cease accessing and using the Service. If you are entering into these Terms on behalf of a company, organization, or other legal entity, you represent and warrant that you have the authority to bind such entity to these Terms.
              </p>
            </section>

            {/* 3. Account Registration */}
            <section id="registration" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 03</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">3. Account Registration &amp; Verification</h2>
              <p>
                To access features of Tasklert, you must register for an account by providing accurate, current, and complete information, including your name, email address, and a secure password of at least 8 characters.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Age Requirement:</strong> You must be at least 18 years of age, or the age of legal majority in your jurisdiction, to create an account.</li>
                <li><strong>Email OTP Verification:</strong> Registration requires successful validation via a single-use 6-digit cryptographic verification code sent to your provided email address.</li>
                <li><strong>OAuth Registration:</strong> You may also register or authenticate using authorized third-party OAuth providers, including Google and GitHub.</li>
                <li><strong>Accuracy of Information:</strong> You agree to maintain and promptly update your account information to keep it accurate, true, and complete.</li>
              </ul>
            </section>

            {/* 4. User Responsibilities */}
            <section id="responsibilities" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 04</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">4. User Responsibilities &amp; Credentials</h2>
              <p>
                You are solely responsible for maintaining the confidentiality of your login credentials, including your password and authentication tokens. You agree to accept full responsibility for all activities that occur under your account.
              </p>
              <p>
                You agree to notify Tasklert immediately upon discovering or suspecting any unauthorized access, security incident, or breach of your account. Tasklert will not be liable for any loss, damages, or consequences arising from your failure to safeguard your login credentials.
              </p>
            </section>

            {/* 5. Task Management and User Content */}
            <section id="content" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 05</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">5. Task Management &amp; User Content</h2>
              <p>
                Tasklert enables you to create, store, organize, edit, and delete task titles, descriptions, priority levels, subtask checklists, project groupings, and notes (collectively, &quot;User Content&quot;).
              </p>
              <p>
                <strong>Ownership:</strong> You retain full copyright and ownership of all User Content you submit to Tasklert.
              </p>
              <p>
                <strong>License to Tasklert:</strong> By submitting User Content, you grant Tasklert a worldwide, non-exclusive, royalty-free license solely to host, store, replicate, transmit, and display your User Content as strictly necessary to operate, maintain, and provide the Service to you. We do not sell, rent, or publicly display your User Content.
              </p>
            </section>

            {/* 6. Reminders and Notifications */}
            <section id="reminders" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 06</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">6. Reminders, Alarms &amp; Notification Disclaimers</h2>
              <p>
                Tasklert includes smart deadline reminders, browser push notifications, audible device alarms, snooze options, and automated email notifications.
              </p>
              <p className="bg-purple-950/40 border border-purple-500/30 p-4 rounded-2xl text-xs sm:text-sm text-purple-200">
                <strong>Important Notice on Critical Reminders:</strong> While Tasklert utilizes robust background schedulers and cron processes, timely delivery of alarms and notifications depends on factors outside our direct control, including your device power settings, operating system sleep/battery optimizations, network connectivity, browser notification permissions, and email service provider spam filters. Tasklert is not designed, warranted, or intended for mission-critical, life-safety, emergency, medical, or legal deadline alerting. You should not rely exclusively on Tasklert for reminders where failure or delay could lead to personal harm, legal forfeiture, or financial loss.
              </p>
            </section>

            {/* 7. Recurring Tasks and Scheduling */}
            <section id="recurring" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 07</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">7. Recurring Tasks &amp; Automated Scheduling</h2>
              <p>
                Tasklert provides automated recurrence functionality supporting daily, weekly, and monthly recurrence intervals. When you mark a recurring task complete or dismiss its alarm, the background worker automatically calculates the next occurrence and generates the subsequent task instance.
              </p>
              <p>
                You acknowledge that time zone transitions, daylight saving time shifts, and leap years are calculated using standard ISO UTC timestamps, and it is your responsibility to verify recurrence dates after altering your device or account time zone settings.
              </p>
            </section>

            {/* 8. Calendar and Productivity Features */}
            <section id="calendar" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 08</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">8. Calendar, Focus Timer &amp; Productivity Tools</h2>
              <p>
                Features such as the interactive Chessboard Calendar, Focus Timer (Pomodoro intervals), and Productivity Velocity Analytics are provided as self-improvement productivity aids.
              </p>
              <p>
                Tasklert makes no warranties or representations regarding specific productivity results, output increases, or work efficiency outcomes resulting from use of the Service.
              </p>
            </section>

            {/* 9. File Uploads and Attachments */}
            <section id="uploads" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 09</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">9. File Uploads &amp; Attachments</h2>
              <p>
                Tasklert allows you to upload document attachments, sprint reports, PDFs, and image files to tasks or QuickSend messages.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li><strong>Storage Restrictions:</strong> Uploaded files are subject to file size limitations (standard 3MB maximum per avatar / designated file limits) and permitted MIME types (JPEG, PNG, WEBP, GIF, PDF).</li>
                <li><strong>Prohibited Content:</strong> You may not upload files that contain viruses, malware, trojans, copyrighted material without authorization, pornographic content, defamatory content, or content that violates any applicable law.</li>
                <li><strong>No Archival Guarantee:</strong> Tasklert is not an archival backup service. You are responsible for retaining independent local copies of all critical files and documents.</li>
              </ul>
            </section>

            {/* 10. Email and Third-Party Integrations */}
            <section id="integrations" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 10</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">10. QuickSend &amp; Third-Party Integrations</h2>
              <p>
                Tasklert includes QuickSend communication tools enabling you to connect external channels:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-300">
                <li><strong>Tasklert Mail:</strong> System outbound notifications dispatched through our verified mail gateway.</li>
                <li><strong>Google Mail Integration:</strong> Users may voluntarily connect their personal Gmail account via Google OAuth PKCE. Tasklert accesses Gmail solely to synchronize email threads and send outbound messages at your explicit request. Our use and transfer of information received from Google APIs adhere strictly to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">Google API Services User Data Policy</a>, including Limited Use requirements.</li>
                <li><strong>Telegram Integration:</strong> Users may voluntarily connect Telegram accounts via MTProto. Tasklert transmits messages strictly upon user command. Users are bound by Telegram&apos;s Terms of Service.</li>
              </ul>
              <p>
                You may disconnect any connected email account or Telegram session at any time from your QuickSend settings.
              </p>
            </section>

            {/* 11. Account Security */}
            <section id="security" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 11</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">11. Account &amp; System Security</h2>
              <p>
                We employ industry-standard security measures, including bcrypt password hashing, 24-hour expiration JSON Web Tokens (JWT), single-use cryptographic handoff codes for OAuth handshakes, and rate limiting on authentication endpoints.
              </p>
              <p>
                However, no Internet transmission or electronic storage method is 100% invulnerable. We cannot and do not guarantee absolute security against unauthorized access or breaches.
              </p>
            </section>

            {/* 12. Acceptable Use Policy */}
            <section id="acceptable-use" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 12</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">12. Acceptable Use Policy</h2>
              <p>You agree not to misuse the Service. Specifically, you agree not to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                <li>Use the Service for any unlawful, fraudulent, harassing, or malicious purpose.</li>
                <li>Send unsolicited bulk emails, commercial spam, or phishing campaigns via QuickSend or Tasklert Mail.</li>
                <li>Attempt to probe, scan, or test the vulnerability of Tasklert systems, networks, or APIs without express authorization.</li>
                <li>Interfere with or disrupt the integrity or performance of the Service, servers, or database instances.</li>
                <li>Reverse engineer, decompile, disassemble, or derive the source code of any portion of the platform.</li>
                <li>Create multiple fraudulent accounts or bypass security access restrictions.</li>
              </ul>
            </section>

            {/* 13. Service Availability */}
            <section id="availability" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 13</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">13. Service Availability &amp; Modifications</h2>
              <p>
                Tasklert strives to maintain high availability and performance. However, we do not warrant that the Service will be continuous, uninterrupted, error-free, or entirely bug-free.
              </p>
              <p>
                The Service may be temporarily unavailable due to scheduled maintenance, software updates, host infrastructure outages, hardware failures, or force majeure events. We reserve the right to modify, enhance, or discontinue features of the Service with or without notice.
              </p>
            </section>

            {/* 14. Third-Party Services */}
            <section id="third-party" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 14</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">14. Third-Party Services &amp; Infrastructure</h2>
              <p>
                Tasklert relies on third-party cloud hosting providers, databases, and APIs, including Render, Vercel, MongoDB Atlas, Google Cloud Platform, and Telegram.
              </p>
              <p>
                Tasklert is not responsible for the performance, policies, uptime, or practices of any third-party service provider. Your interactions with third-party providers are governed by their respective terms and privacy policies.
              </p>
            </section>

            {/* 15. Intellectual Property */}
            <section id="intellectual-property" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 15</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">15. Intellectual Property Rights</h2>
              <p>
                The Tasklert platform, including the Tasklert name, vector logos, icons, interface designs, layout architecture, software code, databases, documentation, and all related intellectual property, are the sole and exclusive property of Tasklert and its creator, Israth Yasin Ahamad.
              </p>
              <p>
                Nothing in these Terms grants you any right, title, or interest in or to our trademarks, service marks, logos, or domain names without our prior written consent.
              </p>
            </section>

            {/* 16. Account Suspension and Termination */}
            <section id="termination" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 16</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">16. Account Suspension &amp; Termination</h2>
              <p>
                <strong>Termination by You:</strong> You may terminate your account at any time by navigating to your Account Settings and selecting &quot;Delete Account&quot;, or by contacting support.
              </p>
              <p>
                <strong>Termination by Tasklert:</strong> We reserve the right to suspend, disable, or terminate your account and access to the Service immediately, without prior notice, if you breach these Terms, violate the Acceptable Use Policy, engage in fraudulent activity, or create liability for Tasklert.
              </p>
            </section>

            {/* 17. Limitation of Liability */}
            <section id="liability" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 17</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">17. Limitation of Liability &amp; Disclaimers</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                IN NO EVENT SHALL TASKLERT, ITS DEVELOPERS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, WORK INTERRUPTION, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICE.
              </p>
            </section>

            {/* 18. Changes to These Terms */}
            <section id="changes" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400">Section 18</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">18. Changes to These Terms</h2>
              <p>
                We reserve the right to update, modify, or replace these Terms at our discretion. When material changes occur, we will update the &quot;Last Updated&quot; date and document version identifier (e.g. Version 1.1) at the top of this document, and provide prominent notification within the application or via email.
              </p>
              <p>
                Your continued access or use of Tasklert following the posting of revised Terms constitutes your explicit acceptance of the revised Terms.
              </p>
            </section>

            {/* 19. Contact Information */}
            <section id="contact" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md space-y-4">
              <span className="text-xs font-mono font-bold text-purple-400">Section 19</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">19. Contact Information</h2>
              <p>
                If you have questions, concerns, feedback, or legal inquiries regarding these Terms of Service, please contact us:
              </p>
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 space-y-2 text-xs sm:text-sm">
                <p className="flex items-center gap-2 text-slate-200">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span>Support Email: <strong className="text-white">support@tasklert.com</strong></span>
                </p>
                <p className="flex items-center gap-2 text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span>Platform Lead: <strong className="text-white">Israth Yasin Ahamad</strong></span>
                </p>
                <p className="text-slate-400 text-xs">
                  Tasklert Productivity Workspace • Document Identifier: TOS-V{TERMS_VERSION}
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
                to="/privacy"
                className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1.5 transition"
              >
                <span>Read our Privacy Policy</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

