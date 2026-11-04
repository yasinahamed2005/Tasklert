import React, { useState, useEffect } from "react";
import {
  Trophy,
  Coffee,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Volume2,
  VolumeX,
  BellRing,
  Check,
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
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSnoozeMinutes, setSelectedSnoozeMinutes] = useState(5);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live Samsung-Clock style digital ticker
  useEffect(() => {
    if (!isOpen) return;
    const ticker = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(ticker);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      soundManager.stop();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(0);
        } catch (_) {}
      }
    };
  }, []);

  if (!isOpen || !sessionInfo) return null;

  const isFocus = sessionInfo.mode === "focus";
  const durationMins = sessionInfo.durationMinutes || 25;

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      soundManager.playAlarm(sessionInfo.sound || "chime", sessionInfo.volume || 80);
    } else {
      setIsMuted(true);
      soundManager.stop();
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

  const handleSnooze = (mins = selectedSnoozeMinutes) => {
    soundManager.stop();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (_) {}
    }
    onSnooze?.(mins);
  };

  const timeString = currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateString = currentTime.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alarm Ringing"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn"
    >
      <div className="bg-white rounded-3xl w-full max-w-md sm:max-w-lg shadow-2xl border border-slate-200 overflow-hidden text-center relative flex flex-col justify-between max-h-[94vh]">
        {/* TOP SAMSUNG-STYLE STATUS BAR */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm font-black text-sm">
              T
            </div>
            <div className="text-left">
              <h1 className="text-xs font-black tracking-wider uppercase text-purple-300">Tasklert Focus</h1>
              <p className="text-[10px] text-slate-400 font-medium">Samsung Clock Alarm Experience</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title={isMuted ? "Unmute Alarm" : "Mute Sound"}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-rose-400" />
                  <span className="text-[11px] text-rose-300 hidden sm:inline">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-300 hidden sm:inline">Sound On</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* CLOCK & ALARM HEADER (Samsung Clock Alarm Style) */}
        <div className="px-6 pt-5 pb-2">
          {/* Live Digital Clock */}
          <div className="mb-4">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
              {timeString}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wider">
              {dateString}
            </div>
          </div>

          {/* Pulsing Alarm Hero Icon */}
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
            <div className="w-full h-full rounded-full flex items-center justify-center text-white shadow-xl bg-gradient-to-br from-purple-600 to-indigo-700">
              {isFocus ? (
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow" />
              ) : (
                <Coffee className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow" />
              )}
            </div>
          </div>

          {/* Alarm Title & Message */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
              <BellRing className="w-3.5 h-3.5 animate-bounce" />
              <span>{isFocus ? "Focus Sprint Accomplished" : "Break Over"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {isFocus ? "Focus Completed! 🎯" : "Break Completed! ☕"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              {isFocus
                ? `You completed ${durationMins} minutes of uninterrupted deep focus. Great discipline!`
                : `Your break is over. Feeling refreshed and ready for your next focus session?`}
            </p>
          </div>

          {/* Session Metrics Bar */}
          <div className="grid grid-cols-2 gap-2.5 my-4 text-left">
            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Session Length</span>
              </div>
              <p className="text-base font-black text-slate-900">{durationMins} mins</p>
            </div>

            <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Total Today</span>
              </div>
              <p className="text-base font-black text-slate-900">
                {Math.floor(todayTotalMinutes / 60)}h {todayTotalMinutes % 60}m
              </p>
            </div>
          </div>

          {/* SNOOZE DURATION SELECTION CHIPS */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-slate-500 mb-1.5 text-left">Choose Snooze Interval:</p>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSelectedSnoozeMinutes(mins)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    selectedSnoozeMinutes === mins
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {mins} mins
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PRIMARY TOUCH-FRIENDLY SAMSUNG-STYLE CONTROLS */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 space-y-2.5">
          {/* 1. Large Snooze & Dismiss Action Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* LARGE SNOOZE BUTTON */}
            <button
              type="button"
              onClick={() => handleSnooze(selectedSnoozeMinutes)}
              className="py-4 px-4 rounded-2xl bg-white border-2 border-purple-300 hover:border-purple-500 text-purple-800 font-extrabold text-sm sm:text-base shadow-sm hover:shadow transition active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                <span>Snooze</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Ring again in {selectedSnoozeMinutes}m
              </span>
            </button>

            {/* LARGE DISMISS BUTTON */}
            <button
              type="button"
              onClick={handleDismiss}
              className="py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition active:scale-95 flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-5 h-5 stroke-[2.5]" />
                <span>Dismiss</span>
              </div>
              <span className="text-[11px] font-medium text-purple-100">
                Stop alarm & record
              </span>
            </button>
          </div>

          {/* 2. Start Next Session CTA */}
          <button
            type="button"
            onClick={handleStartNextSession}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <span>{isFocus ? "Start Next Break Now" : "Start Next Focus Session"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusCompletionModal;
