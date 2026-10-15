import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { CT_CLASSES, SORT_OPTIONS, sortTasks } from '../assets/dummy';
import { CheckCircle2, Filter, Search, X, RotateCcw, Folder, Tag, CheckSquare, Square, Trash2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import TaskItem from '../components/TaskItem';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { API_BASE_URL } from '../config/api';

const CompletedPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
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
        console.warn("Error fetching projects/tags in CompletePage", e);
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

  const sortedCompletedTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = tasks.filter((task) => {
      const isDone = [true, 1, 'yes'].includes(
        typeof task.completed === 'string' ? task.completed.toLowerCase() : task.completed
      );
      if (!isDone) return false;

      if (query) {
        const inTitle = task.title?.toLowerCase().includes(query);
        const inDescription = task.description?.toLowerCase().includes(query);
        const inTags = Array.isArray(task.tags) && task.tags.some((tag) => tag.toLowerCase().includes(query));
        const inProject = task.project?.name?.toLowerCase().includes(query);
        if (!inTitle && !inDescription && !inTags && !inProject) return false;
      }

      if (selectedProject !== "all") {
        const pId = task.project?._id || (typeof task.project === "string" ? task.project : null);
        if (selectedProject === "none") {
          if (pId) return false;
        } else {
          if (pId !== selectedProject) return false;
        }
      }

      if (selectedTag !== "all") {
        if (!Array.isArray(task.tags) || !task.tags.includes(selectedTag)) return false;
      }

      return true;
    });

    return sortTasks(filtered, sortBy);
  }, [tasks, sortBy, searchQuery, selectedProject, selectedTag]);

  const handleSelectAll = useCallback(() => {
    if (selectedTaskIds.length === sortedCompletedTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(sortedCompletedTasks.map((t) => t._id || t.id).filter(Boolean));
    }
  }, [selectedTaskIds, sortedCompletedTasks]);

  return (
    <div className={CT_CLASSES.page}>
      {/* HEADER */}
      <div className={CT_CLASSES.header}>
        <div className={CT_CLASSES.titleWrapper}>
          <h1 className={CT_CLASSES.title}>
            <CheckCircle2 className="text-purple-500 w-5 h-5 md:w-6 md:h-6 shrink-0" />
            <span className="truncate">Completed Tasks</span>
          </h1>
          <p className={CT_CLASSES.subtitle}>
            {sortedCompletedTasks.length} task{sortedCompletedTasks.length !== 1 ? 's' : ''} marked as complete
          </p>
        </div>

        {/* SORT CONTROLS */}
        <div className={CT_CLASSES.sortContainer}>
          <div className={CT_CLASSES.sortBox}>
            <div className={CT_CLASSES.filterLabel}>
              <Filter className="w-4 h-4 text-purple-500" />
              <span className="text-xs md:text-sm">Sort by:</span>
            </div>
          </div>
        </div>

        {/* MOBILE DROPDOWN */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className={CT_CLASSES.select}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label} {opt.id === 'newest' ? 'First' : ''}
            </option>
          ))}
        </select>

        {/* DESKTOP BUTTONS */}
        <div className={CT_CLASSES.btnGroup}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSortBy(opt.id)}
              className={[
                CT_CLASSES.btnBase,
                sortBy === opt.id ? CT_CLASSES.btnActive : CT_CLASSES.btnInactive
              ].join(' ')}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search completed tasks by title, details, tags, project..."
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
          Showing {sortedCompletedTasks.length} Completed Tasks
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
              {selectedTaskIds.length === sortedCompletedTasks.length && sortedCompletedTasks.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-700" />
              ) : (
                <Square className="w-4 h-4 text-purple-700" />
              )}
              {selectedTaskIds.length === sortedCompletedTasks.length && sortedCompletedTasks.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>
            <span className="text-xs font-semibold text-purple-700 bg-purple-200/70 px-2 py-0.5 rounded-full">
              {selectedTaskIds.length} of {sortedCompletedTasks.length} selected
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!selectedTaskIds.length || bulkLoading}
              onClick={() => handleBulkAction("incomplete")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-600 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 disabled:opacity-40 transition cursor-pointer"
            >
              Mark as Incomplete
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

      {/* TASK LIST */}
      <div className={CT_CLASSES.list}>
        {sortedCompletedTasks.length === 0 ? (
          <div className={CT_CLASSES.emptyState}>
            <div className={CT_CLASSES.emptyIconWrapper}>
              <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-purple-500" />
            </div>
            <h3 className={CT_CLASSES.emptyTitle}>
              {searchQuery || selectedProject !== "all" || selectedTag !== "all"
                ? "No matching completed tasks"
                : "No completed tasks yet!"}
            </h3>
            <p className={CT_CLASSES.emptyText}>
              {searchQuery || selectedProject !== "all" || selectedTag !== "all"
                ? "Try clearing your search query or active filters."
                : "Complete some tasks and they'll appear here"}
            </p>
            {(searchQuery || selectedProject !== "all" || selectedTag !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedProject("all");
                  setSelectedTag("all");
                }}
                className="mt-3 px-4 py-2 text-sm font-medium border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          sortedCompletedTasks.map((task) => (
            <TaskItem
              key={task._id || task.id}
              task={task}
              onRefresh={refreshTasks}
              showCompleteCheckbox={false}
              isSelectionMode={isSelectionMode}
              isSelected={selectedTaskIds.includes(task._id || task.id)}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={(t) => setSelectedDetailTask(t)}
              className="opacity-90 hover:opacity-100 transition-opacity text-sm md:text-base"
            />
          ))
        )}
      </div>

      {/* Task Details Modal matching Screen 8 */}
      <TaskDetailModal
        isOpen={Boolean(selectedDetailTask)}
        onClose={() => setSelectedDetailTask(null)}
        task={selectedDetailTask}
        onRefresh={refreshTasks}
      />
    </div>
  );
};

export default CompletedPage;
