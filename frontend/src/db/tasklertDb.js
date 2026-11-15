import Dexie from "dexie";

/**
 * Tasklert RFC4122 v4 UUID generator
 */
export const generateUUID = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Get or initialize persistent client device ID
 */
export const getDeviceId = () => {
  const DEVICE_KEY = "tasklert_device_id";
  if (typeof window === "undefined" || !window.localStorage) {
    return "server-env-device-id";
  }
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = `dev_${generateUUID().replace(/-/g, "").slice(0, 16)}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
};

/**
 * Tasklert Modular IndexedDB Database (Dexie.js)
 * Object stores:
 *  - tasks: Offline-first task store with full schema preservation
 *  - projects: Offline-first projects
 *  - reminders: Local reminder metadata & schedule tracking
 *  - focusSessions: Offline Pomodoro & deep work sessions
 *  - operations: Offline transactional sync queue (CREATE, UPDATE, DELETE)
 *  - metadata: Device info, storage metrics, account contexts
 *  - attachments: Offline file blobs and metadata
 */
export class TasklertDatabase extends Dexie {
  constructor(databaseName = "TasklertResilienceDB") {
    super(databaseName);

    this.version(1).stores({
      tasks:
        "localId, serverId, owner, project, syncStatus, dueDate, reminderAt, updatedAt, createdAt, [owner+syncStatus], [owner+project]",
      projects:
        "localId, serverId, owner, name, syncStatus, updatedAt, [owner+name], [owner+syncStatus]",
      reminders:
        "localId, serverId, owner, task, status, scheduledAt, syncStatus, updatedAt, [owner+status], [owner+scheduledAt]",
      focusSessions:
        "localId, serverId, owner, task, sessionType, status, startedAt, syncStatus, updatedAt, [owner+status]",
      operations:
        "id, localId, entityType, action, userId, status, createdAt, [userId+status]",
      metadata: "key, userId, updatedAt",
      attachments: "id, localId, taskId, name, fileType, createdAt",
    });

    // Version 2: Schema evolution with migration upgrade handler
    this.version(2)
      .stores({
        tasks:
          "localId, serverId, owner, project, syncStatus, dueDate, reminderAt, updatedAt, createdAt, [owner+syncStatus], [owner+project]",
        projects:
          "localId, serverId, owner, name, syncStatus, updatedAt, [owner+name], [owner+syncStatus]",
        reminders:
          "localId, serverId, owner, task, status, scheduledAt, syncStatus, updatedAt, [owner+status], [owner+scheduledAt]",
        focusSessions:
          "localId, serverId, owner, task, sessionType, status, startedAt, syncStatus, updatedAt, [owner+status]",
        operations:
          "id, localId, entityType, action, userId, status, createdAt, [userId+status]",
        metadata: "key, userId, updatedAt",
        attachments: "id, localId, taskId, name, fileType, createdAt",
      })
      .upgrade((tx) => {
        // Migration logic ensures older local database records receive safe default values without data loss
        return tx
          .table("tasks")
          .toCollection()
          .modify((task) => {
            if (!task.version) task.version = 1;
            if (!task.syncStatus) task.syncStatus = "synced";
            if (task.isDeleted === undefined) task.isDeleted = false;
          });
      });
  }
}

export const db = new TasklertDatabase();
export default db;
