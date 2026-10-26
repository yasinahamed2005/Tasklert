import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { HEADER, WRAPPER, ADD_BUTTON, ICON_WRAPPER,STAT_CARD,STATS,STATS_GRID,VALUE_CLASS, LABEL_CLASS, FILTER_WRAPPER } from '../assets/dummy';
import { HomeIcon, Plus, Filter, CalendarIcon, Search, X, BellRing, Clock, ArrowRight, Volume2, Folder, Tag, CheckSquare, Square, Trash2, CheckCircle2, RotateCcw, Sparkles, Timer, AlertTriangle, Send, BarChart3, AlarmClock } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FILTER_LABELS, SELECT_CLASSES, FILTER_OPTIONS,TABS_WRAPPER,TAB_BASE,TAB_ACTIVE,TAB_INACTIVE,EMPTY_STATE, SORT_OPTIONS, sortTasks  } from '../assets/dummy';
import TaskItem from '../components/TaskItem';
const TaskModal = lazy(() => import('../components/TaskModal'));
import { DashboardSkeleton } from '../components/PageSkeletons';
import { API_BASE_URL } from '../config/api';

const isCompletedTask = (task) =>
  [true, 1, 'yes'].includes(
    typeof task.completed === 'string' ? task.completed.toLowerCase() : task.completed
  );

const FILTER_CHIPS = [
  "all",
  "pending",
  "completed",
  "overdue",
  "today",
  "tomorrow",
  "high",
  "medium",
  "low",
];

