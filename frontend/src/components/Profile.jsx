import React, { useState, useEffect } from "react";
import { notify } from "../utils/toastManager";
import { BACK_BUTTON } from "../assets/dummy";
import {
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Save,
  Shield,
  LogOut,
  Lock,
  KeyRound,
  CheckCircle,
  Mail,
  User,
  Palette,
  Check,
  Laptop,
  Bell,
  HelpCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import DeviceNotificationSettings from "./DeviceNotificationSettings";
import { API_BASE_URL } from "../config/api";
const API_URL = API_BASE_URL;

const THEMES = [
  { name: "theme-blue", label: "Ocean Blue", color: "#1e88e5" },
  { name: "theme-peach", label: "Warm Peach", color: "#d4a373" },
  { name: "theme-green", label: "Emerald Green", color: "#a3d977" },
  { name: "theme-lavender", label: "Lavender Purple", color: "#a78bfa" },
  { name: "theme-dark", label: "Charcoal Dark", color: "#1f2937" },
  { name: "theme-pink", label: "Vibrant Fuchsia", color: "#c026d3" },
];

const Profile = ({ setCurrentUser, onLogout }) => {
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem("theme") || "theme-lavender");
  const [activeSection, setActiveSection] = useState("all"); // 'all' | 'account' | 'security' | 'themes'
  const navigate = useNavigate();

  const applyTheme = (theme) => {
    document.documentElement.classList.remove(
      "theme-blue",
      "theme-peach",
      "theme-green",
      "theme-lavender",
      "theme-dark",
      "theme-pink"
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
    setActiveTheme(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
    notify.success("Accent theme applied!", { toastId: "theme-applied" });
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (data.success)
          setProfile({ name: data.user.name, email: data.user.email });
        else notify.error(data.message);
      })
      .catch(() => notify.error("Unable to load profile information."));
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_URL}/api/user/profile`,
        { name: profile.name, email: profile.email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setCurrentUser?.((prev) => ({
          ...prev,
          name: profile.name,
          email: profile.email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
            profile.name
          )}&background=random`,
        }));
        notify.success("Profile updated successfully!");
      } else notify.error(data.message);
    } catch (err) {
      notify.error(err.response?.data?.message || "Profile update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return notify.error("New password & confirmation do not match.");
    }
    if (passwords.new.length < 8) {
      return notify.error("New password must be at least 8 characters.");
    }
    setSavingPassword(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_URL}/api/user/password`,
        {
          currentPassword: passwords.current,
          newPassword: passwords.new,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        notify.success("Password changed successfully!");
        setPasswords({ current: "", new: "", confirm: "" });
      } else notify.error(data.message);
    } catch (err) {
      notify.error(err.response?.data?.message || "Password change failed");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="w-full min-w-0 py-2 sm:py-4 px-2 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-purple-600 transition-colors bg-white px-3.5 py-1.5 rounded-lg border border-slate-200/80 shadow-xs hover:border-purple-200"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </button>

        {/* Header Profile Card - Mobile Centered Style matching Screen 12 */}
        <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-xs flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-400 via-fuchsia-500 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-sm">
              {profile.name ? profile.name[0].toUpperCase() : "N"}
            </div>
            <span className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="Active Account" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
            {profile.name || "Naveen"}
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {profile.email || "naveen@example.com"}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
            <CheckCircle className="w-3 h-3" /> Verified Member
          </div>
        </div>

        {/* MOBILE IOS GROUPED NAVIGATION LIST MATCHING SCREEN 12 */}
        <div className="sm:hidden rounded-3xl border border-purple-100 bg-white shadow-sm overflow-hidden divide-y divide-purple-50">
          {/* 1. Account Settings */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "account" ? "all" : "account")}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <User className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Account Settings</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 2. Notification Preferences */}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Notification Preferences</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 3. Theme & Appearance */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "themes" ? "all" : "themes")}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Palette className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Theme & Appearance</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 4. Connected Devices */}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Laptop className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Connected Devices</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 5. Security */}
          <button
            type="button"
            onClick={() => setActiveSection(activeSection === "security" ? "all" : "security")}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Shield className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Security</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 6. Help & Support */}
          <button
            type="button"
            onClick={() => {
              notify.info("Tasklert Support: Check documentation or contact support@tasklert.com");
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-purple-50/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <HelpCircle className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-gray-800">Help & Support</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* 7. Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-rose-50/50 transition cursor-pointer text-rose-600 font-bold"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm">Sign Out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400" />
          </button>
        </div>

        {/* Accent Theme Selection */}
        <section className={`bg-white rounded-3xl border border-purple-100 shadow-xs p-5 sm:p-6 space-y-3.5 transition-all duration-300 ${
          activeSection === "themes" ? "block animate-fadeIn" : "hidden sm:block"
        }`}>
          <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Accent Theme</h2>
              <p className="text-xs text-slate-500">Choose your favorite accent color across all pages and calendar cells</p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
            {THEMES.map((t) => {
              const isSelected = activeTheme === t.name;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => applyTheme(t.name)}
                  className={`h-11 sm:h-12 rounded-xl cursor-pointer border-2 transition-all shadow-xs flex items-center justify-center relative active:scale-95 ${
                    isSelected ? "border-purple-600 ring-2 ring-purple-300 scale-102" : "border-transparent hover:scale-102"
                  }`}
                  style={{ backgroundColor: t.color }}
                  title={t.label}
                  aria-label={`Switch to ${t.label}`}
                >
                  {isSelected && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Profile & Security Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <section className={`bg-white rounded-3xl border border-purple-100 shadow-xs p-6 space-y-5 transition-all duration-300 ${
            activeSection === "account" ? "block animate-fadeIn" : "hidden sm:block"
          }`}>
            <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <UserCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Personal Information</h2>
                <p className="text-xs text-slate-500">Update your account name and email address</p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Full Name</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all bg-slate-50/50">
                  <User className="text-purple-500 w-4 h-4 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full focus:outline-none text-sm text-slate-800 bg-transparent"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Email Address</label>
                <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all bg-slate-50/50">
                  <Mail className="text-purple-500 w-4 h-4 mr-2.5 shrink-0" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full focus:outline-none text-sm text-slate-800 bg-transparent"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:from-fuchsia-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.99] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? "Saving..." : "Save Profile Changes"}
              </button>
            </form>
          </section>

          {/* Security & Password */}
          <section className="bg-white rounded-2xl border border-purple-100 shadow-xs p-6 space-y-5 flex flex-col justify-between transition-all duration-300">
            <div>
              <div className="flex items-center gap-2.5 pb-3 border-b border-purple-100 mb-5">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Security & Password</h2>
                  <p className="text-xs text-slate-500">Ensure your account uses a strong password</p>
                </div>
              </div>

              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Current Password</label>
                  <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all bg-slate-50/50">
                    <Lock className="text-purple-500 w-4 h-4 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full focus:outline-none text-sm text-slate-800 bg-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">New Password</label>
                  <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all bg-slate-50/50">
                    <KeyRound className="text-purple-500 w-4 h-4 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      placeholder="New Password (min 8 chars)"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full focus:outline-none text-sm text-slate-800 bg-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Confirm New Password</label>
                  <div className="flex items-center border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all bg-slate-50/50">
                    <KeyRound className="text-purple-500 w-4 h-4 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      placeholder="Confirm New Password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full focus:outline-none text-sm text-slate-800 bg-transparent"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.99] disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                  {savingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="mt-6 pt-5 border-t border-red-100 bg-red-50/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                  <LogOut className="w-4 h-4" /> Log Out Session
                </h3>
                <p className="text-xs text-slate-500">Sign out of your active Tasklert session</p>
              </div>
              <button
                onClick={onLogout}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
              >
                Logout Now
              </button>
            </div>
          </section>
        </div>

        {/* Smart Alarm & Device Notifications Panel */}
        <DeviceNotificationSettings />
      </div>
    </div>
  );
};

export default Profile;
