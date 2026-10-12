import React from "react";
import DeviceNotificationSettings from "../components/DeviceNotificationSettings";
import { Bell, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AlarmSettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-6 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-purple-600 transition-colors bg-white px-3.5 py-1.5 rounded-lg border border-slate-200/80 shadow-xs hover:border-purple-200 self-start"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-100/70 text-purple-700 border border-purple-200/60 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Multi-Device Sync Ready
          </div>
        </div>

        {/* Page Title */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100/80 text-purple-600">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                Alarms & Device Notifications
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Manage your real-time push alerts, Web Audio tones, snooze durations, and quiet hours.
              </p>
            </div>
          </div>
        </div>

        {/* Main Settings Panel */}
        <DeviceNotificationSettings />
      </div>
    </div>
  );
};

export default AlarmSettingsPage;