const SORT_LABELS = {
  newest: "Newest first",
  oldest: "Oldest first",
  priority: "Priority first",
  deadline: "Closest deadline",
  alphabetical: "A to Z",
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const Dashboard = () => {
  const { tasks = [], refreshTasks, user, loadingTasks } = useOutletContext();
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectTask] = useState(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 18) return "Good Afternoon 👋";
    return "Good Evening 👋";
  }, []);
  const [filter, setFilter] = useState("all");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [projects, setProjects] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const formatAlarmTime = useCallback((dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes <= 0) return "Due right now";
    if (diffMinutes < 60) return `In ${diffMinutes} min${diffMinutes === 1 ? "" : "s"}`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `In ${diffHours}h ${diffMinutes % 60}m`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }, []);

  const upcomingAlarms = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t) => t.reminderEnabled && t.reminderAt && !isCompletedTask(t))
      .map((t) => ({
        ...t,
        reminderTime: new Date(t.reminderAt).getTime(),
      }))
      .filter((t) => t.reminderTime >= now - 60 * 1000)
      .sort((a, b) => a.reminderTime - b.reminderTime);
  }, [tasks]);

  useEffect(() => {
    let isMounted = true;
    const fetchProjectsAndTags = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const [pRes, tRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/tasks/tags`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!isMounted) return;
        if (pRes.status === "fulfilled" && pRes.value.data?.projects) {
          setProjects(pRes.value.data.projects);
        }
        if (tRes.status === "fulfilled" && tRes.value.data?.tags) {
          setUserTags(tRes.value.data.tags);
        }
      } catch (e) {
        console.warn("Error fetching projects/tags in Dashboard", e);
      }
    };
    fetchProjectsAndTags();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleSelect = useCallback((id) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleBulkAction = async (action, value) => {
    if (!selectedTaskIds.length) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/tasks/bulk`,
        { taskIds: selectedTaskIds, action, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message || "Bulk operation completed");
        if (action === "delete") {
          const deletedIds = [...selectedTaskIds];
          toast.info(
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{deletedIds.length} tasks moved to trash</span>
              <button
                onClick={async () => {
                  try {
                    await Promise.all(
                      deletedIds.map((id) =>
                        axios.post(`${API_BASE_URL}/api/tasks/${id}/restore`, {}, {
                          headers: { Authorization: `Bearer ${token}` },
                        })
                      )
                    );
                    toast.success("Tasks restored!");
                    refreshTasks();
                  } catch (e) {
                    toast.error("Failed to restore some tasks");
                  }
                }}
                className="px-2.5 py-1 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition cursor-pointer"
              >
                Undo
              </button>
            </div>,
            { autoClose: 7000 }
          );
        }
        setSelectedTaskIds([]);
        setIsSelectionMode(false);
        refreshTasks();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Bulk operation failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const nextAlarm = upcomingAlarms[0] || null;

  const filterCounts = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);

    return tasks.reduce(
      (counts, task) => {
        const completed = isCompletedTask(task);
        const priority = task.priority?.toLowerCase() || "";
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;

        counts.all += 1;
        if (completed) counts.completed += 1;
        else counts.pending += 1;

        if (priority === "high") counts.high += 1;
        if (priority === "medium") counts.medium += 1;
        if (priority === "low") counts.low += 1;

        if (dueDate && dueDate >= today && dueDate < tomorrow) counts.today += 1;
        if (dueDate && dueDate >= tomorrow && dueDate < dayAfterTomorrow) counts.tomorrow += 1;
        if (dueDate && dueDate < today && !completed) counts.overdue += 1;

        return counts;
      },
      {
        all: 0,
        pending: 0,
        completed: 0,
        overdue: 0,
        today: 0,
        tomorrow: 0,
        high: 0,
        medium: 0,
        low: 0,
      }
    );
  }, [tasks]);


  const stats = useMemo(() => ({
    total: tasks.length,
    lowPriority: tasks.filter(t => t.priority?.toLowerCase() === 'low').length,
    mediumPriority: tasks.filter(t => t.priority?.toLowerCase() === 'medium').length,
    highPriority: tasks.filter(t => t.priority?.toLowerCase() === 'high').length,
    completed: tasks.filter(t => 
      t.completed === true || 
      t.completed === 1 || 
      (typeof t.completed === 'string' && t.completed.toLowerCase() === 'yes')
    ).length
  }), [tasks]);

  // TODAY'S PLAN & PROGRESS (Feature E)
  const todayPlan = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const isDueToday = (t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= startOfToday && d <= endOfToday;
    };

    const isOverdue = (t) => {
      if (!t.dueDate || isCompletedTask(t)) return false;
      const d = new Date(t.dueDate);
      return d < startOfToday;
    };

    const isCompletedToday = (t) => {
      if (!isCompletedTask(t)) return false;
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= startOfToday && d <= endOfToday;
    };

    const dueTodayTasks = tasks.filter((t) => isDueToday(t) && !isCompletedTask(t));
    const overdueTasks = tasks.filter(isOverdue);
    const completedTodayTasks = tasks.filter(isCompletedToday);

    // Set of unique IDs to prevent counting any task twice
    const uniqueIds = new Set();
    dueTodayTasks.forEach((t) => uniqueIds.add(String(t._id || t.id)));
    overdueTasks.forEach((t) => uniqueIds.add(String(t._id || t.id)));
    completedTodayTasks.forEach((t) => uniqueIds.add(String(t._id || t.id)));

    const totalTarget = uniqueIds.size;
    const completedCount = completedTodayTasks.length;
    const progressPct = totalTarget > 0 ? Math.round((completedCount / totalTarget) * 100) : 0;

    return {
      dueTodayTasks,
      overdueTasks,
      completedTodayTasks,
      totalTarget,
      completedCount,
      progressPct,
      hasTasks: totalTarget > 0,
    };
  }, [tasks]);

  // FILTER + SEARCH + SORT TASKS
  const filteredTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 2);

    const query = searchQuery.trim().toLowerCase();

    const byFilterAndSearch = tasks.filter(task => {
      // Enhanced Search across title, description, tags, project name
      if (query) {
        const inTitle = task.title?.toLowerCase().includes(query);
        const inDescription = task.description?.toLowerCase().includes(query);
        const inTags = Array.isArray(task.tags) && task.tags.some(t => t.toLowerCase().includes(query));
        const inProject = task.project?.name?.toLowerCase().includes(query);
        if (!inTitle && !inDescription && !inTags && !inProject) return false;
      }

      // Project filter
      if (selectedProject !== "all") {
        const pId = task.project?._id || (typeof task.project === "string" ? task.project : null);
        if (selectedProject === "none") {
          if (pId) return false;
        } else {
          if (pId !== selectedProject) return false;
        }
      }

      // Tag filter
      if (selectedTag !== "all") {
        if (!Array.isArray(task.tags) || !task.tags.includes(selectedTag)) return false;
      }

      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const completed = isCompletedTask(task);

      switch (filter) {
        case "pending":
          return !completed;
        case "completed":
          return completed;
        case "high":
        case "medium":
        case "low":
          return task.priority?.toLowerCase() === filter;
        case "today":
          return dueDate && dueDate >= today && dueDate < tomorrow;
        case "tomorrow":
          return dueDate && dueDate >= tomorrow && dueDate < dayAfterTomorrow;
        case "overdue":
          return dueDate && dueDate < today && !completed;
        default:
          return true;
      }
    });

    return sortTasks(byFilterAndSearch, sortBy);
  }, [tasks, filter, sortBy, searchQuery, selectedProject, selectedTag]);

  const handleSelectAll = useCallback(() => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t._id || t.id).filter(Boolean));
    }
  }, [selectedTaskIds, filteredTasks]);

  const handleTaskSave = useCallback(() => {
    refreshTasks();
    setShowModal(false);
    setSelectTask(null);
  }, [refreshTasks]);

  if (loadingTasks && (!tasks || tasks.length === 0)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={WRAPPER}>
      {/* DESKTOP HEADER */}
      <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
        <div className='min-w-0'>
          <h1 className='text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2'>
            <HomeIcon className='text-purple-500 w-5 h-5 md:w-6 md:h-6 shrink-0' />
            <span className='truncate'>
              {user?.name ? `Hello, ${user.name.split(' ')[0]} 👋` : "Task Overview"}
            </span>
          </h1>
          <p className='text-xs sm:text-sm text-gray-500 mt-1 ml-7 truncate'>Let's make today productive and organized</p>
        </div>

        <button onClick={() => setShowModal(true)} className={ADD_BUTTON}>
          <Plus size={18} className='cta-icon' />
          <span className='cta-label font-semibold'>Add New Task</span>
        </button>
      </div>

      {/* MOBILE SCREEN 3 HEADER */}
      <div className="md:hidden mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>{greeting}</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Let's make today productive</p>
      </div>

      {/* MOBILE SCREEN 3 2x2 STATS GRID */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 md:hidden">
        {/* Total Tasks */}
        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-gray-900">{tasks.length}</p>
            <p className="text-[11px] font-semibold text-gray-500">Total Tasks</p>
          </div>
        </div>

        {/* Completed */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-emerald-700">{stats.completed}</p>
            <p className="text-[11px] font-semibold text-gray-500">Completed</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-rose-700">{todayPlan.overdueTasks.length}</p>
            <p className="text-[11px] font-semibold text-gray-500">Overdue</p>
          </div>
        </div>

        {/* Due Today */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black text-amber-700">{todayPlan.dueTodayTasks.length}</p>
            <p className="text-[11px] font-semibold text-gray-500">Due Today</p>
          </div>
        </div>
      </div>

      {/* MOBILE SCREEN 3 TODAY'S PLAN CARD */}
      <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-xs mb-4 md:hidden">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold text-gray-800">Today's Plan</h3>
          <button
            type="button"
            onClick={() => navigate('/pending')}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 cursor-pointer"
          >
            View All
          </button>
        </div>
        <div className="space-y-1.5 mb-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>{todayPlan.dueTodayTasks.length} tasks due today</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{todayPlan.overdueTasks.length} overdue tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{todayPlan.completedTodayTasks.length} completed today</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full h-2.5 overflow-hidden theme-progress-track">
            <div
              className="theme-progress-fill h-full rounded-full transition-all duration-500"
              style={{ width: `${todayPlan.progressPct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-purple-700 shrink-0">
            {todayPlan.progressPct}%
          </span>
        </div>
      </div>

      {/* MOBILE SCREEN 3 FULL-WIDTH ADD BUTTON */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full py-3.5 mb-5 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white font-bold text-sm shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer md:hidden"
      >
        <Plus className="w-4 h-4" />
        <span>+ Add New Task</span>
      </button>

      {/* MOBILE SCREEN 3 QUICK ACTIONS ROW */}
      <div className="mb-6 md:hidden">
        <h4 className="text-xs font-bold text-gray-700 mb-3">Quick Actions</h4>
        <div className="grid grid-cols-4 gap-2 text-center">
          <button
            type="button"
            onClick={() => navigate('/messages')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-purple-50 group-hover:bg-purple-100 border border-purple-100 flex items-center justify-center text-purple-600 transition shadow-2xs group-active:scale-95">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-gray-700 group-hover:text-purple-700">QuickSend</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/alarms')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-purple-50 group-hover:bg-purple-100 border border-purple-100 flex items-center justify-center text-purple-600 transition shadow-2xs group-active:scale-95">
              <AlarmClock className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-gray-700 group-hover:text-purple-700">Alarms</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-purple-50 group-hover:bg-purple-100 border border-purple-100 flex items-center justify-center text-purple-600 transition shadow-2xs group-active:scale-95">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-gray-700 group-hover:text-purple-700">Calendar</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-purple-50 group-hover:bg-purple-100 border border-purple-100 flex items-center justify-center text-purple-600 transition shadow-2xs group-active:scale-95">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-gray-700 group-hover:text-purple-700">Analytics</span>
          </button>
        </div>
      </div>

      {/* DESKTOP STATS */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 md:mb-6">
        {STATS.map(({
          key,label,icon: Icon,iconColor,borderColor = "border-purple-100",
          valueKey, textColor, gradient
         }) => (
          <div key={key} className={`${STAT_CARD} ${borderColor} active:scale-[0.98] transition-transform`}>
            <div className='flex items-center gap-2 md:gap-3'>
              <div className={`${ICON_WRAPPER} ${iconColor} shrink-0`}>
                <Icon className='w-4 h-4 md:w-5 md:h-5' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className={`${VALUE_CLASS} ${gradient 
                  ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 bg-clip-text text-transparent"
                  : textColor }`}> {stats[valueKey]} </p>
                <p className={LABEL_CLASS}>{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* UPCOMING SMART ALARMS WIDGET */}
      <div className="mb-6">
        {nextAlarm ? (
          <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30 text-fuchsia-300 shrink-0">
                <BellRing className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30">
                    Next Smart Alarm
                  </span>
                  <span className="text-xs text-purple-200 flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {formatAlarmTime(nextAlarm.reminderAt)}
                  </span>
                  {nextAlarm.alarmSound && (
                    <span className="text-[11px] text-purple-300/80 flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />
                      {nextAlarm.alarmSound}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                  {nextAlarm.title}
                </h3>
                {nextAlarm.description && (
                  <p className="text-xs text-purple-200/70 truncate max-w-xl">
                    {nextAlarm.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectTask(nextAlarm);
                  setShowModal(true);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Edit Alarm</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Device Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-purple-100 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">
                No active alarms scheduled. Open any task to configure exact-time push & sound reminders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline shrink-0 cursor-pointer"
            >
              Configure Alarm Settings &rarr;
            </button>
          </div>
        )}
      </div>

      {/* TODAY'S PLAN & PROGRESS (Feature E - Desktop Version) */}
      <section className="hidden md:block bg-white rounded-2xl border border-purple-100 p-4 sm:p-5 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-purple-600 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Daily Planning & Progress
            </p>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mt-0.5">
              Today's Plan
            </h2>
          </div>

          {/* Progress Indicator */}
          {todayPlan.hasTasks && (
            <div className="flex items-center gap-3 self-start sm:self-auto bg-purple-50 border border-purple-100 px-3.5 py-1.5 rounded-full text-xs font-semibold text-purple-800">
              <span>{todayPlan.completedCount} of {todayPlan.totalTarget} completed ({todayPlan.progressPct}%)</span>
              <div className="w-16 rounded-full h-2 overflow-hidden theme-progress-track">
                <div
                  className="theme-progress-fill h-2 rounded-full transition-all duration-500"
                  style={{ width: `${todayPlan.progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {!todayPlan.hasTasks ? (
          <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100/60 text-center text-xs text-gray-500">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="font-semibold text-gray-700">No tasks due today</p>
            <p className="text-gray-400 mt-0.5">You're completely caught up! Assign a due date to plan today's priorities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Column 1: Due Today */}
            <div className="p-3 rounded-xl bg-purple-50/30 border border-purple-100/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-600" /> Due Today
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 text-[10px]">
                  {todayPlan.dueTodayTasks.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {todayPlan.dueTodayTasks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No tasks due today</p>
                ) : (
                  todayPlan.dueTodayTasks.map((t) => (
                    <div key={t._id || t.id} className="p-2 rounded-lg bg-white border border-purple-100 shadow-2xs flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-gray-800 flex-1">{t.title}</span>
                      <button
                        type="button"
                        onClick={() => navigate("/focus", { state: { taskId: t._id || t.id } })}
                        className="px-2 py-0.5 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-[10px] shrink-0 transition flex items-center gap-1 cursor-pointer"
                        title="Start focus session for this task"
                      >
                        <Timer className="w-3 h-3" /> Focus
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: Overdue Attention */}
            <div className="p-3 rounded-xl bg-rose-50/30 border border-rose-100/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Overdue Attention
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px]">
                  {todayPlan.overdueTasks.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {todayPlan.overdueTasks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">No overdue tasks! 👏</p>
                ) : (
                  todayPlan.overdueTasks.map((t) => (
                    <div key={t._id || t.id} className="p-2 rounded-lg bg-white border border-rose-100 shadow-2xs flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-gray-800 flex-1">{t.title}</span>
                      <button
                        type="button"
                        onClick={() => navigate("/focus", { state: { taskId: t._id || t.id } })}
                        className="px-2 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[10px] shrink-0 transition flex items-center gap-1 cursor-pointer"
                        title="Start focus session for this task"
                      >
                        <Timer className="w-3 h-3" /> Focus
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Completed Today */}
            <div className="p-3 rounded-xl bg-emerald-50/30 border border-emerald-100/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed Today
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">
                  {todayPlan.completedTodayTasks.length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {todayPlan.completedTodayTasks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic">None completed yet today</p>
                ) : (
                  todayPlan.completedTodayTasks.map((t) => (
                    <div key={t._id || t.id} className="p-2 rounded-lg bg-white border border-emerald-100 shadow-2xs flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-gray-500 line-through flex-1">{t.title}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold shrink-0">Done ✓</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* CONTENTS */}
      <div className='space-y-6 w-full min-w-0 max-w-full'>

        {/* SEARCH */}
        <div className='relative w-full min-w-0 max-w-full'>
          <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search tasks...'
            className='w-full pl-9 pr-9 py-2.5 bg-white border border-purple-100 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200'
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>

        {/* ORDER YOUR LIST & FILTERS */}
        <section className='bg-white rounded-2xl border border-purple-100 shadow-xs p-3.5 sm:p-5 w-full min-w-0 max-w-full overflow-hidden'>
    <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4'>
      <div className='min-w-0'>
        <p className='text-xs uppercase tracking-[0.2em] text-purple-600 font-bold flex items-center gap-1.5'>
          <CalendarIcon className='w-3.5 h-3.5 text-purple-500' /> Order Your List
        </p>
        <h2 className='text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2 mt-0.5'>
          Sort & Filter Tasks
        </h2>
      </div>
      <div className='flex items-center gap-2 text-xs sm:text-sm text-purple-700 bg-purple-50/80 border border-purple-100 px-3.5 py-1.5 rounded-full self-start font-medium shadow-xs'>
        <span>Showing <strong>{filteredTasks.length}</strong> of <strong>{tasks.length}</strong> tasks</span>
      </div>
    </div>

    {/* Sort Buttons */}
    <div className='mb-4'>
      <p className='text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider'>Sort By</p>
      <div className='flex flex-wrap gap-2'>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setSortBy(option.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs sm:text-sm transition-all duration-200 transform hover:scale-[1.02] ${
              sortBy === option.id
                ? 'bg-purple-700 text-white border-purple-700 shadow-md font-bold'
                : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-50 hover:text-purple-700 font-medium'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>

    {/* Filter Chips */}
    <div>
      <p className='text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider'>Filter By Category</p>
      <div className='flex gap-2 overflow-x-auto pb-1 hide-scrollbar'>
        {FILTER_CHIPS.map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`shrink-0 min-w-max px-3.5 py-1.5 rounded-full border text-xs sm:text-sm transition-all duration-200 transform hover:scale-[1.02] cursor-pointer ${
              filter === option
                ? 'bg-purple-700 text-white border-purple-700 shadow-sm font-bold'
                : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-50 hover:text-purple-700 font-medium'
            }`}
          >
            <span>{FILTER_LABELS[option]}</span>
            <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${filter === option ? 'bg-white/20 text-white font-bold' : 'bg-purple-100 text-purple-800'}`}>
              {filterCounts[option] ?? 0}
            </span>
          </button>
        ))}
      </div>
    </div>

    {/* Project Filter */}
    {projects.length > 0 && (
      <div className='mt-4 pt-4 border-t border-purple-100'>
        <p className='text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5'>
          <Folder className='w-3.5 h-3.5 text-purple-500' /> Filter By Project
        </p>
        <div className='flex gap-2 overflow-x-auto pb-1 hide-scrollbar'>
          <button
            type='button'
            onClick={() => setSelectedProject("all")}
            className={`shrink-0 min-w-max px-3 py-1 rounded-full border text-xs transition cursor-pointer ${
              selectedProject === "all"
                ? "bg-purple-700 text-white border-purple-700 font-bold shadow-xs"
                : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50 font-medium"
            }`}
          >
            All Projects
          </button>
          {projects.map((proj) => (
            <button
              key={proj._id}
              type='button'
              onClick={() => setSelectedProject(proj._id)}
              className={`shrink-0 min-w-max px-3 py-1 rounded-full border text-xs flex items-center gap-1.5 transition cursor-pointer ${
                selectedProject === proj._id
                  ? "bg-purple-700 text-white border-purple-700 font-bold shadow-xs"
                  : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50 font-medium"
              }`}
            >
              <span
                className='w-2 h-2 rounded-full'
                style={{ backgroundColor: proj.color || "#8B2CF5" }}
              />
              <span>{proj.name}</span>
            </button>
          ))}
          <button
            type='button'
            onClick={() => setSelectedProject("none")}
            className={`shrink-0 min-w-max px-3 py-1 rounded-full border text-xs transition cursor-pointer ${
              selectedProject === "none"
                ? "bg-purple-700 text-white border-purple-700 font-bold shadow-xs"
                : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50 font-medium"
            }`}
          >
            No Project
          </button>
        </div>
      </div>
    )}

    {/* Tag Filter */}
    {userTags.length > 0 && (
      <div className='mt-4 pt-4 border-t border-purple-100'>
        <p className='text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider flex items-center gap-1.5'>
          <Tag className='w-3.5 h-3.5 text-purple-500' /> Filter By Tag
        </p>
        <div className='flex gap-2 overflow-x-auto pb-1 hide-scrollbar'>
          <button
            type='button'
            onClick={() => setSelectedTag("all")}
            className={`shrink-0 min-w-max px-3 py-1 rounded-full border text-xs transition cursor-pointer ${
              selectedTag === "all"
                ? "bg-purple-700 text-white border-purple-700 font-bold shadow-xs"
                : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50 font-medium"
            }`}
          >
            All Tags
          </button>
          {userTags.map((tag) => (
            <button
              key={tag}
              type='button'
              onClick={() => setSelectedTag(tag)}
              className={`shrink-0 min-w-max px-3 py-1 rounded-full border text-xs transition cursor-pointer ${
                selectedTag === tag
                  ? "bg-purple-700 text-white border-purple-700 font-bold shadow-xs"
                  : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-medium"
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Clear all filters active pill */}
    {(filter !== "all" || selectedProject !== "all" || selectedTag !== "all" || searchQuery) && (
      <div className='mt-4 pt-3 border-t border-purple-100 flex items-center justify-between'>
        <span className='text-xs text-gray-500'>Active filters applied</span>
        <button
          type='button'
          onClick={() => {
            setFilter("all");
            setSelectedProject("all");
            setSelectedTag("all");
            setSearchQuery("");
          }}
          className='inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold hover:underline cursor-pointer'
        >
          <RotateCcw className='w-3 h-3' /> Reset All Filters
        </button>
      </div>
    )}
  </section>

  {/* BULK ACTIONS / TASK LIST TOOLBAR */}
  <div className='flex items-center justify-between gap-3 px-1'>
    <div className='flex items-center gap-2'>
      <h3 className='text-sm sm:text-base font-bold text-gray-800'>
        Tasks <span className='text-xs font-medium text-gray-500'>({filteredTasks.length})</span>
      </h3>
    </div>
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={() => {
          setIsSelectionMode(!isSelectionMode);
          setSelectedTaskIds([]);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
          isSelectionMode
            ? "bg-purple-700 text-white border-purple-700 shadow-xs"
            : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
        }`}
      >
        <CheckSquare className='w-3.5 h-3.5' />
        {isSelectionMode ? "Exit Bulk Mode" : "Bulk Actions"}
      </button>
    </div>
  </div>

  {/* DOCKED BULK ACTION BAR */}
  {isSelectionMode && (
    <div className='p-3 sm:p-4 rounded-xl border border-purple-200 bg-purple-50/90 shadow-md flex flex-wrap items-center justify-between gap-3 animate-fadeIn'>
      <div className='flex items-center gap-3'>
        <button
          type='button'
          onClick={handleSelectAll}
          className='inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer'
        >
          {selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0 ? (
            <CheckSquare className='w-4 h-4 text-purple-700' />
          ) : (
            <Square className='w-4 h-4 text-purple-700' />
          )}
          {selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0
            ? "Deselect All"
            : "Select All"}
        </button>
        <span className='text-xs font-semibold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full'>
          {selectedTaskIds.length} of {filteredTasks.length} selected
        </span>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <button
          type='button'
          disabled={!selectedTaskIds.length || bulkLoading}
          onClick={() => handleBulkAction("complete")}
          className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer'
        >
          <CheckCircle2 className='w-3.5 h-3.5' /> Complete
        </button>
        <button
          type='button'
          disabled={!selectedTaskIds.length || bulkLoading}
          onClick={() => handleBulkAction("incomplete")}
          className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-40 transition cursor-pointer'
        >
          Incomplete
        </button>

        {/* Bulk Priority */}
        <select
          disabled={!selectedTaskIds.length || bulkLoading}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              handleBulkAction("priority", e.target.value);
              e.target.value = "";
            }
          }}
          className='bg-white text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500 disabled:opacity-40 cursor-pointer'
        >
          <option value="" disabled>Priority...</option>
          <option value="Low">Set Low</option>
          <option value="Medium">Set Medium</option>
          <option value="High">Set High</option>
        </select>

        {/* Bulk Project */}
        {projects.length > 0 && (
          <select
            disabled={!selectedTaskIds.length || bulkLoading}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value !== "") {
                handleBulkAction("project", e.target.value === "none" ? null : e.target.value);
                e.target.value = "";
              }
            }}
            className='bg-white text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500 disabled:opacity-40 cursor-pointer'
          >
            <option value="" disabled>Move to Project...</option>
            <option value="none">No Project</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        )}

        <button
          type='button'
          disabled={!selectedTaskIds.length || bulkLoading}
          onClick={() => handleBulkAction("delete")}
          className='inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition cursor-pointer'
        >
          <Trash2 className='w-3.5 h-3.5' /> Delete
        </button>
      </div>
    </div>
  )}

  {/* TASK LIST */}
<div className='space-y-4'>
  {filteredTasks.length === 0 ? (
    <div className={EMPTY_STATE.wrapper}>
      <div className={EMPTY_STATE.iconWrapper}>
        <CalendarIcon className='w-8 h-8 text-purple-500' />
        </div>
        <h3 className='text-lg font-semibold text-gray-800 mb-2'>
          No tasks found
        </h3>
        <p className='text-sm text-gray-500 mb-4'>
          {filter === "all" && selectedProject === "all" && selectedTag === "all" && !searchQuery
            ? "Create your first task to get started" 
            : "No tasks match your search or filter"}
        </p>
        <div className='flex gap-2 justify-center'>
          {(filter !== "all" || selectedProject !== "all" || selectedTag !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setFilter("all");
                setSelectedProject("all");
                setSelectedTag("all");
                setSearchQuery("");
              }}
              className='px-4 py-2 text-sm font-medium border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition cursor-pointer'
            >
              Clear Filters
            </button>
          )}
          <button 
            onClick={() => setShowModal(true)} 
            className={EMPTY_STATE.btn}
          >
            Add New Task
          </button>
        </div>
    </div>
  ) : (
    filteredTasks.map(task => (
      <TaskItem key={task._id || task.id} task={task} 
      onRefresh={refreshTasks}
      showCompleteCheckbox
      isSelectionMode={isSelectionMode}
      isSelected={selectedTaskIds.includes(task._id || task.id)}
      onToggleSelect={handleToggleSelect}
      onEdit={() => {setSelectTask(task); setShowModal(true) }}/>
    ))
  )}
</div>
    {/* ADD TASK DESKTOP */}
<div
  onClick={() => setShowModal(true)}
  className='hidden md:flex items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 add-task-cta'
>
  <Plus className='w-5 h-5 mr-2 cta-icon' />
  <span className='font-semibold cta-label'>Add New Task</span>
</div>
</div>

     {/* MODAL */}
      {showModal && (
        <Suspense fallback={null}>
          <TaskModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false);
              setSelectTask(null);
            }}
            taskToEdit={selectedTask}
            onSave={handleTaskSave}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Dashboard;
