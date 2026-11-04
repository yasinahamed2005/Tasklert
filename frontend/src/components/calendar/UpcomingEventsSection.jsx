import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Bell,
  BellOff,
  Clock,
  CheckCircle2,
  XCircle,
  Repeat,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  ChevronRight,
  History,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { deviceAlarmManager } from "../../utils/deviceAlarmManager";

const TAB_OPTIONS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "snoozed", label: "Snoozed" },
  { id: "dismissed", label: "Dismissed" },
  { id: "completed", label: "Completed" },
];

const UpcomingEventsSection = ({
  reminders = [],
  onEditReminder,
  onReminderDeleted,
  onReminderToggled,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState("upcoming");
  const [loadingActionId, setLoadingActionId] = useState(null);

  // Partition reminders into tabs
  const categorized = useMemo(() => {
    const upcoming = [];
    const snoozed = [];
    const dismissed = [];
    const completed = [];

    reminders.forEach((r) => {
      if (r.status === "snoozed") {
        snoozed.push(r);
      } else if (r.status === "dismissed") {
        dismissed.push(r);
      } else if (r.status === "completed") {
        completed.push(r);
      } else if (r.status === "scheduled" || r.status === "failed_retryable") {
        upcoming.push(r);
      }
    });

    return { upcoming, snoozed, dismissed, completed };
  }, [reminders]);

  const activeList = categorized[activeTab] || [];

  // Toggle alarm enable/disable
  const handleToggle = async (r, e) => {
    e.stopPropagation();
    setLoadingActionId(r._id);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.patch(
        `${API_BASE_URL}/api/reminders/${r._id}/toggle`,
        {},
        { headers }
      );
      const updated = res.data.reminder;
      if (updated.alarmEnabled) {
        deviceAlarmManager.scheduleAlarm(updated);
      } else {
        deviceAlarmManager.cancelAlarm(updated._id);
      }
      onReminderToggled?.(updated);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle alarm:", err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Delete reminder
  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this reminder?")) return;
    setLoadingActionId(id);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${API_BASE_URL}/api/reminders/${id}`, { headers });
      deviceAlarmManager.cancelAlarm(id);
      onReminderDeleted?.(id);
      onRefresh?.();
    } catch (err) {
      console.error("Failed to delete reminder:", err);
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-purple-100/80 shadow-xs p-3 sm:p-4 flex flex-col h-full overflow-hidden text-gray-800">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-2 border-b border-purple-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
              Reminders & Alarms
            </h3>
            <p className="text-[11px] text-gray-500">Live alerts & history</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
          {reminders.length} total
        </span>
      </div>

      {/* TABS */}
      <div className="flex gap-1 p-1 bg-gray-50 rounded-xl my-2 shrink-0 border border-gray-100">
        {TAB_OPTIONS.map((tab) => {
          const count = categorized[tab.id]?.length || 0;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                active
                  ? "bg-white text-purple-700 shadow-xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  active ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* LIST OF REMINDERS */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
        {activeList.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-2">
            <Clock className="w-8 h-8 opacity-40 text-purple-400" />
            <p className="text-xs font-medium">No {activeTab} reminders.</p>
          </div>
        ) : (
          activeList.map((item) => {
            let schedDateText = "";
            let schedTimeText = "";
            try {
              const d = item.scheduledAt ? new Date(item.scheduledAt) : null;
              if (d && !isNaN(d.getTime())) {
                schedDateText = format(d, "MMM d, yyyy");
                schedTimeText = format(d, "hh:mm a");
              }
            } catch {}

            return (
              <div
                key={item._id}
                onClick={() => onEditReminder?.(item)}
                className="group relative p-3 rounded-xl border border-gray-100 hover:border-purple-200 bg-white hover:bg-purple-50/20 transition-all cursor-pointer shadow-2xs space-y-1.5"
              >
                {/* TOP ROW: TITLE & BELL TOGGLE */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        item.status === "snoozed"
                          ? "bg-amber-500 animate-pulse"
                          : item.status === "dismissed"
                          ? "bg-gray-400"
                          : item.status === "completed"
                          ? "bg-emerald-500"
                          : "bg-purple-600"
                      }`}
                    />
                    <h4 className="text-xs font-bold text-gray-900 truncate">
                      {item.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle Alarm button */}
                    <button
                      type="button"
                      disabled={loadingActionId === item._id}
                      onClick={(e) => handleToggle(item, e)}
                      title={item.alarmEnabled ? "Turn Alarm Off" : "Turn Alarm On"}
                      className={`p-1 rounded-lg transition-colors ${
                        item.alarmEnabled
                          ? "text-purple-600 hover:bg-purple-100"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {item.alarmEnabled ? (
                        <Bell className="w-3.5 h-3.5 fill-purple-100" />
                      ) : (
                        <BellOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      disabled={loadingActionId === item._id}
                      onClick={(e) => handleDelete(item._id, e)}
                      title="Delete Reminder"
                      className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* BOTTOM ROW: DATE, TIME & RECURRENCE PILL */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-medium text-gray-700">
                      <Clock className="w-3 h-3 text-purple-500" />
                      {schedTimeText || item.scheduledTime || "--:--"}
                    </span>
                    <span>•</span>
                    <span>{schedDateText || item.scheduledDate}</span>
                  </div>

                  {item.repeat && item.repeat !== "never" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold flex items-center gap-0.5">
                      <Repeat className="w-2.5 h-2.5" />
                      {item.repeat}
                    </span>
                  )}
                </div>

                {/* NOTES PREVIEW */}
                {(item.notes || item.message) && (
                  <p className="text-[11px] text-gray-500 line-clamp-1 italic">
                    {item.notes || item.message}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UpcomingEventsSection;

