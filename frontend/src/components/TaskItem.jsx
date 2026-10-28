import React, { useState, useEffect, useMemo } from "react";
import TaskModal from "./TaskModal";
import DeleteModal from "./DeleteModal";
import axios from "axios";
import { toast } from "react-toastify";
import { getPriorityBadgeColor, TI_CLASSES, getPriorityColor, MENU_OPTIONS, isTaskDueToday, isTaskOverdue, formatCompletionDate } from "../assets/dummy";
import { CheckCircle2, MoreVertical, Calendar, Clock, Bell, Paperclip, ExternalLink, RotateCw, Folder, RotateCcw, Check } from "lucide-react";
import { format, differenceInCalendarDays } from 'date-fns';
import { API_BASE_URL, resolveAttachmentUrl } from "../config/api";

const API_BASE = `${API_BASE_URL}/api/tasks`;

const TaskItem = ({
  task,
  onRefresh,
  onLogout,
  onOpenDetail,
  onEdit,
  onRestore,
  showCompleteCheckbox = true,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  variant = "card",
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    [true, 1, "yes"].includes(typeof task.completed === "string" ? task.completed.toLowerCase() : task.completed)
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subtasks, setSubtasks] = useState(task.subtasks || []);

  useEffect(() => {
    setIsCompleted(
      [true, 1, "yes"].includes(typeof task.completed === "string" ? task.completed.toLowerCase() : task.completed)
    );
  }, [task.completed]);

  useEffect(() => {
    setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
  }, [task.subtasks]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No auth token found");
    return { Authorization: `Bearer ${token}` };
  };

  const borderColor = isCompleted ? "border-green-500" : getPriorityColor(task.priority).split(" ")[0];

  const handleComplete = async () => {
    if (onRestore && isCompleted) {
      onRestore(task);
      return;
    }
    try {
      const newStatus = isCompleted ? "No" : "Yes";
      await axios.put(`${API_BASE}/${task._id}/gp`, 
        { completed: newStatus }, 
        { headers: getAuthHeaders() }
      );
      setIsCompleted(!isCompleted);
      onRefresh?.();
    } catch (err) {
      console.error("Complete task error:", err.response?.data || err.message);
      if (err.response?.status === 401) onLogout?.();
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE}/${task._id}/gp`, { headers: getAuthHeaders() });
      setShowDeleteModal(false); 
      onRefresh?.();
      toast.info(
        <div className="flex items-center justify-between gap-3 text-xs">
          <span>Task moved to trash</span>
          <button
            onClick={async () => {
              try {
                await axios.post(`${API_BASE}/${task._id}/restore`, {}, { headers: getAuthHeaders() });
                toast.success("Task restored!");
                onRefresh?.();
              } catch (_restoreErr) {
                toast.error("Failed to restore task");
              }
            }}
            className="px-2.5 py-1 bg-purple-600 text-white font-semibold rounded hover:bg-purple-700 transition cursor-pointer"
          >
            Undo
          </button>
        </div>,
        { autoClose: 6000 }
      );
    } catch (err) {
      console.error("Delete task error:", err.response?.data || err.message);
      if (err.response?.status === 401) onLogout?.();
    }
  };

  const handleDuplicate = async () => {
    try {
      const dupData = {
        title: `${task.title} (Copy)`,
        description: task.description || "",
        priority: task.priority || "Low",
        dueDate: task.dueDate || null,
        subtasks: (task.subtasks || []).map((st) => ({ title: st.title, completed: false })),
        recurrence: task.recurrence || { frequency: "none", interval: 1 },
        reminderEnabled: false,
      };
      await axios.post(`${API_BASE}/gp`, dupData, { headers: getAuthHeaders() });
      toast.success("Task duplicated successfully");
      onRefresh?.();
    } catch (err) {
      console.error("Duplicate task error:", err.response?.data || err.message);
      toast.error("Failed to duplicate task");
    }
  };

  const handleAction = (action) => {
    setShowMenu(false);
    if (action === "restore") { if (onRestore) onRestore(task); else handleComplete(); }
    if (action === "edit") { if (onEdit) onEdit(task); else setShowEditModal(true); }
    if (action === "duplicate") handleDuplicate();
    if (action === "delete") setShowDeleteModal(true);
  };

  const handleSave = () => {
    setShowEditModal(false);
    onRefresh?.();
  };

  const dueCountdown = useMemo(() => {
    if (isCompleted) return { label: "Completed", tone: "text-green-600" };
    if (!task.dueDate) return { label: "-", tone: "text-gray-500" };
    const daysLeft = differenceInCalendarDays(new Date(task.dueDate), new Date());
    if (daysLeft === 0) return { label: "Today", tone: "text-fuchsia-600" };
    if (daysLeft < 0) {
      const overdueBy = Math.abs(daysLeft);
      return { label: `Overdue by ${overdueBy} day${overdueBy === 1 ? "" : "s"}`, tone: "text-red-600" };
    }
    return { label: `${daysLeft} Day${daysLeft === 1 ? "" : "s"} Left`, tone: "text-gray-500" };
  }, [task.dueDate, isCompleted]);

  const progress = useMemo(
    () => (subtasks.length ? (subtasks.filter((st) => st.completed).length / subtasks.length) * 100 : 0),
    [subtasks]
  );

  const statusBadge = useMemo(() => {
    if (isCompleted) {
      return { label: "Completed", color: "bg-green-100 text-green-700 border-green-200" };
    }
    if (task.dueDate && differenceInCalendarDays(new Date(task.dueDate), new Date()) < 0) {
      return { label: "Overdue", color: "bg-red-100 text-red-700 border-red-200" };
    }
    return { label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" };
  }, [isCompleted, task.dueDate]);

    const dynamicMenuOptions = useMemo(() => {
    if (isCompleted) {
      return [
        { action: "restore", label: "Restore to Pending", icon: <RotateCcw size={14} className="text-emerald-600" /> },
        ...MENU_OPTIONS.filter((opt) => opt.action !== "restore")
      ];
    }
    return MENU_OPTIONS;
  }, [isCompleted]);

  if (variant === "row") {
    const isOverdueTask = isTaskOverdue(task);
    const isDueTodayTask = isTaskDueToday(task);

    return (
      <>
        <div
          onClick={(e) => {
            if (isSelectionMode) {
              onToggleSelect?.(task._id);
              return;
            }
            if (e.target.closest('button, input, [role="button"]')) return;
            if (onOpenDetail) {
              onOpenDetail(task);
            }
          }}
          className={`group p-3 sm:p-3.5 rounded-xl bg-white border border-purple-100 hover:border-purple-200 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-2.5 sm:gap-3.5 cursor-pointer ${
            isCompleted
              ? "border-l-4 border-l-emerald-500 bg-emerald-50/10"
              : isOverdueTask
              ? "border-l-4 border-l-rose-500 bg-rose-50/10"
              : isDueTodayTask
              ? "border-l-4 border-l-amber-500 bg-amber-50/10"
              : "border-l-4 border-l-purple-500"
          }`}
        >
          {/* Left section: Checkbox + Complete + Title & Badges */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
            {isSelectionMode && (
              <input
                type="checkbox"
                checked={Boolean(isSelected)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(task._id);
                }}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded border-purple-300 cursor-pointer shrink-0"
                aria-label={`Select ${task.title}`}
              />
            )}

            {showCompleteCheckbox && (
              <button
                type="button"
                onClick={handleComplete}
                className="p-1 rounded-full text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 transition cursor-pointer shrink-0"
                aria-label={isCompleted ? "Mark pending" : "Mark complete"}
                title={isCompleted ? "Mark pending" : "Mark complete"}
              >
                {isCompleted ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs hover:bg-emerald-600 transition">
                    <Check size={12} strokeWidth={3} className="text-white" />
                  </span>
                ) : (
                  <CheckCircle2
                    size={20}
                    className="text-gray-300 hover:text-emerald-400 group-hover:text-purple-400 transition-colors"
                  />
                )}
              </button>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    isCompleted ? "text-gray-400 line-through font-normal" : "text-gray-800"
                  }`}
                >
                  {task.title}
                </span>

                {/* Priority pill */}
                {task.priority && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider shrink-0 ${getPriorityBadgeColor(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>
                )}

                {/* Project pill */}
                {task.project && task.project.name && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full font-semibold border shrink-0"
                    style={{
                      backgroundColor: `${task.project.color || "#8B2CF5"}15`,
                      borderColor: `${task.project.color || "#8B2CF5"}35`,
                      color: task.project.color || "#8B2CF5",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: task.project.color || "#8B2CF5" }}
                    />
                    <span className="truncate max-w-[100px]">{task.project.name}</span>
                  </span>
                )}

                {/* Alarm bell indicator */}
                {task.reminderEnabled && task.reminderAt && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0 font-medium"
                    title={`Alarm scheduled: ${new Date(task.reminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  >
                    <Bell className="w-2.5 h-2.5" />
                    <span>{new Date(task.reminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                )}

                {/* Recurrence icon */}
                {task.recurrence && task.recurrence.frequency && task.recurrence.frequency !== "none" && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium shrink-0"
                    title={`Repeats ${task.recurrence.frequency}`}
                  >
                    <RotateCw className="w-2.5 h-2.5" />
                    <span>{task.recurrence.frequency}</span>
                  </span>
                )}

                {/* Subtask count */}
                {subtasks.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-500 shrink-0">
                    {subtasks.filter((s) => s.completed).length}/{subtasks.length} subtasks
                  </span>
                )}
              </div>

              {/* 1-line description if exists */}
              {task.description && (
                <p className="text-[11px] text-gray-500 truncate mt-0.5 max-w-xl">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Right section: Due countdown & Actions menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Due Date Badge */}
            {isCompleted ? (
              <span
                className="text-[11px] px-2 py-0.5 rounded-lg border flex items-center gap-1 shrink-0 font-medium bg-emerald-50 text-emerald-700 border-emerald-200"
                title={task.completedAt ? `Completed: ${new Date(task.completedAt).toLocaleString()}` : "Completed"}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{formatCompletionDate(task.completedAt) || "Completed"}</span>
              </span>
            ) : task.dueDate ? (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-lg border flex items-center gap-1 shrink-0 font-medium ${
                  isOverdueTask
                    ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                    : isDueTodayTask
                    ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                    : "bg-purple-50/60 text-gray-700 border-purple-100"
                }`}
                title={format(new Date(task.dueDate), "MMM dd, yyyy")}
              >
                {isOverdueTask ? (
                  <Clock className="w-3 h-3 text-rose-500" />
                ) : (
                  <Calendar className="w-3 h-3 text-purple-500" />
                )}
                <span>{dueCountdown.label}</span>
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 hidden sm:inline-block">No date</span>
            )}

            {/* Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 hover:bg-purple-100 rounded-lg text-gray-400 hover:text-purple-700 transition cursor-pointer"
                aria-label="Task options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 mt-1 w-36 sm:w-40 bg-white border border-purple-100 rounded-xl shadow-lg z-20 overflow-hidden animate-fadeIn py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {dynamicMenuOptions.map((opt) => (
                    <button
                      key={opt.action}
                      type="button"
                      onClick={() => handleAction(opt.action)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-purple-50 flex items-center gap-2 text-gray-700 transition cursor-pointer"
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        <TaskModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          taskToEdit={task}
          onSave={handleSave}
        />

        {/* Delete Modal */}
        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          taskTitle={task.title}
        />
      </>
    );
  }

  return (
    <>
      <div className={`${TI_CLASSES.wrapper} ${borderColor} transition-all duration-300 hover:shadow-md`}>
        <div className={TI_CLASSES.leftContainer}>
          {isSelectionMode && (
            <input
              type="checkbox"
              checked={Boolean(isSelected)}
              onChange={() => onToggleSelect?.(task._id)}
              className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded border-purple-300 mr-2 cursor-pointer shrink-0"
              aria-label={`Select ${task.title}`}
            />
          )}

          {showCompleteCheckbox && (
            <button 
              onClick={handleComplete}
              className={`${TI_CLASSES.completeBtn} ${isCompleted ? "text-green-500" : "text-gray-300"}`}
            >
              <CheckCircle2 
                size={18} 
                className={`${TI_CLASSES.checkboxIconBase} ${isCompleted ? "fill-green-500" : ""}`} 
              />
            </button>
          )}

          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={(e) => {
              if (onOpenDetail) {
                e.stopPropagation();
                onOpenDetail(task);
              }
            }}
          >
            <div className="flex items-baseline gap-2 mb-1 flex-wrap">
              <h3 className={`${TI_CLASSES.titleBase} ${isCompleted ? "text-gray-500 line-through font-medium" : "text-gray-800"}`}>
                {task.title}
              </h3>
              <span className={`${TI_CLASSES.priorityBadge} ${getPriorityBadgeColor(task.priority)}`}>
                {task.priority}
              </span>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${statusBadge.color}`}>
                {statusBadge.label}
              </span>

              {/* Project Badge */}
              {task.project && task.project.name && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold border"
                  style={{
                    backgroundColor: `${task.project.color || '#8B2CF5'}18`,
                    borderColor: `${task.project.color || '#8B2CF5'}40`,
                    color: task.project.color || '#8B2CF5',
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: task.project.color || '#8B2CF5' }}
                  />
                  {task.project.name}
                </span>
              )}

              {/* Recurrence Schedule Badge */}
              {task.recurrence && task.recurrence.frequency && task.recurrence.frequency !== 'none' && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                  <RotateCw className="w-2.5 h-2.5" />
                  {task.recurrence.frequency}
                </span>
              )}
            </div>

            {task.description && <p className={TI_CLASSES.description}>{task.description}</p>}

            {/* Tag Pills */}
            {Array.isArray(task.tags) && task.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Attachments list with safe URL resolution */}
            {Array.isArray(task.attachments) && task.attachments.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {task.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={resolveAttachmentUrl(att.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-100 text-xs font-medium text-purple-700 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span className="max-w-[160px] truncate">{att.name}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                ))}
              </div>
            )}

            {task.reminderEnabled && task.reminderAt ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  <Bell className="w-3 h-3" /> Smart Reminder: {new Date(task.reminderAt).toLocaleString()}
                </span>
              </div>
            ) : null}

            {subtasks.length > 0 && (
              <div className={TI_CLASSES.subtasksContainer}>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{subtasks.filter((st) => st.completed).length}/{subtasks.length} subtasks done</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className={TI_CLASSES.progressBarBg}>
                  <div className={TI_CLASSES.progressBarFg} style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={TI_CLASSES.rightContainer}>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className={TI_CLASSES.menuButton} aria-label="Task options">
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" size={18} />
            </button>
            {showMenu && (
              <div className={TI_CLASSES.menuDropdown}>
                {dynamicMenuOptions.map((opt) => (
                  <button
                    key={opt.action}
                    onClick={() => handleAction(opt.action)}
                    className="w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm hover:bg-purple-50 flex items-center gap-2 transition-colors duration-200"
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className={`${TI_CLASSES.dateRow} ${dueCountdown.tone}`} title={task.dueDate ? format(new Date(task.dueDate), "MMM dd, yyyy") : ""}>
              <Calendar className="w-3.5 h-3.5" />
              {dueCountdown.label}
            </div>
            <div className={TI_CLASSES.createdRow}>
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {task.createdAt ? `Created ${format(new Date(task.createdAt), 'MMM dd')}` : 'No date'}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <TaskModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        taskToEdit={task}
        onSave={handleSave} 
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        taskTitle={task.title}
      />
    </>
  );
};

export default TaskItem;
