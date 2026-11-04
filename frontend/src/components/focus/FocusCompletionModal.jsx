import React, { useState, useEffect } from "react";
import {
  Trophy,
  Coffee,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Check,
  ArrowRight,
  Music,
  BellRing,
} from "lucide-react";
import { soundManager } from "../../utils/soundManager";

export const FocusCompletionModal = ({
  isOpen = false,
  sessionInfo = null,
  todayTotalMinutes = 0,
  onDismiss,
  onStartNext,
  onSnooze,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(true);

  // Sync isPlayingAudio with SoundManager
  useEffect(() => {
    if (!isOpen) {
      soundManager.stop();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);

    return () => {
      soundManager.stop();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch (_) {}
      }
    };
  }, [isOpen]);

  if (!isOpen || !sessionInfo) return null;

  const isFocus = sessionInfo.mode === "focus";
  const durationMins = sessionInfo.durationMinutes || 25;
  const ringtoneName =
    sessionInfo.customAudioName ||
    (sessionInfo.sound === "custom" ? "Tere Vaaste.mp3" : null) ||
    (sessionInfo.sound === "classic"
      ? "Classic Twin Bell"
      : sessionInfo.sound === "digital"
      ? "Digital Pulse"
      : sessionInfo.sound === "bell"
      ? "Zen Singing Bowl"
      : sessionInfo.sound === "soft"
      ? "Warm Marimba"
      : "Gentle Chime");

  const toggleAudio = () => {
    if (isPlayingAudio) {
      soundManager.stop();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      soundManager.playAlarm(
        sessionInfo.sound || "chime",
        sessionInfo.volume || 80,
        sessionInfo.customAudioRecord || sessionInfo.customAudioUrl,
        sessionInfo.mode || "focus"
      );
    }
  };

  const handleDismiss = () => {
    soundManager.stop();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    onDismiss?.();
  };

  const handleStartNextSession = () => {
    soundManager.stop();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    onStartNext?.();
  };

  const handleSnooze = (mins = 5) => {
    soundManager.stop();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    onSnooze?.(mins);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alarm Ringing"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn"
    >
      <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-md shadow-2xl border border-blue-100 overflow-hidden text-center p-5 sm:p-6 space-y-4 animate-scaleUp relative">
        {/* Celebration Radial Glow & Icon (Screen 3 Reference) */}
        <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center pt-2">
          {/* Dashed rays around icon */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-200 animate-spin" style={{ animationDuration: "25s" }} />
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md">
            {isFocus ? (
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow" />
            ) : (
              <Coffee className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow" />
            )}
          </div>
        </div>

        {/* Mode Badge & Titles */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <BellRing className="w-3.5 h-3.5 animate-bounce" />
            <span>{isFocus ? "FOCUS COMPLETED" : "BREAK OVER"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isFocus ? "Focus Completed! 🎯" : "Break Completed! ☕"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            {isFocus
              ? "Your focus sprint is complete. Time for a well-deserved recharge!"
              : "Your break is over. Feeling refreshed and ready for your next focus session?"}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-left">
          <div className="p-3 rounded-2xl border border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Session Length</span>
            </div>
            <p className="text-base font-black text-slate-900">{durationMins} mins</p>
          </div>

          <div className="p-3 rounded-2xl border border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Total Today</span>
            </div>
            <p className="text-base font-black text-slate-900">
              {Math.floor(todayTotalMinutes / 60)}h {todayTotalMinutes % 60}m
            </p>
          </div>
        </div>

        {/* Ringtone Track Card (Exact Match to Screen 3 Reference) */}
        <div className="p-3 rounded-2xl border border-blue-100 bg-blue-50/40 flex items-center justify-between text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {ringtoneName}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                Alarm Ringtone
              </p>
            </div>
          </div>

          {/* Play/Pause Button on Ringtone Card */}
          <button
            type="button"
            onClick={toggleAudio}
            className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs hover:bg-blue-700 transition active:scale-95 shrink-0 cursor-pointer"
            title={isPlayingAudio ? "Pause Alarm Audio" : "Play Alarm Audio"}
          >
            {isPlayingAudio ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
            )}
          </button>
        </div>

        {/* Snooze & Dismiss Action Buttons (Exact Match to Screen 3 Reference) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Snooze Button */}
          <button
            type="button"
            onClick={() => handleSnooze(5)}
            className="py-3 px-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm shadow-xs hover:bg-slate-50 transition active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-extrabold">
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Snooze</span>
            </div>
            <span className="text-[10px] font-medium text-slate-500">
              Ring again in 5 mins
            </span>
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 font-extrabold">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Dismiss</span>
            </div>
            <span className="text-[10px] font-medium text-blue-100">
              Stop alarm & record
            </span>
          </button>
        </div>

        {/* Start Next Session Full-Width CTA */}
        <button
          type="button"
          onClick={handleStartNextSession}
          className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isFocus ? "Start Refreshing Break" : "Start Next Focus Session"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FocusCompletionModal;
