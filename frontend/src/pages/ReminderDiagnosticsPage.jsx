import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  Smartphone,
  Laptop,
  Bell,
  RefreshCw,
  Send,
  Radio,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Search,
  Filter,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { syncPushSubscription, getNotificationPermission } from "../utils/pushManager";
import { notify } from "../utils/toastManager";

const API_BASE = API_BASE_URL;

const STATUS_CONFIG = {
  SCHEDULED: {
    label: "SCHEDULED",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: Clock,
    desc: "Future reminder armed with verified active Web Push delivery job.",
  },
  "PUSH SENT": {
    label: "PUSH SENT",
    color: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    icon: Send,
    desc: "Push notification accepted by Web Push server and dispatched to device.",
  },
  "DELIVERY CONFIRMED": {
    label: "DELIVERY CONFIRMED",
    color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    icon: CheckCircle2,
    desc: "Device Service Worker received and confirmed receipt of notification.",
  },
  "NATIVE ALARM SCHEDULED": {
    label: "NATIVE ALARM SCHEDULED",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    icon: Smartphone,
    desc: "Native Samsung Android AlarmManager exact clock alarm confirmed.",
  },
  FAILED: {
    label: "FAILED",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: XCircle,
    desc: "Delivery failed permanently or exceeded maximum retry attempts.",
  },
  "PERMISSION REQUIRED": {
    label: "PERMISSION REQUIRED",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: AlertTriangle,
    desc: "Notification permission missing or blocked in browser settings.",
  },
  "NOT VERIFIED": {
    label: "NOT VERIFIED",
    color: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: HelpCircle,
    desc: "No active push subscription or verified delivery channel available.",
  },
};

