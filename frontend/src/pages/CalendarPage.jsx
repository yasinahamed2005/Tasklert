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
  parseISO,
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
  Inbox,
  X,
  ExternalLink,
} from "lucide-react";
import TaskModal from "../components/TaskModal";
import { getPriorityBadgeColor, getPriorityColor } from "../assets/dummy";

const isCompletedTask = (task) =>
  [true, 1, "yes"].includes(
    typeof task.completed === "string" ? task.completed.toLowerCase() : task.completed
  );

// Safe local date key generator (yyyy-MM-dd)
const toDateKey = (date) => {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
};

const CalendarPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'week' | 'day'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [prefillDate, setPrefillDate] = useState("");
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [, setThemeTick] = useState(0);

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

  // Group tasks by local date key
  const { tasksByDate, unscheduledTasks } = useMemo(() => {
    const map = {};
    const unscheduled = [];

    tasks.forEach((task) => {
      if (!task.dueDate) {
        unscheduled.push(task);
      } else {
        const key = toDateKey(task.dueDate);
        if (key) {
          if (!map[key]) map[key] = [];
          map[key].push(task);
        } else {
          unscheduled.push(task);
        }
      }
    });

    return { tasksByDate: map, unscheduledTasks: unscheduled };
  }, [tasks]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (viewMode === "month") setCurrentDate((d) => subMonths(d, 1));
    else if (viewMode === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === "month") setCurrentDate((d) => addMonths(d, 1));
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
    setPrefillDate(dateStr);
    setTaskToEdit({ dueDate: dateStr });
    setShowTaskModal(true);
  }, []);

  // Open modal to edit existing task
  const handleEditTask = useCallback((task, e) => {
    if (e) e.stopPropagation();
    setPrefillDate("");
    setTaskToEdit(task);
    setShowTaskModal(true);
  }, []);

  // Compute calendar days for Month view
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Compute days for Week view
  const weekDays = useMemo(() => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  // Heading text
  const viewHeading = useMemo(() => {
    if (viewMode === "month") {
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

  return (
    <div className="p-1.5 sm:p-2.5 md:p-3.5 min-w-0 w-full space-y-2.5 sm:space-y-3">
      {/* UNIFIED COMPACT HEADER & CONTROLS MATCHING SCREEN 5 */}
      <div 
        className="bg-white rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 shadow-xs space-y-2.5"
        style={{ borderColor: "var(--calendar-border)" }}
      >
        {/* Top Row: Title on Left, Add Task on Right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="p-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: "var(--calendar-header-bg)", color: "var(--calendar-header-text)" }}
            >
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 tracking-tight">
              Calendar
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setPrefillDate(format(selectedDate || new Date(), "yyyy-MM-dd"));
              setTaskToEdit(null);
              setShowTaskModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>

        {/* Second Row: Centered Navigation & View Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-2 border-purple-100/60">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous month"
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
              aria-label="Next month"
              className="p-1.5 rounded-lg border border-purple-100 hover:bg-purple-50 text-gray-700 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="hidden sm:inline-flex px-2.5 py-1 text-xs font-bold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Right: View Mode Tabs + Unscheduled Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end">
            {/* View Mode Tabs */}
            <div 
              className="inline-flex rounded-lg p-0.5 border text-xs font-semibold"
              style={{ backgroundColor: "var(--calendar-header-bg)", borderColor: "var(--calendar-border)" }}
            >
              <button
                onClick={() => setViewMode("month")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
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
                onClick={() => setViewMode("week")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
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
                onClick={() => setViewMode("day")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer text-xs ${
                  viewMode === "day"
                    ? "bg-white shadow-xs font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                style={{ color: viewMode === "day" ? "var(--calendar-header-text)" : undefined }}
              >
                <Sun className="w-3 h-3" />
                <span>Day</span>
              </button>
            </div>

            {/* Unscheduled Tasks toggle button */}
            <button
              onClick={() => setShowUnscheduled(!showUnscheduled)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
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

      {/* UNSCHEDULED TASKS DRAWER / BANNER */}
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
                className="w-3.5 h-3.5"
                style={{ color: "var(--primary)" }}
              />
              <h3 className="text-xs sm:text-sm font-bold text-gray-800">
                Tasks without Due Dates ({unscheduledTasks.length})
              </h3>
            </div>
            <button
              onClick={() => setShowUnscheduled(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {unscheduledTasks.length === 0 ? (
            <p className="text-xs text-gray-500 py-1">
              All of your tasks currently have due dates assigned!
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
                  <div className="min-w-0">
                    <p 
                      className="text-xs font-semibold text-gray-800 truncate"
                      style={{ color: undefined }}
                    >
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
      {viewMode === "month" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Month Grid */}
          <div 
            className="lg:col-span-3 bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col"
            style={{ borderColor: "var(--calendar-border)" }}
          >
            {/* Weekday Headers */}
            <div 
              className="grid grid-cols-7 calendar-header-surface border-b text-center py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold tracking-wider uppercase"
              style={{ borderColor: "var(--calendar-border)" }}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days Grid */}
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
                const isAltCell = index % 2 === 1;

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
                    onClick={() => setSelectedDate(day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDate(day);
                      }
                    }}
                    className={`min-h-[52px] sm:min-h-[58px] md:min-h-[64px] lg:min-h-[68px] xl:min-h-[72px] p-1 sm:p-1.5 transition-all flex flex-col justify-between cursor-pointer group calendar-cell-interactive relative ${cellSurfaceClass}`}
                  >
                    {/* Day number & Quick add */}
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
                          <span className="hidden sm:inline-block calendar-today-pill text-[8px] uppercase font-bold tracking-wider px-1 py-0.2 rounded leading-none shrink-0">
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

                    {/* Mobile: Indicator Dots matching Screen 5 Mockup */}
                    {dayTasks.length > 0 && (
                      <div className="flex sm:hidden items-center justify-center gap-0.5 mt-0.5">
                        {dayTasks.slice(0, 3).map((task, i) => (
                          <span
                            key={i}
                            className={`w-1 h-1 rounded-full ${
                              task.priority === "High"
                                ? "bg-rose-500"
                                : task.priority === "Medium"
                                ? "bg-amber-500"
                                : "bg-purple-500"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Desktop: Task Pills */}
                    <div className="hidden sm:block space-y-0.5 flex-1 overflow-hidden mt-0.5">
                      {dayTasks.slice(0, 2).map((task) => {
                        const completed = isCompletedTask(task);
                        return (
                          <div
                            key={task._id}
                            onClick={(e) => handleEditTask(task, e)}
                            className={`px-1 py-0.2 rounded text-[10px] leading-tight truncate flex items-center gap-1 transition cursor-pointer ${
                              completed
                                ? "bg-green-50 text-green-700 line-through opacity-80"
                                : task.priority === "High"
                                ? "bg-red-50 text-red-700 font-medium"
                                : task.priority === "Medium"
                                ? "bg-amber-50 text-amber-700 font-medium"
                                : "bg-blue-50 text-blue-700 font-medium"
                            }`}
                            title={`${task.title} (${task.priority} Priority)`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                completed
                                  ? "bg-green-500"
                                  : task.priority === "High"
                                  ? "bg-red-500"
                                  : task.priority === "Medium"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            <span className="truncate">{task.title}</span>
                          </div>
                        );
                      })}

                      {dayTasks.length > 2 && (
                        <p 
                          className="text-[9px] font-bold pl-0.5 leading-none"
                          style={{ color: "var(--primary)" }}
                        >
                          +{dayTasks.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Inspector Sidebar */}
          <div 
            className="lg:col-span-1 bg-white rounded-xl border p-3 sm:p-3.5 shadow-xs flex flex-col justify-between"
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
                  onClick={() => handleCreateOnDate(selectedDate)}
                  className="p-1 sm:p-1.5 rounded-lg transition text-xs font-semibold flex items-center gap-1 cursor-pointer calendar-today-pill hover:opacity-90"
                  title="Add task to this date"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks List */}
              <div className="space-y-2 max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-0.5">
                {selectedDateTasks.length === 0 ? (
                  <div className="text-center py-6 px-3">
                    <CalendarIcon 
                      className="w-6 h-6 mx-auto mb-1.5 opacity-50"
                      style={{ color: "var(--primary)" }}
                    />
                    <p className="text-xs font-semibold text-gray-600">No tasks due</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      You have no tasks scheduled for this day.
                    </p>
                    <button
                      onClick={() => handleCreateOnDate(selectedDate)}
                      className="mt-2 text-xs font-bold hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      + Schedule task
                    </button>
                  </div>
                ) : (
                  selectedDateTasks.map((task) => {
                    const completed = isCompletedTask(task);
                    const accentLeftBorder = task.priority === "High"
                      ? "border-l-4 border-l-rose-500"
                      : task.priority === "Medium"
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-blue-500";
                    return (
                      <div
                        key={task._id}
                        onClick={(e) => handleEditTask(task, e)}
                        className={`p-2.5 sm:p-3 rounded-xl border bg-white transition-all cursor-pointer hover:shadow-xs ${accentLeftBorder} ${
                          completed ? "opacity-70 line-through" : ""
                        }`}
                        style={{
                          borderColor: completed ? undefined : "var(--calendar-border)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <h4
                            className={`text-xs sm:text-sm font-bold truncate ${
                              completed ? "line-through text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {task.title}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${getPriorityBadgeColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-[10px] text-gray-500 line-clamp-1 mb-1.5">
                            {task.description}
                          </p>
                        )}
                        <div 
                          className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t"
                          style={{ borderColor: "var(--calendar-border)" }}
                        >
                          {task.reminderEnabled && task.reminderAt ? (
                            <span 
                              className="flex items-center gap-1 font-medium"
                              style={{ color: "var(--primary)" }}
                            >
                              <Bell className="w-2.5 h-2.5" />
                              {new Date(task.reminderAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          ) : (
                            <span>No alarm</span>
                          )}
                          <span 
                            className="font-semibold group-hover:underline"
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

      {/* WEEK VIEW */}
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
                className={`rounded-xl border p-2.5 sm:p-3 shadow-xs flex flex-col justify-between min-h-[220px] sm:min-h-[250px] transition-all cursor-pointer calendar-cell-interactive ${
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
                  <div className="space-y-1.5">
                    {dayTasks.length === 0 ? (
                      <p className="text-[10px] text-gray-400 italic py-4 text-center">
                        No tasks
                      </p>
                    ) : (
                      dayTasks.map((t) => {
                        const completed = isCompletedTask(t);
                        return (
                          <div
                            key={t._id}
                            onClick={(e) => handleEditTask(t, e)}
                            className={`p-1.5 rounded-lg border text-xs transition cursor-pointer hover:shadow-xs ${
                              completed
                                ? "bg-green-50/50 border-green-200 line-through text-gray-400"
                                : "bg-white text-gray-800 hover:border-[var(--primary)]"
                            }`}
                            style={{
                              borderColor: completed ? undefined : "var(--calendar-border)",
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
                            {t.reminderEnabled && t.reminderAt && (
                              <div 
                                className="flex items-center gap-1 text-[9px] font-medium"
                                style={{ color: "var(--primary)" }}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(t.reminderAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
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

      {/* DAY VIEW */}
      {viewMode === "day" && (
        <div 
          className="bg-white rounded-xl border p-4 sm:p-5 shadow-xs space-y-3 max-w-3xl mx-auto"
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
              onClick={() => handleCreateOnDate(currentDate)}
              className="btn-primary-strong py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task for Today</span>
            </button>
          </div>

          {/* Daily tasks cards */}
          {tasksByDate[toDateKey(currentDate)]?.length ? (
            <div className="space-y-2">
              {tasksByDate[toDateKey(currentDate)].map((t) => {
                const completed = isCompletedTask(t);
                return (
                  <div
                    key={t._id}
                    onClick={(e) => handleEditTask(t, e)}
                    className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer hover:shadow-xs ${
                      completed
                        ? "bg-green-50/40 border-green-200"
                        : "bg-white hover:border-[var(--primary)]"
                    }`}
                    style={{
                      borderColor: completed ? undefined : "var(--calendar-border)",
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 ${
                          completed
                            ? "bg-green-100 text-green-600"
                            : "calendar-today-pill"
                        }`}
                      >
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4" />
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
            <div className="text-center py-10">
              <CalendarIcon 
                className="w-8 h-8 mx-auto mb-2 opacity-50"
                style={{ color: "var(--primary)" }}
              />
              <h4 className="text-sm font-bold text-gray-700">No tasks for this date</h4>
              <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                Enjoy your free time or schedule a task to stay ahead of your goals.
              </p>
              <button
                onClick={() => handleCreateOnDate(currentDate)}
                className="mt-3 px-3 py-1.5 text-xs font-bold rounded-lg transition calendar-today-pill hover:opacity-90 cursor-pointer"
              >
                + Schedule Task Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal for Creating or Editing Tasks */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskToEdit(null);
          setPrefillDate("");
        }}
        taskToEdit={taskToEdit}
        onSave={() => {
          refreshTasks();
          setShowTaskModal(false);
          setTaskToEdit(null);
          setPrefillDate("");
        }}
      />
    </div>
  );
};

export default CalendarPage;
