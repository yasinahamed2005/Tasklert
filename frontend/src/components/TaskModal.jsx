import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_TASK, baseControlClasses, priorityStyles } from '../assets/dummy';
import { PlusCircle, X, AlignLeft, Flag, Calendar, CheckCircle, Save, Paperclip, Link, FileText, Image, Video, Trash2, Upload, BellRing, Clock, Play, Square, Volume2, Globe, Shield, Sparkles } from 'lucide-react';
import axios from 'axios';
import { soundManager } from '../utils/soundManager';
import { useModalAccessibility } from '../utils/scrollLock';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tasks`;

const ALARM_SOUND_OPTIONS = [
  { id: 'digital', label: 'Digital Beep (Electronic)' },
  { id: 'classic', label: 'Classic Alarm (Twin Bell)' },
  { id: 'chime', label: 'Gentle Chime (Crystal Bell)' },
  { id: 'bell', label: 'Morning Bell (Harmonic)' },
  { id: 'soft', label: 'Soft Reminder (Mellow)' },
];

const TaskModal = ({ isOpen, onClose, taskToEdit, onSave, onLogout }) => {
  const modalRef = useRef(null);
  useModalAccessibility({ isOpen, onClose, modalRef });

  const [taskData, setTaskData] = useState({
    ...DEFAULT_TASK,
    attachments: [],
    alarmSound: 'digital',
    alarmVolume: 80,
    alarmRepeat: 'never',
    snoozeDuration: 5,
    advanceNoticeMinutes: 0,
    channels: { push: true, inApp: true, email: false },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  });
  const [subtaskInput, setSubtaskInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewingSound, setPreviewingSound] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      const normalized = taskToEdit.completed === "Yes" || taskToEdit.completed === true ? "Yes" : "No";
      setTaskData({
        ...DEFAULT_TASK,
        title: taskToEdit.title || "",
        description: taskToEdit.description || "",
        priority: taskToEdit.priority || "Low",
        dueDate: taskToEdit.dueDate?.split("T")[0] || "",
        completed: normalized,
        reminderEnabled: Boolean(taskToEdit.reminderEnabled),
        reminderAt: taskToEdit.reminderAt
          ? new Date(taskToEdit.reminderAt).toISOString().slice(0, 16)
          : "",
        alarmSound: taskToEdit.alarmSound || taskToEdit.sound || 'digital',
        alarmVolume: taskToEdit.alarmVolume !== undefined ? Number(taskToEdit.alarmVolume) : 80,
        alarmRepeat: taskToEdit.alarmRepeat || taskToEdit.repeat || 'never',
        snoozeDuration: taskToEdit.snoozeDuration ? Number(taskToEdit.snoozeDuration) : 5,
        advanceNoticeMinutes: taskToEdit.advanceNoticeMinutes ? Number(taskToEdit.advanceNoticeMinutes) : 0,
        channels: {
          push: taskToEdit.channels?.push !== undefined ? Boolean(taskToEdit.channels.push) : true,
          inApp: taskToEdit.channels?.inApp !== undefined ? Boolean(taskToEdit.channels.inApp) : true,
          email: taskToEdit.channels?.email !== undefined ? Boolean(taskToEdit.channels.email) : false,
        },
        timeZone: taskToEdit.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        subtasks: Array.isArray(taskToEdit.subtasks)
          ? taskToEdit.subtasks.map((item) => ({
              title: item.title || "",
              completed: item.completed === true,
            }))
          : [],
        attachments: Array.isArray(taskToEdit.attachments) ? taskToEdit.attachments : [],
        id: taskToEdit._id,
      });
    } else {
      setTaskData({
        ...DEFAULT_TASK,
        attachments: [],
        alarmSound: 'digital',
        alarmVolume: 80,
        alarmRepeat: 'never',
        snoozeDuration: 5,
        advanceNoticeMinutes: 0,
        channels: { push: true, inApp: true, email: false },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      });
    }
    setSubtaskInput("");
    setLinkInput("");
    setError(null);
    setPreviewingSound(null);
    soundManager.stop();
  }, [isOpen, taskToEdit]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setTaskData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.success && data.file) {
        setTaskData((prev) => ({
          ...prev,
          attachments: [...(prev.attachments || []), data.file],
        }));
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "File upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
    const newAttachment = {
      name: url,
      url: formattedUrl,
      fileType: "link",
      size: 0,
    };
    setTaskData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), newAttachment],
    }));
    setLinkInput("");
  };

  const removeAttachment = (index) => {
    setTaskData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, idx) => idx !== index),
    }));
  };

  const addSubtask = useCallback(() => {
    const title = subtaskInput.trim();
    if (!title) return;
    setTaskData((prev) => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { title, completed: false }],
    }));
    setSubtaskInput("");
  }, [subtaskInput]);

  const toggleSubtask = useCallback((index) => {
    setTaskData((prev) => ({
      ...prev,
      subtasks: (prev.subtasks || []).map((item, idx) =>
        idx === index ? { ...item, completed: !item.completed } : item
      ),
    }));
  }, []);

  const removeSubtask = useCallback((index) => {
    setTaskData((prev) => ({
      ...prev,
      subtasks: (prev.subtasks || []).filter((_, idx) => idx !== index),
    }));
  }, []);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No auth Token Found');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (taskData.dueDate < today) {
      setError('Due date cannot be in the past.');
      return;
    }

    if (taskData.reminderEnabled && !taskData.reminderAt) {
      setError("Choose reminder date & time or disable reminder.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isEdit = Boolean(taskData.id);
      const url = isEdit ? `${API_BASE}/${taskData.id}/gp` : `${API_BASE}/gp`;

      const payload = {
        ...taskData,
        reminderAt: taskData.reminderEnabled && taskData.reminderAt
          ? new Date(taskData.reminderAt).toISOString()
          : null,
        subtasks: taskData.subtasks.filter((item) => item.title?.trim()),
        attachments: taskData.attachments || [],
      };

      const resp = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        if (resp.status === 401) return onLogout?.();
        const err = await resp.json();
        throw new Error(err.message || 'Failed to save task');
      }

      const saved = await resp.json();
      onSave?.(saved);
      onClose();
    } catch (error) {
      console.error(error);
      setError(error.message || 'Error saving task');
    } finally {
      setLoading(false);
    }
  }, [taskData, today, getHeaders, onLogout, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/50 backdrop-blur-xs overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="bg-white border border-purple-100 rounded-2xl max-w-xl w-full shadow-2xl relative max-h-[90vh] max-h-[90dvh] flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* Fixed Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-purple-100 bg-white/95 backdrop-blur-xs z-10 rounded-t-2xl shrink-0">
          <h2 id="task-modal-title" className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            {taskData.id ? <Save className='text-purple-500 w-5 h-5' /> : <PlusCircle className='text-purple-500 w-5 h-5' />}
            {taskData.id ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-gray-500 hover:text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto overscroll-contain modal-content-scroll p-4 sm:p-6 space-y-4 flex-1 min-h-0">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <div className="flex items-center border border-purple-100 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all duration-200">
              <input
                type="text"
                name="title"
                required
                value={taskData.title}
                onChange={handleChange}
                className="w-full text-sm focus:outline-none"
                placeholder="Enter task title"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
              <AlignLeft className='w-4 h-4 text-purple-500' /> Description
            </label>
            <textarea
              name="description"
              rows="3"
              value={taskData.description}
              onChange={handleChange}
              className={baseControlClasses}
              placeholder="Add details about your task"
            />
          </div>

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                <Flag className="w-4 h-4 text-purple-500" /> Priority
              </label>
              <select
                name="priority"
                value={taskData.priority}
                onChange={handleChange}
                className={`${baseControlClasses} ${priorityStyles[taskData.priority]}`}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
            <div>
              <label className='flex items-center gap-1 text-sm font-medium text-gray-700 mb-1'>
                <Calendar className='w-4 h-4 text-purple-500' /> Due Date
              </label>
              <input
                type="date"
                name='dueDate'
                required
                min={today}
                value={taskData.dueDate}
                onChange={handleChange}
                className={baseControlClasses}
              />
            </div>
          </div>

          {/* Smart Alarm & Exact-Time Reminder Panel */}
          <div className="rounded-xl border border-purple-200/90 bg-purple-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white shadow-xs">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-800">Smart Alarm &amp; Exact-Time Reminder</span>
                  <p className="text-[11px] text-gray-500">Multi-device alert at scheduled date &amp; time</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={taskData.reminderEnabled}
                  onChange={(e) =>
                    setTaskData((prev) => ({
                      ...prev,
                      reminderEnabled: e.target.checked,
                      reminderAt:
                        e.target.checked && !prev.reminderAt
                          ? `${taskData.dueDate || today}T09:00`
                          : prev.reminderAt,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {taskData.reminderEnabled && (
              <div className="space-y-3 pt-2 border-t border-purple-100">
                {/* Date & Time Pickers */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-purple-600" /> Reminder Date
                    </label>
                    <input
                      type="date"
                      min={today}
                      value={taskData.reminderAt ? taskData.reminderAt.split("T")[0] : ""}
                      onChange={(e) => {
                        const time = taskData.reminderAt ? taskData.reminderAt.split("T")[1] || "09:00" : "09:00";
                        setTaskData((prev) => ({ ...prev, reminderAt: `${e.target.value}T${time}` }));
                      }}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required={taskData.reminderEnabled}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3 text-purple-600" /> Exact Time
                    </label>
                    <input
                      type="time"
                      value={taskData.reminderAt ? taskData.reminderAt.split("T")[1]?.slice(0, 5) || "09:00" : "09:00"}
                      onChange={(e) => {
                        const date = taskData.reminderAt ? taskData.reminderAt.split("T")[0] || today : today;
                        setTaskData((prev) => ({ ...prev, reminderAt: `${date}T${e.target.value}` }));
                      }}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required={taskData.reminderEnabled}
                    />
                  </div>
                </div>

                {/* Timezone & Live Summary */}
                <div className="flex items-center justify-between text-[11px] bg-purple-100/70 text-purple-800 rounded-lg px-2.5 py-1.5">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-purple-600" />
                    Timezone: <strong>{taskData.timeZone || "Asia/Kolkata"}</strong>
                  </span>
                  {taskData.reminderAt && (
                    <span className="font-semibold text-purple-700">
                      {new Date(taskData.reminderAt) > new Date()
                        ? `⏰ Scheduled for ${new Date(taskData.reminderAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date(taskData.reminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : "Past/Immediate"}
                    </span>
                  )}
                </div>

                {/* Sound Selection with Preview & Repeat */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-purple-600" /> Alarm Sound
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const snd = taskData.alarmSound || "digital";
                          if (previewingSound === snd) {
                            soundManager.stop();
                            setPreviewingSound(null);
                          } else {
                            setPreviewingSound(snd);
                            soundManager.preview(snd, taskData.alarmVolume || 80);
                            setTimeout(() => setPreviewingSound(null), 2500);
                          }
                        }}
                        className="text-[10px] font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        {previewingSound === taskData.alarmSound ? (
                          <Square className="w-2.5 h-2.5 fill-purple-700" />
                        ) : (
                          <Play className="w-2.5 h-2.5 fill-purple-700" />
                        )}
                        {previewingSound === taskData.alarmSound ? "Stop" : "Preview"}
                      </button>
                    </div>
                    <select
                      value={taskData.alarmSound || "digital"}
                      onChange={(e) => setTaskData((prev) => ({ ...prev, alarmSound: e.target.value }))}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      {ALARM_SOUND_OPTIONS.map((snd) => (
                        <option key={snd.id} value={snd.id}>
                          {snd.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3 text-purple-600" /> Repeat Schedule
                    </label>
                    <select
                      value={taskData.alarmRepeat || "never"}
                      onChange={(e) => setTaskData((prev) => ({ ...prev, alarmRepeat: e.target.value }))}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value="never">Never (Once)</option>
                      <option value="daily">Daily at same time</option>
                      <option value="weekly">Weekly at same time</option>
                    </select>
                  </div>
                </div>

                {/* Snooze & Advance Notice */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 mb-1 block">
                      Snooze Duration
                    </label>
                    <select
                      value={taskData.snoozeDuration || 5}
                      onChange={(e) => setTaskData((prev) => ({ ...prev, snoozeDuration: Number(e.target.value) }))}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 mb-1 block">
                      Advance Alert
                    </label>
                    <select
                      value={taskData.advanceNoticeMinutes || 0}
                      onChange={(e) => setTaskData((prev) => ({ ...prev, advanceNoticeMinutes: Number(e.target.value) }))}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value={0}>At scheduled time</option>
                      <option value={5}>5 min before</option>
                      <option value={10}>10 min before</option>
                      <option value={30}>30 min before</option>
                    </select>
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="pt-1.5 border-t border-purple-100 flex flex-wrap gap-4 text-xs text-gray-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(taskData.channels?.push)}
                      onChange={(e) => setTaskData((prev) => ({
                        ...prev,
                        channels: { ...prev.channels, push: e.target.checked }
                      }))}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>Device Push</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(taskData.channels?.inApp)}
                      onChange={(e) => setTaskData((prev) => ({
                        ...prev,
                        channels: { ...prev.channels, inApp: e.target.checked }
                      }))}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>In-App Alarm</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(taskData.channels?.email)}
                      onChange={(e) => setTaskData((prev) => ({
                        ...prev,
                        channels: { ...prev.channels, email: e.target.checked }
                      }))}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>Email Alert</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Attachments & Links (Up to 10MB) */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Paperclip className="w-4 h-4 text-purple-500" />
              Attachments & Links <span className="text-xs text-gray-400 font-normal">(Max 10MB)</span>
            </label>

            {/* File Upload Button + Link Input */}
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Uploading..." : "Upload File"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt"
                  />
                </label>

                <div className="flex-1 flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Or paste website/file URL"
                    className="w-full text-xs border border-purple-100 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Uploaded List Preview */}
              {taskData.attachments && taskData.attachments.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1.5 border border-purple-100 rounded-lg p-2 bg-purple-50/30">
                  {taskData.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-purple-50 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {att.fileType === "image" ? (
                          <Image className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : att.fileType === "video" ? (
                          <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        ) : att.fileType === "link" ? (
                          <Link className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        )}
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-purple-700 hover:underline font-medium"
                        >
                          {att.name}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-red-500 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Subtasks</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                className={baseControlClasses}
                placeholder="Add a subtask"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="px-3 rounded-lg border border-purple-200 text-purple-700"
              >
                Add
              </button>
            </div>
            {taskData.subtasks.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-2 border border-purple-100 rounded-lg p-2">
                {taskData.subtasks.map((item, idx) => (
                  <div key={`${item.title}-${idx}`} className="flex items-center justify-between gap-2 text-sm">
                    <label className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={Boolean(item.completed)}
                        onChange={() => toggleSubtask(idx)}
                      />
                      <span className={`truncate ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {item.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSubtask(idx)}
                      className="text-red-500 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
              <CheckCircle className="w-4 h-4 text-purple-500" /> Status
            </label>
            <div className="flex gap-4">
              {[
                { val: 'Yes', label: 'Completed' },
                { val: 'No', label: 'In Progress' }
              ].map(({ val, label }) => (
                <label key={val} className="flex items-center">
                  <input
                    type="radio"
                    name="completed"
                    value={val}
                    checked={taskData.completed === val}
                    onChange={handleChange}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          </div>

          {/* Stable Footer Action Buttons */}
          <div className="p-4 sm:p-5 border-t border-purple-100 bg-gray-50/95 rounded-b-2xl z-10 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-strong font-medium py-2.5 px-5 rounded-xl flex items-center justify-center gap-2
                         disabled:opacity-50 hover:shadow-md transition cursor-pointer"
            >
              {loading ? (
                'Saving...'
              ) : taskData.id ? (
                <>
                  <Save className="w-4 h-4" /> Update Task
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" /> Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
