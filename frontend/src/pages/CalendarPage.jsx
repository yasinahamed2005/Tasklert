import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  Bell,
  AlertCircle,
  Flag,
  CalendarDays,
  CalendarRange,
  Sun,
  ListOrdered,
  Inbox,
  X,
  Filter,
  Search,
} from "lucide-react";
import TaskModal from "../components/TaskModal";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import ReminderModal from "../components/calendar/ReminderModal";
import UpcomingEventsSection from "../components/calendar/UpcomingEventsSection";
import { deviceAlarmManager } from "../utils/deviceAlarmManager";
import { getPriorityBadgeColor } from "../assets/dummy";

const isCompletedTask = (task) => {
  if (!task) return false;
  const val = task.completed;
  if (val === true || val === 1) return true;
  if (typeof val === "string") {
    const norm = val.trim().toLowerCase();
    return norm === "yes" || norm === "true" || norm === "completed" || norm === "1";
  }
  return false;
};

// Safe local date key generator (yyyy-MM-dd) without timezone skew
const toDateKey = (date) => {
  if (!date) return null;
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
};

const isTaskOverdue = (task, todayKey) => {
  if (!task?.dueDate || isCompletedTask(task)) return false;
  const key = toDateKey(task.dueDate);
  return key && key < todayKey;
};

const CalendarPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'week' | 'day' | 'agenda'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderToEdit, setReminderToEdit] = useState(null);
  const [sidebarTab, setSidebarTab] = useState("day"); // 'day' | 'history'
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showDayDrawer, setShowDayDrawer] = useState(false);
  const [, setThemeTick] = useState(0);

  // Filters state
  const [filterPriority, setFilterPriority] = useState("all"); // 'all' | 'High' | 'Medium' | 'Low'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'pending' | 'completed' | 'overdue'
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterBar, setShowFilterBar] = useState(false);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Fetch reminders and sync local alarms
  const fetchReminders = useCallback(async () => {
    try {
      setIsLoadingReminders(true);
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE_URL}/api/reminders`, { headers });
      const list = res.data?.reminders || [];
      setReminders(list);
      deviceAlarmManager.syncUpcomingAlarms(list);
    } catch (err) {
      console.warn("Could not fetch reminders:", err);
    } finally {
      setIsLoadingReminders(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  // Group reminders by local date key
  const remindersByDate = useMemo(() => {
    const map = {};
    reminders.forEach((r) => {
      let key = r.scheduledDate;
      if (!key && r.scheduledAt) {
        key = toDateKey(r.scheduledAt);
      }
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(r);
      }
    });
    return map;
  }, [reminders]);

  // Listen for accent theme changes to trigger instant calendar refresh
  useEffect(() => {
    const handleThemeChange = () => setThemeTick((t) => t + 1);
    window.addEventListener("themechange", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  // Filter tasks based on search, priority, and status
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = (t.title || "").toLowerCase().includes(q);
        const inDesc = (t.description || "").toLowerCase().includes(q);
        const inProject = (t.project?.name || t.project || "").toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inProject) return false;
      }

      // Priority filter
      if (filterPriority !== "all") {
        if ((t.priority || "").toLowerCase() !== filterPriority.toLowerCase()) return false;
      }

      // Status filter
      if (filterStatus === "completed" && !isCompletedTask(t)) return false;
      if (filterStatus === "pending" && isCompletedTask(t)) return false;
      if (filterStatus === "overdue" && !isTaskOverdue(t, todayKey)) return false;

      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus, todayKey]);

  // Group tasks by local date key
  const { tasksByDate, unscheduledTasks, allMonthTasksCount } = useMemo(() => {
    const map = {};
    const unscheduled = [];
    let monthCount = 0;

    const curMonthKey = format(currentDate, "yyyy-MM");

    filteredTasks.forEach((task) => {
      if (!task.dueDate) {
        unscheduled.push(task);
      } else {
        const key = toDateKey(task.dueDate);
        if (key) {
          if (!map[key]) map[key] = [];
          map[key].push(task);
          if (key.startsWith(curMonthKey)) {
            monthCount++;
          }
        } else {
          unscheduled.push(task);
        }
      }
    });

    return { tasksByDate: map, unscheduledTasks: unscheduled, allMonthTasksCount: monthCount };
  }, [filteredTasks, currentDate]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (viewMode === "month" || viewMode === "agenda") setCurrentDate((d) => subMonths(d, 1));
    else if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === "month" || viewMode === "agenda") setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  }, [viewMode]);

  const handleToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }, []);

  // Open modal to create a task on a specific date
  // Open ReminderModal to create a reminder on specific date (Main Calendar '+' action)
  const handleCreateOnDate = useCallback((date) => {
    setSelectedDate(date);
    setReminderToEdit(null);
    setShowReminderModal(true);
  }, []);

  // Open ReminderModal to edit reminder
  const handleEditReminder = useCallback((reminder, e) => {
    if (e) e.stopPropagation();
    setReminderToEdit(reminder);
    setShowReminderModal(true);
  }, []);

  // Open modal to edit existing task
  const handleEditTask = useCallback((task, e) => {
    if (e) e.stopPropagation();
    setTaskToEdit(task);
    setShowTaskModal(true);
  }, []);

  // Compute calendar days for Month view (Monday start)
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Compute days for Week view (Monday start)
  const weekDays = useMemo(() => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Heading text
  const viewHeading = useMemo(() => {
    if (viewMode === "month" || viewMode === "agenda") {
      return format(currentDate, "MMMM yyyy");
    }
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(currentDate, "EEEE, MMMM d, yyyy");
  }, [viewMode, currentDate]);

  // Selected date tasks for inspector
  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateTasks = tasksByDate[selectedDateKey] || [];

  // Active filter count
  const activeFiltersCount = (filterPriority !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  const clearFilters = () => {
    setFilterPriority("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  return (
    <div className="p-1 sm:p-2 md:p-2.5 min-w-0 w-full h-full flex-1 min-h-0 flex flex-col overflow-hidden space-y-2">
      {/* UNIFIED COMPACT HEADER & CONTROLS */}
      <div
        className="rounded-2xl border px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs space-y-2 shrink-0 transition-colors"
        style={{ backgroundColor: "var(--cal-sidebar-bg)", borderColor: "var(--calendar-border)" }}
      >
        {/* Top Row: Title + Counts on Left, Add Task on Right */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: "var(--cal-selected-bg)", color: "var(--primary)" }}
            >
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-lg sm:text-xl font-bold tracking-tight"
                  style={{ color: "var(--cal-cell-in-month-text)" }}
                >
                  Calendar
                </h1>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "var(--cal-selected-bg)", color: "var(--primary)" }}
                >
                  {allMonthTasksCount} scheduled
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilterBar(!showFilterBar)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                activeFiltersCount > 0 || showFilterBar
                  ? "bg-purple-50 text-purple-700 border-purple-300"
                  : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Add Reminder Button - Main Calendar Action */}
            <button
              type="button"
              onClick={() => {
                setSelectedDate(selectedDate || new Date());
                setReminderToEdit(null);
                setShowReminderModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white font-bold text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer shrink-0 hover:opacity-90"
              style={{ backgroundColor: "var(--primary)" }}
              title="Create a new reminder and device alarm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Reminder</span>
            </button>

            {/* Add Task Button (Secondary) */}
            <button
              type="button"
              onClick={() => {
                setTaskToEdit({ dueDate: format(selectedDate || new Date(), "yyyy-MM-dd") });
                setShowTaskModal(true);
              }}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs transition hover:bg-gray-50 active:scale-95 cursor-pointer shrink-0"
              title="Create a standard task"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Collapsible) */}
        {showFilterBar && (
          <div
            className="pt-2 border-t flex flex-wrap items-center gap-2 animate-fadeIn"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            {/* Search Input */}
            <div className="relative flex-1 min-w-[140px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 text-xs border rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                style={{ borderColor: "var(--calendar-border)" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Priority Selector */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="py-1 px-2 text-xs border rounded-lg bg-white font-medium text-gray-700 focus:outline-none"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              <option value="all">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>

            {/* Status Selector */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="py-1 px-2 text-xs border rounded-lg bg-white font-medium text-gray-700 focus:outline-none"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-bold text-purple-600 hover:text-purple-800 hover:underline px-2 py-1 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        )}

        {/* Second Row: Centered Navigation & View Mode Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-2 border-purple-100/60">
          {/* Month/Week Navigation */}
          <div className="flex items-center justify-between w-full sm:w-auto gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="p-1.5 rounded-lg border border-purple-100 hover:bg-purple-50 text-gray-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h2 className="text-sm sm:text-base font-extrabold text-gray-800 tracking-tight text-center flex-1 sm:flex-initial">
              {viewHeading}
            </h2>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="p-1.5 rounded-lg border border-purple-100 hover:bg-purple-50 text-gray-700 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer hover:bg-gray-50"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
            >
              Today
            </button>
          </div>

          {/* Right: View Mode Tabs + Unscheduled Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end">
            {/* View Mode Tabs: Month, Week, Day, Agenda */}
            <div
              className="inline-flex rounded-xl p-0.5 border text-xs font-semibold shadow-xs"
              style={{
                backgroundColor: "var(--cal-tabs-bg)",
                borderColor: "var(--cal-tabs-border)",
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewMode === "month"
                    ? "shadow-xs font-black"
                    : "font-semibold hover:opacity-80"
                }`}
                style={{
                  backgroundColor: viewMode === "month" ? "var(--cal-tab-active-bg)" : "transparent",
                  color: viewMode === "month" ? "var(--cal-tab-active-text)" : "var(--cal-tab-inactive-text)",
                }}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Month</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewMode === "week"
                    ? "shadow-xs font-black"
                    : "font-semibold hover:opacity-80"
                }`}
                style={{
                  backgroundColor: viewMode === "week" ? "var(--cal-tab-active-bg)" : "transparent",
                  color: viewMode === "week" ? "var(--cal-tab-active-text)" : "var(--cal-tab-inactive-text)",
                }}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Week</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewMode === "day"
                    ? "shadow-xs font-black"
                    : "font-semibold hover:opacity-80"
                }`}
                style={{
                  backgroundColor: viewMode === "day" ? "var(--cal-tab-active-bg)" : "transparent",
                  color: viewMode === "day" ? "var(--cal-tab-active-text)" : "var(--cal-tab-inactive-text)",
                }}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Day</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  viewMode === "agenda"
                    ? "shadow-xs font-black"
                    : "font-semibold hover:opacity-80"
                }`}
                style={{
                  backgroundColor: viewMode === "agenda" ? "var(--cal-tab-active-bg)" : "transparent",
                  color: viewMode === "agenda" ? "var(--cal-tab-active-text)" : "var(--cal-tab-inactive-text)",
                }}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Agenda</span>
              </button>
            </div>

            {/* Unscheduled Tasks toggle button */}
            <button
              type="button"
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className="text-xs font-bold px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              style={{
                backgroundColor: showUnscheduled ? "var(--primary)" : "var(--cal-tabs-bg)",
                borderColor: showUnscheduled ? "var(--primary)" : "var(--cal-tabs-border)",
                color: showUnscheduled ? "#ffffff" : "var(--cal-tab-inactive-text)",
              }}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unscheduled</span>
              <span
                className="font-bold"
                style={{
                  color: showUnscheduled ? "#ffffff" : "var(--primary)",
                }}
              >
                ({unscheduledTasks.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* UNSCHEDULED TASKS DRAWER */}
      {showUnscheduled && (
        <div
          className="bg-white rounded-xl border p-3 sm:p-3.5 shadow-xs animate-fadeIn space-y-2.5"
          style={{ borderColor: "var(--calendar-border)" }}
        >
          <div
            className="flex items-center justify-between border-b pb-2"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div className="flex items-center gap-2">
              <Inbox
                className="w-4 h-4"
                style={{ color: "var(--primary)" }}
              />
              <h3 className="text-xs sm:text-sm font-bold text-gray-800">
                Tasks without Due Dates ({unscheduledTasks.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowUnscheduled(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {unscheduledTasks.length === 0 ? (
            <p className="text-xs text-gray-500 py-1">
              All tasks have scheduled due dates!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-0.5">
              {unscheduledTasks.map((t) => (
                <div
                  key={t._id}
                  onClick={(e) => handleEditTask(t, e)}
                  className="p-2 rounded-lg border flex items-center justify-between gap-2 transition cursor-pointer hover:shadow-xs group hover:border-[var(--primary)]"
                  style={{
                    backgroundColor: "var(--calendar-cell-alt)",
                    borderColor: "var(--calendar-border)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {t.title}
                    </p>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${getPriorityBadgeColor(t.priority)}`}>
                      {t.priority}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold shrink-0"
                    style={{ color: "var(--primary)" }}
                  >
                    Set Date &rarr;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODES */}

      {/* 1. MONTH VIEW */}
      {viewMode === "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5 sm:gap-3 flex-1 min-h-0 overflow-hidden h-full">
          {/* Theme-Reactive Chessboard Month Grid (3 cols on desktop) */}
          <div
            className="lg:col-span-3 rounded-2xl border shadow-xs overflow-hidden flex flex-col h-full min-h-0"
            style={{ backgroundColor: "var(--cal-sidebar-bg)", borderColor: "var(--cal-grid-border)" }}
          >
            {/* Weekday Headers Bar (Monday to Sunday) */}
            <div
              className="grid grid-cols-7 border-b text-center py-2 text-[11px] sm:text-xs font-bold tracking-wider uppercase shrink-0 transition-colors duration-200"
              style={{
                backgroundColor: "var(--cal-header-bg)",
                color: "var(--cal-header-text)",
                borderColor: "var(--cal-header-border, var(--cal-grid-border))",
              }}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days 2D Chessboard Grid: Alternating Cell A and Cell B */}
            <div
              className="grid grid-cols-7 auto-rows-fr flex-1 min-h-0 gap-[1px] border-b transition-colors duration-200"
              style={{
                backgroundColor: "var(--cal-grid-border)",
                borderColor: "var(--cal-grid-border)",
              }}
            >
              {monthDays.map((day, index) => {
                const dateKey = toDateKey(day);
                const dayTasks = tasksByDate[dateKey] || [];
                const dayReminders = remindersByDate[dateKey] || [];
                const inCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = isSameDay(day, selectedDate);
                const dayIsToday = isToday(day);

                // Alternating pattern across 7 columns:
                // (row + col) % 2 === 0 -> Dim Tint Cell (Cell A)
                // (row + col) % 2 === 1 -> Pure White Cell (Cell B)
                const isDarkCell = (Math.floor(index / 7) + (index % 7)) % 2 === 0;

                return (
                  <div
                    key={dateKey}
                    role={inCurrentMonth ? "button" : undefined}
                    tabIndex={inCurrentMonth ? 0 : -1}
                    aria-label={inCurrentMonth ? `${format(day, "EEEE, MMMM d, yyyy")}${dayIsToday ? ", Today" : ""}${isSelected ? ", Selected" : ""}` : undefined}
                    onClick={() => {
                      if (!inCurrentMonth) return;
                      setSelectedDate(day);
                      if (window.innerWidth < 1024) {
                        setShowDayDrawer(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (!inCurrentMonth) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDate(day);
                        if (window.innerWidth < 1024) {
                          setShowDayDrawer(true);
                        }
                      }
                    }}
                    className={`h-full min-h-0 p-1 sm:p-1.5 transition-all flex flex-col justify-between relative select-none overflow-hidden ${
                      inCurrentMonth ? "cursor-pointer group" : "cursor-default pointer-events-none"
                    }`}
                    style={{
                      backgroundColor: isSelected && inCurrentMonth
                        ? "var(--cal-selected-bg)"
                        : !inCurrentMonth
                        ? (isDarkCell ? "var(--cal-cell-outside-alt, var(--cal-cell-outside))" : "var(--cal-cell-outside)")
                        : isDarkCell
                        ? "var(--cal-cell-alt)"
                        : "var(--cal-cell-in-month)",
                      color: isDarkCell
                        ? "var(--cal-cell-alt-text, var(--cal-cell-in-month-text))"
                        : "var(--cal-cell-in-month-text)",
                      boxShadow: isSelected && inCurrentMonth ? "inset 0 0 0 2px var(--cal-selected-border)" : undefined,
                      zIndex: isSelected && inCurrentMonth ? 10 : 1,
                    }}
                  >
                    {inCurrentMonth && (
                      <>
                        {/* Top of Cell: Day number & Quick add */}
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`text-[11px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all shrink-0 ${
                                dayIsToday ? "ring-2 ring-white/80 shadow-xs" : ""
                              }`}
                              style={{
                                backgroundColor: dayIsToday ? "var(--cal-today-badge)" : undefined,
                                color: dayIsToday
                                  ? "var(--cal-today-text)"
                                  : isSelected
                                  ? "var(--cal-selected-border)"
                                  : isDarkCell
                                  ? "var(--cal-cell-alt-text, var(--cal-cell-in-month-text))"
                                  : "var(--cal-cell-in-month-text)",
                              }}
                            >
                              {format(day, "d")}
                            </span>
                            {dayIsToday && (
                              <span
                                className="hidden md:inline-block text-[8px] uppercase font-black tracking-wider px-1 py-0.5 rounded leading-none shrink-0"
                                style={{
                                  color: "var(--primary)",
                                  backgroundColor: "var(--cal-selected-bg)",
                                }}
                              >
                                TODAY
                              </span>
                            )}
                          </div>

                          {/* Quick Add icon button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateOnDate(day);
                            }}
                            aria-label={`Add reminder on ${dateKey}`}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
                            style={{
                              color: isDarkCell ? "var(--cal-cell-alt-text, var(--cal-cell-outside-text))" : "var(--cal-cell-outside-text)",
                            }}
                            title="Add reminder on this date"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mobile: Compact Colored Dots */}
                        {(dayReminders.length > 0 || dayTasks.length > 0) && (
                          <div className="flex sm:hidden items-center justify-center gap-0.5 mt-0.5">
                            {dayReminders.slice(0, 2).map((r, i) => (
                              <span
                                key={`rem-dot-${i}`}
                                className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-emerald-300"
                                title={`Alarm: ${r.title}`}
                              />
                            ))}
                            {dayTasks.slice(0, 2).map((task, i) => {
                              const completed = isCompletedTask(task);
                              const overdue = isTaskOverdue(task, todayKey);
                              return (
                                <span
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    completed
                                      ? "bg-emerald-500"
                                      : overdue
                                      ? "bg-rose-500"
                                      : task.priority === "High"
                                      ? "bg-rose-500"
                                      : task.priority === "Medium"
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                  }`}
                                />
                              );
                            })}
                            {dayTasks.length > 3 && (
                              <span
                                className="text-[8px] font-bold"
                                style={{
                                  color: "var(--cal-cell-outside-text)",
                                }}
                              >
                                +{dayTasks.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Desktop: Real Task Badges with Dynamic Contrast */}
                        <div className="hidden sm:block space-y-0.5 flex-1 overflow-hidden mt-0.5">
                          {/* Reminders badges */}
                          {dayReminders.slice(0, 2).map((r) => (
                            <div
                              key={r._id}
                              onClick={(e) => handleEditReminder(r, e)}
                              className={`px-1.5 py-0.5 rounded text-[10px] leading-tight truncate flex items-center justify-between gap-1 transition cursor-pointer font-semibold shadow-2xs hover:opacity-90 ${
                                isDarkCell
                                  ? "bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/90"
                                  : "bg-emerald-50/90 border border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                              }`}
                              title={`Alarm: ${r.title} (${r.scheduledTime || "Scheduled"})`}
                            >
                              <span className="truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="truncate">{r.title}</span>
                                <Bell className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                              </span>
                              <span className={`text-[9px] font-bold shrink-0 ${isDarkCell ? "text-emerald-300" : "text-emerald-700"}`}>
                                {r.scheduledTime || (r.scheduledAt ? format(new Date(r.scheduledAt), "hh:mm a") : "")}
                              </span>
                            </div>
                          ))}
                          {/* Tasks badges */}
                          {dayTasks.slice(0, Math.max(1, 3 - dayReminders.length)).map((task) => {
                            const completed = isCompletedTask(task);
                            const overdue = isTaskOverdue(task, todayKey);
                            return (
                              <div
                                key={task._id}
                                onClick={(e) => handleEditTask(task, e)}
                                className={`px-1.5 py-0.5 rounded text-[10px] leading-tight truncate flex items-center justify-between gap-1 transition cursor-pointer ${
                                  isDarkCell
                                    ? completed
                                      ? "bg-emerald-950/60 border border-emerald-800 text-emerald-400 line-through opacity-75"
                                      : overdue
                                      ? "bg-rose-950/80 border border-rose-700 text-rose-300 font-semibold"
                                      : task.priority === "High"
                                      ? "bg-rose-950/80 border border-rose-700 text-rose-300 font-medium"
                                      : task.priority === "Medium"
                                      ? "bg-amber-950/80 border border-amber-700 text-amber-300 font-medium"
                                      : "bg-slate-800/90 border border-slate-700 text-slate-100 font-medium"
                                    : completed
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800 line-through opacity-85"
                                    : overdue
                                    ? "bg-rose-50 border border-rose-200 text-rose-800 font-semibold"
                                    : task.priority === "High"
                                    ? "bg-rose-50 border border-rose-200 text-rose-800 font-medium"
                                    : task.priority === "Medium"
                                    ? "bg-amber-50 border border-amber-200 text-amber-800 font-medium"
                                    : "bg-blue-50 border border-blue-200 text-blue-800 font-medium"
                                }`}
                                title={`${task.title} (${task.priority} Priority${overdue ? ", Overdue" : ""})`}
                              >
                                <div className="flex items-center gap-1 min-w-0 truncate">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      completed
                                        ? "bg-emerald-500"
                                        : overdue
                                        ? "bg-rose-500"
                                        : task.priority === "High"
                                        ? "bg-rose-500"
                                        : task.priority === "Medium"
                                        ? "bg-amber-500"
                                        : "bg-blue-500"
                                    }`}
                                  />
                                  <span className="truncate">{task.title}</span>
                                </div>
                                {task.reminderEnabled && task.reminderAt && (
                                  <Bell
                                    className="w-2.5 h-2.5 shrink-0"
                                    style={{
                                      color: "var(--primary)",
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}

                          {/* +N More Overflow Button */}
                          {dayTasks.length > 2 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day);
                                setShowDayDrawer(true);
                              }}
                              className="text-[9px] font-bold pl-0.5 leading-none hover:underline cursor-pointer block text-left"
                              style={{
                                color: "var(--primary)",
                              }}
                            >
                              +{dayTasks.length - 2} more
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector Sidebar (1 col on desktop) */}
          <div
            className="hidden lg:flex lg:col-span-1 rounded-2xl border p-3.5 shadow-xs flex-col justify-between h-full min-h-0 overflow-hidden transition-colors"
            style={{ backgroundColor: "var(--cal-sidebar-bg)", borderColor: "var(--cal-card-border)" }}
          >
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-2">
              {/* Tab Switcher: Selected Day vs History */}
              <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800 p-0.5 shrink-0 border border-gray-200/50 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setSidebarTab("day")}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    sidebarTab === "day"
                      ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-2xs"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Selected Day ({(remindersByDate[selectedDateKey] || []).length + selectedDateTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab("history")}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    sidebarTab === "history"
                      ? "bg-white dark:bg-slate-700 shadow-2xs"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                  style={{ color: sidebarTab === "history" ? "var(--primary)" : undefined }}
                >
                  Alarms & History ({reminders.length})
                </button>
              </div>

              {sidebarTab === "history" ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                  <UpcomingEventsSection
                    reminders={reminders}
                    onEditReminder={handleEditReminder}
                    onReminderDeleted={fetchReminders}
                    onReminderToggled={fetchReminders}
                    onRefresh={fetchReminders}
                  />
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center justify-between border-b pb-2 shrink-0"
                    style={{ borderColor: "var(--cal-card-border)" }}
                  >
                    <div>
                      <span
                        className="text-[9px] font-black uppercase tracking-wider block"
                        style={{ color: "var(--primary)" }}
                      >
                        SELECTED DAY
                      </span>
                      <h3
                        className="text-xs sm:text-sm font-bold leading-tight mt-0.5"
                        style={{ color: "var(--cal-cell-in-month-text)" }}
                      >
                        {format(selectedDate, "EEE, MMM d, yyyy")}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCreateOnDate(selectedDate)}
                        className="px-2.5 py-1 rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer text-white shadow-2xs hover:opacity-90"
                        style={{ backgroundColor: "var(--primary)" }}
                        title="Add reminder & phone alarm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Day items list: Reminders & Tasks */}
                  <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-0.5 tg-custom-scrollbar">
                    {/* SECTION: REMINDERS & ALARMS */}
                    {(remindersByDate[selectedDateKey] || []).length > 0 && (
                      <div className="space-y-1.5">
                        <div
                          className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: "var(--primary)" }}
                        >
                          <span className="flex items-center gap-1">
                            <Bell className="w-3 h-3" /> Reminders & Alarms ({(remindersByDate[selectedDateKey] || []).length})
                          </span>
                        </div>
                        {(remindersByDate[selectedDateKey] || []).map((r) => (
                          <div
                            key={r._id}
                            onClick={(e) => handleEditReminder(r, e)}
                            className="p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs space-y-1"
                            style={{
                              backgroundColor: "var(--cal-cell-hover)",
                              borderColor: "var(--cal-card-border)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-xs font-bold truncate"
                                style={{ color: "var(--cal-cell-in-month-text)" }}
                              >
                                {r.title}
                              </span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{
                                  backgroundColor: "var(--cal-selected-bg)",
                                  color: "var(--primary)",
                                }}
                              >
                                {r.scheduledTime || (r.scheduledAt ? format(new Date(r.scheduledAt), "hh:mm a") : "")}
                              </span>
                            </div>
                            {(r.notes || r.message) && (
                              <p className="text-[10px] text-gray-500 line-clamp-1 italic">{r.notes || r.message}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SECTION: TASKS DUE */}
                    {selectedDateTasks.length === 0 && (remindersByDate[selectedDateKey] || []).length === 0 ? (
                      <div className="text-center py-8 px-2 flex flex-col items-center justify-center my-auto">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                          style={{ color: "var(--primary)" }}
                        >
                          <CalendarIcon className="w-8 h-8 opacity-75" />
                        </div>
                        <p
                          className="text-xs font-bold"
                          style={{ color: "var(--cal-cell-in-month-text)" }}
                        >
                          No tasks due
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          You have no tasks scheduled for this date.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCreateOnDate(selectedDate)}
                          className="mt-2 text-xs font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                          style={{ color: "var(--primary)" }}
                        >
                          <Plus className="w-3 h-3" /> Schedule task
                        </button>
                      </div>
                    ) : (
                      selectedDateTasks.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                            <span>Tasks Due ({selectedDateTasks.length})</span>
                          </div>
                          {selectedDateTasks.map((task) => {
                    const completed = isCompletedTask(task);
                    const overdue = isTaskOverdue(task, todayKey);
                    const accentBorder = task.priority === "High"
                      ? "border-l-4 border-l-rose-500"
                      : task.priority === "Medium"
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-blue-500";

                    return (
                      <div
                        key={task._id}
                        onClick={(e) => handleEditTask(task, e)}
                        className={`p-2.5 rounded-xl border bg-white transition-all cursor-pointer hover:shadow-xs ${accentBorder} ${
                          completed ? "opacity-70 line-through" : ""
                        }`}
                        style={{
                          borderColor: completed ? undefined : "var(--calendar-border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h4
                            className={`text-xs font-bold truncate ${
                              completed ? "line-through text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {task.title}
                          </h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border shrink-0 ${getPriorityBadgeColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-[10px] text-gray-500 line-clamp-1 mb-1">
                            {task.description}
                          </p>
                        )}

                        <div
                          className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t"
                          style={{ borderColor: "var(--calendar-border)" }}
                        >
                          <div className="flex items-center gap-1.5">
                            {overdue && (
                              <span className="text-[9px] font-bold text-rose-600 flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5" /> Overdue
                              </span>
                            )}
                            {task.reminderEnabled && task.reminderAt ? (
                              <span
                                className="flex items-center gap-0.5 font-medium"
                                style={{ color: "var(--primary)" }}
                              >
                                <Bell className="w-2.5 h-2.5" />
                                {new Date(task.reminderAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : null}
                          </div>

                          <span
                            className="font-semibold hover:underline"
                            style={{ color: "var(--primary)" }}
                          >
                            Edit &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
    {/* Quick summary footer */}
            <div
              className="pt-2 border-t text-[11px] text-gray-500 flex justify-between items-center shrink-0"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              <span>{selectedDateTasks.length} task(s)</span>
              <span
                className="font-semibold"
                style={{ color: "var(--primary)" }}
              >
                {selectedDateTasks.filter(isCompletedTask).length} done
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. WEEK VIEW */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 flex-1 min-h-0 overflow-y-auto tg-custom-scrollbar p-0.5">
          {weekDays.map((day, idx) => {
            const dateKey = toDateKey(day);
            const dayTasks = tasksByDate[dateKey] || [];
            const dayIsToday = isToday(day);
            const isSelected = isSameDay(day, selectedDate);
            const isAltDay = idx % 2 === 1;

            return (
              <div
                key={dateKey}
                role="button"
                tabIndex={0}
                aria-label={`${format(day, "EEEE, MMMM d, yyyy")}${dayIsToday ? ", Today" : ""}${isSelected ? ", Selected" : ""}`}
                onClick={() => setSelectedDate(day)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDate(day);
                  }
                }}
                className={`rounded-xl border p-2.5 sm:p-3 shadow-xs flex flex-col justify-between min-h-[240px] sm:min-h-[270px] transition-all cursor-pointer calendar-cell-interactive ${
                  isSelected
                    ? "calendar-cell-selected"
                    : isAltDay
                    ? "calendar-cell-alt"
                    : "calendar-cell-base"
                } ${
                  dayIsToday
                    ? "ring-2 ring-[var(--primary)]"
                    : ""
                }`}
                style={{
                  borderColor: isSelected
                    ? "var(--calendar-cell-selected-border)"
                    : "var(--calendar-border)",
                }}
              >
                <div>
                  {/* Day Header */}
                  <div
                    className="flex items-center justify-between border-b pb-1.5 mb-2"
                    style={{ borderColor: "var(--calendar-border)" }}
                  >
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                          {format(day, "EEE")}
                        </span>
                        {dayIsToday && (
                          <span className="calendar-today-pill text-[8px] uppercase font-bold tracking-wider px-1 py-0.2 rounded leading-none">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                            dayIsToday
                              ? "calendar-today-badge"
                              : isSelected
                              ? "calendar-selected-badge"
                              : "text-gray-800"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        <span className="text-[11px] text-gray-500 font-medium">
                          {format(day, "MMM")}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateOnDate(day);
                      }}
                      className="p-1 rounded-md transition cursor-pointer hover:bg-[var(--calendar-cell-hover)]"
                      style={{ color: "var(--primary)" }}
                      title="Add task for this day"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {dayTasks.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic py-6 text-center">
                        No tasks
                      </p>
                    ) : (
                      dayTasks.map((t) => {
                        const completed = isCompletedTask(t);
                        const overdue = isTaskOverdue(t, todayKey);
                        return (
                          <div
                            key={t._id}
                            onClick={(e) => handleEditTask(t, e)}
                            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer hover:shadow-xs ${
                              completed
                                ? "bg-green-50/50 border-green-200 line-through text-gray-400"
                                : overdue
                                ? "bg-rose-50/60 border-rose-200 text-rose-800"
                                : "bg-white text-gray-800 hover:border-[var(--primary)]"
                            }`}
                            style={{
                              borderColor: completed || overdue ? undefined : "var(--calendar-border)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-semibold truncate text-[11px]">{t.title}</span>
                              <span
                                className={`text-[8px] px-1 rounded-full border ${getPriorityBadgeColor(
                                  t.priority
                                )}`}
                              >
                                {t.priority[0]}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-gray-400 mt-0.5">
                              {t.reminderEnabled && t.reminderAt ? (
                                <span
                                  className="flex items-center gap-0.5 font-medium"
                                  style={{ color: "var(--primary)" }}
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(t.reminderAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              ) : (
                                <span>All day</span>
                              )}
                              {overdue && (
                                <span className="text-rose-600 font-bold text-[8px]">Overdue</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateOnDate(day);
                  }}
                  className="w-full mt-2 py-1 text-center text-xs font-semibold rounded-lg transition cursor-pointer calendar-today-pill hover:opacity-90"
                >
                  + Add Task
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. DAY VIEW */}
      {viewMode === "day" && (
        <div
          className="bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 max-w-3xl mx-auto flex-1 min-h-0 overflow-y-auto tg-custom-scrollbar w-full"
          style={{ borderColor: "var(--calendar-border)" }}
        >
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b pb-3"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--primary)" }}
                >
                  Daily Agenda
                </span>
                {isToday(currentDate) && (
                  <span className="calendar-today-pill text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded leading-none">
                    Today
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mt-0.5">
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleCreateOnDate(currentDate)}
              className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task for This Day</span>
            </button>
          </div>

          {/* Daily tasks cards */}
          {tasksByDate[toDateKey(currentDate)]?.length ? (
            <div className="space-y-2">
              {tasksByDate[toDateKey(currentDate)].map((t) => {
                const completed = isCompletedTask(t);
                const overdue = isTaskOverdue(t, todayKey);
                return (
                  <div
                    key={t._id}
                    onClick={(e) => handleEditTask(t, e)}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer hover:shadow-xs ${
                      completed
                        ? "bg-green-50/40 border-green-200"
                        : overdue
                        ? "bg-rose-50/50 border-rose-200 hover:border-rose-400"
                        : "bg-white hover:border-[var(--primary)]"
                    }`}
                    style={{
                      borderColor: completed || overdue ? undefined : "var(--calendar-border)",
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${
                          completed
                            ? "bg-green-100 text-green-600"
                            : overdue
                            ? "bg-rose-100 text-rose-600"
                            : "calendar-today-pill"
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : overdue ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4
                            className={`text-xs sm:text-sm font-bold ${
                              completed ? "line-through text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {t.title}
                          </h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full border font-semibold ${getPriorityBadgeColor(
                              t.priority
                            )}`}
                          >
                            {t.priority}
                          </span>
                          {overdue && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
                              Overdue
                            </span>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-lg">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-xs font-medium self-end sm:self-auto">
                      {t.reminderEnabled && t.reminderAt && (
                        <span className="flex items-center gap-1 calendar-today-pill px-2 py-0.5 rounded text-[10px]">
                          <Bell className="w-3 h-3" />
                          {new Date(t.reminderAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      <span
                        className="font-bold hover:underline text-xs"
                        style={{ color: "var(--primary)" }}
                      >
                        Edit &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarIcon
                className="w-8 h-8 mx-auto mb-2 opacity-40"
                style={{ color: "var(--primary)" }}
              />
              <h4 className="text-sm font-bold text-gray-700">No tasks for this date</h4>
              <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                No tasks scheduled for this day. Enjoy your free time or schedule a new task.
              </p>
              <button
                type="button"
                onClick={() => handleCreateOnDate(currentDate)}
                className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg transition calendar-today-pill hover:opacity-90 cursor-pointer"
              >
                + Schedule Task Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. AGENDA VIEW (Mobile-friendly chronological list) */}
      {viewMode === "agenda" && (
        <div
          className="bg-white rounded-2xl border p-3.5 sm:p-5 shadow-xs space-y-4 max-w-3xl mx-auto flex-1 min-h-0 overflow-y-auto tg-custom-scrollbar w-full"
          style={{ borderColor: "var(--calendar-border)" }}
        >
          <div
            className="flex items-center justify-between border-b pb-2.5"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--primary)" }}
              >
                Monthly Agenda
              </span>
              <h3 className="text-sm sm:text-base font-bold text-gray-800">
                Scheduled Tasks in {format(currentDate, "MMMM yyyy")}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleCreateOnDate(selectedDate || currentDate)}
              className="py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          {/* Agenda Grouped by Day */}
          {(() => {
            const curMonthKey = format(currentDate, "yyyy-MM");
            const sortedKeys = Object.keys(tasksByDate)
              .filter((k) => k.startsWith(curMonthKey) && tasksByDate[k]?.length > 0)
              .sort();

            if (sortedKeys.length === 0) {
              return (
                <div className="text-center py-12">
                  <CalendarIcon
                    className="w-8 h-8 mx-auto mb-2 opacity-40"
                    style={{ color: "var(--primary)" }}
                  />
                  <h4 className="text-sm font-bold text-gray-700">No scheduled tasks this month</h4>
                  <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                    There are no tasks matching your filters for {format(currentDate, "MMMM yyyy")}.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCreateOnDate(new Date())}
                    className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg transition calendar-today-pill hover:opacity-90 cursor-pointer"
                  >
                    + Schedule Task Now
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {sortedKeys.map((key) => {
                  const dayObj = new Date(`${key}T12:00:00`);
                  const dayTasks = tasksByDate[key] || [];
                  const dayIsToday = key === todayKey;

                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                            dayIsToday
                              ? "calendar-today-badge"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {format(dayObj, "EEE, MMM d")}
                        </span>
                        {dayIsToday && (
                          <span className="calendar-today-pill text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded leading-none">
                            Today
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-medium">
                          ({dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"})
                        </span>
                      </div>

                      <div className="space-y-1.5 pl-2 sm:pl-3 border-l-2 border-purple-100">
                        {dayTasks.map((t) => {
                          const completed = isCompletedTask(t);
                          const overdue = isTaskOverdue(t, todayKey);
                          return (
                            <div
                              key={t._id}
                              onClick={(e) => handleEditTask(t, e)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer hover:shadow-xs ${
                                completed
                                  ? "bg-green-50/40 border-green-200 opacity-75"
                                  : overdue
                                  ? "bg-rose-50/50 border-rose-200"
                                  : "bg-white hover:border-[var(--primary)]"
                              }`}
                              style={{
                                borderColor: completed || overdue ? undefined : "var(--calendar-border)",
                              }}
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    completed
                                      ? "bg-emerald-500"
                                      : overdue
                                      ? "bg-rose-500"
                                      : t.priority === "High"
                                      ? "bg-rose-500"
                                      : t.priority === "Medium"
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p
                                    className={`text-xs font-semibold truncate ${
                                      completed ? "line-through text-gray-400" : "text-gray-800"
                                    }`}
                                  >
                                    {t.title}
                                  </p>
                                  {t.description && (
                                    <p className="text-[10px] text-gray-400 truncate max-w-md">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-full border ${getPriorityBadgeColor(
                                    t.priority
                                  )}`}
                                >
                                  {t.priority}
                                </span>
                                {t.reminderEnabled && t.reminderAt && (
                                  <span className="text-[10px] text-purple-600 flex items-center gap-0.5">
                                    <Bell className="w-2.5 h-2.5" />
                                    {new Date(t.reminderAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Mobile Drawer / Day View Popover when "+N more" or Day is tapped on small screens */}
      {showDayDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border shadow-xl p-4 space-y-3 max-h-[80vh] flex flex-col"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--primary)" }}
                >
                  All Tasks on Date
                </span>
                <h3 className="text-sm font-bold text-gray-800">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDayDrawer(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {selectedDateTasks.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No tasks for this day.</p>
              ) : (
                selectedDateTasks.map((t) => {
                  const completed = isCompletedTask(t);
                  const overdue = isTaskOverdue(t, todayKey);
                  return (
                    <div
                      key={t._id}
                      onClick={(e) => {
                        setShowDayDrawer(false);
                        handleEditTask(t, e);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer hover:shadow-xs ${
                        completed
                          ? "bg-green-50/40 border-green-200 line-through opacity-75"
                          : overdue
                          ? "bg-rose-50/50 border-rose-200"
                          : "bg-white hover:border-[var(--primary)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {t.title}
                        </p>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${getPriorityBadgeColor(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-purple-600 hover:underline">
                        Edit &rarr;
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDayDrawer(false);
                  handleCreateOnDate(selectedDate);
                }}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-center cursor-pointer"
              >
                + Add Task for This Date
              </button>
              <button
                type="button"
                onClick={() => setShowDayDrawer(false)}
                className="py-2 px-3 text-xs font-semibold rounded-xl border text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Modal for Creating or Editing Reminders */}
      <ReminderModal
        isOpen={showReminderModal}
        initialDate={selectedDate}
        reminderToEdit={reminderToEdit}
        onClose={() => {
          setShowReminderModal(false);
          setReminderToEdit(null);
        }}
        onReminderSaved={() => {
          fetchReminders();
          refreshTasks();
        }}
        onReminderDeleted={() => {
          fetchReminders();
        }}
      />

      {/* Modal for Creating or Editing Tasks */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        onSave={() => {
          refreshTasks();
          setShowTaskModal(false);
          setTaskToEdit(null);
        }}
      />
    </div>
  );
};

export default CalendarPage;
