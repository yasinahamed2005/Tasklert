import React, { useState, useRef, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Cloud,
  Zap,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSyncStatus } from "../../hooks/useSyncStatus";

export const SyncStatusIndicator = ({ onOpenEmergencyMode }) => {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    conflictsCount,
    lastError,
    lastSyncedAt,
    syncNow,
  } = useSyncStatus();

  const [isOpen, setIsOpen] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);
  const containerRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    if (!isOnline) {
      toast.info("You are offline. Connect to the internet to synchronize.");
      return;
    }

    setSyncFeedback("Syncing with server...");
    try {
      const res = await syncNow();
      if (res.status === "already_running") {
        setSyncFeedback("Sync already in progress...");
      } else if (res.status === "offline") {
        setSyncFeedback("Cannot sync while offline.");
      } else if (res.status === "unauthenticated") {
        setSyncFeedback("Authentication expired. Please log in.");
        toast.error("Please sign in to sync changes.");
      } else {
        setSyncFeedback("All changes synced successfully!");
        toast.success("All changes synced with server!");
        setTimeout(() => setSyncFeedback(null), 3000);
      }
    } catch (err) {
      setSyncFeedback("Sync failed. Will retry automatically.");
      toast.error(err.message || "Sync failed. Will retry automatically.");
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const formatLastSync = (date) => {
    if (!date) return "Never";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Recently";
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 15) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Determine appearance state
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200/90";
  let label = "All changes saved";
  let Icon = CheckCircle2;

  if (!isOnline) {
    badgeStyle = "bg-amber-50 text-amber-800 border-amber-200/90";
    label = pendingCount > 0 ? `Offline Mode (${pendingCount})` : "Offline Mode";
    Icon = WifiOff;
  } else if (isSyncing) {
    badgeStyle = "bg-purple-50 text-purple-700 border-purple-200/90";
    label = "Syncing...";
    Icon = RefreshCw;
  } else if (conflictsCount > 0) {
    badgeStyle = "bg-orange-50 text-orange-700 border-orange-200/90";
    label = "Conflict requires attention";
    Icon = AlertTriangle;
  } else if (lastError) {
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200/90";
    label = "Unable to sync – will retry";
    Icon = AlertCircle;
  } else if (pendingCount > 0) {
    badgeStyle = "bg-amber-50 text-amber-800 border-amber-200/90";
    label = `${pendingCount} ${pendingCount === 1 ? "change" : "changes"} waiting`;
    Icon = Cloud;
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Connection and Sync status: ${label}`}
        title={`Connection: ${isOnline ? "Online" : "Offline"} • ${label}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${badgeStyle}`}
      >
        <Icon
          className={`w-3.5 h-3.5 shrink-0 ${
            isSyncing ? "animate-spin text-purple-600" : ""
          }`}
        />
        <span className="hidden sm:inline font-medium truncate max-w-[130px] lg:max-w-[180px]">
          {label}
        </span>
        <span className="sm:hidden font-medium">
          {!isOnline ? "Offline" : isSyncing ? "Syncing" : pendingCount > 0 ? `${pendingCount}` : "Saved"}
        </span>
        <ChevronDown
          className={`w-3 h-3 opacity-60 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Detail Popover */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-purple-100 p-4 z-50 text-slate-800 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-purple-50">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isOnline ? "Online Connected" : "Offline Mode"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Synced: {formatLastSync(lastSyncedAt)}
            </span>
          </div>

          {/* Status Breakdown */}
          <div className="py-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Unsynced Local Changes</span>
              <span
                className={`font-mono font-bold px-1.5 py-0.5 rounded-md ${
                  pendingCount > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {pendingCount}
              </span>
            </div>

            {conflictsCount > 0 && (
              <div className="flex items-center justify-between text-orange-700 bg-orange-50 p-2 rounded-xl">
                <span className="flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Conflicts
                </span>
                <span className="font-bold">{conflictsCount}</span>
              </div>
            )}

            {lastError && (
              <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-xl leading-relaxed">
                {lastError}
              </div>
            )}

            {syncFeedback && (
              <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded-xl font-medium">
                {syncFeedback}
              </div>
            )}

            {!isOnline && (
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                All edits are safely stored in your browser database. They will automatically sync when your internet connection is restored.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-purple-50 space-y-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing in Progress..." : "Sync Now"}</span>
            </button>

            {onOpenEmergencyMode && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEmergencyMode();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100/80 text-purple-700 font-semibold text-xs border border-purple-100 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-purple-600" />
                <span>Open Emergency Mode</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
