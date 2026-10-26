import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  BellRing,
  Volume2,
  VolumeX,
  Clock,
  Flag,
  CheckCircle2,
  X,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import { soundManager } from "../utils/soundManager";
import { useModalAccessibility } from "../utils/scrollLock";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;
const SNOOZE_OPTIONS = [5, 10, 15, 30];

const AlarmModal = ({ alarm, onClose, onActionCompleted }) => {
  const modalRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSnooze, setSelectedSnooze] = useState(5);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Live digital clock ticker for the ringing screen (Samsung Clock style)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useModalAccessibility({
    isOpen: Boolean(alarm),
    onClose: () => {
      soundManager.stop();
      onClose();
    },
    modalRef,
  });

  useEffect(() => {
    if (!alarm) return;

    // Start audio playback when alarm modal opens
    const sound = alarm.sound || "digital";
    const volume = alarm.volume || 80;
    soundManager.playAlarm(sound, isMuted ? 0 : volume);

    return () => {
      soundManager.stop();
    };
  }, [alarm, isMuted]);

  if (!alarm) return null;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      soundManager.playAlarm(alarm.sound || "digital", alarm.volume || 80);
    } else {
      setIsMuted(true);
      soundManager.stop();
    }
  };

  const handleDismiss = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. If alarmId exists, call dismissReminder on backend
      // (which now automatically marks the linked task completed in MongoDB!)
      if (token && alarm.alarmId) {
        await axios.post(
          `${API_BASE}/api/reminders/${alarm.alarmId}/dismiss`,
          { completeLinkedTask: true },
          { headers }
        );
      }

      // 2. If taskId exists and alarmId was missing (e.g. foreground trigger),
      // mark task completed directly
      if (token && alarm.taskId && !alarm.alarmId) {
        await axios.put(
          `${API_BASE}/api/tasks/${alarm.taskId}`,
          { completed: true },
          { headers }
        );
      }

      soundManager.stop();
      onActionCompleted?.({
        dismissed: true,
        taskId: alarm.taskId,
        alarmId: alarm.alarmId,
      });
      onClose();
    } catch (err) {
      console.error("Error dismissing alarm:", err);
      const msg =
        err.response?.data?.message ||
        "Failed to dismiss alarm on server. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSnooze = async () => {
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem("token");
      if (token && alarm.alarmId) {
        await axios.post(
          `${API_BASE}/api/reminders/${alarm.alarmId}/snooze`,
          { durationMinutes: selectedSnooze },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      soundManager.stop();
      onActionCompleted?.({
        snoozed: true,
        taskId: alarm.taskId,
        alarmId: alarm.alarmId,
        durationMinutes: selectedSnooze,
      });
      onClose();
    } catch (err) {
      console.error("Error snoozing alarm:", err);
      const msg =
        err.response?.data?.message ||
        "Failed to snooze alarm on server. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleForceClose = () => {
    soundManager.stop();
    onClose();
  };

  const priorityColors = {
    High: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    Medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    Low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  };
  const priorityClass = priorityColors[alarm.priority] || priorityColors.Medium;

  // Format time for Samsung Clock display
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const timeFormatted = `${String(displayHours).padStart(2, "0")}:${minutes}`;

  const isLinkedToTask = Boolean(alarm.taskId);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleForceClose();
        }
      }}
    >
      {/* Samsung Clock-inspired Concentric Sound Ripples */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[320px] sm:w-[460px] h-[320px] sm:h-[460px] rounded-full border border-[#8B2CF5]/20 animate-ping opacity-60" />
        <div className="absolute w-[240px] sm:w-[360px] h-[240px] sm:h-[360px] rounded-full bg-[#8B2CF5]/10 animate-pulse" />
      </div>

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alarm-modal-title"
        className="relative w-full max-w-lg max-h-[92vh] max-h-[92dvh] flex flex-col rounded-3xl border border-[#8B2CF5]/40 bg-[#0F172A] p-5 sm:p-7 shadow-2xl text-[#F8FAFC] overflow-hidden"
      >
        {/* Top Bar: Status Badge + Mute/Close Controls */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#8B2CF5] to-[#D946EF] text-white shadow-lg shadow-[#8B2CF5]/40 animate-bounce-slow">
              <BellRing className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D946EF]">
                Tasklert Clock
              </span>
              <p className="text-xs font-semibold text-slate-300">
                {isLinkedToTask ? "Task Alarm Ringing" : "Alarm Ringing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute / Unmute Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:text-white transition cursor-pointer"
              title={isMuted ? "Unmute Alarm" : "Mute Sound"}
              aria-label={isMuted ? "Unmute Alarm" : "Mute Sound"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={handleForceClose}
              className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:text-white transition cursor-pointer"
              title="Close Alarm"
              aria-label="Close Alarm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Samsung Clock Big Digital Ringing Display */}
        <div className="my-4 text-center shrink-0">
          <div className="inline-flex items-baseline justify-center gap-2">
            <span className="text-5xl sm:text-6xl font-extrabold font-mono tracking-tight text-white drop-shadow-md">
              {timeFormatted}
            </span>
            <div className="flex flex-col items-start leading-none">
              <span className="text-xs font-mono text-purple-300 font-bold">
                :{seconds}
              </span>
              <span className="text-sm font-extrabold text-purple-400">
                {period}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${priorityClass}`}
            >
              <Flag className="h-3 w-3" />
              {alarm.priority || "Medium"} Priority
            </span>
            {isLinkedToTask && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-bold text-purple-200">
                <CheckCheck className="h-3 w-3 text-purple-300" />
                Linked to Task
              </span>
            )}
          </div>
        </div>

        {/* Alarm Title & Description (Scrollable container for small screens) */}
        <div className="my-2 space-y-2.5 flex-1 min-h-0 overflow-y-auto overscroll-contain modal-content-scroll pr-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
            <h2
              id="alarm-modal-title"
              className="text-xl sm:text-2xl font-extrabold text-white leading-snug break-words"
            >
              {alarm.title}
            </h2>

            {alarm.body && (
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed break-words text-left bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {alarm.body}
              </p>
            )}

            {isLinkedToTask && (
              <p className="mt-2 text-[11px] font-medium text-emerald-400 flex items-center justify-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Dismissing will mark this task as Completed in MongoDB.
              </p>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300">
              <p className="font-semibold mb-1">⚠️ Error syncing with server:</p>
              <p className="mb-2">{errorMessage}</p>
              <button
                type="button"
                onClick={handleForceClose}
                className="underline hover:text-white font-medium cursor-pointer"
              >
                Close alarm locally anyway
              </button>
            </div>
          )}
        </div>

        {/* Samsung Clock-inspired Controls (Stable shrink-0 Footer) */}
        <div className="space-y-3 pt-3 border-t border-slate-800 shrink-0">
          {/* Snooze Duration Selector */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/90 p-2 text-xs">
            <span className="text-slate-400 font-medium pl-2">Snooze time:</span>
            <div className="flex gap-1.5">
              {SNOOZE_OPTIONS.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setSelectedSnooze(min)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                    selectedSnooze === min
                      ? "bg-[#8B2CF5] text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Snooze & Dismiss/Complete */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSnooze}
              disabled={loadingAction}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700/80 px-4 py-3.5 text-xs sm:text-sm font-bold text-slate-200 transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              <Clock className="h-4 w-4 text-purple-400" />
              <span>{loadingAction ? "Snoozing..." : `Snooze (${selectedSnooze}m)`}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              disabled={loadingAction}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-4 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#8B2CF5]/40 hover:brightness-110 active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="h-4.5 w-4.5 text-white" />
              <span>
                {loadingAction
                  ? "Completing..."
                  : isLinkedToTask
                  ? "Dismiss & Complete"
                  : "Stop Alarm"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmModal;
