import { db, generateUUID } from "./tasklertDb.js";
import { operationsRepository } from "./operationsRepository.js";

/**
 * Focus Session Repository
 * Tracks Pomodoro and Deep Work sessions locally for offline resilience.
 */
export const focusSessionRepository = {
  async saveSession(sessionData, userId) {
    if (!userId) {
      throw new Error("focusSessionRepository.saveSession requires a valid userId");
    }

    const now = new Date().toISOString();
    const localId = sessionData.localId || generateUUID();
    const isSynced = Boolean(sessionData.serverId || sessionData._id);

    const record = {
      localId,
      serverId: sessionData.serverId || sessionData._id || null,
      owner: String(userId),
      task: sessionData.task || sessionData.taskId || null,
      sessionType: sessionData.sessionType || "focus",
      plannedDuration: Number(sessionData.plannedDuration || 1500),
      actualElapsedSeconds: Number(sessionData.actualElapsedSeconds || 0),
      startedAt: sessionData.startedAt
        ? new Date(sessionData.startedAt).toISOString()
        : now,
      endedAt: sessionData.endedAt
        ? new Date(sessionData.endedAt).toISOString()
        : null,
      status: sessionData.status || "completed", // 'running', 'paused', 'completed', 'cancelled'
      syncStatus: isSynced ? "synced" : "created",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    return await db.transaction("rw", [db.focusSessions, db.operations], async () => {
      await db.focusSessions.put(record);

      if (!isSynced) {
        await operationsRepository.queueOperation(
          {
            entityType: "focusSession",
            action: "CREATE",
            localId,
            userId,
            payload: record,
          },
          db
        );
      }

      return record;
    });
  },

  async getSessions(userId, limit = 50) {
    if (!userId) return [];
    const ownerId = String(userId);
    const sessions = await db.focusSessions
      .where("owner")
      .equals(ownerId)
      .reverse()
      .sortBy("startedAt");

    return sessions.slice(0, limit);
  },

  async getActiveSession(userId) {
    if (!userId) return null;
    const ownerId = String(userId);
    return await db.focusSessions
      .where("[owner+status]")
      .equals([ownerId, "running"])
      .first();
  },
};

export default focusSessionRepository;
