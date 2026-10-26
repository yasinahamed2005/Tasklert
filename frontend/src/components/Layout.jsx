import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import axios from "axios";
import { TrendingUp, Circle, Clock, Zap, AlertTriangle } from "lucide-react";
import { notify } from "../utils/toastManager";
import AlertsPanel from "./AlertsPanel";
import AlarmModal from "./AlarmModal";
import MobileBottomNav from "./MobileBottomNav";
import NotificationPermissionBanner from "./NotificationPermissionBanner";
import ErrorBoundary from "./ErrorBoundary";
import { showBrowserNotification } from "../utils/pushManager";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;

// STATISTIC CARD (defined outside Layout to avoid remounting on each render)
const StatCard = ({ title, value, icon }) => (
  <div className="p-2 sm:p-3 rounded-xl bg-white shadow-sm border border-purple-100 hover:shadow-md transition-all duration-300 hover:border-purple-200 group">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 group-hover:from-fuchsia-500/20 group-hover:to-purple-500/20">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold text-[color:var(--text-strong)]">
          {value}
        </p>
        <p className="text-xs text-gray-500 font-medium">{title}</p>
      </div>
    </div>
  </div>
);

const Layout = ({ onLogout, user }) => {
  const location = useLocation();
  const isFullWidthPage = ["/settings", "/profile", "/messages", "/calendar", "/analytics", "/focus"].includes(location.pathname);
  const [tasks, setTasks] = useState(() => {
    try {
      const cached = sessionStorage.getItem("tasklert_cached_tasks");
      return cached ? JSON.parse(cached) : [];
    } catch (_) {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem("tasklert_cached_tasks");
    } catch (_) {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeAlarm, setActiveAlarm] = useState(null);

  // Notification lifecycle & storm protection refs
  const isInitialNotifFetchRef = useRef(true);
  const knownNotificationIdsRef = useRef(new Set());
  const currentUserIdRef = useRef(user?.id || user?._id || localStorage.getItem("userId") || "");

  // Reset notification state on user logout or account switch to prevent data leakage
  useEffect(() => {
    const activeId = user?.id || user?._id || localStorage.getItem("userId") || "";
    if (currentUserIdRef.current && currentUserIdRef.current !== activeId) {
      knownNotificationIdsRef.current.clear();
      isInitialNotifFetchRef.current = true;
      setNotifications([]);
      setUnreadCount(0);
      notify.clear();
    }
    currentUserIdRef.current = activeId;
  }, [user]);

  // Reset scroll to top on page transition (instant, zero artificial delay)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const fetchTasks = useCallback(async () => {
    setError(null);
    try {
      const token = localStorage.getItem("token");

      // ✅ If there's no token, send user back to login instead of throwing
      if (!token) {
        console.warn("No token found -> Redirecting to login");
        setLoading(false);
        onLogout();
        return;
      }

      const { data } = await axios.get(
        `${API_BASE}/api/tasks/gp`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.tasks)
        ? data.tasks
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setTasks(arr);
      try {
        sessionStorage.setItem("tasklert_cached_tasks", JSON.stringify(arr));
      } catch (_) {}
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not load tasks.");
      if (err.response?.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const { data } = await axios.get(
        `${API_BASE}/api/notifications?scope=all`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const list = Array.isArray(data?.notifications)
        ? data.notifications
        : [];
      setNotifications(list);
      setUnreadCount(Number(data?.unreadCount || 0));

      // Quiet initial load: seed known IDs so historical notifications populate NotificationBell quietly
      // without firing ANY toasts or browser notifications on login/startup/refresh
      if (isInitialNotifFetchRef.current) {
        list.forEach((item) => knownNotificationIdsRef.current.add(item._id));
        isInitialNotifFetchRef.current = false;
        return;
      }

      // Subsequent background polls: only alert on genuinely new unread notifications that arrived during active session
      const newUnreadItems = list.filter(
        (item) => !item.read && !knownNotificationIdsRef.current.has(item._id)
      );

      if (newUnreadItems.length > 0) {
        newUnreadItems.forEach((item) => knownNotificationIdsRef.current.add(item._id));

        if (newUnreadItems.length === 1) {
          const single = newUnreadItems[0];
          notify.info(`${single.title}: ${single.message}`, {
            toastId: `notif-${single._id}`,
            autoClose: 5000,
          });
          showBrowserNotification(single.title || "Task Update", {
            body: single.message,
          });
        } else {
          // Bounded burst alert: top priority notification + compact discreet summary
          const top = newUnreadItems[0];
          notify.info(`${top.title}: ${top.message}`, {
            toastId: `notif-${top._id}`,
            autoClose: 4000,
          });
          notify.info(
            `You have ${newUnreadItems.length} new notifications. Check your notification center.`,
            { toastId: "notif-burst-summary", autoClose: 4000 }
          );
          showBrowserNotification(`Tasklert (${newUnreadItems.length} new notifications)`, {
            body: `${top.title}: ${top.message}`,
          });
        }
      }
    } catch (err) {
      console.error("fetchNotifications error:", err.message);
      if (err.response?.status === 401) onLogout();
    }
  }, [onLogout]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const markNotificationRead = useCallback(
    async (id) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        await axios.patch(
          `${API_BASE}/api/notifications/${id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setNotifications((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, read: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("markNotificationRead error:", err);
      }
    },
    []
  );

  const deleteSingleNotification = useCallback(
    async (id) => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        await axios.delete(`${API_BASE}/api/notifications/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setNotifications((prev) => prev.filter((item) => item._id !== id));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("deleteNotification error:", err);
      }
    },
    []
  );

  const clearAllNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await axios.delete(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("clearAllNotifications error:", err);
    }
  }, []);

  const isTaskCompleted = useCallback((task) => {
    const value = task?.completed;
    if (value === true || value === 1) return true;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "yes" || normalized === "true" || normalized === "completed";
    }
    return false;
  }, []);

  const stats = useMemo(() => {
    const completedTasks = tasks.filter(isTaskCompleted).length;

    const totalCount = tasks.length;
    const pendingCount = totalCount - completedTasks;

    const completionPercentage = totalCount
      ? Math.round((completedTasks / totalCount) * 100)
      : 0;

    return {
      totalCount,
      completedTasks,
      pendingCount,
      completionPercentage,
    };
  }, [tasks, isTaskCompleted]);

  // 1. Listen for background push notifications and action clicks forwarded via Service Worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleMessage = (event) => {
      if (event.data?.type === "TASKLERT_ALARM_EVENT" && event.data?.alarm) {
        console.log("🔔 Received alarm event from Service Worker:", event.data.alarm);
        setActiveAlarm(event.data.alarm);
      } else if (event.data?.type === "TASKLERT_NOTIFICATION_ACTION") {
        const { action, alarmId } = event.data;
        const token = localStorage.getItem("token");
        if (token && alarmId) {
          if (action === "dismiss") {
            axios
              .post(
                `${API_BASE}/api/reminders/${alarmId}/dismiss`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              )
              .then(() => {
                notify.info("Alarm dismissed & task marked completed.");
                fetchTasks();
                fetchNotifications();
              })
              .catch(console.error);
          } else if (action === "snooze") {
            axios
              .post(
                `${API_BASE}/api/reminders/${alarmId}/snooze`,
                { durationMinutes: 5 },
                { headers: { Authorization: `Bearer ${token}` } }
              )
              .then(() => {
                notify.info("Alarm snoozed for 5 minutes.");
                fetchTasks();
                fetchNotifications();
              })
              .catch(console.error);
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, [fetchTasks, fetchNotifications]);

  // Handle URL query parameters triggered by Service Worker notification clicks (e.g. ?alarmId=...&notifAction=dismiss)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const alarmId = params.get("alarmId");
    const notifAction = params.get("notifAction");

    if (!alarmId) return;

    const token = localStorage.getItem("token");
    window.history.replaceState({}, "", location.pathname);

    if (!token) return;

    if (notifAction === "dismiss") {
      axios
        .post(
          `${API_BASE}/api/reminders/${alarmId}/dismiss`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then(() => {
          notify.info("Alarm dismissed & task marked completed.");
          fetchTasks();
          fetchNotifications();
        })
        .catch(console.error);
    } else if (notifAction === "snooze") {
      axios
        .post(
          `${API_BASE}/api/reminders/${alarmId}/snooze`,
          { durationMinutes: 5 },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then(() => {
          notify.info("Alarm snoozed for 5 minutes.");
          fetchTasks();
          fetchNotifications();
        })
        .catch(console.error);
    } else {
      // Open action or general click: fetch reminder and open alarm modal
      axios
        .get(`${API_BASE}/api/reminders/${alarmId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(({ data }) => {
          if (data?.reminder) {
            const r = data.reminder;
            setActiveAlarm({
              title: r.title,
              body: r.message,
              alarmId: r._id,
              taskId: r.task?._id || r.task,
              sound: r.sound || "digital",
              volume: r.volume || 80,
              priority: r.priority || "Medium",
              scheduledAt: r.scheduledAt,
            });
          }
        })
        .catch(console.error);
    }
  }, [location.search, location.pathname, fetchTasks, fetchNotifications]);

  // 2. Active foreground tab alarm trigger for remindable tasks
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const checkDueAlarms = () => {
      const now = Date.now();
      for (const task of tasks) {
        if (task.reminderEnabled && task.reminderAt && !isTaskCompleted(task)) {
          const reminderTime = new Date(task.reminderAt).getTime();
          const alarmKey = `tasklert-active-alarm-${task._id || task.id}-${task.reminderAt}`;
          const alreadyFired = sessionStorage.getItem(alarmKey);

          // If due within the last 5 minutes and not yet fired in this session:
          if (!alreadyFired && reminderTime <= now && now - reminderTime < 5 * 60 * 1000) {
            sessionStorage.setItem(alarmKey, "1");
            setActiveAlarm({
              title: `⏰ Alarm: ${task.title}`,
              body: task.description || `Task "${task.title}" reminder is due now!`,
              taskId: task._id || task.id,
              sound: task.alarmSound || "digital",
              volume: task.alarmVolume || 80,
              priority: task.priority || "Medium",
              scheduledAt: task.reminderAt,
            });
            break;
          }
        }
      }
    };

    checkDueAlarms();
    const interval = setInterval(checkDueAlarms, 15000);
    return () => clearInterval(interval);
  }, [tasks, isTaskCompleted]);


  const outletContext = useMemo(
    () => ({ tasks, refreshTasks: fetchTasks, user, loadingTasks: loading }),
    [tasks, fetchTasks, user, loading]
  );

  // ERROR (Only block dashboard/tasks when tasks are critical and unavailable)
  const isTaskCriticalPage = ["/", "/pending", "/Complete"].includes(location.pathname);
  if (error && tasks.length === 0 && isTaskCriticalPage)
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-rose-100 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-base">Could not load tasks</h3>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchTasks}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <Navbar
        user={user}
        onLogout={onLogout}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkNotificationRead={markNotificationRead}
        onClearAllNotifications={clearAllNotifications}
        onDeleteNotification={deleteSingleNotification}
      />
      <Sidebar user={user} tasks={tasks} />
      <div className="min-w-0 ml-0 md:ml-20 lg:ml-64 xl:ml-64 pt-[calc(var(--app-header-height)+0.75rem)] px-2.5 sm:px-4 md:px-6 pb-24 md:pb-8 transition-all duration-300">
        {isFullWidthPage ? (
          <div className="w-full min-w-0 animate-page-enter">
            <ErrorBoundary>
              <Outlet context={outletContext} />
            </ErrorBoundary>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 w-full min-w-0 max-w-full animate-page-enter">
            <div className="xl:col-span-2 space-y-3 sm:space-y-4 min-w-0 w-full max-w-full">
              <ErrorBoundary>
                <Outlet context={outletContext} />
              </ErrorBoundary>
            </div>

            <div className="hidden xl:block xl:col-span-1 space-y-4 sm:space-y-6 min-w-0">
              <AlertsPanel tasks={tasks} />
              {/* STATISTICS */}
              <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-purple-100">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  Task Statistics
                </h3>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <StatCard
                    title="Total Tasks"
                    value={stats.totalCount}
                    icon={
                      <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
                    }
                  />
                  <StatCard
                    title="Completed"
                    value={stats.completedTasks}
                    icon={
                      <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                    }
                  />
                  <StatCard
                    title="Pending"
                    value={stats.pendingCount}
                    icon={
                      <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-fuchsia-500" />
                    }
                  />
                  <StatCard
                    title="Completion Rate"
                    value={`${stats.completionPercentage}%`}
                    icon={
                      <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500" />
                    }
                  />
                </div>

                <hr className="my-3 sm:my-4 border-purple-100" />

                {/* PROGRESS BAR */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="text-xs sm:text-sm font-medium flex items-center gap-1.5">
                      <Circle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-500 fill-purple-500" />
                      Task Progress
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 sm:px-2 rounded-full">
                      {stats.completedTasks} / {stats.totalCount}
                    </span>
                  </div>

                  <div className="relative pt-1">
                    <div className="flex gap-1.5 items-center">
                      <div className="flex-1 h-2 sm:h-3 rounded-full overflow-hidden theme-progress-track">
                        <div
                          className="h-full rounded-full transition-all duration-500 theme-progress-fill"
                          style={{ width: `${stats.completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT ACTIVITY */}
              <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-purple-100">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                  Recent Activity
                </h3>

                <div className="space-y-2 sm:space-y-3">
                  {tasks.slice(0, 3).map((task) => (
                    <div
                      key={task._id || task.id}
                      className="flex items-center justify-between p-2 sm:p-3 hover:bg-purple-50/50 rounded-lg transition-colors duration-200 border border-transparent hover:border-purple-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 break-words whitespace-normal">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {task.createdAt
                            ? new Date(task.createdAt).toLocaleDateString()
                            : "No date"}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full shrink-0 ml-2 ${
                          isTaskCompleted(task)
                            ? "bg-green-100 text-green-700"
                            : "bg-fuchsia-100 text-fuchsia-700"
                        }`}
                      >
                        {isTaskCompleted(task) ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}

                  {tasks.length === 0 && (
                    <div className="text-center py-4 sm:py-6 px-2">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                        <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
                      </div>
                      <p className="text-sm text-gray-500">
                        No recent tasks available
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Tasks will appear here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GLOBAL ACTIVE ALARM MODAL */}
      {activeAlarm && (
        <AlarmModal
          alarm={activeAlarm}
          onClose={() => setActiveAlarm(null)}
          onActionCompleted={(result) => {
            if (result?.dismissed && result?.taskId) {
              setTasks((prev) =>
                prev.map((t) =>
                  String(t._id || t.id) === String(result.taskId)
                    ? { ...t, completed: true, completedAt: new Date().toISOString() }
                    : t
                )
              );
            }
            fetchTasks();
            fetchNotifications();
          }}
        />
      )}

      {/* RESPECTFUL NOTIFICATION PERMISSION ONBOARDING BANNER */}
      <NotificationPermissionBanner />

      {/* NATIVE-APP MOBILE BOTTOM NAVIGATION */}
      <MobileBottomNav user={user} onLogout={onLogout} tasks={tasks} />
    </div>
  );
};

export default Layout;
