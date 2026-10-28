import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  isTaskCompleted,
  isTaskDueToday,
  isTaskOverdue,
  isTaskUpcoming,
  isTaskNoDueDate,
} from '../assets/dummy';
import {
  ListChecks,
  Plus,
  Search,
  X,
  RotateCcw,
  Folder,
  Tag,
  CheckSquare,
  Square,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Bell,
  Check,
} from 'lucide-react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { API_BASE_URL } from '../config/api';

const SORT_OPTIONS_LIST = [
  { id: 'smart', label: 'Smart (Urgency)' },
  { id: 'deadline', label: 'Closest Deadline' },
  { id: 'priority', label: 'Priority (High to Low)' },
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'alphabetical', label: 'A to Z' },
];

const priorityRank = { high: 3, medium: 2, low: 1 };

const PendingPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary status / date tab: 'all' | 'today' | 'upcoming' | 'overdue' | 'no_date'
  const [filterTab, setFilterTab] = useState(() => {
    const p = searchParams.get('filter');
    if (['all', 'today', 'upcoming', 'overdue', 'no_date'].includes(p)) return p;
    if (p === 'pending') return 'all';
    return 'all';
  });

  useEffect(() => {
    const p = searchParams.get('filter');
    if (['all', 'today', 'upcoming', 'overdue', 'no_date'].includes(p)) {
      setFilterTab(p);
    } else if (p === 'pending') {
      setFilterTab('all');
    }
  }, [searchParams]);

  // Controls state
  const [sortBy, setSortBy] = useState('smart');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedReminder, setSelectedReminder] = useState('all'); // 'all' | 'with_reminder' | 'without_reminder'

  // Popover state
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const moreFiltersRef = useRef(null);

  // Quick-Add state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('Medium');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const quickInputRef = useRef(null);

  // Modals state
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Bulk mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Metadata: Projects & Tags
  const [projects, setProjects] = useState([]);
  const [userTags, setUserTags] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const [pRes, tRes] = await Promise.allSettled([
          axios.get(`${API_BASE_URL}/api/projects`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/api/tasks/tags`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!isMounted) return;
        if (pRes.status === 'fulfilled' && pRes.value.data?.projects) {
          setProjects(pRes.value.data.projects);
        }
        if (tRes.status === 'fulfilled' && tRes.value.data?.tags) {
          setUserTags(tRes.value.data.tags);
        }
      } catch (err) {
        console.warn('Error fetching projects/tags in PendingPage', err);
      }
    };
    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close more filters popover on outside click or Escape
  useEffect(() => {
    if (!showMoreFilters) return;
    const handleClickOutside = (e) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target)) {
        setShowMoreFilters(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowMoreFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoreFilters]);

  // Isolate pending tasks (completed tasks belong strictly to Completed Tasks view)
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => !isTaskCompleted(t));
  }, [tasks]);

  // Live accurate counts
  const counts = useMemo(() => {
    return {
      all: pendingTasks.length,
      today: pendingTasks.filter(isTaskDueToday).length,
      upcoming: pendingTasks.filter(isTaskUpcoming).length,
      overdue: pendingTasks.filter(isTaskOverdue).length,
      noDate: pendingTasks.filter(isTaskNoDueDate).length,
      high: pendingTasks.filter((t) => (t.priority || '').toLowerCase() === 'high').length,
      medium: pendingTasks.filter((t) => (t.priority || '').toLowerCase() === 'medium').length,
      low: pendingTasks.filter((t) => (t.priority || '').toLowerCase() === 'low').length,
      withReminder: pendingTasks.filter((t) => t.reminderEnabled && t.reminderAt).length,
    };
  }, [pendingTasks]);

  // Quick Filters configuration
  const quickFilters = useMemo(
    () => [
      { id: 'all', label: 'All Pending', count: counts.all },
      { id: 'today', label: 'Today', count: counts.today },
      { id: 'upcoming', label: 'Upcoming', count: counts.upcoming },
      { id: 'overdue', label: 'Overdue', count: counts.overdue, isOverdue: true },
      { id: 'no_date', label: 'No Due Date', count: counts.noDate },
    ],
    [counts]
  );

  // Active advanced filters calculation
  const activeMoreFiltersCount =
    (selectedPriority !== 'all' ? 1 : 0) +
    (selectedProject !== 'all' ? 1 : 0) +
    (selectedTag !== 'all' ? 1 : 0) +
    (selectedReminder !== 'all' ? 1 : 0);

  const hasAnyActiveFilters =
    filterTab !== 'all' ||
    selectedPriority !== 'all' ||
    selectedProject !== 'all' ||
    selectedTag !== 'all' ||
    selectedReminder !== 'all' ||
    Boolean(searchQuery.trim());

  const resetAllFilters = useCallback(() => {
    setFilterTab('all');
    setSearchParams({});
    setSelectedPriority('all');
    setSelectedProject('all');
    setSelectedTag('all');
    setSelectedReminder('all');
    setSearchQuery('');
  }, [setSearchParams]);

  const resetMoreFilters = useCallback(() => {
    setSelectedPriority('all');
    setSelectedProject('all');
    setSelectedTag('all');
    setSelectedReminder('all');
  }, []);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return pendingTasks.filter((t) => {
      // 1. Primary tab filter
      if (filterTab === 'today' && !isTaskDueToday(t)) return false;
      if (filterTab === 'upcoming' && !isTaskUpcoming(t)) return false;
      if (filterTab === 'overdue' && !isTaskOverdue(t)) return false;
      if (filterTab === 'no_date' && !isTaskNoDueDate(t)) return false;

      // 2. Search query (title, description, tags, project)
      if (q) {
        const inTitle = t.title?.toLowerCase().includes(q);
        const inDesc = t.description?.toLowerCase().includes(q);
        const inTags = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(q));
        const inProj = t.project?.name?.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inTags && !inProj) return false;
      }

      // 3. Priority filter
      if (selectedPriority !== 'all') {
        if ((t.priority || '').toLowerCase() !== selectedPriority.toLowerCase()) return false;
      }

      // 4. Project filter
      if (selectedProject !== 'all') {
        const pId = t.project?._id || (typeof t.project === 'string' ? t.project : null);
        if (selectedProject === 'none') {
          if (pId) return false;
        } else {
          if (pId !== selectedProject) return false;
        }
      }

      // 5. Tag filter
      if (selectedTag !== 'all') {
        if (!Array.isArray(t.tags) || !t.tags.includes(selectedTag)) return false;
      }

      // 6. Reminder filter
      if (selectedReminder === 'with_reminder') {
        if (!t.reminderEnabled || !t.reminderAt) return false;
      } else if (selectedReminder === 'without_reminder') {
        if (t.reminderEnabled && t.reminderAt) return false;
      }

      return true;
    });
  }, [pendingTasks, filterTab, searchQuery, selectedPriority, selectedProject, selectedTag, selectedReminder]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const list = [...filteredTasks];

    switch (sortBy) {
      case 'smart': {
        // Smart sorting: Overdue (earliest first) -> Today (priority high->low, deadline) -> Upcoming (earliest deadline, priority) -> No Date (priority, newest)
        return list.sort((a, b) => {
          const aOver = isTaskOverdue(a);
          const bOver = isTaskOverdue(b);
          if (aOver && !bOver) return -1;
          if (!aOver && bOver) return 1;
          if (aOver && bOver) {
            return new Date(a.dueDate) - new Date(b.dueDate);
          }

          const aToday = isTaskDueToday(a);
          const bToday = isTaskDueToday(b);
          if (aToday && !bToday) return -1;
          if (!aToday && bToday) return 1;
          if (aToday && bToday) {
            const pDiff = (priorityRank[b.priority?.toLowerCase()] || 0) - (priorityRank[a.priority?.toLowerCase()] || 0);
            if (pDiff !== 0) return pDiff;
            return new Date(a.dueDate) - new Date(b.dueDate);
          }

          const aUp = isTaskUpcoming(a);
          const bUp = isTaskUpcoming(b);
          if (aUp && !bUp) return -1;
          if (!aUp && bUp) return 1;
          if (aUp && bUp) {
            const dDiff = new Date(a.dueDate) - new Date(b.dueDate);
            if (dDiff !== 0) return dDiff;
            return (priorityRank[b.priority?.toLowerCase()] || 0) - (priorityRank[a.priority?.toLowerCase()] || 0);
          }

          // Both have no due date: rank by priority then newest
          const pDiff = (priorityRank[b.priority?.toLowerCase()] || 0) - (priorityRank[a.priority?.toLowerCase()] || 0);
          if (pDiff !== 0) return pDiff;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }

      case 'deadline': {
        return list.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        });
      }

      case 'priority': {
        return list.sort((a, b) => {
          const pDiff = (priorityRank[b.priority?.toLowerCase()] || 0) - (priorityRank[a.priority?.toLowerCase()] || 0);
          if (pDiff !== 0) return pDiff;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      }

      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      case 'alphabetical':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

      case 'newest':
      default:
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }, [filteredTasks, sortBy]);

  // Section groupings for "All Pending" in Smart sort
  const taskGroups = useMemo(() => {
    if (filterTab !== 'all' || sortBy !== 'smart') return null;

    const overdue = [];
    const today = [];
    const upcoming = [];
    const noDate = [];

    for (const t of sortedTasks) {
      if (isTaskOverdue(t)) overdue.push(t);
      else if (isTaskDueToday(t)) today.push(t);
      else if (isTaskUpcoming(t)) upcoming.push(t);
      else noDate.push(t);
    }

    return [
      { id: 'overdue', label: 'Overdue Attention', tone: 'rose', icon: AlertTriangle, tasks: overdue },
      { id: 'today', label: 'Due Today', tone: 'amber', icon: Clock, tasks: today },
      { id: 'upcoming', label: 'Upcoming', tone: 'purple', icon: Calendar, tasks: upcoming },
      { id: 'no_date', label: 'No Due Date', tone: 'gray', icon: FileText, tasks: noDate },
    ].filter((g) => g.tasks.length > 0);
  }, [filterTab, sortBy, sortedTasks]);

  // Quick Task Creation handler
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || quickSubmitting) return;

    setQuickSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const payload = {
        title,
        priority: quickPriority,
        completed: 'No',
        dueDate: null,
        subtasks: [],
        tags: selectedTag !== 'all' ? [selectedTag] : [],
        project: selectedProject !== 'all' && selectedProject !== 'none' ? selectedProject : null,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };

      const res = await axios.post(`${API_BASE_URL}/api/tasks/gp`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data?.success || res.status === 200 || res.status === 201) {
        toast.success(`Task "${title}" created!`);
        setQuickTitle('');
        refreshTasks();
      }
    } catch (err) {
      console.error('Quick add failed:', err);
      toast.error(err.response?.data?.message || 'Failed to create task');
    } finally {
      setQuickSubmitting(false);
      quickInputRef.current?.focus();
    }
  };

  // Bulk selection handlers
  const handleToggleSelect = useCallback((id) => {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedTaskIds.length === sortedTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(sortedTasks.map((t) => t._id || t.id).filter(Boolean));
    }
  }, [selectedTaskIds, sortedTasks]);

  const handleBulkAction = async (action, value) => {
    if (!selectedTaskIds.length) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE_URL}/api/tasks/bulk`,
        { taskIds: selectedTaskIds, action, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(data.message || 'Bulk operation completed');
        if (action === 'delete') {
          const deletedIds = [...selectedTaskIds];
          toast.info(
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{deletedIds.length} tasks moved to trash</span>
              <button
                onClick={async () => {
                  try {
                    await Promise.all(
                      deletedIds.map((id) =>
                        axios.post(
                          `${API_BASE_URL}/api/tasks/${id}/restore`,
                          {},
                          { headers: { Authorization: `Bearer ${token}` } }
                        )
                      )
                    );
                    toast.success('Tasks restored!');
                    refreshTasks();
                  } catch (_e) {
                    toast.error('Failed to restore tasks');
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
      toast.error(err.response?.data?.message || 'Bulk operation failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 min-w-0 w-full space-y-4 max-w-7xl mx-auto">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 shrink-0">
              <ListChecks className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
              Pending Tasks
            </h1>
            <span className="text-xs sm:text-sm font-semibold text-purple-700 bg-purple-100/90 border border-purple-200/80 px-2.5 py-0.5 rounded-full shrink-0">
              {counts.all} {counts.all === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 ml-9 truncate">
            Everything you still need to complete.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedTaskIds([]);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              isSelectionMode
                ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                : 'bg-white text-gray-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectionMode ? 'Exit Bulk' : 'Bulk Actions'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedTask(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* 2. QUICK TASK CREATION BAR */}
      <div className="bg-white rounded-xl border border-purple-100/90 shadow-2xs p-2 sm:p-2.5 transition-all focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-300">
        <form onSubmit={handleQuickAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-purple-500 shrink-0 ml-1.5" />
          <input
            ref={quickInputRef}
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add a pending task... (Press Enter to save)"
            className="flex-1 bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden"
            disabled={quickSubmitting}
          />
          {quickTitle.trim() && (
            <div className="flex items-center gap-1.5 shrink-0 animate-fadeIn">
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value)}
                className="text-[11px] font-semibold text-gray-700 bg-purple-50/70 border border-purple-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-purple-500 cursor-pointer"
                title="Select priority"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <button
                type="submit"
                disabled={quickSubmitting || !quickTitle.trim()}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
              >
                {quickSubmitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedTask(null);
              setShowModal(true);
            }}
            className="p-1.5 text-gray-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition cursor-pointer"
            title="Open full task form (due date, alarms, subtasks, tags)"
            aria-label="Open full task creation form"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 3. SEARCH, SORT & FILTERS TOOLBAR */}
      <div className="bg-white rounded-2xl border border-purple-100/90 shadow-xs p-3 sm:p-4 space-y-3">
        {/* Row 1: Search Field + Sort Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pending tasks by title, project, tags..."
              className="w-full pl-9 pr-8 py-2 bg-purple-50/40 border border-purple-100 hover:border-purple-200 focus:bg-white rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all duration-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <label htmlFor="pending-sort-by" className="text-xs font-semibold text-gray-500 whitespace-nowrap flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-600" />
              <span>Sort:</span>
            </label>
            <div className="relative">
              <select
                id="pending-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-2.5 pr-7 py-1.5 bg-white border border-purple-200 hover:border-purple-300 rounded-lg text-xs font-semibold text-gray-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer transition"
              >
                {SORT_OPTIONS_LIST.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Row 2: Quick Filters & More Filters */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-purple-50">
          {quickFilters.map((tab) => {
            const isActive = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setFilterTab(tab.id);
                  if (tab.id === 'all') setSearchParams({});
                  else setSearchParams({ filter: tab.id });
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                  isActive
                    ? tab.isOverdue
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'bg-purple-700 text-white shadow-xs font-bold'
                    : tab.isOverdue && tab.count > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200/80 hover:bg-rose-100 font-semibold'
                    : 'bg-white text-gray-700 border border-purple-100 hover:bg-purple-50 hover:text-purple-700 font-medium'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab.isOverdue && tab.count > 0
                      ? 'bg-rose-200/70 text-rose-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}

          {/* More Filters Popover Trigger */}
          <div className="relative shrink-0" ref={moreFiltersRef}>
            <button
              id="more-filters-trigger"
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              aria-expanded={showMoreFilters}
              aria-haspopup="dialog"
              aria-label="More filters"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                activeMoreFiltersCount > 0
                  ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-2xs font-bold'
                  : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
              <span>More filters</span>
              {activeMoreFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-purple-700 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeMoreFiltersCount}
                </span>
              )}
              <ChevronDown
                className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${
                  showMoreFilters ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover */}
            {showMoreFilters && (
              <div
                role="dialog"
                aria-label="Additional task filters"
                className="absolute left-0 mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-white rounded-xl shadow-xl border border-purple-100 p-3.5 z-30 animate-fadeIn space-y-3.5 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" /> Advanced Filters
                  </span>
                  {activeMoreFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetMoreFilters}
                      className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</p>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: 'all', label: 'All', count: counts.all },
                      { id: 'High', label: 'High', count: counts.high, color: 'text-red-600' },
                      { id: 'Medium', label: 'Medium', count: counts.medium, color: 'text-amber-600' },
                      { id: 'Low', label: 'Low', count: counts.low, color: 'text-emerald-600' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPriority(p.id)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                          selectedPriority === p.id
                            ? 'bg-purple-700 text-white border-purple-700 shadow-2xs font-bold'
                            : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50'
                        }`}
                      >
                        <div>{p.label}</div>
                        <div className={`text-[10px] ${selectedPriority === p.id ? 'text-white/80' : p.color || 'text-gray-400'}`}>
                          {p.count}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Projects */}
                {projects.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Folder className="w-3 h-3 text-purple-600" /> Projects
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => setSelectedProject('all')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                          selectedProject === 'all'
                            ? 'bg-purple-100 text-purple-800 font-bold'
                            : 'text-gray-700 hover:bg-gray-100 font-medium'
                        }`}
                      >
                        <span>All Projects</span>
                        {selectedProject === 'all' && <Check className="w-3.5 h-3.5 text-purple-700" />}
                      </button>
                      {projects.map((proj) => (
                        <button
                          key={proj._id}
                          type="button"
                          onClick={() => setSelectedProject(proj._id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            selectedProject === proj._id
                              ? 'bg-purple-100 text-purple-800 font-bold'
                              : 'text-gray-700 hover:bg-gray-100 font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: proj.color || '#8B2CF5' }}
                            />
                            <span className="truncate">{proj.name}</span>
                          </span>
                          {selectedProject === proj._id && <Check className="w-3.5 h-3.5 text-purple-700" />}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedProject('none')}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                          selectedProject === 'none'
                            ? 'bg-purple-100 text-purple-800 font-bold'
                            : 'text-gray-700 hover:bg-gray-100 font-medium'
                        }`}
                      >
                        <span>No Project</span>
                        {selectedProject === 'none' && <Check className="w-3.5 h-3.5 text-purple-700" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {userTags.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-purple-600" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => setSelectedTag('all')}
                        className={`px-2 py-1 rounded-md text-[11px] transition cursor-pointer ${
                          selectedTag === 'all'
                            ? 'bg-purple-700 text-white font-bold'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        All Tags
                      </button>
                      {userTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                          className={`px-2 py-1 rounded-md text-[11px] transition cursor-pointer ${
                            selectedTag === tag
                              ? 'bg-purple-700 text-white font-bold'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reminder Status */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Bell className="w-3 h-3 text-purple-600" /> Reminders
                  </p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'with_reminder', label: 'With Alarm' },
                      { id: 'without_reminder', label: 'No Alarm' },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedReminder(r.id)}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer border ${
                          selectedReminder === r.id
                            ? 'bg-purple-700 text-white border-purple-700 font-bold'
                            : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-purple-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMoreFilters(false)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset All Filters button if active */}
          {hasAnyActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold hover:underline cursor-pointer ml-auto"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Active Advanced Filter Chips on Toolbar */}
        {activeMoreFiltersCount > 0 && (
          <div className="pt-2 border-t border-purple-50 flex flex-wrap items-center gap-1.5 animate-fadeIn">
            <span className="text-[11px] text-gray-500 font-medium mr-1">Active filter:</span>
            {selectedPriority !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <span>Priority: {selectedPriority}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPriority('all')}
                  className="hover:text-purple-950 cursor-pointer"
                  title="Remove priority filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedProject !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <span>
                  Project: {selectedProject === 'none' ? 'No Project' : projects.find((p) => p._id === selectedProject)?.name || 'Selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProject('all')}
                  className="hover:text-purple-950 cursor-pointer"
                  title="Remove project filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTag !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <span>#{selectedTag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className="hover:text-purple-950 cursor-pointer"
                  title="Remove tag filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedReminder !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <span>{selectedReminder === 'with_reminder' ? 'With Alarm' : 'No Alarm'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedReminder('all')}
                  className="hover:text-purple-950 cursor-pointer"
                  title="Remove reminder filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. DOCKED BULK ACTION BAR */}
      {isSelectionMode && (
        <div className="p-3 sm:p-4 rounded-xl border border-purple-200 bg-purple-50/90 shadow-md flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer"
            >
              {selectedTaskIds.length === sortedTasks.length && sortedTasks.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-700" />
              ) : (
                <Square className="w-4 h-4 text-purple-700" />
              )}
              {selectedTaskIds.length === sortedTasks.length && sortedTasks.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs font-semibold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full">
              {selectedTaskIds.length} of {sortedTasks.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={() => handleBulkAction('complete')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Complete
            </button>

            {/* Bulk Priority */}
            <select
              disabled={!selectedTaskIds.length || bulkLoading}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAction('priority', e.target.value);
                  e.target.value = '';
                }
              }}
              className="bg-white text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500 disabled:opacity-40 cursor-pointer"
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
                  if (e.target.value !== '') {
                    handleBulkAction('project', e.target.value === 'none' ? null : e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-white text-xs border border-purple-200 rounded-lg px-2 py-1.5 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500 disabled:opacity-40 cursor-pointer"
              >
                <option value="" disabled>Move to Project...</option>
                <option value="none">No Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            )}

            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={() => handleBulkAction('delete')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* 5. TASK LIST (LOGICAL SECTIONS OR CLEAN FLAT LIST) */}
      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-purple-100 p-8 shadow-xs text-center">
            <div className="max-w-xs mx-auto py-4 text-center">
              <div className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600">
                {hasAnyActiveFilters ? (
                  <Search className="w-6 h-6 text-purple-400" />
                ) : (
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                )}
              </div>
              <h3 className="text-gray-800 mb-1.5 text-base sm:text-lg font-bold">
                {hasAnyActiveFilters ? 'No matching pending tasks' : 'All caught up! 🎉'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">
                {hasAnyActiveFilters
                  ? 'Try clearing your search query or active filters to view all pending tasks.'
                  : 'You have no pending tasks. Relax or create a new task to plan ahead.'}
              </p>
              <div className="flex gap-2 justify-center">
                {hasAnyActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTask(null);
                      setShowModal(true);
                    }}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs transition cursor-pointer"
                  >
                    + Create a Task
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : taskGroups ? (
          // Grouped Sections for All Pending in Smart Urgency Order
          <div className="space-y-5">
            {taskGroups.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Icon
                      className={`w-4 h-4 ${
                        group.tone === 'rose'
                          ? 'text-rose-600'
                          : group.tone === 'amber'
                          ? 'text-amber-600'
                          : group.tone === 'purple'
                          ? 'text-purple-600'
                          : 'text-gray-500'
                      }`}
                    />
                    <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {group.label}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        group.tone === 'rose'
                          ? 'bg-rose-100 text-rose-800'
                          : group.tone === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : group.tone === 'purple'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {group.tasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.tasks.map((task) => (
                      <TaskItem
                        key={task._id || task.id}
                        task={task}
                        variant="row"
                        showCompleteCheckbox
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedTaskIds.includes(task._id || task.id)}
                        onToggleSelect={handleToggleSelect}
                        onOpenDetail={(t) => setSelectedDetailTask(t)}
                        onEdit={(t) => {
                          setSelectedTask(t);
                          setShowModal(true);
                        }}
                        onRefresh={refreshTasks}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          // Filtered / Custom Sorted Flat List
          <div className="space-y-2">
            {sortedTasks.map((task) => (
              <TaskItem
                key={task._id || task.id}
                task={task}
                variant="row"
                showCompleteCheckbox
                isSelectionMode={isSelectionMode}
                isSelected={selectedTaskIds.includes(task._id || task.id)}
                onToggleSelect={handleToggleSelect}
                onOpenDetail={(t) => setSelectedDetailTask(t)}
                onEdit={(t) => {
                  setSelectedTask(t);
                  setShowModal(true);
                }}
                onRefresh={refreshTasks}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Details Sheet */}
      {selectedDetailTask && (
        <TaskDetailModal
          isOpen={Boolean(selectedDetailTask)}
          onClose={() => setSelectedDetailTask(null)}
          task={selectedDetailTask}
          onRefresh={refreshTasks}
          onEdit={(task) => {
            setSelectedDetailTask(null);
            setSelectedTask(task);
            setShowModal(true);
          }}
        />
      )}

      {/* Create / Edit Task Modal */}
      {(showModal || Boolean(selectedTask)) && (
        <TaskModal
          isOpen={showModal || Boolean(selectedTask)}
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
            refreshTasks();
          }}
          taskToEdit={selectedTask}
          onSave={() => {
            setShowModal(false);
            setSelectedTask(null);
            refreshTasks();
          }}
        />
      )}
    </div>
  );
};

export default PendingPage;
