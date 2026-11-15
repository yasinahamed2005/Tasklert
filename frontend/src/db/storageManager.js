import { db } from "./tasklertDb.js";

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Storage Manager
 * Handles browser storage quota estimation, persistent storage requests,
 * and safe non-destructive cleanup rules.
 */
export const storageManager = {
  /**
   * Get storage usage estimate from browser storage API.
   */
  async getStorageEstimate() {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageBytes = estimate.usage || 0;
        const quotaBytes = estimate.quota || 0;
        const percentUsed = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
        const isPersistent = await this.isPersistentStorageGranted();

        return {
          supported: true,
          usageBytes,
          quotaBytes,
          percentUsed: Number(percentUsed.toFixed(2)),
          formattedUsage: formatBytes(usageBytes),
          formattedQuota: formatBytes(quotaBytes),
          isPersistent,
        };
      } catch (err) {
        console.warn("Could not retrieve storage estimate:", err);
      }
    }

    return {
      supported: false,
      usageBytes: 0,
      quotaBytes: 0,
      percentUsed: 0,
      formattedUsage: "Unknown",
      formattedQuota: "Unknown",
      isPersistent: false,
    };
  },

  /**
   * Check if persistent storage is already granted.
   */
  async isPersistentStorageGranted() {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persisted) {
      try {
        return await navigator.storage.persisted();
      } catch (_) {}
    }
    return false;
  },

  /**
   * Request persistent storage permission from the browser.
   * Prevents browser from evicting IndexedDB under storage pressure.
   */
  async requestPersistentStorage() {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        return { success: true, granted };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "Persistent storage API not supported" };
  },

  /**
   * Check storage quota threshold and return warnings if critical.
   */
  async checkStorageThreshold() {
    const est = await this.getStorageEstimate();
    if (!est.supported) return { status: "normal", percentUsed: 0 };

    if (est.percentUsed >= 90) {
      return {
        status: "critical",
        percentUsed: est.percentUsed,
        warning: `Device storage is critically full (${est.percentUsed}% used). Consider cleaning up old synced tasks.`,
      };
    }

    if (est.percentUsed >= 80) {
      return {
        status: "warning",
        percentUsed: est.percentUsed,
        warning: `Device storage is reaching capacity (${est.percentUsed}% used).`,
      };
    }

    return { status: "normal", percentUsed: est.percentUsed };
  },

  /**
   * Safe, Non-Destructive Cleanup.
   *
   * STRICT RESILIENCE RULES:
   * 1. NEVER deletes unsynchronized user changes (syncStatus !== 'synced')!
   * 2. NEVER deletes active tasks or un-synced operations!
   * 3. Only purges soft-deleted records that have ALREADY been fully synced
   *    and are older than the specified retention window (default 30 days).
   */
  async cleanupOldSyncedEntries(userId, retentionDays = 30) {
    if (!userId) return { cleanedCount: 0 };

    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const ownerId = String(userId);

    return await db.transaction("rw", [db.tasks, db.projects, db.reminders], async () => {
      // Find eligible deleted tasks:
      // must be: owner === userId, isDeleted === true, syncStatus === 'synced', deletedAt < cutoffDate
      const deletedSyncedTasks = await db.tasks
        .where("owner")
        .equals(ownerId)
        .filter(
          (t) =>
            t.isDeleted === true &&
            t.syncStatus === "synced" &&
            t.deletedAt &&
            t.deletedAt < cutoffDate
        )
        .toArray();

      const taskIds = deletedSyncedTasks.map((t) => t.localId);
      if (taskIds.length > 0) {
        await db.tasks.bulkDelete(taskIds);
      }

      // Cleanup old synced deleted projects
      const deletedSyncedProjects = await db.projects
        .where("owner")
        .equals(ownerId)
        .filter(
          (p) =>
            p.isDeleted === true &&
            p.syncStatus === "synced" &&
            p.deletedAt &&
            p.deletedAt < cutoffDate
        )
        .toArray();

      const projectIds = deletedSyncedProjects.map((p) => p.localId);
      if (projectIds.length > 0) {
        await db.projects.bulkDelete(projectIds);
      }

      return {
        cleanedTasks: taskIds.length,
        cleanedProjects: projectIds.length,
        totalCleaned: taskIds.length + projectIds.length,
      };
    });
  },

  /**
   * Handle quota errors gracefully with actionable diagnostics.
   */
  handleQuotaError(error) {
    const isQuotaError =
      error &&
      (error.name === "QuotaExceededError" ||
        error.code === 22 ||
        error.number === -2147024882 ||
        error.message?.includes("quota"));

    if (isQuotaError) {
      return {
        isQuotaExceeded: true,
        userMessage:
          "Browser storage quota exceeded. Your offline changes could not be saved to local storage. Please free up space on your device.",
      };
    }

    return {
      isQuotaExceeded: false,
      userMessage: error?.message || "An unexpected database error occurred.",
    };
  },
};

export default storageManager;
