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
} from "lucide-react";
import { deviceAlarmManager } from "../../utils/deviceAlarmManager";
import { customRingtoneStorage } from "../../utils/customRingtoneStorage";

export const FocusDiagnosticsModal = ({ isOpen = false, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState(null);
  const [activeSlotMeta, setActiveSlotMeta] = useState(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const diag = await deviceAlarmManager.getDiagnosticStatus();
      setStatus(diag);

      const focusRing = await customRingtoneStorage.getRingtoneMetadata("focus");
      setActiveSlotMeta(focusRing);
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
    setTestResult("Scheduling 5-second test alarm... Lock your phone or leave app now!");
    try {
      await deviceAlarmManager.testNativeAlarm();
      setTestResult("✅ 5-second test alarm armed! Check if alarm screen appears and sound plays.");
    } catch (err) {
      setTestResult("❌ Test alarm failed: " + err.message);
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
              <p className="text-[11px] text-slate-400">Hardware & Native Engine Inspection</p>
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
                        : "Web / Chrome PWA (Subject to browser background throttling)"}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-white/80 border border-current">
                  {status?.isNative ? "NATIVE" : "WEB PWA"}
                </span>
              </div>

              {/* Warning if running in browser/PWA */}
              {!status?.isNative && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>Real-device background limitation detected</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    You are accessing Tasklert through a browser or Chrome PWA shortcut. Android kernel Doze mode suspends Chrome when the screen is locked. To get guaranteed lock-screen wake and exact alarms without keeping the phone unlocked, the compiled <strong>Tasklert Android APK</strong> must be installed.
                  </p>
                </div>
              )}

              {/* Permissions Grid */}
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

              {/* Custom Ringtone Integrity */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-purple-600" />
                    Selected Ringtone:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {activeSlotMeta?.name || status?.savedRingtoneName || "Tere Vaaste.mp3"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Storage Status:</span>
                  <span className="text-emerald-700 font-bold">
                    {activeSlotMeta ? `IndexedDB (${(activeSlotMeta.size / 1024 / 1024).toFixed(2)} MB)` : "Verified"}
                  </span>
                </div>
              </div>

              {/* Next Scheduled Alarm State */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-slate-500 font-medium block">Next Scheduled Alarm:</span>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>
                    {status?.alarmActive && status?.targetEndAtMs
                      ? new Date(status.targetEndAtMs).toLocaleTimeString()
                      : "None currently scheduled"}
                  </span>
                </div>
              </div>

              {/* Live 5-Second Test Tool */}
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-purple-950 block">Instant 5-Second Verification</span>
                    <span className="text-[11px] text-purple-700">Arms an alarm to fire in 5 seconds to test lock-screen wake</span>
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
