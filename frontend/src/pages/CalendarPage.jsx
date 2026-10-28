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
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [showDayDrawer, setShowDayDrawer] = useState(false);
  const [, setThemeTick] = useState(0);

  // Filters state
  const [filterPriority, setFilterPriority] = useState("all"); // 'all' | 'High' | 'Medium' | 'Low'
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'pending' | 'completed' | 'overdue'
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterBar, setShowFilterBar] = useState(false);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

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
  const handleCreateOnDate = useCallback((date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setTaskToEdit({ dueDate: dateStr });
    setShowTaskModal(true);
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
    <div className="p-1.5 sm:p-2.5 md:p-3.5 min-w-0 w-full space-y-2.5 sm:space-y-3">
      {/* UNIFIED COMPACT HEADER & CONTROLS */}
      <div
        className="bg-white rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 shadow-xs space-y-2.5"
        style={{ borderColor: "var(--calendar-border)" }}
      >
        {/* Top Row: Title + Counts on Left, Add Task on Right */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: "var(--calendar-header-bg)", color: "var(--calendar-header-text)" }}
            >
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">
                  Calendar
                </h1>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: "var(--calendar-cell-alt)", color: "var(--calendar-header-text)" }}
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

            {/* Add Task Button */}
            <button
              type="button"
              onClick={() => {
                setTaskToEdit({ dueDate: format(selectedDate || new Date(), "yyyy-MM-dd") });
                setShowTaskModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
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
              className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Right: View Mode Tabs + Unscheduled Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end">
            {/* View Mode Tabs: Month, Week, Day, Agenda */}
            <div
              className="inline-flex rounded-lg p-0.5 border text-xs font-semibold"
              style={{ backgroundColor: "var(--calendar-header-bg)", borderColor: "var(--calendar-border)" }}
            >
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                  viewMode === "month"
                    ? "bg-white shadow-xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                style={{ color: viewMode === "month" ? "var(--calendar-header-text)" : undefined }}
              >
                <CalendarDays className="w-3 h-3" />
                <span>Month</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                  viewMode === "week"
                    ? "bg-white shadow-xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                style={{ color: viewMode === "week" ? "var(--calendar-header-text)" : undefined }}
              >
                <CalendarRange className="w-3 h-3" />
                <span>Week</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                  viewMode === "day"
                    ? "bg-white shadow-xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                style={{ color: viewMode === "day" ? "var(--calendar-header-text)" : undefined }}
              >
                <Sun className="w-3 h-3" />
                <span>Day</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                  viewMode === "agenda"
                    ? "bg-white shadow-xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                style={{ color: viewMode === "agenda" ? "var(--calendar-header-text)" : undefined }}
              >
                <ListOrdered className="w-3 h-3" />
                <span>Agenda</span>
              </button>
            </div>

            {/* Unscheduled Tasks toggle button */}
            <button
              type="button"
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                showUnscheduled
                  ? "calendar-today-pill"
                  : "hover:bg-[var(--calendar-cell-hover)]"
              }`}
              style={{
                borderColor: "var(--calendar-border)",
                backgroundColor: showUnscheduled ? undefined : "var(--calendar-header-bg)",
                color: showUnscheduled ? undefined : "var(--calendar-header-text)",
              }}
            >
              <Inbox className="w-3 h-3" />
              <span className="hidden sm:inline">Unscheduled</span>
              <span>({unscheduledTasks.length})</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Chessboard Month Grid (3 cols on desktop) */}
          <div
            className="lg:col-span-3 bg-white rounded-2xl border shadow-xs overflow-hidden flex flex-col"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            {/* Weekday Headers (Monday to Sunday) */}
            <div
              className="grid grid-cols-7 calendar-header-surface border-b text-center py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days 2D Chessboard Grid */}
            <div
              className="grid grid-cols-7 auto-rows-fr bg-[var(--calendar-border)] gap-[1px] border-b"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              {monthDays.map((day, index) => {
                const dateKey = toDateKey(day);
                const dayTasks = tasksByDate[dateKey] || [];
                const inCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = isSameDay(day, selectedDate);
                const dayIsToday = isToday(day);

                // True 2D Chessboard Alternation
                const row = Math.floor(index / 7);
                const col = index % 7;
                const isAltCell = (row + col) % 2 === 1;

                const cellSurfaceClass = isSelected
                  ? "calendar-cell-selected"
                  : !inCurrentMonth
                  ? isAltCell
                    ? "calendar-cell-outside-alt text-gray-400"
                    : "calendar-cell-outside text-gray-400"
                  : isAltCell
                  ? "calendar-cell-alt text-gray-800"
                  : "calendar-cell-base text-gray-800";

                return (
                  <div
                    key={dateKey}
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(day, "EEEE, MMMM d, yyyy")}${dayIsToday ? ", Today" : ""}${isSelected ? ", Selected" : ""}`}
                    onClick={() => {
                      setSelectedDate(day);
                      // On mobile viewports, also toggle day drawer
                      if (window.innerWidth < 1024) {
                        setShowDayDrawer(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDate(day);
                        if (window.innerWidth < 1024) {
                          setShowDayDrawer(true);
                        }
                      }
                    }}
                    className={`min-h-[58px] sm:min-h-[66px] md:min-h-[74px] lg:min-h-[80px] p-1 sm:p-1.5 transition-all flex flex-col justify-between cursor-pointer group calendar-cell-interactive relative ${cellSurfaceClass}`}
                  >
                    {/* Top of Cell: Day number & Quick add */}
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className={`text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 ${
                            dayIsToday
                              ? "calendar-today-badge"
                              : isSelected
                              ? "calendar-selected-badge"
                              : inCurrentMonth
                              ? "text-gray-700"
                              : "text-gray-400"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        {dayIsToday && (
                          <span className="hidden md:inline-block calendar-today-pill text-[8px] uppercase font-bold tracking-wider px-1 py-0.2 rounded leading-none shrink-0">
                            Today
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
                        aria-label={`Add task on ${dateKey}`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--calendar-cell-hover)] rounded transition cursor-pointer"
                        style={{ color: "var(--primary)" }}
                        title="Add task on this date"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Mobile: Compact Colored Dots */}
                    {dayTasks.length > 0 && (
                      <div className="flex sm:hidden items-center justify-center gap-0.5 mt-0.5">
                        {dayTasks.slice(0, 3).map((task, i) => {
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
                          <span className="text-[8px] font-bold text-gray-500">+{dayTasks.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Desktop: Real Task Pills */}
                    <div className="hidden sm:block space-y-0.5 flex-1 overflow-hidden mt-0.5">
                      {dayTasks.slice(0, 2).map((task) => {
                        const completed = isCompletedTask(task);
                        const overdue = isTaskOverdue(task, todayKey);
                        return (
                          <div
                            key={task._id}
                            onClick={(e) => handleEditTask(task, e)}
                            className={`px-1 py-0.5 rounded text-[10px] leading-tight truncate flex items-center justify-between gap-1 transition cursor-pointer ${
                              completed
                                ? "bg-green-50 text-green-700 line-through opacity-75"
                                : overdue
                                ? "bg-rose-50 text-rose-700 font-semibold border border-rose-200"
                                : task.priority === "High"
                                ? "bg-rose-50 text-rose-700 font-medium"
                                : task.priority === "Medium"
                                ? "bg-amber-50 text-amber-700 font-medium"
                                : "bg-blue-50 text-blue-700 font-medium"
                            }`}
                            title={`${task.title} (${task.priority} Priority${overdue ? ", Overdue" : ""})`}
                          >
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  completed
                                    ? "bg-green-500"
                                    : overdue
                                    ? "bg-rose-600"
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
                              <Bell className="w-2.5 h-2.5 text-purple-600 shrink-0" />
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
                          style={{ color: "var(--primary)" }}
                        >
                          +{dayTasks.length - 2} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector Sidebar (1 col on desktop) */}
          <div
            className="lg:col-span-1 bg-white rounded-2xl border p-3 sm:p-4 shadow-xs flex flex-col justify-between"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            <div className="space-y-3">
              <div
                className="flex items-center justify-between border-b pb-2.5"
                style={{ borderColor: "var(--calendar-border)" }}
              >
                <div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--primary)" }}
                  >
                    Selected Day
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-gray-800 leading-tight">
                    {format(selectedDate, "EEE, MMM d, yyyy")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleCreateOnDate(selectedDate)}
                  className="p-1 sm:p-1.5 rounded-lg transition text-xs font-semibold flex items-center gap-1 cursor-pointer calendar-today-pill hover:opacity-90"
                  title="Add task to this date"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline text-[10px]">Add</span>
                </button>
              </div>

              {/* Tasks List for Selected Day */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                {selectedDateTasks.length === 0 ? (
                  <div className="text-center py-8 px-2">
                    <CalendarIcon
                      className="w-7 h-7 mx-auto mb-1.5 opacity-40"
                      style={{ color: "var(--primary)" }}
                    />
                    <p className="text-xs font-semibold text-gray-600">No tasks due</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      You have no tasks scheduled for this date.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateOnDate(selectedDate)}
                      className="mt-2.5 text-xs font-bold hover:underline cursor-pointer inline-flex items-center gap-1"
                      style={{ color: "var(--primary)" }}
                    >
                      <Plus className="w-3 h-3" /> Schedule task
                    </button>
                  </div>
                ) : (
                  selectedDateTasks.map((task) => {
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
                  })
                )}
              </div>
            </div>

            {/* Quick summary footer */}
            <div
              className="pt-2 border-t text-[11px] text-gray-500 flex justify-between items-center"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5">
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
          className="bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3 max-w-3xl mx-auto"
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
          className="bg-white rounded-2xl border p-3.5 sm:p-5 shadow-xs space-y-4 max-w-3xl mx-auto"
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
