import { db, generateUUID, getDeviceId } from "./tasklertDb.js";
import { operationsRepository } from "./operationsRepository.js";

/**
 * Task Repository
 * Offline-first repository for Task CRUD, transactional operation queuing,
 * and strict user account isolation.
 */
export const taskRepository = {
  /**
   * Create a new task locally.
   * Transactionally saves the task and queues an offline CREATE operation if un-synced.
   */
  async createTask(taskData, userId) {
    if (!userId) {
      throw new Error("taskRepository.createTask requires an authenticated userId");
    }

    const now = new Date().toISOString();
    const localId = taskData.localId || generateUUID();
    const isSynced = Boolean(taskData.serverId || taskData._id);

    const taskRecord = {
      localId,
      serverId: taskData.serverId || taskData._id || null,
      owner: String(userId),
      title: taskData.title?.trim() || "Untitled Task",
      description: taskData.description || "",
      priority: taskData.priority || "Low",
      dueDate: taskData.dueDate ? new Date(taskData.dueDate).toISOString() : null,
      completed: Boolean(taskData.completed),
      completedAt: taskData.completedAt
        ? new Date(taskData.completedAt).toISOString()
        : taskData.completed
        ? now
        : null,
      subtasks: Array.isArray(taskData.subtasks)
        ? taskData.subtasks.map((s) => ({
            title: s.title || "",
            completed: Boolean(s.completed),
          }))
        : [],
      reminderEnabled: Boolean(taskData.reminderEnabled),
      reminderAt: taskData.reminderAt
        ? new Date(taskData.reminderAt).toISOString()
        : null,
      startDate: taskData.startDate
        ? new Date(taskData.startDate).toISOString()
        : null,
      endDate: taskData.endDate
        ? new Date(taskData.endDate).toISOString()
        : null,
      allDay: Boolean(taskData.allDay),
      eventColor: taskData.eventColor || "#2563eb",
      location: taskData.location || "",
      notes: taskData.notes || "",
      isCalendarEvent: Boolean(taskData.isCalendarEvent),
      source: taskData.source || "task",
      attachments: Array.isArray(taskData.attachments)
        ? taskData.attachments
        : [],
      recurrence: taskData.recurrence || {
        frequency: "none",
        interval: 1,
        endsOn: null,
        alertBeforeEnd: null,
        endAlertsSent: [],
      },
      alarmSound: taskData.alarmSound || "digital",
      alarmVolume: taskData.alarmVolume ?? 80,
      alarmRepeat: taskData.alarmRepeat || "never",
      snoozeDuration: taskData.snoozeDuration ?? 5,
      advanceNoticeMinutes: taskData.advanceNoticeMinutes ?? 0,
      channels: taskData.channels || { push: true, inApp: true, email: false },
      timeZone: taskData.timeZone || "UTC",
      project: taskData.project || null,
      tags: Array.isArray(taskData.tags) ? taskData.tags : [],
      isDeleted: false,
      deletedAt: null,
      // Offline-first synchronization metadata
      syncStatus: isSynced ? "synced" : "created",
      version: taskData.version || 1,
      createdAt: taskData.createdAt
        ? new Date(taskData.createdAt).toISOString()
        : now,
      updatedAt: taskData.updatedAt
        ? new Date(taskData.updatedAt).toISOString()
        : now,
      deviceId: getDeviceId(),
    };

    // Transactional write: Save task & append to operations queue
    return await db.transaction("rw", [db.tasks, db.operations], async () => {
      await db.tasks.put(taskRecord);

      if (!isSynced) {
        await operationsRepository.queueOperation(
          {
            entityType: "task",
            action: "CREATE",
            localId,
            userId,
            payload: taskRecord,
          },
          db
        );
      }

      return taskRecord;
    });
  },

  /**
   * Get all tasks belonging to a user, with optional filters and sorting.
   */
  async getTasks(userId, filter = {}) {
    if (!userId) {
      throw new Error("taskRepository.getTasks requires a valid userId");
    }

    const ownerId = String(userId);
    const includeDeleted = Boolean(filter.includeDeleted);

    const records = await db.tasks.where("owner").equals(ownerId).toArray();

    // Apply in-memory filters for flexibility
    let result = records.filter((task) => {
      // Exclude soft-deleted tasks by default
      if (!includeDeleted && Boolean(task.isDeleted)) {
        return false;
      }
      // Completed filter
      if (filter.completed !== undefined) {
        if (Boolean(task.completed) !== Boolean(filter.completed)) {
          return false;
        }
      }

      // Project filter
      if (filter.project) {
        if (String(task.project) !== String(filter.project)) {
          return false;
        }
      }

      // Priority filter
      if (filter.priority) {
        if (task.priority !== filter.priority) {
          return false;
        }
      }

      // Sync status filter
      if (filter.syncStatus) {
        if (task.syncStatus !== filter.syncStatus) {
          return false;
        }
      }

      // Search query filter (title, description, notes, tags)
      if (filter.search && typeof filter.search === "string") {
        const query = filter.search.toLowerCase().trim();
        const inTitle = task.title?.toLowerCase().includes(query);
        const inDesc = task.description?.toLowerCase().includes(query);
        const inNotes = task.notes?.toLowerCase().includes(query);
        const inTags = Array.isArray(task.tags) &&
          task.tags.some((t) => t.toLowerCase().includes(query));
        if (!inTitle && !inDesc && !inNotes && !inTags) {
          return false;
        }
      }

      // Date range filters
      if (filter.dueBefore && task.dueDate) {
        if (new Date(task.dueDate) > new Date(filter.dueBefore)) return false;
      }
      if (filter.dueAfter && task.dueDate) {
        if (new Date(task.dueDate) < new Date(filter.dueAfter)) return false;
      }

      return true;
    });

    // Sorting
    const sortBy = filter.sortBy || "dueDate";
    const order = filter.order === "desc" ? -1 : 1;

    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });

    return result;
  },

  /**
   * Get a single task by its localId or serverId, enforcing user isolation.
   */
  async getTaskById(id, userId) {
    if (!id || !userId) return null;
    const targetId = String(id);
    const ownerId = String(userId);

    // Try finding by localId first
    let task = await db.tasks.get(targetId);
    if (task && String(task.owner) === ownerId) {
      return task;
    }

    // Try finding by serverId
    task = await db.tasks.where("serverId").equals(targetId).first();
    if (task && String(task.owner) === ownerId) {
      return task;
    }

    return null;
  },

  /**
   * Update an existing task transactionally and queue an UPDATE operation.
   */
  async updateTask(id, updates, userId) {
    if (!id || !userId) {
      throw new Error("taskRepository.updateTask requires valid id and userId");
    }

    const task = await this.getTaskById(id, userId);
    if (!task) {
      throw new Error(`Task ${id} not found or unauthorized for user ${userId}`);
    }

    const now = new Date().toISOString();
    const updatedSyncStatus =
      task.syncStatus === "created" ? "created" : "updated";

    const updatedTask = {
      ...task,
      ...updates,
      localId: task.localId, // Immutable primary key
      serverId: task.serverId, // Preserve server ID mapping
      owner: task.owner, // Immutable owner
      version: (task.version || 1) + 1,
      syncStatus: updatedSyncStatus,
      updatedAt: now,
    };

    return await db.transaction("rw", [db.tasks, db.operations], async () => {
      await db.tasks.put(updatedTask);

      await operationsRepository.queueOperation(
        {
          entityType: "task",
          action: "UPDATE",
          localId: task.localId,
          userId,
          payload: updatedTask,
        },
        db
      );

      return updatedTask;
    });
  },

  /**
   * Mark a task as completed or pending.
   */
  async completeTask(id, userId, completed = true) {
    const now = new Date().toISOString();
    return await this.updateTask(
      id,
      {
        completed: Boolean(completed),
        completedAt: completed ? now : null,
      },
      userId
    );
  },

  /**
   * Delete a task (soft delete by default, preserves record for sync).
   */
  async deleteTask(id, userId, soft = true) {
    if (!id || !userId) {
      throw new Error("taskRepository.deleteTask requires valid id and userId");
    }

    const task = await this.getTaskById(id, userId);
    if (!task) {
      return { success: false, message: "Task not found" };
    }

    const now = new Date().toISOString();

    return await db.transaction("rw", [db.tasks, db.operations], async () => {
      if (soft) {
        const deletedTask = {
          ...task,
          isDeleted: true,
          deletedAt: now,
          syncStatus: "deleted",
          updatedAt: now,
          version: (task.version || 1) + 1,
        };
        await db.tasks.put(deletedTask);
      } else {
        await db.tasks.delete(task.localId);
      }

      await operationsRepository.queueOperation(
        {
          entityType: "task",
          action: "DELETE",
          localId: task.localId,
          userId,
          payload: {
            localId: task.localId,
            serverId: task.serverId,
            deletedAt: now,
          },
        },
        db
      );

      return { success: true, localId: task.localId, serverId: task.serverId };
    });
  },

  /**
   * Bulk cache tasks received from the server.
   * Safe non-destructive upsert: preserves existing local un-synced edits.
   */
  async bulkUpsertFromServer(serverTasks, userId) {
    if (!Array.isArray(serverTasks) || !userId) return [];
    const ownerId = String(userId);

    return await db.transaction("rw", [db.tasks], async () => {
      const existingUserTasks = await db.tasks
        .where("owner")
        .equals(ownerId)
        .toArray();

      const serverIdToLocalMap = new Map();
      existingUserTasks.forEach((t) => {
        if (t.serverId) {
          serverIdToLocalMap.set(String(t.serverId), t);
        }
      });

      const upsertRecords = [];

      for (const st of serverTasks) {
        const sId = String(st._id || st.serverId || "");
        if (!sId) continue;

        const existingLocal = serverIdToLocalMap.get(sId);

        // If local copy has pending un-synced changes, do NOT overwrite it blindly!
        if (existingLocal && existingLocal.syncStatus !== "synced") {
          continue;
        }

        const localId = existingLocal ? existingLocal.localId : generateUUID();
        const record = {
          localId,
          serverId: sId,
          owner: ownerId,
          title: st.title || "Untitled Task",
          description: st.description || "",
          priority: st.priority || "Low",
          dueDate: st.dueDate ? new Date(st.dueDate).toISOString() : null,
          completed: Boolean(st.completed),
          completedAt: st.completedAt ? new Date(st.completedAt).toISOString() : null,
          subtasks: Array.isArray(st.subtasks) ? st.subtasks : [],
          reminderEnabled: Boolean(st.reminderEnabled),
          reminderAt: st.reminderAt ? new Date(st.reminderAt).toISOString() : null,
          startDate: st.startDate ? new Date(st.startDate).toISOString() : null,
          endDate: st.endDate ? new Date(st.endDate).toISOString() : null,
          allDay: Boolean(st.allDay),
          eventColor: st.eventColor || "#2563eb",
          location: st.location || "",
          notes: st.notes || "",
          isCalendarEvent: Boolean(st.isCalendarEvent),
          source: st.source || "task",
          attachments: Array.isArray(st.attachments) ? st.attachments : [],
          recurrence: st.recurrence || { frequency: "none", interval: 1, endsOn: null },
          alarmSound: st.alarmSound || "digital",
          alarmVolume: st.alarmVolume ?? 80,
          alarmRepeat: st.alarmRepeat || "never",
          snoozeDuration: st.snoozeDuration ?? 5,
          advanceNoticeMinutes: st.advanceNoticeMinutes ?? 0,
          channels: st.channels || { push: true, inApp: true, email: false },
          timeZone: st.timeZone || "UTC",
          project: st.project ? (st.project._id || st.project) : null,
          tags: Array.isArray(st.tags) ? st.tags : [],
          isDeleted: Boolean(st.isDeleted),
          deletedAt: st.deletedAt ? new Date(st.deletedAt).toISOString() : null,
          syncStatus: "synced",
          version: st.version || 1,
          createdAt: st.createdAt ? new Date(st.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: st.updatedAt ? new Date(st.updatedAt).toISOString() : new Date().toISOString(),
          deviceId: getDeviceId(),
        };

        upsertRecords.push(record);
      }

      if (upsertRecords.length > 0) {
        await db.tasks.bulkPut(upsertRecords);
      }

      return upsertRecords;
    });
  },
};

export default taskRepository;
