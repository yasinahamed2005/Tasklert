import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  isTaskCompleted,
  isCompletedToday,
  isCompletedThisWeek,
  isCompletedThisMonth,
  getCompletionGroup,
} from '../assets/dummy';
import {
  CheckCircle2,
  Search,
  X,
  RotateCcw,
  Folder,
  Tag,
  CheckSquare,
  Square,
  Trash2,
  CalendarCheck,
  TrendingUp,
  Award,
  CheckCheck,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useOutletContext, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import TaskItem from '../components/TaskItem';
import { TaskDetailModal } from '../components/TaskDetailModal';
import DeleteModal from '../components/DeleteModal';
import { API_BASE_URL } from '../config/api';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently Completed' },
  { id: 'oldest', label: 'Oldest Completed' },
  { id: 'alphabetical', label: 'Task Title (A–Z)' },
  { id: 'priority', label: 'Priority (High to Low)' },
];

const CompletedPage = () => {
  const { tasks = [], refreshTasks, loadingTasks = false } = useOutletContext();

  // Optimistic tracking for restored tasks
  const [optimisticRestoringIds, setOptimisticRestoringIds] = useState(new Set());

  // Navigation, Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month'
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'alphabetical' | 'priority'
  const [selectedPriority, setSelectedPriority] = useState(''); // '' | 'High' | 'Medium' | 'Low'
  const [selectedProject, setSelectedProject] = useState('all'); // 'all' | 'none' | projectId
  const [selectedTag, setSelectedTag] = useState('all'); // 'all' | tagName
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Bulk Actions State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Modals
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // User metadata (Projects & Tags)
  const [projects, setProjects] = useState([]);
  const [userTags, setUserTags] = useState([]);

  const moreFiltersRef = useRef(null);

  // Fetch projects and tags for advanced filtering
  useEffect(() => {
    let isMounted = true;
    const fetchMetadata = async () => {
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
      } catch (e) {
        console.warn('Error fetching projects/tags in CompletePage', e);
      }
    };
    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close more filters popover on outside click
  useEffect(() => {
    if (!showMoreFilters) return;
    const handleClickOutside = (e) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target)) {
        setShowMoreFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreFilters]);

  // Clean optimistic state whenever tasks are refreshed from backend
  useEffect(() => {
    setOptimisticRestoringIds((prev) => {
      if (prev.size === 0) return prev;
      const currentDoneIds = new Set(tasks.filter(isTaskCompleted).map((t) => t._id || t.id));
      const next = new Set();
      prev.forEach((id) => {
        // Keep in restoring set only if server still returns it as completed
        if (currentDoneIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [tasks]);

  // All completed tasks for the current user
  const allCompletedTasks = useMemo(() => {
    return tasks.filter((t) => isTaskCompleted(t) && !optimisticRestoringIds.has(t._id || t.id));
  }, [tasks, optimisticRestoringIds]);

  // Real-time calculated metrics from authoritative completed tasks
  const metrics = useMemo(() => {
    const now = new Date();
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    allCompletedTasks.forEach((t) => {
      if (isCompletedToday(t, now)) today++;
      if (isCompletedThisWeek(t, now)) thisWeek++;
      if (isCompletedThisMonth(t, now)) thisMonth++;
    });

    return {
      today,
      thisWeek,
      thisMonth,
      total: allCompletedTasks.length,
    };
  }, [allCompletedTasks]);

  // Filtered completed tasks
  const filteredCompletedTasks = useMemo(() => {
    const now = new Date();
    const q = searchQuery.trim().toLowerCase();

    return allCompletedTasks.filter((task) => {
      // 1. Quick Date Filter
      if (quickFilter === 'today' && !isCompletedToday(task, now)) return false;
      if (quickFilter === 'week' && !isCompletedThisWeek(task, now)) return false;
      if (quickFilter === 'month' && !isCompletedThisMonth(task, now)) return false;

      // 2. Search Query across title, description, project, tags
      if (q) {
        const inTitle = (task.title || '').toLowerCase().includes(q);
        const inDesc = (task.description || '').toLowerCase().includes(q);
        const inProject = (task.project?.name || '').toLowerCase().includes(q);
        const inTags = Array.isArray(task.tags) && task.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inProject && !inTags) return false;
      }

      // 3. Priority Filter
      if (selectedPriority && (task.priority || '').toLowerCase() !== selectedPriority.toLowerCase()) {
        return false;
      }

      // 4. Project Filter
      if (selectedProject !== 'all') {
        const pId = task.project?._id || (typeof task.project === 'string' ? task.project : null);
        if (selectedProject === 'none') {
          if (pId) return false;
        } else {
          if (pId !== selectedProject) return false;
        }
      }

      // 5. Tag Filter
      if (selectedTag !== 'all') {
        if (!Array.isArray(task.tags) || !task.tags.includes(selectedTag)) return false;
      }

      return true;
    });
  }, [allCompletedTasks, quickFilter, searchQuery, selectedPriority, selectedProject, selectedTag]);

  // Sorted completed tasks
  const sortedCompletedTasks = useMemo(() => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const list = [...filteredCompletedTasks];

    list.sort((a, b) => {
      switch (sortBy) {
        case 'oldest': {
          const dateA = a.completedAt
            ? new Date(a.completedAt).getTime()
            : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
          const dateB = b.completedAt
            ? new Date(b.completedAt).getTime()
            : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
          return dateA - dateB;
        }
        case 'alphabetical':
          return (a.title || '').localeCompare(b.title || '');
        case 'priority': {
          const pA = priorityWeight[a.priority?.toLowerCase()] || 0;
          const pB = priorityWeight[b.priority?.toLowerCase()] || 0;
          if (pB !== pA) return pB - pA;
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return dateB - dateA;
        }
        case 'recent':
        default: {
          const dateA = a.completedAt
            ? new Date(a.completedAt).getTime()
            : a.updatedAt
            ? new Date(a.updatedAt).getTime()
            : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;
          const dateB = b.completedAt
            ? new Date(b.completedAt).getTime()
            : b.updatedAt
            ? new Date(b.updatedAt).getTime()
            : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;
          return dateB - dateA;
        }
      }
    });

    return list;
  }, [filteredCompletedTasks, sortBy]);

  // Chronological grouping when in default "Recently Completed" view with no quick-date filter
  const groupedTasks = useMemo(() => {
    if (sortBy !== 'recent' || quickFilter !== 'all') {
      return null;
    }

    const now = new Date();
    const groups = {
      today: { id: 'today', title: 'Today', tone: 'emerald', tasks: [] },
      yesterday: { id: 'yesterday', title: 'Yesterday', tone: 'teal', tasks: [] },
      this_week: { id: 'this_week', title: 'Earlier This Week', tone: 'purple', tasks: [] },
      this_month: { id: 'this_month', title: 'Earlier This Month', tone: 'indigo', tasks: [] },
      older: { id: 'older', title: 'Older', tone: 'gray', tasks: [] },
      no_timestamp: { id: 'no_timestamp', title: 'Previous Completions', tone: 'gray', tasks: [] },
    };

    sortedCompletedTasks.forEach((task) => {
      const g = getCompletionGroup(task, now);
      if (groups[g]) {
        groups[g].tasks.push(task);
      } else {
        groups.older.tasks.push(task);
      }
    });

    return Object.values(groups).filter((g) => g.tasks.length > 0);
  }, [sortedCompletedTasks, sortBy, quickFilter]);

  // Restore Task (Move from Completed to Pending)
  const handleRestore = useCallback(
    async (task) => {
      const taskId = task._id || task.id;
      if (optimisticRestoringIds.has(taskId)) return;

      // 1. Optimistic removal
      setOptimisticRestoringIds((prev) => new Set([...prev, taskId]));

      try {
        const token = localStorage.getItem('token');
        await axios.put(
          `${API_BASE_URL}/api/tasks/${taskId}/gp`,
          { completed: 'No' },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.info(
          <div className="flex items-center justify-between gap-3 text-xs">
            <span>"{task.title}" restored to Pending</span>
            <button
              onClick={async () => {
                try {
                  await axios.put(
                    `${API_BASE_URL}/api/tasks/${taskId}/gp`,
                    { completed: 'Yes' },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  toast.success('Task moved back to Completed');
                  setOptimisticRestoringIds((prev) => {
                    const next = new Set(prev);
                    next.delete(taskId);
                    return next;
                  });
                  refreshTasks();
                } catch (e) {
                  toast.error('Failed to undo restore');
                }
              }}
              className="px-2.5 py-1 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition cursor-pointer"
            >
              Undo
            </button>
          </div>,
          { autoClose: 5000 }
        );

        refreshTasks();
      } catch (err) {
        console.error('Failed to restore task:', err);
        toast.error(err.response?.data?.message || 'Failed to restore task');
        // Rollback optimistic removal
        setOptimisticRestoringIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [optimisticRestoringIds, refreshTasks]
  );

  // Single Task Delete
  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return;
    const taskId = taskToDelete._id || taskToDelete.id;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/tasks/${taskId}/gp`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.info(
        <div className="flex items-center justify-between gap-3 text-xs">
          <span>Task moved to trash</span>
          <button
            onClick={async () => {
              try {
                await axios.post(
                  `${API_BASE_URL}/api/tasks/${taskId}/restore`,
                  {},
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Task restored!');
                refreshTasks();
              } catch (e) {
                toast.error('Failed to undo delete');
              }
            }}
            className="px-2.5 py-1 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition cursor-pointer"
          >
            Undo
          </button>
        </div>,
        { autoClose: 6000 }
      );
      setTaskToDelete(null);
      refreshTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
    }
  }, [taskToDelete, refreshTasks]);

  // Bulk Selection Handlers
  const handleToggleSelect = useCallback((id) => {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedTaskIds.length === sortedCompletedTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(sortedCompletedTasks.map((t) => t._id || t.id).filter(Boolean));
    }
  }, [selectedTaskIds, sortedCompletedTasks]);

  const handleBulkRestore = async () => {
    if (!selectedTaskIds.length || bulkLoading) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE_URL}/api/tasks/bulk`,
        { taskIds: selectedTaskIds, action: 'incomplete' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(`${selectedTaskIds.length} tasks restored to Pending`);
        setSelectedTaskIds([]);
        setIsSelectionMode(false);
        refreshTasks();
      }
    } catch (e) {
      toast.error('Failed to restore selected tasks');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTaskIds.length || bulkLoading) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE_URL}/api/tasks/bulk`,
        { taskIds: selectedTaskIds, action: 'delete' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success(`${selectedTaskIds.length} tasks moved to trash`);
        setSelectedTaskIds([]);
        setIsSelectionMode(false);
        setShowBulkDeleteConfirm(false);
        refreshTasks();
      }
    } catch (e) {
      toast.error('Failed to delete selected tasks');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkProjectChange = async (projectId) => {
    if (!selectedTaskIds.length || bulkLoading) return;
    setBulkLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        `${API_BASE_URL}/api/tasks/bulk`,
        { taskIds: selectedTaskIds, action: 'project', value: projectId === 'none' ? null : projectId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        toast.success('Project updated for selected tasks');
        setSelectedTaskIds([]);
        setIsSelectionMode(false);
        refreshTasks();
      }
    } catch (e) {
      toast.error('Failed to update project for selected tasks');
    } finally {
      setBulkLoading(false);
    }
  };

  // Export CSV Action
  const handleExportCSV = () => {
    if (!sortedCompletedTasks.length) {
      toast.info('No completed tasks to export');
      return;
    }
    const headers = ['Title', 'Priority', 'Project', 'Completed At', 'Original Due Date', 'Tags'];
    const rows = sortedCompletedTasks.map((t) => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.priority || 'Low'}"`,
      `"${t.project?.name || ''}"`,
      `"${t.completedAt ? new Date(t.completedAt).toISOString() : ''}"`,
      `"${t.dueDate ? new Date(t.dueDate).toISOString() : ''}"`,
      `"${Array.isArray(t.tags) ? t.tags.join(', ') : ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tasklert_completed_tasks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported completed tasks to CSV');
  };

  // Reset Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setQuickFilter('all');
    setSelectedPriority('');
    setSelectedProject('all');
    setSelectedTag('all');
  };

  const hasActiveFilters =
    searchQuery ||
    quickFilter !== 'all' ||
    selectedPriority ||
    selectedProject !== 'all' ||
    selectedTag !== 'all';

  const activeMoreFiltersCount =
    (selectedPriority ? 1 : 0) + (selectedProject !== 'all' ? 1 : 0) + (selectedTag !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* 1. COMPACT PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/70 backdrop-blur-xs p-4 sm:p-5 rounded-2xl border border-purple-100 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Completed Tasks</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {metrics.total} completed
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 font-medium pl-11">Your finished work, all in one place.</p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export completed tasks to CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white text-gray-700 border border-purple-200 hover:bg-purple-50 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedTaskIds([]);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer shadow-2xs ${
              isSelectionMode
                ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectionMode ? 'Exit Bulk' : 'Bulk Actions'}</span>
          </button>
        </div>
      </div>

      {/* 2. PROGRESS SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Completed Today */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-purple-100/80 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed Today</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">{metrics.today}</p>
            <p className="text-[10px] text-gray-400 font-medium">Finished today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <CalendarCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* Completed This Week */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-purple-100/80 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">This Week</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">{metrics.thisWeek}</p>
            <p className="text-[10px] text-gray-400 font-medium">Mon – Sun window</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 shrink-0">
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
        </div>

        {/* Completed This Month */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-purple-100/80 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">This Month</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">{metrics.thisMonth}</p>
            <p className="text-[10px] text-gray-400 font-medium">
              {new Date().toLocaleDateString([], { month: 'short' })} window
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <Award className="w-5 h-5 text-blue-600" />
          </div>
        </div>

        {/* Total Completed */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-purple-100/80 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Completed</p>
            <p className="text-xl sm:text-2xl font-black text-gray-900 mt-1">{metrics.total}</p>
            <p className="text-[10px] text-gray-400 font-medium">All-time completion</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
            <CheckCheck className="w-5 h-5 text-purple-700" />
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER TOOLBAR */}
      <div className="space-y-3 bg-white/80 p-3.5 sm:p-4 rounded-2xl border border-purple-100 shadow-2xs">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search completed tasks by title, details, project, tags..."
              className="w-full pl-9 pr-9 py-2 bg-white border border-purple-100 rounded-xl text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-600" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white text-xs border border-purple-200 rounded-xl px-3 py-2 text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition cursor-pointer shadow-2xs"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Chips & More Filters Popover Trigger */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 hide-scrollbar">
          {/* All Completed */}
          <button
            type="button"
            onClick={() => setQuickFilter('all')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              quickFilter === 'all'
                ? 'bg-purple-700 text-white border-purple-700 shadow-2xs font-bold'
                : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <span>All Completed</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                quickFilter === 'all' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {metrics.total}
            </span>
          </button>

          {/* Today */}
          <button
            type="button"
            onClick={() => setQuickFilter('today')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              quickFilter === 'today'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                : 'bg-white text-gray-700 border-purple-100 hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            <span>Today</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                quickFilter === 'today' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {metrics.today}
            </span>
          </button>

          {/* This Week */}
          <button
            type="button"
            onClick={() => setQuickFilter('week')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              quickFilter === 'week'
                ? 'bg-purple-700 text-white border-purple-700 shadow-2xs font-bold'
                : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <span>This Week</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                quickFilter === 'week' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-700'
              }`}
            >
              {metrics.thisWeek}
            </span>
          </button>

          {/* This Month */}
          <button
            type="button"
            onClick={() => setQuickFilter('month')}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              quickFilter === 'month'
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                : 'bg-white text-gray-700 border-purple-100 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <span>This Month</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                quickFilter === 'month' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {metrics.thisMonth}
            </span>
          </button>

          {/* More Filters Popover Trigger */}
          <div className="relative shrink-0" ref={moreFiltersRef}>
            <button
              id="complete-more-filters-trigger"
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

            {/* Accessible Popover Box */}
            {showMoreFilters && (
              <div
                role="dialog"
                aria-label="Advanced filters"
                className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 sm:w-80 bg-white border border-purple-100 rounded-2xl shadow-xl z-30 p-4 space-y-4 animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-purple-50 pb-2">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Advanced Filters</h3>
                  {activeMoreFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPriority('');
                        setSelectedProject('all');
                        setSelectedTag('all');
                      }}
                      className="text-[11px] text-purple-600 hover:text-purple-800 font-semibold cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* Priority Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Priority</label>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {['', 'High', 'Medium', 'Low'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPriority(p)}
                        className={`py-1 rounded-md font-semibold border transition text-center cursor-pointer ${
                          selectedPriority === p
                            ? 'bg-purple-700 text-white border-purple-700'
                            : 'bg-white text-gray-700 border-purple-100 hover:bg-purple-50'
                        }`}
                      >
                        {p || 'All'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Project Filter */}
                {projects.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                      Project
                    </label>
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full bg-white text-xs border border-purple-200 rounded-lg p-2 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="all">All Projects</option>
                      <option value="none">No Project Assigned</option>
                      {projects.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tag Filter */}
                {userTags.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Tag</label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      className="w-full bg-white text-xs border border-purple-200 rounded-lg p-2 text-gray-700 font-medium focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="all">All Tags</option>
                      {userTags.map((tag) => (
                        <option key={tag} value={tag}>
                          #{tag}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-2 border-t border-purple-50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowMoreFilters(false)}
                    className="px-3 py-1 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset Filters action */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="shrink-0 inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold px-2 py-1 rounded-md hover:bg-purple-50 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Active Filter Chips Row */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-gray-400 text-[11px] font-medium">Active:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                Search: "{searchQuery}"
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-purple-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedPriority && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                Priority: {selectedPriority}
                <button
                  type="button"
                  onClick={() => setSelectedPriority('')}
                  className="hover:text-purple-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedProject !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                Project: {projects.find((p) => p._id === selectedProject)?.name || selectedProject}
                <button
                  type="button"
                  onClick={() => setSelectedProject('all')}
                  className="hover:text-purple-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTag !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                Tag: #{selectedTag}
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className="hover:text-purple-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. DOCKED BULK ACTIONS TOOLBAR (VISIBLE WHEN IN SELECTION MODE) */}
      {isSelectionMode && (
        <div className="p-3 sm:p-4 rounded-xl border border-purple-200 bg-purple-50/95 shadow-md flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer"
            >
              {selectedTaskIds.length === sortedCompletedTasks.length && sortedCompletedTasks.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-700" />
              ) : (
                <Square className="w-4 h-4 text-purple-700" />
              )}
              <span>
                {selectedTaskIds.length === sortedCompletedTasks.length && sortedCompletedTasks.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </span>
            </button>
            <span className="text-xs font-semibold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full">
              {selectedTaskIds.length} of {sortedCompletedTasks.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Restore selected to pending */}
            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={handleBulkRestore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 transition cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore to Pending</span>
            </button>

            {/* Move to Project */}
            {projects.length > 0 && (
              <select
                disabled={!selectedTaskIds.length || bulkLoading}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value !== '') {
                    handleBulkProjectChange(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-white text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-semibold focus:ring-1 focus:ring-purple-500 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <option value="" disabled>
                  Move to Project...
                </option>
                <option value="none">No Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {/* Bulk Delete */}
            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. PRIMARY CONTENT AREA: COMPLETED TASK LIST */}
      <div className="space-y-4">
        {loadingTasks && sortedCompletedTasks.length === 0 ? (
          // Skeleton loader
          <div className="space-y-2.5 animate-pulse">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-white/60 rounded-xl border border-purple-100 flex items-center p-4">
                <div className="w-5 h-5 rounded-full bg-gray-200 mr-3" />
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedCompletedTasks.length === 0 ? (
          // Dual Contextual Empty States
          <div className="bg-white/80 rounded-2xl border border-purple-100 p-8 sm:p-12 text-center shadow-2xs">
            {allCompletedTasks.length === 0 ? (
              // Case A: User has zero completed tasks
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
                  <CheckCircle2 className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">No completed tasks yet</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  Tasks you finish will appear here as your verified work history.
                </p>
                <div className="pt-2">
                  <Link
                    to="/pending"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-700 text-white hover:bg-purple-800 transition cursor-pointer shadow-sm"
                  >
                    <span>View Pending Tasks</span>
                  </Link>
                </div>
              </div>
            ) : (
              // Case B: Search or Filters produced zero matches
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-14 h-14 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto border border-gray-100">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">No tasks match your search</h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  Try clearing your search query or active filters to view all completed tasks.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 transition cursor-pointer shadow-2xs"
                  >
                    <span>Clear All Filters</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : groupedTasks ? (
          // Grouped Chronological Sections (Default "Recently Completed" view)
          <div className="space-y-6">
            {groupedTasks.map((group) => (
              <section key={group.id} className="space-y-2.5">
                {/* Compact section header */}
                <div className="flex items-center gap-2 px-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{group.title}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
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
                      onRestore={handleRestore}
                      onOpenDetail={(t) => setSelectedDetailTask(t)}
                      onRefresh={refreshTasks}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          // Flat List (When filtered or sorted custom, e.g. A-Z, priority)
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-xs text-gray-500 font-semibold">
              <span>Showing {sortedCompletedTasks.length} tasks</span>
            </div>
            {sortedCompletedTasks.map((task) => (
              <TaskItem
                key={task._id || task.id}
                task={task}
                variant="row"
                showCompleteCheckbox
                isSelectionMode={isSelectionMode}
                isSelected={selectedTaskIds.includes(task._id || task.id)}
                onToggleSelect={handleToggleSelect}
                onRestore={handleRestore}
                onOpenDetail={(t) => setSelectedDetailTask(t)}
                onRefresh={refreshTasks}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      <TaskDetailModal
        isOpen={Boolean(selectedDetailTask)}
        onClose={() => setSelectedDetailTask(null)}
        task={selectedDetailTask}
        onRefresh={refreshTasks}
      />

      {/* Single Task Delete Modal */}
      <DeleteModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
        taskTitle={taskToDelete?.title || ''}
      />

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-red-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete {selectedTaskIds.length} tasks?</h3>
                <p className="text-xs text-gray-500">These completed tasks will be moved to trash.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={bulkLoading}
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkLoading}
                onClick={handleBulkDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition cursor-pointer shadow-sm"
              >
                {bulkLoading ? 'Deleting...' : 'Delete Tasks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedPage;
