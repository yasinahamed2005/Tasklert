import React, { useState } from "react";
import {
  X,
  Sliders,
  Volume2,
  Bell,
  Smartphone,
  Zap,
  Repeat,
  CheckCircle,
  RotateCcw,
} from "lucide-react";

export const FocusSettingsModal = ({
  isOpen = false,
  onClose,
  settings,
  onSaveSettings,
  onOpenRingtonePicker,
  notificationPermission = "default",
  onRequestNotificationPermission,
}) => {
  const [formData, setFormData] = useState({ ...settings });

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSaveSettings(formData);
    onClose();
  };

  const handleResetDefaults = () => {
    const defaults = {
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      cyclesBeforeLongBreak: 4,
      alarmSound: "chime",
      alarmVolume: 80,
      autoStartNext: true,
      screenWakeLock: true,
      vibration: true,
      flashlightBlink: false,
    };
    setFormData(defaults);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-blue-100 flex flex-col overflow-hidden max-h-[90vh] animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50 bg-blue-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Focus & Alarm Preferences
              </h3>
              <p className="text-xs text-slate-500">
                Customize durations, alerts, native device triggers, and ringtones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-left">
          {/* Section 1: Timer Durations */}
          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Interval Durations (Minutes)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Focus Session
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={formData.focusDuration}
                    onChange={(e) =>
                      handleChange("focusDuration", Math.max(1, Number(e.target.value)))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-400">min</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Short Break
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formData.shortBreakDuration}
                    onChange={(e) =>
                      handleChange("shortBreakDuration", Math.max(1, Number(e.target.value)))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-400">min</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Long Break
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formData.longBreakDuration}
                    onChange={(e) =>
                      handleChange("longBreakDuration", Math.max(1, Number(e.target.value)))
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-400">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Pomodoro Cycles */}
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Pomodoro Cycle Target
            </span>
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Cycles Before Long Break
                </p>
                <p className="text-[10px] text-slate-500">
                  Default: 4 focus sessions before an extended long break
                </p>
              </div>
              <select
                value={formData.cyclesBeforeLongBreak || 4}
                onChange={(e) => handleChange("cyclesBeforeLongBreak", Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-xs text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2}>2 cycles</option>
                <option value={3}>3 cycles</option>
                <option value={4}>4 cycles</option>
                <option value={5}>5 cycles</option>
                <option value={6}>6 cycles</option>
              </select>
            </div>
          </div>

          {/* Section 3: Alarm Sound & Volume */}
          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Completion Tone & Audio
            </span>
            <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Selected Ringtone</p>
                <p className="text-[10px] text-slate-500">
                  Preset sounds or custom music file from device
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenRingtonePicker}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                Change Ringtone
              </button>
            </div>
          </div>

          {/* Section 4: Device & Screen Triggers */}
          <div className="space-y-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
              Device Triggers & Automation
            </span>

            {/* Screen Wake Lock */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Screen Wake Lock
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Keep display awake while focus timer is actively running
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.screenWakeLock)}
                onChange={(e) => handleChange("screenWakeLock", e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-blue-600"
              />
            </div>

            {/* Vibration */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Device Vibration
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Rhythmic pulse vibration on completion
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.vibration)}
                onChange={(e) => handleChange("vibration", e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-blue-600"
              />
            </div>

            {/* Flashlight Blink */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Flashlight Blink
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Flash screen / light on completion
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.flashlightBlink)}
                onChange={(e) => handleChange("flashlightBlink", e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-blue-600"
              />
            </div>

            {/* Auto Start Next */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-2.5">
                <Repeat className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Auto-Start Next Session
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Automatically trigger break after focus without manual taps
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(formData.autoStartNext)}
                onChange={(e) => handleChange("autoStartNext", e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Section 5: Notifications Permission status */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Notification Status
                </p>
                <p className="text-[10px] text-slate-500">
                  {notificationPermission === "granted"
                    ? "Active: background alarm notifications enabled"
                    : "Action required: enable to ring when screen is off"}
                </p>
              </div>
            </div>

            {notificationPermission === "granted" ? (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Granted
              </span>
            ) : (
              <button
                type="button"
                onClick={onRequestNotificationPermission}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Enable Alerts
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition active:scale-95 cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusSettingsModal;