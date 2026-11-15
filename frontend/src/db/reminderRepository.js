import { db, generateUUID } from "./tasklertDb.js";
import { operationsRepository } from "./operationsRepository.js";

/**
 * Reminder Repository
 * Stores reminder metadata and schedules locally for offline viewing and scheduling.
 * (Note: Browser-based background timers and Service Worker alarms operate on best-effort
 * availability; exact wake-lock alarm delivery requires native platform integration).
 */
export const reminderRepository = {
  /**
   * Get all reminders for a user with optional filtering.
   */
  async getReminders(userId, filter = {}) {
    if (!userId) return [];
    const ownerId = String(userId);

    let reminders = await db.reminders.where("owner").equals(ownerId).toArray();

    return reminders.filter((rem) => {
      if (filter.status && rem.status !== filter.status) return false;
      if (filter.taskId && String(rem.task) !== String(filter.taskId)) return false;
      if (filter.alarmEnabled !== undefined && rem.alarmEnabled !== filter.alarmEnabled) return false;
      if (filter.scheduledBefore && new Date(rem.scheduledAt) > new Date(filter.scheduledBefore)) return false;
      if (filter.scheduledAfter && new Date(rem.scheduledAt) < new Date(filter.scheduledAfter)) return false;
      return true;
    }).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  },

  /**
   * Get single reminder by localId or serverId.
   */
  async getReminderById(id, userId) {
    if (!id || !userId) return null;
    const targetId = String(id);
    const ownerId = String(userId);

    let r = await db.reminders.get(targetId);
    if (r && String(r.owner) === ownerId) return r;

    r = await db.reminders.where("serverId").equals(targetId).first();
    if (r && String(r.owner) === ownerId) return r;

    return null;
  },

  /**
   * Save or create reminder metadata locally.
   */
  async saveReminder(reminderData, userId) {
    if (!userId) {
      throw new Error("reminderRepository.saveReminder requires a valid userId");
    }

    const now = new Date().toISOString();
    const localId = reminderData.localId || generateUUID();
    const isSynced = Boolean(reminderData.serverId || reminderData._id);

    const reminderRecord = {
      localId,
      serverId: reminderData.serverId || reminderData._id || null,
      owner: String(userId),
      task: reminderData.task || reminderData.taskId || null,
      title: reminderData.title?.trim() || "Reminder",
      message: reminderData.message || "",
      notes: reminderData.notes || "",
      scheduledDate: reminderData.scheduledDate || "",
      scheduledTime: reminderData.scheduledTime || "",
      scheduledAt: reminderData.scheduledAt
        ? new Date(reminderData.scheduledAt).toISOString()
        : now,
      timeZone: reminderData.timeZone || "UTC",
      alarmEnabled: reminderData.alarmEnabled !== false,
      notificationEnabled: reminderData.notificationEnabled !== false,
      vibrationEnabled: reminderData.vibrationEnabled !== false,
      soundName: reminderData.soundName || "digital",
      volume: reminderData.volume ?? 80,
      priority: reminderData.priority || "Medium",
      status: reminderData.status || "scheduled", // 'scheduled', 'dismissed', 'snoozed'
      syncStatus: isSynced ? "synced" : "created",
      version: 1,
      createdAt: reminderData.createdAt
        ? new Date(reminderData.createdAt).toISOString()
        : now,
      updatedAt: reminderData.updatedAt
        ? new Date(reminderData.updatedAt).toISOString()
        : now,
    };

    return await db.transaction("rw", [db.reminders, db.operations], async () => {
      await db.reminders.put(reminderRecord);

      if (!isSynced) {
        await operationsRepository.queueOperation(
          {
            entityType: "reminder",
            action: "CREATE",
            localId,
            userId,
            payload: reminderRecord,
          },
          db
        );
      }

      return reminderRecord;
    });
  },

  /**
   * Dismiss a reminder locally.
   */
  async dismissReminder(id, userId) {
    if (!id || !userId) return null;
    const rem = await this.getReminderById(id, userId);
    if (!rem) return null;

    const now = new Date().toISOString();
    const updated = {
      ...rem,
      status: "dismissed",
      syncStatus: rem.syncStatus === "created" ? "created" : "updated",
      updatedAt: now,
      version: (rem.version || 1) + 1,
    };

    return await db.transaction("rw", [db.reminders, db.operations], async () => {
      await db.reminders.put(updated);
      await operationsRepository.queueOperation(
        {
          entityType: "reminder",
          action: "UPDATE",
          localId: rem.localId,
          userId,
          payload: updated,
        },
        db
      );
      return updated;
    });
  },

  /**
   * Delete a reminder locally.
   */
  async deleteReminder(id, userId) {
    if (!id || !userId) return false;
    const rem = await this.getReminderById(id, userId);
    if (!rem) return false;

    return await db.transaction("rw", [db.reminders, db.operations], async () => {
      await db.reminders.delete(rem.localId);
      await operationsRepository.queueOperation(
        {
          entityType: "reminder",
          action: "DELETE",
          localId: rem.localId,
          userId,
          payload: { localId: rem.localId, serverId: rem.serverId },
        },
        db
      );
      return true;
    });
  },

  /**
   * Bulk cache server reminders.
   */
  async bulkUpsertFromServer(serverReminders, userId) {
    if (!Array.isArray(serverReminders) || !userId) return [];
    const ownerId = String(userId);

    return await db.transaction("rw", [db.reminders], async () => {
      const existing = await db.reminders.where("owner").equals(ownerId).toArray();
      const sMap = new Map();
      existing.forEach((r) => {
        if (r.serverId) sMap.set(String(r.serverId), r);
      });

      const records = [];
      for (const sr of serverReminders) {
        const sId = String(sr._id || sr.serverId || "");
        if (!sId) continue;

        const local = sMap.get(sId);
        if (local && local.syncStatus !== "synced") continue;

        const localId = local ? local.localId : generateUUID();
        records.push({
          localId,
          serverId: sId,
          owner: ownerId,
          task: sr.task ? (sr.task._id || sr.task) : null,
          title: sr.title || "Reminder",
          message: sr.message || "",
          notes: sr.notes || "",
          scheduledDate: sr.scheduledDate || "",
          scheduledTime: sr.scheduledTime || "",
          scheduledAt: sr.scheduledAt ? new Date(sr.scheduledAt).toISOString() : new Date().toISOString(),
          timeZone: sr.timeZone || "UTC",
          alarmEnabled: sr.alarmEnabled !== false,
          notificationEnabled: sr.notificationEnabled !== false,
          vibrationEnabled: sr.vibrationEnabled !== false,
          soundName: sr.soundName || "digital",
          volume: sr.volume ?? 80,
          priority: sr.priority || "Medium",
          status: sr.status || "scheduled",
          syncStatus: "synced",
          version: sr.version || 1,
          createdAt: sr.createdAt ? new Date(sr.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: sr.updatedAt ? new Date(sr.updatedAt).toISOString() : new Date().toISOString(),
        });
      }

      if (records.length > 0) {
        await db.reminders.bulkPut(records);
      }
      return records;
    });
  },
};

export default reminderRepository;