export default function ReminderDiagnosticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [browserPerm, setBrowserPerm] = useState("default");

  const fetchDiagnostics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${API_BASE}/api/reminders/diagnostics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to load reminder diagnostics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    setBrowserPerm(getNotificationPermission());
  }, [fetchDiagnostics]);

  const handleSyncPush = async () => {
    setActionLoading(true);
    try {
      const sub = await syncPushSubscription({ force: true });
      if (sub) {
        notify.success("Web Push subscription synchronized with backend!");
        setBrowserPerm(getNotificationPermission());
        await fetchDiagnostics(true);
      } else {
        notify.warn("Push subscription could not be established. Check browser permission.");
      }
    } catch (err) {
      notify.error(err.message || "Failed to sync push subscription");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_BASE}/api/notifications/test`,
        { customMessage: "Tasklert Background Diagnostic Test: Everything operational!" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        notify.success("Test push dispatched! Check notification shade.");
        await fetchDiagnostics(true);
      } else {
        notify.warn(res.data?.message || "Could not dispatch test push");
      }
    } catch (err) {
      notify.error(err.response?.data?.message || err.message || "Test push failed");
    } finally {
      setActionLoading(false);
    }
  };

  const items = data?.items || [];
  const filteredItems = items.filter((item) => {
    const matchesFilter = filterStatus === "all" || item.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.taskTitle && item.taskTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  Reminder Scheduling Diagnostics
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Real-time inspection of backend jobs, Web Push registration, exact scheduling, and delivery audit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchDiagnostics(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSyncPush}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs font-semibold text-purple-200 transition cursor-pointer disabled:opacity-50"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>Sync Web Push</span>
            </button>

            <button
              onClick={handleSendTestPush}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-xs font-bold text-white shadow-md shadow-purple-900/40 transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Test Push Alarm</span>
            </button>
          </div>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Push Subscriptions */}
          <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Web Push Devices</span>
              <Smartphone className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white">
                {data?.summary?.activePushSubscriptions ?? 0}
              </span>
              <span className="text-xs text-slate-400">active subscriptions</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400 truncate">
              {data?.summary?.pushDevices?.length
                ? data.summary.pushDevices.map((d) => `${d.deviceName} (${d.browser})`).join(", ")
                : "No devices subscribed yet."}
            </p>
          </div>

          {/* Card 2: Browser Permission */}
          <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Browser Permission</span>
              <Bell className="w-4 h-4 text-pink-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-lg font-extrabold uppercase ${
                  browserPerm === "granted"
                    ? "text-emerald-400"
                    : browserPerm === "denied"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {browserPerm}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {browserPerm === "granted"
                ? "Notifications enabled on this client."
                : "Click 'Sync Web Push' to grant permission."}
            </p>
          </div>

          {/* Card 3: Backend Scheduler */}
          <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Backend Scheduler</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg font-extrabold text-emerald-400">ACTIVE</span>
              <span className="text-xs text-slate-400">(30s cron loop)</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              UTC Server: {data?.summary?.serverTimeUTC ? new Date(data.summary.serverTimeUTC).toLocaleTimeString() : "Online"}
            </p>
          </div>

          {/* Card 4: VAPID Status */}
          <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">VAPID Configuration</span>
              <ShieldCheck className="w-4 h-4 text-fuchsia-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-lg font-extrabold ${
                  data?.summary?.isVapidConfigured ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {data?.summary?.isVapidConfigured ? "CONFIGURED" : "MISSING KEYS"}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {data?.summary?.isVapidConfigured
                ? "Server VAPID credentials ready."
                : "Configure VAPID_PUBLIC_KEY in backend/.env"}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-white/10 bg-slate-900/60">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search reminder title, ID, or linked task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {["all", "SCHEDULED", "PUSH SENT", "DELIVERY CONFIRMED", "NATIVE ALARM SCHEDULED", "FAILED", "PERMISSION REQUIRED", "NOT VERIFIED"].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    filterStatus === st
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {st === "all" ? "All Reminders" : st}
                </button>
              )
            )}
          </div>
        </div>

        {/* Diagnostics Table / Cards */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-purple-400 mb-3" />
            <p className="text-sm font-medium">Inspecting reminder scheduling state...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center border border-white/10 rounded-2xl bg-slate-900/40">
            <Bell className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No matching reminders found</p>
            <p className="text-xs text-slate-500 mt-1">
              Create a reminder from Calendar, Tasks, or Alarms to view scheduling diagnostics.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG["NOT VERIFIED"];
              const StatusIcon = cfg.icon;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 hover:border-purple-500/30 transition shadow-lg space-y-3"
                >
                  {/* Top Row: Title, ID & Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                        {item.taskTitle && (
                          <span className="text-[11px] font-medium text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 truncate">
                            Task: {item.taskTitle}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">ID: {item.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}
                        title={cfg.desc}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Diagnostic Fields Grid (Exact 11 Fields from Rule 6) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* 1. Scheduled Local Time & Timezone */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Scheduled Local Date &amp; Time
                      </span>
                      <p className="text-white font-bold mt-0.5">{item.scheduledLocal}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Timezone: {item.userTimeZone}</p>
                    </div>

                    {/* 2. Scheduled UTC Timestamp */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Scheduled UTC Timestamp
                      </span>
                      <p className="text-purple-300 font-mono text-[11px] mt-0.5 break-all">
                        {item.scheduledUTC}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Database anchor timestamp</p>
                    </div>

                    {/* 3. Backend Job Status */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Backend Job Status
                      </span>
                      <p className="text-white font-bold mt-0.5">{item.backendJobStatus}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Attempts: {item.deliveryAttempts}
                      </p>
                    </div>

                    {/* 4. Push Subscription Status */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Push Subscription Status
                      </span>
                      <p
                        className={`font-bold mt-0.5 ${
                          item.pushSubscriptionStatus.startsWith("ACTIVE")
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {item.pushSubscriptionStatus}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">VAPID subscription presence</p>
                    </div>

                    {/* 5. Native Alarm Scheduled Status */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Native Alarm Status
                      </span>
                      <p className="text-white font-bold mt-0.5">{item.nativeAlarmScheduledStatus}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Android AlarmManager</p>
                    </div>

                    {/* 6. Last Delivery Attempt */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Last Delivery Attempt
                      </span>
                      <p className="text-white font-bold mt-0.5">
                        {item.lastDeliveryAttempt ? new Date(item.lastDeliveryAttempt).toLocaleTimeString() : "None yet"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.lastDeliveryAttempt ? new Date(item.lastDeliveryAttempt).toLocaleDateString() : "Pending"}
                      </p>
                    </div>

                    {/* 7. Last Trigger Timestamp */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Last Trigger Timestamp
                      </span>
                      <p className="text-white font-bold mt-0.5">
                        {item.lastTriggerTimestamp ? new Date(item.lastTriggerTimestamp).toLocaleTimeString() : "None yet"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {item.lastTriggerTimestamp ? new Date(item.lastTriggerTimestamp).toLocaleDateString() : "Pending"}
                      </p>
                    </div>

                    {/* 8. Last Notification Result */}
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Last Notification Result
                      </span>
                      <p
                        className={`font-bold mt-0.5 ${
                          item.lastNotificationResult === "ACCEPTED"
                            ? "text-emerald-400"
                            : item.lastNotificationResult === "ERROR"
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {item.lastNotificationResult}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Push service dispatch state</p>
                    </div>
                  </div>

                  {/* Failure reason if any */}
                  {item.lastFailureReason && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <span className="font-bold">Last Failure Reason: </span>
                        <span>{item.lastFailureReason}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
