import axios from "axios";
import { db, getDeviceId } from "../db/tasklertDb.js";
import { operationsRepository } from "../db/operationsRepository.js";
import { taskRepository } from "../db/taskRepository.js";
import { projectRepository } from "../db/projectRepository.js";
import { reminderRepository } from "../db/reminderRepository.js";
import { accountManager } from "../db/accountManager.js";
import { API_BASE_URL } from "../config/api";
import { notify } from "../utils/toastManager.js";

const API_BASE = API_BASE_URL;

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.lastSyncedAt = null;
    this.syncError = null;
    this.subscribers = new Set();
    this.debounceTimer = null;
    this.retryTimer = null;
    this.retryCount = 0;
    this.isInitialized = false;

    // Track conflict items
    this.activeConflicts = [];
  }

  /**
   * Initialize sync engine listeners and auto-triggers
   */
  init() {
    if (this.isInitialized || typeof window === "undefined") return;

    // 1. Listen for connectivity restoration
    window.addEventListener("online", () => {
      this.retryCount = 0;
      this.scheduleSync(500);
    });

    // 2. Listen for tab / app visibility
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.scheduleSync(1000);
      }
    });

    // 3. Listen for window focus (returning to app)
    window.addEventListener("focus", () => {
      this.scheduleSync(1500);
    });

    // 4. Listen for Service Worker background sync triggers
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "TASKLERT_TRIGGER_SYNC") {
          this.scheduleSync(100);
        }
      });
    }

    // 5. Register Background Sync if supported
    this.registerBackgroundSync();

    // 6. Recover any interrupted sync operations from prior session crash
    const activeUid = accountManager.getActiveUserId();
    if (activeUid) {
      operationsRepository.resetInterruptedProcessingOperations(activeUid).catch(() => {});
    }

    this.isInitialized = true;
    this.loadLastSyncMetadata().then(() => this.notify());
  }

  /**
   * Stop all active synchronization triggers, timers, and background retries
   * (Invoked securely upon user logout)
   */
  stop() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.isSyncing = false;
    this.retryCount = 0;
  }

  /**
   * Attempt to register Background Sync with Service Worker
   */
  async registerBackgroundSync() {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "SyncManager" in window
    ) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg?.sync) {
          await reg.sync.register("tasklert-sync");
        }
      } catch (_) {
        // Fallback to foreground triggers
      }
    }
  }

  /**
   * Load last synced timestamp from IndexedDB metadata
   */
  async loadLastSyncMetadata() {
    try {
      const meta = await db.metadata.get("last_sync_timestamp");
      if (meta && meta.timestamp) {
        this.lastSyncedAt = new Date(meta.timestamp);
      }
    } catch (_) {}
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getStatus());
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers with updated status
   */
  async notify() {
    const status = await this.getStatus();
    this.subscribers.forEach((cb) => {
      try {
        cb(status);
      } catch (_) {}
    });
  }

  /**
   * Get current synchronization status
   */
  async getStatus() {
    const userId = accountManager.getActiveUserId();
    const pendingCount = userId
      ? await operationsRepository.getPendingCount(userId)
      : 0;

    return {
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      pendingCount,
      conflictsCount: this.activeConflicts.length,
      conflicts: this.activeConflicts,
      lastError: this.syncError,
    };
  }

  /**
   * Debounced sync trigger
   */
  scheduleSync(delayMs = 1000) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.syncNow().catch(() => {});
    }, delayMs);
  }

  /**
   * Manual / programmatic sync execution
   */
  async syncNow() {
    if (this.isSyncing) return { status: "already_running" };

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const userId = accountManager.getActiveUserId();

    if (!token || !userId) {
      return { status: "unauthenticated" };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { status: "offline" };
    }

    // Validate the device session before touching the existing offline operation queue.
    try {
      await axios.get(`${API_BASE}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      if ([401, 403].includes(err.response?.status)) {
        this.syncError = "This device session is no longer active. Sign in again to sync.";
        if (err.response?.data?.code === "SESSION_REVOKED") {
          window.dispatchEvent(new CustomEvent("tasklert:session-revoked"));
        }
        await this.notify();
        return { status: "session_revoked" };
      }
      return { status: "validation_unavailable" };
    }

    this.isSyncing = true;
    this.syncError = null;
    await this.notify();

    try {
      // 1. PUSH: Send pending local changes to backend
      const pushResults = await this.executePushPhase(token, userId);

      // 2. PULL: Fetch server updates since last sync cursor
      const pullResults = await this.executePullPhase(token, userId);

      // 3. Update sync timestamps
      const now = new Date();
      this.lastSyncedAt = now;
      this.retryCount = 0;

      await db.metadata.put({
        key: "last_sync_timestamp",
        userId,
        timestamp: now.toISOString(),
        updatedAt: now.toISOString(),
      });

      this.isSyncing = false;
      await this.notify();

      return {
        success: true,
        push: pushResults,
        pull: pullResults,
      };
    } catch (err) {
      console.warn("Sync execution failed:", err);
      this.isSyncing = false;
      this.handleSyncError(err);
      await this.notify();
      return { success: false, error: err.message };
    }
  }

  /**
   * PUSH PHASE: Process pending local operations
   * Batches operations in chunks of 20 with 100ms pause and 429 rate limit backoff
   */
  async executePushPhase(token, userId) {
    const pendingOps = await operationsRepository.getPendingOperations(userId);
    if (!pendingOps || pendingOps.length === 0) {
      return { processedCount: 0 };
    }

    const deviceId = getDeviceId();
    const CHUNK_SIZE = 20;
    let totalProcessed = 0;

    for (let i = 0; i < pendingOps.length; i += CHUNK_SIZE) {
      const chunk = pendingOps.slice(i, i + CHUNK_SIZE);
      let success = false;
      let attempts = 0;

      while (!success && attempts < 3) {
        attempts++;
        try {
          const { data } = await axios.post(
            `${API_BASE}/api/sync/push`,
            { deviceId, operations: chunk },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (data.success && Array.isArray(data.results)) {
            for (const res of data.results) {
              const matchingOp = chunk.find((o) => o.operationId === res.operationId || o.id === res.operationId);
              const opId = matchingOp ? matchingOp.id : res.operationId;
              const localId = res.localId || matchingOp?.localId;

              if (res.status === "applied" || res.status === "already_processed") {
                // Update local entity with serverId and synced status
                if (localId) {
                  if (matchingOp?.entityType === "task") {
                    const task = await db.tasks.get(localId);
                    if (task) {
                      await db.tasks.update(localId, {
                        serverId: res.serverId || task.serverId,
                        syncStatus: "synced",
                        version: res.version || task.version,
                        updatedAt: res.updatedAt || new Date().toISOString(),
                      });
                    }
                  } else if (matchingOp?.entityType === "project") {
                    const proj = await db.projects.get(localId);
                    if (proj) {
                      await db.projects.update(localId, {
                        serverId: res.serverId || proj.serverId,
                        syncStatus: "synced",
                        version: res.version || proj.version,
                      });
                    }
                  } else if (matchingOp?.entityType === "reminder") {
                    const rem = await db.reminders.get(localId);
                    if (rem) {
                      await db.reminders.update(localId, {
                        serverId: res.serverId || rem.serverId,
                        syncStatus: "synced",
                      });
                    }
                  }
                }

                await operationsRepository.markOperationCompleted(opId);
              } else if (res.status === "conflict") {
                // Version conflict handling
                await this.handleConflict(res, matchingOp, userId);
                await operationsRepository.markOperationCompleted(opId);
              } else if (res.status === "rejected") {
                // Permanent validation or rejected error: do not retry indefinitely
                await operationsRepository.markOperationFailed(opId, res.message || "Rejected by server");
              }
            }
          }

          success = true;
          totalProcessed += chunk.length;
        } catch (err) {
          if (err.response?.status === 429) {
            notify.info("Syncing slowly to respect rate limits...", { toastId: "sync-rate-limit" });
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            throw err;
          }
        }
      }

      // Small 100ms pause between chunks to keep request rates smooth
      if (i + CHUNK_SIZE < pendingOps.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return { processedCount: totalProcessed };
  }

  /**
   * PULL PHASE: Retrieve changes from server since last cursor
   */
  async executePullPhase(token, userId) {
    const meta = await db.metadata.get("last_sync_timestamp");
    const since = meta?.timestamp ? encodeURIComponent(meta.timestamp) : "";
    const url = since
      ? `${API_BASE}/api/sync/pull?since=${since}&limit=100`
      : `${API_BASE}/api/sync/pull?limit=100`;

    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (data.success && data.changes) {
      const { tasks = [], projects = [], reminders = [], deleted = {} } = data.changes;

      // 1. Bulk upsert server changes into local database
      if (tasks.length > 0) {
        await taskRepository.bulkUpsertFromServer(tasks, userId);
      }
      if (projects.length > 0) {
        await projectRepository.bulkUpsertFromServer(projects, userId);
      }
      if (reminders.length > 0) {
        await reminderRepository.bulkUpsertFromServer(reminders, userId);
      }

      // 2. Handle server deletions locally
      if (Array.isArray(deleted.tasks) && deleted.tasks.length > 0) {
        for (const sId of deleted.tasks) {
          const local = await db.tasks.where("serverId").equals(String(sId)).first();
          if (local && local.syncStatus === "synced") {
            await db.tasks.delete(local.localId);
          }
        }
      }

      if (Array.isArray(deleted.projects) && deleted.projects.length > 0) {
        for (const sId of deleted.projects) {
          const local = await db.projects.where("serverId").equals(String(sId)).first();
          if (local && local.syncStatus === "synced") {
            await db.projects.delete(local.localId);
          }
        }
      }
    }

    return { success: true };
  }

  /**
   * Conflict Resolution Strategy
   * Preserves conflict snapshot in metadata, merges non-conflicting fields,
   * and prevents silent data loss.
   */
  async handleConflict(conflictResult, operation, userId) {
    const { localId, serverEntity, message } = conflictResult;

    // Record conflict snapshot in metadata
    await db.metadata.put({
      key: `conflict_${localId}`,
      userId,
      conflictData: {
        localId,
        serverEntity,
        operationPayload: operation?.payload,
        detectedAt: new Date().toISOString(),
        message,
      },
      updatedAt: new Date().toISOString(),
    });

    this.activeConflicts.push({
      localId,
      serverEntity,
      clientEntity: operation?.payload,
      detectedAt: new Date(),
    });

    // Strategy: Intelligent field merge with server fallback
    if (serverEntity && localId) {
      const localTask = await db.tasks.get(localId);
      if (localTask) {
        await db.tasks.update(localId, {
          serverId: String(serverEntity._id),
          version: serverEntity.version || localTask.version + 1,
          syncStatus: "synced",
          // Retain server's authoritative state while storing conflict for user inspection
          title: serverEntity.title || localTask.title,
          completed: serverEntity.completed !== undefined ? serverEntity.completed : localTask.completed,
          updatedAt: serverEntity.updatedAt || new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Error & Retry Management: Exponential Backoff with Jitter
   */
  handleSyncError(err) {
    this.syncError = err.message || "Sync failed";

    // 401/403: Authentication expired -> Pause and require login
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.warn("🔐 Sync authentication expired -> Pausing retry");
      this.syncError = "Authentication expired. Please log in again.";
      return;
    }

    // Network or 5xx server error: Schedule exponential backoff with jitter
    this.retryCount += 1;
    if (this.retryCount <= 5) {
      const baseDelay = 1000 * Math.pow(2, this.retryCount);
      const jitter = Math.random() * 1000;
      const delayMs = Math.min(60000, baseDelay + jitter);

      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.syncNow().catch(() => {});
      }, delayMs);
    }
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
