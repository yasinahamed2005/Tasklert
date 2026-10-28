import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Settings,
  User,
  Shield,
  Palette,
  BellRing,
  AlarmClock,
  Database,
  Volume2,
  VolumeX,
  Play,
  Square,
  Check,
  Globe,
  Calendar,
  Lock,
  KeyRound,
  Download,
  Trash2,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Clock,
  LogOut,
  Sliders,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { notify } from "../utils/toastManager";
import { soundManager } from "../utils/soundManager";
import UserAvatar from "../components/UserAvatar";
import DeviceNotificationSettings from "../components/DeviceNotificationSettings";

const THEMES = [
  { name: "theme-blue", label: "Ocean Blue", color: "#1e88e5", desc: "Cool, calm and focused productivity" },
  { name: "theme-peach", label: "Warm Peach", color: "#d4a373", desc: "Soft warm tones with gentle contrast" },
  { name: "theme-green", label: "Emerald Green", color: "#43a047", desc: "Fresh natural green for clarity" },
  { name: "theme-lavender", label: "Lavender Purple", color: "#8b5cf6", desc: "Signature Tasklert brand theme" },
  { name: "theme-dark", label: "Charcoal Dark", color: "#374151", desc: "High contrast dark slate workspace" },
  { name: "theme-pink", label: "Vibrant Fuchsia", color: "#c026d3", desc: "Energetic vivid berry magenta" },
];

const ALARM_SOUNDS = [
  { id: "digital", label: "Digital Beep", desc: "Electronic pulse tone" },
  { id: "classic", label: "Classic Bell", desc: "Traditional twin-bell chime" },
  { id: "chime", label: "Crystal Chime", desc: "Harmonic crystal resonance" },
  { id: "bell", label: "Morning Bell", desc: "Warm morning alarm chime" },
  { id: "soft", label: "Soft Reminder", desc: "Mellow reminder notification" },
];

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const TABS = [
  { id: "general", label: "General", icon: Sliders, desc: "Timezone, date formats & defaults" },
  { id: "profile", label: "Profile", icon: User, desc: "Personal information & photo" },
  { id: "security", label: "Security & Login", icon: Shield, desc: "Password & authentication" },
  { id: "appearance", label: "Appearance", icon: Palette, desc: "Accent colors & 6 themes" },
  { id: "notifications", label: "Notifications & Devices", icon: BellRing, desc: "Push alerts & registered devices" },
  { id: "alarms", label: "Alarms & Reminders", icon: AlarmClock, desc: "Default sound, volume & snooze" },
  { id: "privacy", label: "Privacy & Data", icon: Database, desc: "Data export & cache controls" },
];

