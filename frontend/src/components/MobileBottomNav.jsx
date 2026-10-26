import React, { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, ListChecks, Calendar, Timer, Menu, X, BarChart3, Send, Bell, User, Palette, LogOut, ChevronRight, AlarmClock } from "lucide-react";
import ThemeSettings from "./ThemeSettings";

const MobileBottomNav = ({ user, onLogout, tasks = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [openThemeModal, setOpenThemeModal] = useState(false);

  const pendingCount = tasks.filter(
    (t) => !["yes", true, 1].includes(typeof t.completed === "string" ? t.completed.toLowerCase() : t.completed)
  ).length;

  const username = user?.name || "User";
  const email = user?.email || "";
  const initial = username.charAt(0).toUpperCase();

  const isTasksActive = location.pathname === "/pending" || location.pathname === "/complete";
  const isMoreActive = ["/settings", "/profile", "/messages", "/analytics", "/alarms"].includes(location.pathname) || moreOpen;

  const handleNav = (path) => {
    setMoreOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* NATIVE-APP MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-purple-100/80 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* 1. HOME */}
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-gray-500 hover:text-gray-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
          </NavLink>

          {/* 2. TASKS */}
          <button
            type="button"
            onClick={() => handleNav("/pending")}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
              isTasksActive && !moreOpen
                ? "text-[color:var(--primary)] font-bold"
                : "text-gray-500 hover:text-gray-800 font-medium"
            }`}
          >
            <div className="relative">
              <ListChecks className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-[color:var(--primary)] text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Tasks</span>
          </button>

          {/* 3. CALENDAR */}
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-gray-500 hover:text-gray-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Calendar</span>
          </NavLink>

          {/* 4. FOCUS */}
          <NavLink
            to="/focus"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
                isActive && !moreOpen
                  ? "text-[color:var(--primary)] font-bold"
                  : "text-gray-500 hover:text-gray-800 font-medium"
              }`
            }
          >
            <div className="relative">
              <Timer className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">Focus</span>
          </NavLink>

          {/* 5. MORE */}
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors duration-150 cursor-pointer ${
              isMoreActive
                ? "text-[color:var(--primary)] font-bold"
                : "text-gray-500 hover:text-gray-800 font-medium"
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
          <div className="bg-white rounded-t-3xl border-t border-purple-100 shadow-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto overscroll-contain animate-slideUp">
            {/* Header / Grab Bar */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full initial-avatar flex items-center justify-center text-sm font-bold shadow-xs">
                  {initial}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-800 truncate">{username}</h3>
                  <p className="text-xs text-gray-500 truncate">{email || "Tasklert Member"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Grid / List */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handleNav("/profile")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Account Profile &amp; Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleNav("/analytics")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Analytics &amp; Productivity</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleNav("/messages")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Send className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">QuickSend Messenger</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleNav("/settings")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Alarms &amp; Device Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => handleNav("/alarms")}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <AlarmClock className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Alarms Clock (On/Off)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setOpenThemeModal(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 text-gray-700 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Palette className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold">Theme &amp; Accent Color</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <div className="pt-2 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-50 text-red-600 transition cursor-pointer font-semibold text-sm"
                >
                  <div className="p-2 rounded-lg bg-red-100 text-red-600">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accent Theme Modal Triggered from More Menu */}
      {openThemeModal && (
        <ThemeSettings
          isOpen={openThemeModal}
          onClose={() => setOpenThemeModal(false)}
        />
      )}
    </>
  );
};

export default MobileBottomNav;
