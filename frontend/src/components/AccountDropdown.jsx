import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  User,
  Settings,
  Palette,
  BellRing,
  LogOut,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import UserAvatar from "./UserAvatar";

export const AccountDropdown = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = user?.name || "User";
  const email = user?.email || "";
  const isGoogle = user?.provider === "google";

  // Close dropdown on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Handle keyboard accessibility (Escape to close, Focus retention)
  const handleKeyDown = useCallback(
    (e) => {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    },
    [open]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const handleNavigate = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogoutClick = () => {
    setOpen(false);
    onLogout?.();
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="account-menu-button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 sm:gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-full hover:bg-[color:var(--primary-50)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition cursor-pointer select-none border border-transparent hover:border-[color:var(--surface-border)]"
      >
        <UserAvatar user={user} size="sm" showStatus statusColor="bg-emerald-500" />
        <span className="hidden sm:inline-block max-w-[120px] truncate text-xs font-bold text-gray-700">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 hidden sm:block ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Account Menu Dropdown */}
      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="account-menu-button"
          className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-white shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn focus:outline-none"
        >
          {/* Account Header */}
          <div className="p-4 bg-gradient-to-b from-[color:var(--primary-50)] to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate tracking-tight">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate" title={email}>
                  {email || "Signed in"}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--primary-700)]">
                  {isGoogle ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[color:var(--primary-100)] text-[color:var(--primary-700)]">
                      <ShieldCheck className="w-3 h-3" />
                      Google Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[color:var(--primary-100)] text-[color:var(--primary-700)]">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified Member
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-2 space-y-0.5" role="group" aria-label="Account Destinations">
            {/* 1. My Profile */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/profile")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-[color:var(--primary-50)] transition cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-600)] group-hover:bg-[color:var(--primary-100)] transition">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold block text-xs sm:text-sm">My Profile</span>
                <span className="text-[11px] text-gray-400 block truncate">
                  Personal info &amp; account details
                </span>
              </div>
            </button>

            {/* 2. Account Settings */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/settings")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-[color:var(--primary-50)] transition cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-600)] group-hover:bg-[color:var(--primary-100)] transition">
                <Settings className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold block text-xs sm:text-sm">Account Settings</span>
                <span className="text-[11px] text-gray-400 block truncate">
                  General, alarms &amp; security hub
                </span>
              </div>
            </button>

            {/* 3. Appearance */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/settings?tab=appearance")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-[color:var(--primary-50)] transition cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-600)] group-hover:bg-[color:var(--primary-100)] transition">
                <Palette className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold block text-xs sm:text-sm">Appearance</span>
                <span className="text-[11px] text-gray-400 block truncate">
                  6 themes, accent colors &amp; contrast
                </span>
              </div>
            </button>

            {/* 4. Notification Preferences */}
            <button
              type="button"
              role="menuitem"
              onClick={() => handleNavigate("/settings?tab=notifications")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-[color:var(--primary-50)] transition cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-[color:var(--primary-50)] text-[color:var(--primary-600)] group-hover:bg-[color:var(--primary-100)] transition">
                <BellRing className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-semibold block text-xs sm:text-sm">
                  Notification Preferences
                </span>
                <span className="text-[11px] text-gray-400 block truncate">
                  Browser push, tones &amp; devices
                </span>
              </div>
            </button>
          </div>

          {/* Separated Destructive Action */}
          <div className="p-2 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogoutClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs sm:text-sm font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer group"
            >
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 group-hover:bg-rose-200 transition">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Log out of Tasklert</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;
