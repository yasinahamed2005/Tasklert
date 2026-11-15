import { useState, useEffect, useCallback } from "react";
import { syncEngine } from "../services/syncEngine";

/**
 * React hook to observe offline sync status, online/offline connectivity,
 * pending queue count, and trigger manual syncs.
 */
export const useSyncStatus = () => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [status, setStatus] = useState({
    isSyncing: syncEngine.isSyncing,
    lastSyncedAt: syncEngine.lastSyncedAt,
    pendingCount: 0,
    conflictsCount: syncEngine.activeConflicts.length,
    lastError: syncEngine.syncError,
  });

  useEffect(() => {
    syncEngine.init();

    const updateOnlineStatus = () => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      setIsOnline(online);
      if (online) {
        syncEngine.scheduleSync(500);
      }
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    const unsubscribe = syncEngine.subscribe((newStatus) => {
      setStatus((prev) => ({
        ...prev,
        ...newStatus,
      }));
    });

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async () => {
    return await syncEngine.syncNow();
  }, []);

  return {
    isOnline,
    ...status,
    syncNow,
  };
};

export default useSyncStatus;
