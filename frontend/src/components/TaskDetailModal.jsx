import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  MoreVertical,
  CheckCircle2,
  Clock,
  Paperclip,
  Download,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Folder,
  Tag,
  ExternalLink,
} from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { API_BASE_URL, resolveAttachmentUrl } from "../config/api";
import { getPriorityBadgeColor } from "../assets/dummy";

const API_BASE = `${API_BASE_URL}/api/tasks`;

export const TaskDetailModal = ({ isOpen, onClose, task, onRefresh, onEdit, onLogout }) => {
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    [true, 1, "yes"].includes(
      typeof task?.completed === "string" ? task.completed.toLowerCase() : task?.completed
    )
  );

  useEffect(() => {
    if (task) {
      setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
      setIsCompleted(
        [true, 1, "yes"].includes(
          typeof task.completed === "string" ? task.completed.toLowerCase() : task.completed
        )
      );
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No auth token");
    return { Authorization: `Bearer ${token}` };
  };

  const handleToggleComplete = async () => {
    try {
      const nextStatus = isCompleted ? "No" : "Yes";
      await axios.put(
        `${API_BASE}/${task._id}/gp`,
        { completed: nextStatus },
        { headers: getAuthHeaders() }
      );
      setIsCompleted(!isCompleted);
      onRefresh?.();
      toast.success(isCompleted ? "Task marked as pending" : "Task completed! 🎉");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
      if (err.response?.status === 401) onLogout?.();
    }
  };

  const handleToggleSubtask = async (index) => {
    const updated = subtasks.map((st, i) =>
      i === index ? { ...st, completed: !st.completed } : st
    );
    setSubtasks(updated);
    try {
      await axios.put(
        `${API_BASE}/${task._id}/gp`,
        { subtasks: updated },
        { headers: getAuthHeaders() }
      );
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update subtask");
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const updated = [...subtasks, { title: newSubtaskTitle.trim(), completed: false }];
    setSubtasks(updated);
    setNewSubtaskTitle("");
    setAddingSubtask(false);
    try {
      await axios.put(
        `${API_BASE}/${task._id}/gp`,
        { subtasks: updated },
        { headers: getAuthHeaders() }
      );
      onRefresh?.();
      toast.success("Subtask added");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add subtask");
    }
  };

  const completedSubtasksCount = subtasks.filter((st) => st.completed).length;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-purple-100 rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl relative max-h-[92vh] max-h-[92dvh] flex flex-col overflow-hidden"
      >
        {/* Grab Handle for Mobile */}
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-2.5 -mb-1 sm:hidden shrink-0" />

        {/* Top Header matching Screen 8 */}
        <div className="flex items-center justify-between p-4 border-b border-purple-100 bg-white/95 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-base font-bold text-gray-800">Task Details</h2>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit?.(task);
            }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            aria-label="Edit Task"
            title="Edit Task"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {/* Title & Checkbox */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`mt-0.5 p-1 rounded-full transition cursor-pointer ${
                isCompleted ? "text-emerald-500" : "text-gray-300 hover:text-purple-600"
              }`}
            >
              <CheckCircle2
                className={`w-6 h-6 ${isCompleted ? "fill-emerald-500 text-white" : ""}`}
              />
            </button>
            <div className="flex-1 min-w-0">
              <h1
                className={`text-lg sm:text-xl font-bold leading-snug ${
                  isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                }`}
              >
                {task.title}
              </h1>
              {task.description && (
                <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Badges Row matching Screen 8: Priority | Due Date | Status */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-purple-50">
            {/* Priority Badge */}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${getPriorityBadgeColor(
                task.priority
              )}`}
            >
              {task.priority || "Low"}
            </span>

            {/* Due Date Badge */}
            {task.dueDate && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(task.dueDate), "EEE, d MMM yyyy")}
              </span>
            )}

            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border ${
                isCompleted
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-purple-50 text-purple-700 border-purple-200"
              }`}
            >
              {isCompleted ? "Completed" : "Pending"}
            </span>

            {/* Project badge if any */}
            {task.project?.name && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                <Folder className="w-3.5 h-3.5 text-purple-600" />
                {task.project.name}
              </span>
            )}
          </div>

          {/* Subtasks Section matching Screen 8 */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <span>Subtasks</span>
                <span className="text-gray-400 font-medium">
                  ({completedSubtasksCount}/{subtasks.length})
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setAddingSubtask(true)}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subtask
              </button>
            </div>

            {/* Subtask list */}
            <div className="space-y-1.5">
              {subtasks.map((st, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleSubtask(idx)}
                  className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/40 hover:bg-purple-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(st.completed)}
                    onChange={() => {}}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-purple-300 pointer-events-none"
                  />
                  <span
                    className={`text-xs flex-1 truncate ${
                      st.completed ? "text-gray-400 line-through" : "text-gray-800 font-medium"
                    }`}
                  >
                    {st.title}
                  </span>
                </div>
              ))}

              {addingSubtask && (
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Subtask name..."
                    className="flex-1 text-xs p-2 border border-purple-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubtask(false);
                      setNewSubtaskTitle("");
                    }}
                    className="px-2 py-2 text-gray-500 text-xs hover:text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Attachments Section matching Screen 8 */}
          {Array.isArray(task.attachments) && task.attachments.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs sm:text-sm font-bold text-gray-800 mb-2">
                Attachments ({task.attachments.length})
              </h3>
              <div className="space-y-2">
                {task.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={resolveAttachmentUrl(att.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-purple-100 bg-white hover:bg-purple-50 flex items-center justify-between gap-3 transition group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{att.name}</p>
                        <p className="text-[10px] text-gray-400">Tap to view / download</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Full-Width Sticky Button matching Screen 8 */}
        <div className="p-3.5 sm:p-5 border-t border-purple-100 bg-gray-50/95 shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <button
            type="button"
            onClick={handleToggleComplete}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm shadow-md active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer ${
              isCompleted
                ? "bg-gray-700 hover:bg-gray-800 text-white"
                : "bg-gradient-to-r from-purple-600 via-purple-700 to-fuchsia-600 text-white hover:brightness-105"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? "Mark as Incomplete" : "Mark as Complete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
