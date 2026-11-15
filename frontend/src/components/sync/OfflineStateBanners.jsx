import React, { useState, useEffect } from "react";
import {
  WifiOff,
  AlertTriangle,
  Lock,
  RefreshCw,
  HardDrive,
  Database,
  Plus,
  Zap,
  X,
} from "lucide-react";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { storageManager } from "../../db/storageManager";

/**
 * Offline and Sync Error Banners
 * Displays subtle, non-blocking contextual ribbons for connection state,
 * storage quotas, and expired sessions.
 */
export const OfflineStateBanners = ({ onOpenEmergencyMode, onCreateTask }) => {
  const { isOnline, pendingCount, lastError, isSyncing, syncNow } = useSyncStatus();

  const [storageWarning, setStorageWarning] = useState(null);
  const [dismissedOfflineBanner, setDismissedOfflineBanner] = useState(false);

  // Check browser storage health periodically
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const health = await storageManager.checkStorageHealth();
        if (!health.healthy) {
          setStorageWarning(health.warning || "Browser storage quota reached. Please free up space or clear old completed tasks.");
        } else {
          setStorageWarning(null);
        }
      } catch (_) {}
    };

    checkStorage();
    const interval = setInterval(checkStorage, 60000);
    return () => clearInterval(interval);
  }, []);

  // Reset dismissal if connection status changes
  useEffect(() => {
    if (isOnline) {
      setDismissedOfflineBanner(false);
    }
  }, [isOnline]);

  const isLoginExpired =
    lastError &&
    (lastError.toLowerCase().includes("expired") ||
      lastError.toLowerCase().includes("401") ||
      lastError.toLowerCase().includes("authentication"));

  return (
    <div className="w-full space-y-1.5 px-3 sm:px-5 md:px-6 pt-2 empty:hidden">
      {/* 1. STORAGE FULL ALERT */}
      {storageWarning && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-2.5 sm:p-3 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <HardDrive className="w-4 h-4 text-rose-600 shrink-0" />
            <p className="truncate">
              <span className="font-bold">Storage Full:</span> {storageWarning}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStorageWarning(null)}
            className="text-rose-500 hover:text-rose-700 p-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. LOGIN EXPIRED NOTICE */}
      {isLoginExpired && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-2.5 sm:p-3 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-4 h-4 text-rose-600 shrink-0" />
            <p>
              <span className="font-bold">Login Expired:</span> Your session has expired. Please reconnect to the internet and sign in.
            </p>
          </div>
        </div>
      )}

      {/* 3. SYNC FAILURE RETRY NOTICE (When online but sync failed) */}
      {isOnline && lastError && !isLoginExpired && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 sm:p-3 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="truncate">
              <span className="font-bold">Unable to sync – will retry automatically:</span>{" "}
              {lastError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 font-bold rounded-lg text-xs transition cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isSyncing ? "Retrying..." : "Retry Now"}
          </button>
        </div>
      )}

      {/* 4. OFFLINE MODE BANNER (Compact, non-blocking) */}
      {!isOnline && !dismissedOfflineBanner && (
        <div className="bg-amber-50/90 border border-amber-200 text-amber-900 rounded-xl p-2.5 sm:p-3 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="truncate">
              <span className="font-bold">You're offline.</span> Changes are saved locally and will automatically sync when connection returns.
              {pendingCount > 0 && (
                <span className="ml-1.5 font-semibold text-amber-700">
                  ({pendingCount} unsynced {pendingCount === 1 ? "change" : "changes"})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenEmergencyMode && (
              <button
                type="button"
                onClick={onOpenEmergencyMode}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>Emergency Mode</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDismissedOfflineBanner(true)}
              aria-label="Dismiss offline banner"
              className="p-1 text-amber-600 hover:text-amber-800 rounded transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Empty State for cached tasks when offline
 */
export const EmptyCachedTasksState = ({ onCreateTask }) => {
  return (
    <div className="py-16 px-4 bg-white rounded-3xl border border-purple-100 p-6 text-center max-w-md mx-auto shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mx-auto mb-3">
        <WifiOff className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-800">No Cached Tasks on This Device</h3>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
        You are currently offline. Tasks previously viewed on this device are available offline, or you can create a new task right now.
      </p>
      {onCreateTask && (
        <button
          type="button"
          onClick={onCreateTask}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Task Offline</span>
        </button>
      )}
    </div>
  );
};

export default OfflineStateBanners;
