import React, { useEffect, useState } from "react";
import { BellRing, Volume2, VolumeX, Clock, Flag, CheckCircle, ArrowRight, X } from "lucide-react";
import { soundManager } from "../utils/soundManager";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const AlarmModal = ({ alarm, onClose, onActionCompleted }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSnooze, setSelectedSnooze] = useState(5);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!alarm) return;

    // Start audio playback when alarm modal opens
    const sound = alarm.sound || "digital";
    const volume = alarm.volume || 80;
    soundManager.playAlarm(sound, isMuted ? 0 : volume);

    return () => {
      // Guarantee sound stops when modal closes or unmounts
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
    soundManager.stop();
    try {
      const token = localStorage.getItem("token");
      if (token && alarm.alarmId) {
        await axios.post(
          `${API_BASE}/api/reminders/${alarm.alarmId}/dismiss`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      onActionCompleted?.();
    } catch (err) {
      console.error("Error dismissing alarm:", err);
    } finally {
      setLoadingAction(false);
      onClose();
    }
  };

  const handleSnooze = async () => {
    setLoadingAction(true);
    soundManager.stop();
    try {
      const token = localStorage.getItem("token");
      if (token && alarm.alarmId) {
        await axios.post(
          `${API_BASE}/api/reminders/${alarm.alarmId}/snooze`,
          { durationMinutes: selectedSnooze },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      onActionCompleted?.();
    } catch (err) {
      console.error("Error snoozing alarm:", err);
    } finally {
      setLoadingAction(false);
      onClose();
    }
  };

  const priorityColors = {
    High: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    Medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  const priorityClass = priorityColors[alarm.priority] || priorityColors.Medium;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fadeIn">
      {/* Sound waves pulsing background effect */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[420px] h-[420px] rounded-full bg-[#8B2CF5]/15 animate-ping opacity-75" />
      </div>

      <div className="relative w-full max-w-lg rounded-3xl border border-[#8B2CF5]/40 bg-[#111A2E] p-6 sm:p-8 shadow-2xl text-[#F8FAFC]">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-[#34445F]">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#8B2CF5] to-[#D946EF] text-white shadow-lg shadow-[#8B2CF5]/40 animate-bounce-slow">
              <BellRing className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#D946EF]">
                Tasklert Scheduled Alarm
              </span>
              <p className="text-sm font-semibold text-[#F8FAFC]">Due Reminder Alert</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute / Unmute Toggle */}
            <button
              onClick={toggleMute}
              className="rounded-xl border border-[#34445F] bg-[#19243A] p-2 text-[#AAB8CF] hover:text-[#F8FAFC] transition cursor-pointer"
              title={isMuted ? "Unmute Alarm" : "Mute Sound"}
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-xl border border-[#34445F] bg-[#19243A] p-2 text-[#AAB8CF] hover:text-[#F8FAFC] transition cursor-pointer"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Task Title & Details */}
        <div className="my-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${priorityClass}`}>
              <Flag className="h-3 w-3" />
              {alarm.priority || "Medium"} Priority
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[#AAB8CF]">
              <Clock className="h-3.5 w-3.5 text-[#8B2CF5]" />
              {alarm.scheduledAt ? new Date(alarm.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now"}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F8FAFC] leading-snug">
            {alarm.title}
          </h2>

          {alarm.body && (
            <p className="text-sm text-[#AAB8CF] leading-relaxed bg-[#19243A]/70 border border-[#34445F]/60 p-3 rounded-xl">
              {alarm.body}
            </p>
          )}
        </div>

        {/* Snooze & Dismiss Controls */}
        <div className="space-y-4 pt-2">
          {/* Snooze Options */}
          <div className="flex items-center justify-between rounded-xl border border-[#34445F] bg-[#19243A] p-2 text-xs">
            <span className="text-[#AAB8CF] font-medium pl-2">Snooze duration:</span>
            <div className="flex gap-1.5">
              {SNOOZE_OPTIONS.map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setSelectedSnooze(min)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer ${
                    selectedSnooze === min
                      ? "bg-[#8B2CF5] text-white shadow-sm"
                      : "text-[#AAB8CF] hover:text-white hover:bg-[#222F49]"
                  }`}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSnooze}
              disabled={loadingAction}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#34445F] bg-[#19243A] hover:bg-[#222F49] px-4 py-3 text-sm font-semibold text-[#F8FAFC] transition cursor-pointer disabled:opacity-50"
            >
              <Clock className="h-4 w-4 text-[#8B2CF5]" />
              Snooze ({selectedSnooze}m)
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              disabled={loadingAction}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B2CF5] to-[#D946EF] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#8B2CF5]/30 hover:brightness-110 active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Dismiss Alarm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmModal;
