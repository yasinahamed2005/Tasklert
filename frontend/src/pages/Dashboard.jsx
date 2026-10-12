import React, { useState, useMemo, useCallback } from 'react';
import { HEADER, WRAPPER, ADD_BUTTON, ICON_WRAPPER,STAT_CARD,STATS,STATS_GRID,VALUE_CLASS, LABEL_CLASS, FILTER_WRAPPER } from '../assets/dummy';
import { HomeIcon, Plus, Filter, CalendarIcon, Search, X, BellRing, Clock, ArrowRight, Volume2 } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { FILTER_LABELS, SELECT_CLASSES, FILTER_OPTIONS,TABS_WRAPPER,TAB_BASE,TAB_ACTIVE,TAB_INACTIVE,EMPTY_STATE, SORT_OPTIONS, sortTasks  } from '../assets/dummy';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';

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
  const {tasks, refreshTasks}=useOutletContext()
  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectTask] = useState(null);
  const [filter, setFilter] = useState("all");
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

  const activeSortLabel = SORT_LABELS[sortBy] || "Newest first";

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

  // FILTER + SEARCH + SORT TASKS
const filteredTasks = useMemo(() => {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today); dayAfterTomorrow.setDate(today.getDate() + 2);

  const query = searchQuery.trim().toLowerCase();

  const byFilterAndSearch = tasks.filter(task => {
    if (query) {
      const inTitle = task.title?.toLowerCase().includes(query);
      const inDescription = task.description?.toLowerCase().includes(query);
      if (!inTitle && !inDescription) return false;
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
},
  [tasks, filter, sortBy, searchQuery]
);

  // TaskModal already saves to API, this only refreshes local view.
  const handleTaskSave = useCallback(() => {
    refreshTasks();
    setShowModal(false);
    setSelectTask(null);
  }, [refreshTasks]);

  return (
    <div className={WRAPPER}>
      {/* HEADER */}
      <div className={HEADER}>
        <div className='min-w-0'>
          <h1 className='text-xl md:text-3xl font-bold text-gray-800 flex items-center gap-2'>
            <HomeIcon className='text-purple-500 w-5 h-5 md:w-6 md:h-6 shrink-0' />
            <span className='truncate'>Task Overview</span>
          </h1>
          <p className='text-sm text-gray-500 mt-1 ml-7 truncate'> Manage your tasks efficiently</p>
        </div>

        <button onClick={() => setShowModal(true)} className={ADD_BUTTON}>
          <Plus size={18} className='cta-icon' />
          <span className='cta-label font-semibold'>Add New Task</span>
          </button>
      </div>
      {/* STATS */}
      <div className={STATS_GRID}>
        {STATS.map(({
          key,label,icon: Icon,iconColor,borderColor = "border-purple-100",
          valueKey, textColor, gradient
         }) => (
    <div key={key} className={`${STAT_CARD} ${borderColor}`}>
      <div className='flex items-center gap-2 md:gap-3'>
        <div className={`${ICON_WRAPPER} ${iconColor}`}>
          <Icon className='w-4 h-4 md:w-5 md:h-5' />
        </div>
        <div className='min-w-0'>
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
                <BellRing className="w-6 h-6 animate-bounce" />
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
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-purple-100 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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

      {/* CONTENTS */}
<div className='space-y-6'>

  {/* SEARCH */}
  <div className='relative'>
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
  <section className='bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 shadow-sm p-4 sm:p-5 transition-all duration-300 hover:shadow-md'>
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
            className={`shrink-0 min-w-max px-3.5 py-1.5 rounded-full border text-xs sm:text-sm transition-all duration-200 transform hover:scale-[1.02] ${
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
  </section>

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
          {filter === "all" && !searchQuery
            ? "Create your first task to get started" 
            : "No tasks match your search or filter"}
        </p>
        <button 
          onClick={() => setShowModal(true)} 
          className={EMPTY_STATE.btn}
        >
          Add New Task
        </button>
    </div>
  ) : (
    filteredTasks.map(task => (
      <TaskItem key={task._id || task.id} task={task} 
      onRefresh={refreshTasks}
      showCompleteCheckbox
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
<TaskModal isOpen={showModal}
onClose={() => { setShowModal(false); setSelectTask(null) }}
taskToEdit={selectedTask}
onSave={handleTaskSave} />
    </div>
  );
};

export default Dashboard;
