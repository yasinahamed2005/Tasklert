import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { layoutClasses, SORT_OPTIONS, sortTasks } from '../assets/dummy';
import { ListChecks, Filter, Plus, Clock, Search, X, RotateCcw, Folder, Tag, CheckSquare, Square, Trash2, CheckCircle2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { API_BASE_URL } from '../config/api';

const isCompletedTask = (task) =>
  [true, 1, 'yes'].includes(
    typeof task.completed === 'string' ? task.completed.toLowerCase() : task.completed
  );

const PendingPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'pending' | 'completed'
  const [sortBy, setSortBy] = useState('newest');
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [projects, setProjects] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

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
        console.warn("Error fetching projects/tags in PendingPage", e);
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

  const pendingCount = useMemo(
    () => tasks.filter((t) => !isCompletedTask(t)).length,
    [tasks]
  );
  const completedCount = useMemo(
    () => tasks.filter((t) => isCompletedTask(t)).length,
    [tasks]
  );

  const sortedPendingTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = tasks.filter((t) => {
      // 1. Tab filter
      if (filterTab === "pending" && isCompletedTask(t)) return false;
      if (filterTab === "completed" && !isCompletedTask(t)) return false;

      // 2. Search query filter
      if (query) {
        const inTitle = t.title?.toLowerCase().includes(query);
        const inDescription = t.description?.toLowerCase().includes(query);
        const inTags = Array.isArray(t.tags) && t.tags.some((tag) => tag.toLowerCase().includes(query));
        const inProject = t.project?.name?.toLowerCase().includes(query);
        if (!inTitle && !inDescription && !inTags && !inProject) return false;
      }

      // 3. Project filter
      if (selectedProject !== "all") {
        const pId = t.project?._id || (typeof t.project === "string" ? t.project : null);
        if (selectedProject === "none") {
          if (pId) return false;
        } else {
          if (pId !== selectedProject) return false;
        }
      }

      // 4. Tag filter
      if (selectedTag !== "all") {
        if (!Array.isArray(t.tags) || !t.tags.includes(selectedTag)) return false;
      }

      return true;
    });

    return sortTasks(filtered, sortBy);
  }, [tasks, filterTab, sortBy, searchQuery, selectedProject, selectedTag]);

  const handleSelectAll = useCallback(() => {
    if (selectedTaskIds.length === sortedPendingTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(sortedPendingTasks.map((t) => t._id || t.id).filter(Boolean));
    }
  }, [selectedTaskIds, sortedPendingTasks]);

  return (
    <div className={layoutClasses.container}>
      {/* HEADER MATCHING SCREEN 4 MOCKUP */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="text-purple-500 w-6 h-6 shrink-0" />
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            Tasks
          </h1>
        </div>

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

      {/* SEARCH BAR WITH FILTER TOGGLE */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-purple-100 rounded-xl shadow-xs text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
            showFilters || selectedProject !== "all" || selectedTag !== "all"
              ? "bg-purple-100 text-purple-700 border-purple-300"
              : "bg-white text-gray-600 border-purple-100 hover:bg-purple-50"
          }`}
          title="Toggle Filters"
          aria-label="Filter tasks"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* SEGMENTED CONTROL TABS MATCHING SCREEN 4 */}
      <div className="flex items-center rounded-xl bg-purple-50/80 p-1 border border-purple-100 shadow-2xs">
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
            filterTab === "all"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-gray-600 hover:text-purple-700"
          }`}
        >
          All ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("pending")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
            filterTab === "pending"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-gray-600 hover:text-purple-700"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab("completed")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
            filterTab === "completed"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-gray-600 hover:text-purple-700"
          }`}
        >
          Completed ({completedCount})
        </button>
      </div>

      {/* EXPANDABLE SORT & FILTER BAR */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-purple-100 p-3 shadow-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Filter className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold">Sort By:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs border border-purple-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-medium focus:ring-1 focus:ring-purple-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">By Priority</option>
              <option value="deadline">By Deadline</option>
              <option value="alphabetical">Alphabetically</option>
            </select>
          </div>
        </div>
      )}

      {/* PROJECT & TAG FILTERS BAR */}
      {(projects.length > 0 || userTags.length > 0) && (
        <div className="bg-white/80 rounded-xl border border-purple-100 p-3 shadow-xs space-y-2">
          {projects.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar text-xs">
              <span className="font-semibold text-gray-500 shrink-0 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-purple-500" /> Project:
              </span>
              <button
                type="button"
                onClick={() => setSelectedProject("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full border transition cursor-pointer ${
                  selectedProject === "all"
                    ? "bg-purple-700 text-white border-purple-700 font-bold"
                    : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50"
                }`}
              >
                All
              </button>
              {projects.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedProject(p._id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full border flex items-center gap-1 transition cursor-pointer ${
                    selectedProject === p._id
                      ? "bg-purple-700 text-white border-purple-700 font-bold"
                      : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || "#8B2CF5" }} />
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {userTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 hide-scrollbar text-xs">
              <span className="font-semibold text-gray-500 shrink-0 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-500" /> Tag:
              </span>
              <button
                type="button"
                onClick={() => setSelectedTag("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full border transition cursor-pointer ${
                  selectedTag === "all"
                    ? "bg-purple-700 text-white border-purple-700 font-bold"
                    : "bg-white text-gray-700 border-purple-200 hover:bg-purple-50"
                }`}
              >
                All
              </button>
              {userTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`shrink-0 px-2.5 py-1 rounded-full border transition cursor-pointer ${
                    selectedTag === tag
                      ? "bg-purple-700 text-white border-purple-700 font-bold"
                      : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {(selectedProject !== "all" || selectedTag !== "all" || searchQuery) && (
            <div className="pt-2 border-t border-purple-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedProject("all");
                  setSelectedTag("all");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* BULK ACTIONS / TASK LIST TOOLBAR */}
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold text-gray-800">
          Showing {sortedPendingTasks.length} Pending Tasks
        </h2>
        <button
          type="button"
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
          <CheckSquare className="w-3.5 h-3.5" />
          {isSelectionMode ? "Exit Bulk Mode" : "Bulk Actions"}
        </button>
      </div>

      {/* DOCKED BULK ACTION BAR */}
      {isSelectionMode && (
        <div className="p-3 sm:p-4 rounded-xl border border-purple-200 bg-purple-50/90 shadow-md flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900 hover:text-purple-700 cursor-pointer"
            >
              {selectedTaskIds.length === sortedPendingTasks.length && sortedPendingTasks.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-700" />
              ) : (
                <Square className="w-4 h-4 text-purple-700" />
              )}
              {selectedTaskIds.length === sortedPendingTasks.length && sortedPendingTasks.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>
            <span className="text-xs font-semibold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full">
              {selectedTaskIds.length} of {sortedPendingTasks.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={() => handleBulkAction("complete")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
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
                  if (e.target.value !== "") {
                    handleBulkAction("project", e.target.value === "none" ? null : e.target.value);
                    e.target.value = "";
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
              onClick={() => handleBulkAction("delete")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* ADD TASK BUTTON */}
      <div
        className={`${layoutClasses.addBox} add-task-cta cursor-pointer`}
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center justify-center gap-3 transition-colors">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
            <Plus className="cta-icon" size={18} />
          </div>
          <span className="font-semibold cta-label">
            Add New Task
          </span>
        </div>
      </div>

      {/* TASK LIST */}
      <div className="space-y-4">
        {sortedPendingTasks.length === 0 ? (
          <div className={layoutClasses.emptyState}>
            <div className="max-w-xs mx-auto py-6 text-center">
              <div className={layoutClasses.emptyIconBg}>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-gray-800 mb-2 text-lg font-semibold">
                {searchQuery || selectedProject !== "all" || selectedTag !== "all"
                  ? "No matching pending tasks"
                  : "All caught up!"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery || selectedProject !== "all" || selectedTag !== "all"
                  ? "Try clearing your search query or active filters."
                  : "No pending tasks – great work!"}
              </p>
              <div className="flex gap-2 justify-center">
                {(searchQuery || selectedProject !== "all" || selectedTag !== "all") && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedProject("all");
                      setSelectedTag("all");
                    }}
                    className="px-4 py-2 text-sm font-medium border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  onClick={() => setShowModal(true)}
                  className={layoutClasses.emptyBtn}
                >
                  Create New Task
                </button>
              </div>
            </div>
          </div>
        ) : (
          sortedPendingTasks.map((task) => (
            <TaskItem
              key={task._id || task.id}
              task={task}
              showCompleteCheckbox
              isSelectionMode={isSelectionMode}
              isSelected={selectedTaskIds.includes(task._id || task.id)}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={(t) => setSelectedDetailTask(t)}
              onEdit={() => {
                setSelectedTask(task);
                setShowModal(true);
              }}
              onRefresh={refreshTasks}
            />
          ))
        )}
      </div>

      {/* Task Details Sheet matching Screen 8 */}
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

      {/* Create / Edit Task Modal matching Screen 7 */}
      <TaskModal
        isOpen={!!selectedTask || showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedTask(null);
          refreshTasks();
        }}
        taskToEdit={selectedTask}
      />
    </div>
  );
};

export default PendingPage;
