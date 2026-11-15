import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  X,
  Zap,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Flame,
  ListFilter,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import { taskService } from "../../services/taskService";
import { taskRepository } from "../../db/taskRepository";
import { reminderRepository } from "../../db/reminderRepository";
import { accountManager } from "../../db/accountManager";
import { soundManager } from "../../utils/soundManager";
import { useModalAccessibility } from "../../utils/scrollLock";

const isTaskCompleted = (t) => {
  if (!t) return false;
  return t.completed === "Yes" || t.completed === true || t.completed === 1;
};

export const EmergencyModeModal = ({ isOpen, onClose, onRefreshApp }) => {
  const modalRef = useRef(null);
  useModalAccessibility({ isOpen, onClose, modalRef });

  const [activeTab, setActiveTab] = useState("urgent"); // 'urgent' | 'all' | 'reminders' | 'timer'
  const [tasks, setTasks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick Task Creation state
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("High");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lightweight Focus Timer state
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerIntervalRef = useRef(null);

  const userId = accountManager.getActiveUserId();

  // Load cached tasks and reminders directly from local IndexedDB
  const loadLocalData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [localTasks, localReminders] = await Promise.all([
        taskRepository.getTasks(userId),
        reminderRepository.getReminders(userId),
      ]);
      setTasks(localTasks || []);
      setReminders(localReminders || []);
    } catch (err) {
      console.warn("Could not load emergency data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadLocalData();
    }
  }, [isOpen, loadLocalData]);

  // Urgent tasks: High priority or Overdue or Due Today
  const urgentTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return tasks.filter((t) => {
      if (isTaskCompleted(t)) return false;
      if (t.priority === "High") return true;
      const due = t.dueDate ? t.dueDate.split("T")[0] : null;
      if (due && due <= todayStr) return true;
      return false;
    });
  }, [tasks]);

  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => !isTaskCompleted(t));
  }, [tasks]);

  // Create Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        title: newTitle.trim(),
        priority: newPriority,
        completed: "No",
        dueDate: new Date().toISOString().split("T")[0],
      };

      const created = await taskService.createTask(payload);
      setTasks((prev) => [created, ...prev]);
      setNewTitle("");
      toast.success("Task saved offline!");
      onRefreshApp?.();
    } catch (err) {
      toast.error(err.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Completion
  const handleToggleTask = async (task) => {
    const nextCompleted = !isTaskCompleted(task);
    const taskId = task._id || task.localId || task.id;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        (t._id || t.localId || t.id) === taskId
          ? { ...t, completed: nextCompleted ? "Yes" : "No" }
          : t
      )
    );

    try {
      await taskService.completeTask(taskId, nextCompleted);
      onRefreshApp?.();
    } catch (err) {
      toast.error("Failed to update task");
      loadLocalData();
    }
  };

  // Delete Task
  const handleDeleteTask = async (task) => {
    const taskId = task._id || task.localId || task.id;
    setTasks((prev) => prev.filter((t) => (t._id || t.localId || t.id) !== taskId));

    try {
      await taskService.deleteTask(taskId);
      onRefreshApp?.();
    } catch (err) {
      toast.error("Failed to delete task");
      loadLocalData();
    }
  };

  // Timer Tick
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setTimerRunning(false);
            try {
              soundManager.playAlarm("chime", 80);
            } catch (_) {}
            toast.success("Focus sprint completed! Great job. 🎯");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning]);

  const formatTimer = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/80 backdrop-blur-xs overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-hub-title"
        className="bg-white rounded-2xl sm:rounded-3xl border border-purple-200 shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-purple-100 bg-purple-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-600 text-white shadow-2xs">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 id="emergency-hub-title" className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                Emergency Mode
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Offline Hub
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Ultra-lightweight access to urgent work and cached alarms
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Exit Emergency Mode"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QUICK TASK CREATION BAR */}
        <form
          onSubmit={handleCreateTask}
          className="p-3 sm:p-4 border-b border-purple-100 bg-white flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add quick offline task..."
            className="flex-1 px-3 py-2 text-xs sm:text-sm bg-purple-50/50 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-slate-400"
          />

          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="px-2 py-2 text-xs font-semibold bg-white border border-purple-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shrink-0"
          >
            <option value="High">🔴 High</option>
            <option value="Medium">🟠 Medium</option>
            <option value="Low">🟢 Low</option>
          </select>

          <button
            type="submit"
            disabled={!newTitle.trim() || isSubmitting}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        {/* TABS */}
        <div className="flex items-center px-3 sm:px-4 pt-2 border-b border-purple-100 bg-slate-50/80 gap-1 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("urgent")}
            className={`px-3 py-2 font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === "urgent"
                ? "border-purple-600 text-purple-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            🔥 Urgent ({urgentTasks.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-2 font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === "all"
                ? "border-purple-600 text-purple-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📋 All ({pendingTasks.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reminders")}
            className={`px-3 py-2 font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === "reminders"
                ? "border-purple-600 text-purple-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⏰ Reminders ({reminders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timer")}
            className={`px-3 py-2 font-bold rounded-t-xl transition border-b-2 cursor-pointer ${
              activeTab === "timer"
                ? "border-purple-600 text-purple-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⏱️ Focus Sprint
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading local tasks...
            </div>
          ) : activeTab === "timer" ? (
            /* LIGHTWEIGHT TIMER */
            <div className="py-6 sm:py-8 text-center space-y-5">
              <div className="text-4xl sm:text-5xl font-extrabold font-mono text-purple-900 tracking-wider">
                {formatTimer(timerSeconds)}
              </div>
              <p className="text-xs text-slate-500">
                25-minute Pomodoro Sprint • Works 100% offline with audio alert
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setTimerRunning((prev) => !prev)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer flex items-center gap-2"
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{timerRunning ? "Pause" : "Start Sprint"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(25 * 60);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer"
                  title="Reset to 25 minutes"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : activeTab === "reminders" ? (
            /* REMINDERS LIST */
            reminders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No reminders cached on this device.
              </div>
            ) : (
              <div className="space-y-2">
                {reminders.map((rem) => (
                  <div
                    key={rem._id || rem.localId}
                    className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Bell className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="min-w-0 truncate">
                        <p className="font-semibold text-slate-800 truncate">{rem.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {rem.scheduledDate || "Today"} {rem.scheduledTime || ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold shrink-0">
                      {rem.alarmEnabled ? "Active" : "Silent"}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* TASKS LIST (URGENT OR ALL) */
            (activeTab === "urgent" ? urgentTasks : pendingTasks).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                {activeTab === "urgent"
                  ? "No urgent tasks! You are all caught up. 🎉"
                  : "No cached pending tasks found."}
              </div>
            ) : (
              (activeTab === "urgent" ? urgentTasks : pendingTasks).map((task) => {
                const completed = isTaskCompleted(task);
                const isHigh = task.priority === "High";
                const isMed = task.priority === "Medium";

                return (
                  <div
                    key={task._id || task.localId || task.id}
                    className="p-3 bg-white hover:bg-purple-50/40 rounded-xl border border-purple-100 flex items-center justify-between gap-3 transition text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        aria-label="Toggle task completion"
                        className="p-1 rounded-lg text-slate-400 hover:text-purple-600 cursor-pointer shrink-0"
                      >
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 hover:text-purple-600" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`font-medium truncate ${
                            completed ? "line-through text-slate-400" : "text-slate-800"
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Due: {task.dueDate.split("T")[0]}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isHigh
                            ? "bg-rose-100 text-rose-700"
                            : isMed
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {task.priority || "Low"}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task)}
                        aria-label="Delete task"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 py-2.5 sm:px-6 bg-slate-50 border-t border-purple-100 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
          <span>⚡ Local storage active • Zero data loss</span>
          <button
            type="button"
            onClick={onClose}
            className="text-purple-700 font-bold hover:underline cursor-pointer"
          >
            Exit to Full App
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyModeModal;