const SettingsPage = ({ user, setCurrentUser, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get("tab") || "general";

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState(() => {
    try {
      const stored = localStorage.getItem("tasklert_general_settings");
      return stored
        ? JSON.parse(stored)
        : {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            dateFormat: "YYYY-MM-DD",
            weekStart: "Monday",
            soundEffects: true,
          };
    } catch {
      return {
        timeZone: "UTC",
        dateFormat: "YYYY-MM-DD",
        weekStart: "Monday",
        soundEffects: true,
      };
    }
  });

  // Theme State
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("theme") || "theme-lavender");

  // Alarms & Reminders Account Preferences State
  const [alarmPrefs, setAlarmPrefs] = useState({
    defaultSound: "digital",
    defaultVolume: 80,
    defaultSnoozeDuration: 5,
    defaultChannels: { push: true, inApp: true, email: false },
  });
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [previewingSound, setPreviewingSound] = useState(null);

  // Security Form State
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile Form State
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileEmail, setProfileEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const isGoogleAccount = user?.provider === "google";

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
    }
  }, [user]);

  // Load Remote Alarm Preferences
  const fetchPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingPrefs(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/reminders/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success && data.preferences) {
        setAlarmPrefs({
          defaultSound: data.preferences.defaultSound || "digital",
          defaultVolume: data.preferences.defaultVolume ?? 80,
          defaultSnoozeDuration: data.preferences.defaultSnoozeDuration ?? 5,
          defaultChannels: data.preferences.defaultChannels || { push: true, inApp: true, email: false },
        });
      }
    } catch (err) {
      console.warn("Could not load preferences:", err.message);
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      soundManager.stop();
    };
  }, []);

  // Set active tab
  const handleSelectTab = (tabId) => {
    soundManager.stop();
    setPreviewingSound(null);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  // Apply Theme
  const handleApplyTheme = (themeName) => {
    document.documentElement.classList.remove(
      "theme-blue",
      "theme-peach",
      "theme-green",
      "theme-lavender",
      "theme-dark",
      "theme-pink"
    );
    document.documentElement.classList.add(themeName);
    localStorage.setItem("theme", themeName);
    setActiveTheme(themeName);
    window.dispatchEvent(new CustomEvent("themechange", { detail: themeName }));
    notify.success("Theme updated!", { toastId: "theme-change-toast" });
  };

  // Preview Alarm Sound
  const handleToggleSoundPreview = (soundId) => {
    if (previewingSound === soundId) {
      soundManager.stop();
      setPreviewingSound(null);
    } else {
      soundManager.stop();
      soundManager.preview(soundId, alarmPrefs.defaultVolume);
      setPreviewingSound(soundId);
    }
  };

  // Save General Preferences
  const handleSaveGeneral = (e) => {
    e.preventDefault();
    try {
      localStorage.setItem("tasklert_general_settings", JSON.stringify(generalSettings));
      notify.success("General settings saved successfully!");
    } catch {
      notify.error("Could not save general settings to browser storage.");
    }
  };

  // Save Alarm Preferences to Backend
  const handleSaveAlarmPreferences = async (e) => {
    e.preventDefault();
    soundManager.stop();
    setPreviewingSound(null);
    setSavingPrefs(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_BASE_URL}/api/reminders/preferences`,
        alarmPrefs,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        notify.success("Alarm & reminder defaults saved successfully!");
      } else {
        notify.error(data.message || "Failed to save alarm preferences.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Error saving alarm preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  // Save Profile in Settings
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim() || !profileEmail.trim()) {
      notify.error("Name and email are required.");
      return;
    }
    setSavingProfile(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_BASE_URL}/api/user/profile`,
        { name: profileName.trim(), email: profileEmail.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setCurrentUser?.((prev) => ({
          ...prev,
          name: profileName.trim(),
          email: profileEmail.trim(),
        }));
        notify.success("Profile saved successfully!");
      } else {
        notify.error(data.message || "Failed to update profile.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Error updating profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Save Password
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      notify.error("New password and confirmation do not match.");
      return;
    }
    if (passwords.new.length < 8) {
      notify.error("New password must be at least 8 characters long.");
      return;
    }
    setSavingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_BASE_URL}/api/user/password`,
        { currentPassword: passwords.current, newPassword: passwords.new },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        notify.success("Password changed successfully!");
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        notify.error(data.message || "Failed to change password.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Export Tasks as CSV
  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API_BASE_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tasks = data.tasks || (Array.isArray(data) ? data : []);
      if (!tasks.length) {
        notify.info("No tasks to export.");
        return;
      }
      const headers = ["Title", "Description", "Priority", "Due Date", "Completed", "Created At"];
      const rows = tasks.map((t) => [
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${t.priority || "Low"}"`,
        `"${t.dueDate ? new Date(t.dueDate).toISOString() : ""}"`,
        `"${t.completed ? "Yes" : "No"}"`,
        `"${t.createdAt ? new Date(t.createdAt).toISOString() : ""}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasklert_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify.success("Tasks exported to CSV successfully!");
    } catch (err) {
      notify.error("Failed to export tasks: " + err.message);
    }
  };

  // Export Tasks as JSON
  const handleExportJSON = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API_BASE_URL}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tasks = data.tasks || (Array.isArray(data) ? data : []);
      const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasklert_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify.success("Tasks backup downloaded as JSON!");
    } catch (err) {
      notify.error("Failed to backup tasks: " + err.message);
    }
  };

  // Clear Cached App Data
  const handleClearCache = () => {
    try {
      sessionStorage.removeItem("tasklert_cached_tasks");
      notify.success("Offline task cache cleared. New data will be fetched fresh from server.");
    } catch {
      notify.error("Could not clear cache.");
    }
  };

  return (
    <div className="w-full min-w-0 py-3 sm:py-6 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Top Header */}
        <div className="bg-white rounded-3xl border border-purple-100 p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-[color:var(--primary-50)] text-[color:var(--primary-700)] shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Account Settings
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">
                Manage your preferences, appearance themes, alarms and security settings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 hover:text-[color:var(--primary-700)] hover:bg-[color:var(--primary-50)] transition cursor-pointer self-start sm:self-auto shadow-2xs"
          >
            <UserAvatar user={user} size="xs" />
            <span>View Full Profile</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Settings Navigation Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Mobile Horizontal Tabs (<md) */}
          <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectTab(id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 border ${
                    active
                      ? "bg-[color:var(--primary)] text-white border-[color:var(--primary)] shadow-xs"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Left Settings Sidebar (md: col-span-4 lg: col-span-3) */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 bg-white rounded-3xl border border-purple-100 p-2.5 shadow-xs sticky top-[calc(var(--app-header-height)+1.5rem)] space-y-1">
            <p className="px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-gray-400">
              Preferences Hub
            </p>
            {TABS.map(({ id, label, icon: Icon, desc }) => {
              const active = currentTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectTab(id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition cursor-pointer group ${
                    active
                      ? "bg-[color:var(--primary-50)] text-[color:var(--primary-800)] border border-[color:var(--primary-200)] shadow-2xs font-bold"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium border border-transparent"
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl transition shrink-0 ${
                      active
                        ? "bg-[color:var(--primary)] text-white shadow-xs"
                        : "bg-gray-100 text-gray-500 group-hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs sm:text-sm block tracking-tight truncate">
                      {label}
                    </span>
                    <span className="text-[11px] text-gray-400 block truncate">
                      {desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Main Focused Content Panel (md: col-span-8 lg: col-span-9) */}
          <main className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl border border-purple-100 p-6 sm:p-8 shadow-xs min-h-[500px]">
            {/* 1. GENERAL TAB */}
            {currentTab === "general" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[color:var(--primary)]" />
                    <span>General Preferences</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Set your timezone, display formats, and schedule configurations
                  </p>
                </div>

                <form onSubmit={handleSaveGeneral} className="space-y-5">
                  {/* Timezone */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Workspace Timezone
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
                          setGeneralSettings((prev) => ({ ...prev, timeZone: detected }));
                          notify.info(`Timezone detected: ${detected}`);
                        }}
                        className="text-xs font-bold text-[color:var(--primary-700)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Auto-detect</span>
                      </button>
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] transition">
                      <Globe className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                      <input
                        type="text"
                        value={generalSettings.timeZone}
                        onChange={(e) =>
                          setGeneralSettings({ ...generalSettings, timeZone: e.target.value })
                        }
                        placeholder="e.g. Asia/Kolkata, America/New_York, UTC"
                        className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Ensures alarms and notifications trigger accurately according to your local time.
                    </p>
                  </div>

                  {/* Date Format */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Date Display Format
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"].map((fmt) => {
                        const isSelected = generalSettings.dateFormat === fmt;
                        return (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() =>
                              setGeneralSettings((prev) => ({ ...prev, dateFormat: fmt }))
                            }
                            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "border-[color:var(--primary)] bg-[color:var(--primary-50)] text-[color:var(--primary-800)] font-bold shadow-2xs"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-xs font-medium">{fmt}</span>
                            {isSelected && <Check className="w-4 h-4 text-[color:var(--primary)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start of Week */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Calendar Week Starts On
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                      {["Monday", "Sunday"].map((day) => {
                        const isSelected = generalSettings.weekStart === day;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setGeneralSettings((prev) => ({ ...prev, weekStart: day }))
                            }
                            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "border-[color:var(--primary)] bg-[color:var(--primary-50)] text-[color:var(--primary-800)] font-bold shadow-2xs"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="text-xs font-medium">{day}</span>
                            {isSelected && <Check className="w-4 h-4 text-[color:var(--primary)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-white text-xs sm:text-sm font-bold shadow-xs hover:brightness-105 transition active:scale-95 cursor-pointer"
                    >
                      Save General Settings
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. PROFILE TAB */}
            {currentTab === "profile" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-[color:var(--primary)]" />
                      <span>Profile Information</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Manage your display name, email, and photo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[color:var(--primary-700)] bg-[color:var(--primary-50)] hover:bg-[color:var(--primary-100)] transition cursor-pointer"
                  >
                    <span>Photo &amp; Full Profile</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-[color:var(--primary-50)] border border-[color:var(--primary-100)] flex items-center gap-4">
                  <UserAvatar user={user} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {user?.name || "Tasklert User"}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">{user?.email || "No email"}</p>
                    <p className="text-[11px] text-[color:var(--primary-700)] font-semibold mt-1">
                      {isGoogleAccount ? "Google OAuth Account" : "Verified Account"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      required
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-white text-xs sm:text-sm font-bold shadow-xs hover:brightness-105 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {savingProfile ? "Saving..." : "Save Profile Details"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 3. SECURITY & LOGIN TAB */}
            {currentTab === "security" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[color:var(--primary)]" />
                    <span>Security &amp; Login</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Manage your authentication method and password
                  </p>
                </div>

                {isGoogleAccount ? (
                  <div className="p-5 rounded-2xl bg-sky-50 border border-sky-100 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-sky-900">Signed in via Google OAuth</h3>
                      <p className="text-xs text-sky-700 mt-0.5">
                        Your account password and two-factor authentication are securely managed by your Google Workspace / Google Account.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSavePassword} className="space-y-4 max-w-xl">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        placeholder="Current password"
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        required
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          placeholder="Min. 8 characters"
                          value={passwords.new}
                          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                          required
                          minLength={8}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          placeholder="Repeat new password"
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {savingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </form>
                )}

                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Session Controls</h4>
                    <p className="text-xs text-gray-500">End your current session on this device</p>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* 4. APPEARANCE TAB */}
            {currentTab === "appearance" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[color:var(--primary)]" />
                    <span>Appearance &amp; Themes</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Choose from Tasklert's six high-contrast themes. Changes apply instantly across all pages and calendar views.
                  </p>
                </div>

                {/* Theme Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {THEMES.map((t) => {
                    const isSelected = activeTheme === t.name;
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => handleApplyTheme(t.name)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer relative shadow-xs flex flex-col justify-between ${
                          isSelected
                            ? "border-[color:var(--primary)] ring-2 ring-[color:var(--primary-200)] bg-[color:var(--primary-50)]"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-6 h-6 rounded-full border border-black/10 shadow-xs shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                            <span className="text-sm font-bold text-gray-900">{t.label}</span>
                          </div>
                          {isSelected && (
                            <span className="p-1 rounded-full bg-[color:var(--primary)] text-white shadow-xs">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 font-medium">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {/* WCAG Contrast & Accessibility Notice */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-start gap-3 text-xs text-gray-600">
                  <Info className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-800">Theme Contrast Integrity:</span>
                    <p className="mt-0.5">
                      Every theme automatically computes WCAG AA-compliant avatar badges, buttons, active sidebar highlights, and calendar today badges.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. NOTIFICATIONS & DEVICES TAB */}
            {currentTab === "notifications" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[color:var(--primary)]" />
                    <span>Notifications &amp; Devices</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Configure web push permissions, test notifications, and manage quiet hours
                  </p>
                </div>

                <DeviceNotificationSettings />
              </div>
            )}

            {/* 6. ALARMS & REMINDERS TAB */}
            {currentTab === "alarms" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <AlarmClock className="w-5 h-5 text-[color:var(--primary)]" />
                      <span>Alarms &amp; Reminder Defaults</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      Configure your default tones, volume levels, and snooze intervals
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/alarms")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[color:var(--primary)] hover:brightness-105 shadow-xs transition cursor-pointer self-start sm:self-auto"
                  >
                    <AlarmClock className="w-3.5 h-3.5" />
                    <span>Open Alarms &amp; Clock</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Contextual Notice Differentiating Alarm Settings from Alarms Manager */}
                <div className="p-4 rounded-2xl bg-[color:var(--primary-50)] border border-[color:var(--primary-100)] flex items-start gap-3">
                  <Info className="w-5 h-5 text-[color:var(--primary-700)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-700">
                    <span className="font-bold text-gray-900">Default Alarm Behavior:</span>
                    <p className="mt-0.5">
                      The options configured here represent your account defaults for newly created tasks and focus sessions. To create, toggle, or dismiss active scheduled alarms, visit the{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/alarms")}
                        className="font-bold text-[color:var(--primary-800)] underline cursor-pointer"
                      >
                        Alarms &amp; Clock
                      </button>{" "}
                      manager.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveAlarmPreferences} className="space-y-6">
                  {/* Default Sound */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Default Alarm Sound
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ALARM_SOUNDS.map((snd) => {
                        const isSelected = alarmPrefs.defaultSound === snd.id;
                        const isPlaying = previewingSound === snd.id;
                        return (
                          <div
                            key={snd.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-[color:var(--primary)] bg-[color:var(--primary-50)] text-gray-900 shadow-2xs"
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setAlarmPrefs((prev) => ({ ...prev, defaultSound: snd.id }))
                              }
                              className="text-left flex-1 min-w-0 cursor-pointer"
                            >
                              <span className="text-xs font-bold block truncate">{snd.label}</span>
                              <span className="text-[11px] text-gray-400 block truncate">
                                {snd.desc}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleSoundPreview(snd.id)}
                              className={`p-2 rounded-xl transition cursor-pointer shrink-0 ml-2 ${
                                isPlaying
                                  ? "bg-rose-500 text-white shadow-xs"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                              title={isPlaying ? "Stop audio" : "Preview tone"}
                            >
                              {isPlaying ? (
                                <Square className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-[color:var(--primary)]" />
                        <span>Default Volume</span>
                      </label>
                      <span className="text-xs font-extrabold text-[color:var(--primary-700)]">
                        {alarmPrefs.defaultVolume}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <VolumeX className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={alarmPrefs.defaultVolume}
                        onChange={(e) =>
                          setAlarmPrefs({
                            ...alarmPrefs,
                            defaultVolume: Number(e.target.value),
                          })
                        }
                        className="w-full accent-[var(--primary)] cursor-pointer"
                      />
                      <Volume2 className="w-4 h-4 text-gray-700 shrink-0" />
                    </div>
                  </div>

                  {/* Snooze Duration */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Default Snooze Interval
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {SNOOZE_OPTIONS.map((min) => {
                        const isSelected = alarmPrefs.defaultSnoozeDuration === min;
                        return (
                          <button
                            key={min}
                            type="button"
                            onClick={() =>
                              setAlarmPrefs((prev) => ({
                                ...prev,
                                defaultSnoozeDuration: min,
                              }))
                            }
                            className={`p-3 rounded-xl border text-center transition cursor-pointer font-bold text-xs ${
                              isSelected
                                ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow-xs"
                                : "border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                            }`}
                          >
                            {min} Minutes
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notification Channels */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Default Alert Channels
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: "push", label: "Browser Push Alerts", desc: "Native OS banners" },
                        { key: "inApp", label: "In-App Audio Ringing", desc: "Full-screen alarm overlay" },
                        { key: "email", label: "Email Dispatch", desc: "Advance task warning" },
                      ].map(({ key, label, desc }) => {
                        const enabled = Boolean(alarmPrefs.defaultChannels?.[key]);
                        return (
                          <label
                            key={key}
                            className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                              enabled
                                ? "border-[color:var(--primary)] bg-[color:var(--primary-50)]"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) =>
                                setAlarmPrefs({
                                  ...alarmPrefs,
                                  defaultChannels: {
                                    ...alarmPrefs.defaultChannels,
                                    [key]: e.target.checked,
                                  },
                                })
                              }
                              className="mt-0.5 rounded text-[color:var(--primary)] accent-[var(--primary)] focus:ring-[var(--primary)]"
                            />
                            <div>
                              <span className="text-xs font-bold text-gray-900 block">{label}</span>
                              <span className="text-[11px] text-gray-400 block">{desc}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={savingPrefs || loadingPrefs}
                      className="px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-white text-xs sm:text-sm font-bold shadow-xs hover:brightness-105 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {savingPrefs ? "Saving..." : "Save Alarm Defaults"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 7. PRIVACY & DATA TAB */}
            {currentTab === "privacy" && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Database className="w-5 h-5 text-[color:var(--primary)]" />
                    <span>Privacy &amp; Data Controls</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Export your productivity data, manage offline storage, and view privacy policies
                  </p>
                </div>

                {/* Export Card */}
                <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Export Your Productivity Data</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Download an archive of all your tasks, priorities, tags, and recurrence rules.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Export as CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-purple-600" />
                      <span>Export as JSON</span>
                    </button>
                  </div>
                </div>

                {/* Offline Storage Cache */}
                <div className="p-5 rounded-2xl bg-white border border-gray-200 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Local Browser Cache</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tasklert stores temporary offline task state to make navigation instant. Purging this cache forces a fresh network query.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Offline Cache</span>
                  </button>
                </div>

                {/* Privacy Information */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-2">
                  <span className="font-bold text-gray-800 block">Tasklert Privacy Commitment:</span>
                  <p>
                    Your task titles, attachments, schedules, and notifications are securely scoped to your private user account. Tasklert does not sell your productivity data or share email contents with third-party advertisers.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
