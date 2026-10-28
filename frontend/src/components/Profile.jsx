import React, { useState, useEffect, useRef } from "react";
import { notify } from "../utils/toastManager";
import {
  ChevronLeft,
  User,
  Mail,
  Camera,
  Trash2,
  Save,
  X,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Lock,
  ExternalLink,
  KeyRound,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import UserAvatar from "./UserAvatar";
import { API_BASE_URL } from "../config/api";

const Profile = ({ user, setCurrentUser, onLogout }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Editable Profile State
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
    provider: user?.provider || "local",
    createdAt: user?.createdAt || null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password Change State
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  // Sync state when props or backend loads
  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        avatar: user.avatar !== undefined ? user.avatar : prev.avatar,
        provider: user.provider || prev.provider,
        createdAt: user.createdAt || prev.createdAt,
      }));
    }
  }, [user]);

  // Fetch full user record from backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios
      .get(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (data.success && data.user) {
          const u = data.user;
          setProfile({
            name: u.name || "",
            email: u.email || "",
            avatar: u.avatar || "",
            provider: u.provider || "local",
            createdAt: u.createdAt || null,
          });
          setCurrentUser?.((prev) => ({
            ...prev,
            ...u,
          }));
        }
      })
      .catch((err) => {
        console.warn("Could not fetch remote profile details:", err.message);
      });
  }, [setCurrentUser]);

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim() || !profile.email.trim()) {
      notify.error("Name and email are required.");
      return;
    }

    setSavingProfile(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_BASE_URL}/api/user/profile`,
        { name: profile.name.trim(), email: profile.email.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setCurrentUser?.((prev) => ({
          ...prev,
          name: profile.name.trim(),
          email: profile.email.trim(),
        }));
        setIsEditing(false);
        notify.success("Profile information updated successfully!");
      } else {
        notify.error(data.message || "Failed to update profile");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to update profile information");
    } finally {
      setSavingProfile(false);
    }
  };

  // Cancel edit mode and restore current values
  const handleCancelEdit = () => {
    setProfile((prev) => ({
      ...prev,
      name: user?.name || prev.name,
      email: user?.email || prev.email,
    }));
    setIsEditing(false);
  };

  // Handle Avatar Image Upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image format
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      notify.error("Please upload a valid image file (JPEG, PNG, WEBP, or GIF).");
      return;
    }

    // Validate size (max 3 MB)
    if (file.size > 3 * 1024 * 1024) {
      notify.error("Profile picture size must not exceed 3 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API_BASE_URL}/api/user/avatar`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (data.success && data.avatar) {
        setProfile((prev) => ({ ...prev, avatar: data.avatar }));
        setCurrentUser?.((prev) => ({ ...prev, avatar: data.avatar }));
        notify.success("Profile photo updated successfully!");
      } else {
        notify.error(data.message || "Photo upload failed.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to upload photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove Avatar (reset to theme initials)
  const handleRemoveAvatar = async () => {
    if (!profile.avatar) return;
    setUploadingAvatar(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_BASE_URL}/api/user/profile`,
        { name: profile.name, email: profile.email, avatar: "" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setProfile((prev) => ({ ...prev, avatar: "" }));
        setCurrentUser?.((prev) => ({ ...prev, avatar: "" }));
        notify.success("Photo removed. Initial avatar active.");
      } else {
        notify.error(data.message || "Failed to remove avatar.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to remove avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
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
        notify.success("Password updated successfully!");
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        notify.error(data.message || "Password update failed.");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const isGoogleAccount = profile.provider === "google";
  const memberDate = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="w-full min-w-0 py-3 sm:py-6 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[color:var(--primary)] bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs hover:border-[color:var(--primary-200)] transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[color:var(--primary-700)] hover:text-[color:var(--primary-800)] bg-[color:var(--primary-50)] hover:bg-[color:var(--primary-100)] px-3.5 py-2 rounded-xl border border-[color:var(--primary-200)] transition cursor-pointer"
          >
            <span>All Settings</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. PROFESSIONAL PROFILE HERO CARD */}
        <div className="bg-white rounded-3xl border border-purple-100/90 shadow-xs overflow-hidden">
          {/* Header Accent Ribbon */}
          <div className="h-24 sm:h-32 bg-gradient-to-r from-[color:var(--primary-600)] via-[color:var(--primary-500)] to-[color:var(--primary-400)] relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_70%)]" />
          </div>

          {/* Profile Details Container */}
          <div className="px-5 sm:px-8 pb-6 sm:pb-8 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-16">
              {/* Avatar with Upload Action */}
              <div className="relative inline-block self-center sm:self-auto">
                <div className="p-1 rounded-full bg-white shadow-md">
                  <UserAvatar
                    user={{ ...user, avatar: profile.avatar }}
                    size="xl"
                    showStatus
                    statusColor="bg-emerald-500"
                  />
                </div>

                {/* Upload Button Overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Upload profile photo"
                  aria-label="Upload profile photo"
                  className="absolute bottom-1 right-1 p-2 rounded-full bg-gray-900 text-white hover:bg-black shadow-md border-2 border-white transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center sm:justify-end gap-2.5">
                {profile.avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                    title="Remove custom photo and use theme initials"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditing((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer ${
                    isEditing
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      : "bg-[color:var(--primary)] text-white hover:brightness-105"
                  }`}
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Edit Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* User Identity Details */}
            <div className="mt-4 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {profile.name || "Tasklert User"}
                </h1>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {isGoogleAccount ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                      Google Authenticated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Account
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                {profile.email || "No email provided"}
              </p>

              {memberDate && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-gray-400 mt-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member since {memberDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. EDIT FORM / INFORMATION GRID */}
        {isEditing ? (
          <div className="bg-white rounded-3xl border border-purple-100 p-6 sm:p-8 shadow-xs animate-fadeIn">
            <div className="pb-4 border-b border-gray-100 mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Edit Personal Information</h2>
                <p className="text-xs text-gray-500">Update your account name and email address</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                Editing
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent transition">
                  <User className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none"
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent transition">
                  <Mail className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full text-sm font-medium text-gray-800 bg-transparent focus:outline-none"
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[color:var(--primary)] text-white text-xs sm:text-sm font-bold shadow-xs hover:brightness-105 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingProfile ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Personal Details Card */}
            <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-[color:var(--primary)]" />
                  <span>Personal Details</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-[color:var(--primary-700)] hover:underline cursor-pointer"
                >
                  Edit
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Full Name
                  </span>
                  <p className="font-semibold text-gray-800 mt-0.5">{profile.name || "—"}</p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Email Address
                  </span>
                  <p className="font-semibold text-gray-800 mt-0.5">{profile.email || "—"}</p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Profile Photo
                  </span>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {profile.avatar
                      ? "Custom photo uploaded"
                      : "Theme-aware dynamic initial medallion"}
                  </p>
                </div>
              </div>
            </div>

            {/* Account & Security Summary Card */}
            <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[color:var(--primary)]" />
                  <span>Account Summary</span>
                </h3>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Authentication Provider
                  </span>
                  <p className="font-semibold text-gray-800 mt-0.5 capitalize">
                    {isGoogleAccount ? "Google OAuth" : "Email & Password"}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Account Status
                  </span>
                  <p className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Active &amp; Verified
                  </p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider block">
                    Settings &amp; Preferences
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className="text-xs font-bold text-[color:var(--primary-700)] hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>Configure in Settings Hub</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. SECURITY & PASSWORD CHANGE (Only for local email accounts) */}
        {!isGoogleAccount && (
          <div className="bg-white rounded-3xl border border-purple-100 p-6 sm:p-8 shadow-xs">
            <div className="pb-4 border-b border-gray-100 mb-6 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[color:var(--primary-50)] text-[color:var(--primary-700)]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Change Password</h2>
                <p className="text-xs text-gray-500">
                  Ensure your account uses a secure password with at least 8 characters
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent transition">
                  <KeyRound className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent transition">
                    <Lock className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      placeholder="Min. 8 characters"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="flex items-center border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent transition">
                    <Lock className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
                    <input
                      type="password"
                      placeholder="Re-enter new password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. SESSION LOGOUT & DANGER ZONE */}
        <div className="bg-rose-50/50 rounded-3xl border border-rose-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-sm font-bold text-rose-900 flex items-center justify-center sm:justify-start gap-1.5">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>Active Session</span>
            </h3>
            <p className="text-xs text-rose-700/80 mt-0.5">
              You are signed in as <strong className="font-bold">{profile.email}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
