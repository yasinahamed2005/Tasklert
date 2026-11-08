import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ListChecks,
  Calendar,
  Timer,
  Menu,
  X,
  BarChart3,
  Send,
  Settings,
  User,
  LogOut,
  ChevronRight,
  AlarmClock,
} from "lucide-react";
import UserAvatar from "./UserAvatar";

const MobileBottomNav = ({ user, onLogout, tasks = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const pendingCount = tasks.filter(
    (t) => !["yes", true, 1].includes(typeof t.completed === "string" ? t.completed.toLowerCase() : t.completed)
  ).length;

  const username = user?.name || "User";
  const email = user?.email || "";

  const isMoreActive = ["/settings", "/profile", "/analytics", "/alarms", "/pending", "/complete"].includes(location.pathname) || moreOpen;

  const handleNav = (path) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* NATIVE-APP MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[color:var(--surface-1)] backdrop-blur-md border-t border-[color:var(--surface-border)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* 1. HOME */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
          </NavLink>

          {/* 2. FOCUS (Replaced Tasks) */}
          <NavLink
            to="/focus"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Timer className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Focus</span>
          </NavLink>

          {/* 3. CALENDAR */}
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Calendar</span>
          </NavLink>

          {/* 4. QUICKSEND (Added in place of Focus) */}
          <NavLink
            to="/messages"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("tasklert:quicksend-clicked"));
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">QuickSend</span>
          </NavLink>

          {/* 5. MORE */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
              isMoreActive
                ? "text-[color:var(--primary)] font-bold"
                : "text-slate-500 hover:text-slate-800 font-medium"
            }`}
          >
            <div className="relative">
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* MORE MOBILE ACTION SHEET / DRAWER */}
      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="More Navigation Options"
          className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-xs flex flex-col justify-end animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false);
          }}
        >
          <div className="bg-white rounded-t-3xl border-t border-slate-100 shadow-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overscroll-contain animate-slideUp">
            {/* Header / Grab Bar */}
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size="md" showStatus statusColor="bg-emerald-500" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 truncate">{username}</h3>
                  <p className="text-xs text-slate-500 truncate">{email || "Tasklert Member"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation List */}
            <div className="space-y-1">
              {/* Tasks & To-Dos */}
              <button
                type="button"
                onClick={() => handleNav("/pending")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[color:var(--primary-50)] text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Tasks &amp; To-Dos</span>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[color:var(--primary)] text-white text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {/* Alarms & Clock */}
              <button
                type="button"
                onClick={() => handleNav("/alarms")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[color:var(--primary-50)] text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                    <AlarmClock className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Alarms &amp; Clock</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Analytics & Productivity */}
              <button
                type="button"
                onClick={() => handleNav("/analytics")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[color:var(--primary-50)] text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Analytics &amp; Productivity</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Account Settings */}
              <button
                type="button"
                onClick={() => handleNav("/settings")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[color:var(--primary-50)] text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                    <Settings className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Account Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* My Profile */}
              <button
                type="button"
                onClick={() => handleNav("/profile")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[color:var(--primary-50)] text-slate-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">My Profile</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Log Out */}
              <div className="pt-2 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 transition cursor-pointer font-semibold text-sm"
                >
                  <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>Log out of Tasklert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomNav;