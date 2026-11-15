import { db, generateUUID, getDeviceId } from "./tasklertDb.js";

/**
 * Operations Repository
 * Manages the offline mutation queue for Phase 3 background synchronization.
 * Every offline CREATE, UPDATE, or DELETE generates an idempotent operation record.
 */
export const operationsRepository = {
  /**
   * Queue a new offline operation (can be executed within an existing Dexie transaction)
   */
  async queueOperation(
    { entityType, action, localId, userId, payload },
    customTx = null
  ) {
    if (!userId) {
      throw new Error("Cannot queue operation without a valid userId");
    }

    const opId = generateUUID();
    const opRecord = {
      id: opId,
      operationId: opId,
      entityId: String(localId),
      localId: String(localId),
      entityType, // 'task' | 'project' | 'reminder' | 'focusSession'
      action, // 'CREATE' | 'UPDATE' | 'DELETE'
      userId: String(userId),
      deviceId: getDeviceId(),
      status: "pending", // 'pending' | 'processing' | 'failed' | 'completed'
      retryCount: 0,
      createdAt: new Date().toISOString(),
      payload: payload || null,
    };

    const targetStore = customTx ? customTx.table("operations") : db.operations;
    await targetStore.put(opRecord);
    return opRecord;
  },

  /**
   * Get all pending operations for a specific user, ordered by creation time
   */
  async getPendingOperations(userId) {
    if (!userId) return [];
    return await db.operations
      .where("[userId+status]")
      .equals([String(userId), "pending"])
      .sortBy("createdAt");
  },

  /**
   * Count how many operations are currently queued for a user
   */
  async getPendingCount(userId) {
    if (!userId) return 0;
    return await db.operations
      .where("[userId+status]")
      .equals([String(userId), "pending"])
      .count();
  },

  /**
   * Mark an operation as completed
   */
  async markOperationCompleted(opId) {
    return await db.operations.update(opId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  },

  /**
   * Mark an operation as failed with error details and increment retryCount
   */
  async markOperationFailed(opId, errorMessage) {
    const op = await db.operations.get(opId);
    if (!op) return;

    return await db.operations.update(opId, {
      status: op.retryCount >= 5 ? "failed" : "pending",
      retryCount: (op.retryCount || 0) + 1,
      lastError: errorMessage || "Unknown error",
      lastAttemptAt: new Date().toISOString(),
    });
  },

  /**
   * Reset interrupted operations that were left in 'processing' status
   * (e.g. from browser crash, tab close, or power loss midway through sync push)
   */
  async resetInterruptedProcessingOperations(userId) {
    if (!userId) return 0;
    const processing = await db.operations
      .where("[userId+status]")
      .equals([String(userId), "processing"])
      .toArray();

    for (const op of processing) {
      await db.operations.update(op.id, {
        status: "pending",
        lastError: "Recovered from interrupted sync session",
      });
    }

    return processing.length;
  },

  /**
   * Get all permanently failed operations (Dead-Letter inspection)
   */
  async getFailedOperations(userId) {
    if (!userId) return [];
    return await db.operations
      .where("[userId+status]")
      .equals([String(userId), "failed"])
      .sortBy("createdAt");
  },

  /**
   * Reset a failed operation back to 'pending' to allow manual retry
   */
  async retryFailedOperation(opId) {
    return await db.operations.update(opId, {
      status: "pending",
      retryCount: 0,
      lastError: null,
    });
  },

  /**
   * Reset all failed operations back to 'pending' for a user
   */
  async retryAllFailedOperations(userId) {
    if (!userId) return 0;
    const failed = await this.getFailedOperations(userId);
    for (const op of failed) {
      await this.retryFailedOperation(op.id);
    }
    return failed.length;
  },

  /**
   * Clean up old completed operations for a user
   */
  async clearCompletedOperations(userId) {
    if (!userId) return 0;
    const completed = await db.operations
      .where("[userId+status]")
      .equals([String(userId), "completed"])
      .toArray();

    const ids = completed.map((c) => c.id);
    if (ids.length > 0) {
      await db.operations.bulkDelete(ids);
    }
    return ids.length;
  },
};

export default operationsRepository;
