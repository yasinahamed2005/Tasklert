import React, { useState, useEffect } from "react";
import {
  X,
  Activity,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Music,
  Clock,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  Trash2,
  Copy,
} from "lucide-react";
import { deviceAlarmManager } from "../../utils/deviceAlarmManager";
import { customRingtoneStorage } from "../../utils/customRingtoneStorage";
import { soundManager } from "../../utils/soundManager";
import { toast } from "react-toastify";

export const FocusDiagnosticsModal = ({ isOpen = false, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [allSlots, setAllSlots] = useState({});
  const [soundDiag, setSoundDiag] = useState({});

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const diag = await deviceAlarmManager.getDiagnosticStatus();
      setStatus(diag);

      const slots = await customRingtoneStorage.getAllSlotsMetadata();
      setAllSlots(slots || {});

      const smDiag = soundManager.getDiagnostics();
      setSoundDiag(smDiag || {});
    } catch (e) {
      console.warn("Diagnostics error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  const handleRun5SecTest = async () => {
    setTestResult("Arming 5-second precision test alarm... Lock phone or minimize browser now!");
    try {
      await soundManager.unlockAudioContext();
      await deviceAlarmManager.testNativeAlarm();
      setTestResult("✅ 5-second test alarm armed! Check if alarm screen appears and sound plays.");
    } catch (err) {
      setTestResult("❌ Test alarm failed: " + err.message);
    }
  };

  const handleCopyFocusToAll = async () => {
    try {
      const focusRec = await customRingtoneStorage.getRingtone("focus");
      if (!focusRec || !focusRec.blob) {
        toast.info("No Focus custom audio found to copy. Please upload a file first.");
        return;
      }

      await customRingtoneStorage.saveRingtone("short_break", focusRec.blob);
      await customRingtoneStorage.saveRingtone("long_break", focusRec.blob);

      if (focusRec.data) {
        soundManager.preloadCustomAudio("short_break", focusRec.data, focusRec.name);
        soundManager.preloadCustomAudio("long_break", focusRec.data, focusRec.name);
      }

      await fetchDiagnostics();
      toast.success(`Copied "${focusRec.name}" to Short Break & Long Break!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy ringtone to all modes.");
    }
  };

  const handleWipeStaleCache = async () => {
    try {
      await customRingtoneStorage.clearAllRingtones();
      soundManager.clearBuffers();
      await fetchDiagnostics();
      toast.success("Ringtone cache completely wiped! Please re-select your preferred track.");
    } catch (err) {
      console.error(err);
      toast.error("Could not wipe ringtone cache.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Focus Alarm Diagnostics</h2>
              <p className="text-[11px] text-slate-400">AudioContext, Slots & Engine Inspection</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-8 text-center text-slate-500 font-medium">Inspecting system capabilities...</div>
          ) : (
            <>
              {/* Platform Banner */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  status?.isNative
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-extrabold block text-sm">{status?.platform || "Detecting..."}</span>
                    <span className="text-[11px] opacity-80">
                      {status?.isNative
                        ? "Native Android AlarmManager (setAlarmClock active)"
                        : "Web Browser / Chrome PWA (Web Audio + Web Worker precision)"}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-white/80 border border-current">
                  {status?.isNative ? "NATIVE" : "WEB PWA"}
                </span>
              </div>

              {/* AudioContext Health Check */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-purple-600" />
                    Web Audio Context State:
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] uppercase border ${
                      soundDiag.audioContextState === "running"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                  >
                    {soundDiag.audioContextState || "uninitialized"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Silent Keep-Alive Node:</span>
                  <span className="font-bold text-slate-800">
                    {soundDiag.keepAliveActive ? "Active (Engaged)" : "Standby"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Last Played Track:</span>
                  <span className="font-bold text-purple-700">
                    {soundDiag.currentRingtoneName || "Tere Vaaste.mp3"}
                  </span>
                </div>
              </div>

              {/* Ringtone Slots Forensic Breakdown */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Ringtone Slot Integrity:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFocusToAll}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Focus to All</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-slate-700">🍅 Focus:</span>
                    <span className="font-extrabold text-blue-700 truncate max-w-[200px]">
                      {allSlots.focus?.name || "None (Default Chime)"}
                    </span>
                  </div>

                  <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-slate-700">☕ Short Break:</span>
                    <span className="font-extrabold text-blue-700 truncate max-w-[200px]">
                      {allSlots.short_break?.name || "None (Inherits Focus)"}
                    </span>
                  </div>

                  <div className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                    <span className="font-bold text-slate-700">🛋️ Long Break:</span>
                    <span className="font-extrabold text-blue-700 truncate max-w-[200px]">
                      {allSlots.long_break?.name || "None (Inherits Focus)"}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleWipeStaleCache}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wipe Stale Cache (Removes Alaaakaa Loova)</span>
                  </button>
                </div>
              </div>

              {/* Permissions & Alarms */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium block">Exact Alarms:</span>
                  <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900">
                    {status?.canScheduleExactAlarms ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{status?.canScheduleExactAlarms ? "Granted" : "Restricted (Web)"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 font-medium block">Notifications:</span>
                  <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900">
                    {status?.hasNotificationPermission ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                    <span>{status?.hasNotificationPermission ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
              </div>

              {/* 5-Second Verification Tool */}
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-950 block">Instant 5-Second Verification</span>
                    <span className="text-[11px] text-purple-700">Fires in 5 seconds to test background ringing</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRun5SecTest}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shrink-0"
                  >
                    Test (5s)
                  </button>
                </div>
                {testResult && (
                  <p className="text-[11px] font-semibold text-purple-900 bg-white/70 p-2 rounded-lg border border-purple-100">
                    {testResult}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
};

export default FocusDiagnosticsModal;
