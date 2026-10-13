import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import { BACK_BUTTON, personalFields, securityFields } from "../assets/dummy";
import { ChevronLeft, UserCircle, Save, Shield, LogOut, Lock, KeyRound, CheckCircle, Mail, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import DeviceNotificationSettings from "./DeviceNotificationSettings";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Profile = ({ setCurrentUser, onLogout }) => {
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const navigate = useNavigate();

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
        else toast.error(data.message);
      })
      .catch(() => toast.error("Unable to load profile information."));
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
        toast.success("Profile updated successfully!");
      } else toast.error(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Profile update failed");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return toast.error("New password & confirmation do not match.");
    }
    if (passwords.new.length < 8) {
      return toast.error("New password must be at least 8 characters.");
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
        toast.success("Password changed successfully!");
        setPasswords({ current: "", new: "", confirm: "" });
      } else toast.error(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed");
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

        {/* Header Profile Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-purple-100 p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-fuchsia-500 to-purple-600 flex items-center justify-center text-3xl font-extrabold text-white shadow-lg shadow-purple-500/25">
              {profile.name ? profile.name[0].toUpperCase() : "U"}
            </div>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Active Account" />
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              {profile.name || "Account Profile"}
            </h1>
            <p className="text-slate-500 text-sm flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-500" />
              {profile.email || "Manage your profile and security preferences"}
            </p>
            <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <CheckCircle className="w-3 h-3" /> Verified Member
              </span>
            </div>
          </div>
        </div>

        {/* Profile & Security Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <section className="bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 shadow-sm p-6 space-y-5 transition-all duration-300 hover:shadow-md">
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
          <section className="bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 shadow-sm p-6 space-y-5 flex flex-col justify-between transition-all duration-300 hover:shadow-md">
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
