import Task from "../models/taskModel.js";
import Project from "../models/projectModel.js";
import Reminder from "../models/reminderModel.js";
import SyncOperationLog from "../models/syncOperationLogModel.js";

/**
 * PUSH SYNCHRONIZATION
 * Processes a batch of offline operations from the client with idempotency,
 * ownership authorization, validation, conflict detection, and audit logging.
 */
export const pushSync = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { deviceId = "unknown_device", operations = [] } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload: operations must be an array",
      });
    }

    const results = [];

    for (const op of operations) {
      const {
        operationId,
        entityType,
        entityId,
        action,
        payload = {},
      } = op;

      if (!operationId || !entityType || !action) {
        results.push({
          operationId: operationId || "invalid",
          status: "rejected",
          message: "Missing operationId, entityType, or action",
        });
        continue;
      }

      // 1. Idempotency Check: prevent duplicate processing of the same operation
      const existingLog = await SyncOperationLog.findOne({
        operationId,
        userId,
      });

      if (existingLog) {
        results.push({
          operationId,
          localId: entityId,
          serverId: existingLog.resultServerId,
          status: "already_processed",
          message: "Operation previously processed",
        });
        continue;
      }

      try {
        // ==========================================
        // ENTITY: TASK
        // ==========================================
        if (entityType === "task") {
          if (action === "CREATE") {
            // Check if task with this localId was already created
            if (entityId) {
              const existingTask = await Task.findOne({
                localId: entityId,
                owner: userId,
              });
              if (existingTask) {
                await SyncOperationLog.create({
                  operationId,
                  userId,
                  deviceId,
                  entityType: "task",
                  entityId,
                  action: "CREATE",
                  status: "already_processed",
                  resultServerId: String(existingTask._id),
                });
                results.push({
                  operationId,
                  localId: entityId,
                  serverId: String(existingTask._id),
                  status: "already_processed",
                  version: existingTask.version || 1,
                  updatedAt: existingTask.updatedAt,
                });
                continue;
              }
            }

            if (!payload.title || !payload.title.trim()) {
              results.push({
                operationId,
                localId: entityId,
                status: "rejected",
                message: "Task title is required",
              });
              continue;
            }

            const now = new Date();
            const newTask = await Task.create({
              title: payload.title.trim(),
              description: payload.description || "",
              priority: payload.priority || "Low",
              dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
              owner: userId,
              completed: Boolean(payload.completed),
              completedAt: payload.completed
                ? payload.completedAt
                  ? new Date(payload.completedAt)
                  : now
                : null,
              subtasks: Array.isArray(payload.subtasks)
                ? payload.subtasks.filter((s) => s.title && s.title.trim())
                : [],
              reminderEnabled: Boolean(payload.reminderEnabled),
              reminderAt: payload.reminderAt ? new Date(payload.reminderAt) : null,
              startDate: payload.startDate ? new Date(payload.startDate) : null,
              endDate: payload.endDate ? new Date(payload.endDate) : null,
              allDay: Boolean(payload.allDay),
              eventColor: payload.eventColor || "#2563eb",
              location: payload.location || "",
              notes: payload.notes || "",
              isCalendarEvent: Boolean(payload.isCalendarEvent),
              source: payload.source || "task",
              attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
              recurrence: payload.recurrence || { frequency: "none", interval: 1 },
              alarmSound: payload.alarmSound || "digital",
              alarmVolume: payload.alarmVolume ?? 80,
              alarmRepeat: payload.alarmRepeat || "never",
              snoozeDuration: payload.snoozeDuration ?? 5,
              advanceNoticeMinutes: payload.advanceNoticeMinutes ?? 0,
              channels: payload.channels || { push: true, inApp: true, email: false },
              timeZone: payload.timeZone || "UTC",
              project: payload.project || null,
              tags: Array.isArray(payload.tags) ? payload.tags : [],
              isDeleted: false,
              deletedAt: null,
              localId: entityId || null,
              version: 1,
              updatedAt: now,
              createdAt: payload.createdAt ? new Date(payload.createdAt) : now,
            });

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "task",
              entityId,
              action: "CREATE",
              status: "applied",
              resultServerId: String(newTask._id),
              serverVersion: 1,
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: String(newTask._id),
              status: "applied",
              version: 1,
              updatedAt: newTask.updatedAt,
            });
          } else if (action === "UPDATE") {
            const query = payload.serverId
              ? { _id: payload.serverId, owner: userId }
              : { localId: entityId, owner: userId };

            const task = await Task.findOne(query);

            if (!task) {
              results.push({
                operationId,
                localId: entityId,
                status: "rejected",
                message: "Task not found on server or access denied",
              });
              continue;
            }

            // Conflict Detection: If server has a newer version than client base
            const clientVersion = Number(payload.version || 1);
            const serverVersion = Number(task.version || 1);
            const clientUpdatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date(0);
            const serverUpdatedAt = task.updatedAt ? new Date(task.updatedAt) : new Date(0);

            if (serverVersion > clientVersion && serverUpdatedAt > clientUpdatedAt) {
              // Version conflict detected
              results.push({
                operationId,
                localId: entityId,
                serverId: String(task._id),
                status: "conflict",
                message: "Version conflict: server record is newer",
                serverEntity: {
                  _id: task._id,
                  title: task.title,
                  description: task.description,
                  completed: task.completed,
                  version: task.version,
                  updatedAt: task.updatedAt,
                },
              });
              continue;
            }

            // Apply updates
            const now = new Date();
            if (payload.title !== undefined) task.title = payload.title.trim() || task.title;
            if (payload.description !== undefined) task.description = payload.description;
            if (payload.priority !== undefined) task.priority = payload.priority;
            if (payload.dueDate !== undefined) task.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
            if (payload.notes !== undefined) task.notes = payload.notes;
            if (payload.tags !== undefined) task.tags = payload.tags;
            if (payload.project !== undefined) task.project = payload.project;
            if (payload.subtasks !== undefined) task.subtasks = payload.subtasks;

            if (payload.completed !== undefined) {
              task.completed = Boolean(payload.completed);
              if (task.completed) {
                task.completedAt = payload.completedAt ? new Date(payload.completedAt) : now;
              } else {
                task.completedAt = null;
              }
            }

            task.version = Math.max(serverVersion + 1, clientVersion + 1);
            task.updatedAt = now;
            await task.save();

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "task",
              entityId,
              action: "UPDATE",
              status: "applied",
              resultServerId: String(task._id),
              serverVersion: task.version,
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: String(task._id),
              status: "applied",
              version: task.version,
              updatedAt: task.updatedAt,
            });
          } else if (action === "DELETE") {
            const query = payload.serverId
              ? { _id: payload.serverId, owner: userId }
              : { localId: entityId, owner: userId };

            const task = await Task.findOne(query);
            const now = new Date();

            if (task) {
              task.isDeleted = true;
              task.deletedAt = now;
              task.updatedAt = now;
              task.version = (task.version || 1) + 1;
              await task.save();
            }

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "task",
              entityId,
              action: "DELETE",
              status: "applied",
              resultServerId: task ? String(task._id) : null,
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: task ? String(task._id) : null,
              status: "applied",
            });
          }
        }

        // ==========================================
        // ENTITY: PROJECT
        // ==========================================
        else if (entityType === "project") {
          if (action === "CREATE") {
            const newProject = await Project.create({
              name: payload.name ? payload.name.trim() : "Untitled Project",
              description: payload.description || "",
              color: payload.color || "#8B2CF5",
              owner: userId,
              localId: entityId || null,
              isDeleted: false,
              version: 1,
            });

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "project",
              entityId,
              action: "CREATE",
              status: "applied",
              resultServerId: String(newProject._id),
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: String(newProject._id),
              status: "applied",
              version: 1,
              updatedAt: newProject.updatedAt,
            });
          } else if (action === "UPDATE") {
            const query = payload.serverId
              ? { _id: payload.serverId, owner: userId }
              : { localId: entityId, owner: userId };

            const project = await Project.findOne(query);
            if (!project) {
              results.push({
                operationId,
                localId: entityId,
                status: "rejected",
                message: "Project not found on server",
              });
              continue;
            }

            if (payload.name) project.name = payload.name.trim();
            if (payload.description !== undefined) project.description = payload.description;
            if (payload.color) project.color = payload.color;
            project.version = (project.version || 1) + 1;
            await project.save();

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "project",
              entityId,
              action: "UPDATE",
              status: "applied",
              resultServerId: String(project._id),
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: String(project._id),
              status: "applied",
              version: project.version,
              updatedAt: project.updatedAt,
            });
          } else if (action === "DELETE") {
            const query = payload.serverId
              ? { _id: payload.serverId, owner: userId }
              : { localId: entityId, owner: userId };

            const project = await Project.findOne(query);
            if (project) {
              project.isDeleted = true;
              project.deletedAt = new Date();
              await project.save();
            }

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "project",
              entityId,
              action: "DELETE",
              status: "applied",
              resultServerId: project ? String(project._id) : null,
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: project ? String(project._id) : null,
              status: "applied",
            });
          }
        }

        // ==========================================
        // ENTITY: REMINDER
        // ==========================================
        else if (entityType === "reminder") {
          if (action === "CREATE") {
            const newReminder = await Reminder.create({
              owner: userId,
              task: payload.task || null,
              title: payload.title || "Reminder",
              message: payload.message || "",
              notes: payload.notes || "",
              scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : new Date(),
              timeZone: payload.timeZone || "UTC",
              alarmEnabled: payload.alarmEnabled !== false,
              sound: payload.sound || "digital",
              volume: payload.volume ?? 80,
              status: payload.status || "scheduled",
            });

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "reminder",
              entityId,
              action: "CREATE",
              status: "applied",
              resultServerId: String(newReminder._id),
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: String(newReminder._id),
              status: "applied",
              version: 1,
              updatedAt: newReminder.updatedAt,
            });
          } else if (action === "UPDATE" || action === "DELETE") {
            const query = payload.serverId
              ? { _id: payload.serverId, owner: userId }
              : { _id: entityId, owner: userId };

            const reminder = await Reminder.findOne(query);
            if (reminder) {
              if (action === "DELETE") {
                reminder.status = "dismissed";
                await reminder.save();
              } else {
                if (payload.status) reminder.status = payload.status;
                if (payload.scheduledAt) reminder.scheduledAt = new Date(payload.scheduledAt);
                await reminder.save();
              }
            }

            await SyncOperationLog.create({
              operationId,
              userId,
              deviceId,
              entityType: "reminder",
              entityId,
              action,
              status: "applied",
              resultServerId: reminder ? String(reminder._id) : null,
            });

            results.push({
              operationId,
              localId: entityId,
              serverId: reminder ? String(reminder._id) : null,
              status: "applied",
            });
          }
        }
      } catch (opErr) {
        console.error(`Error processing sync op ${operationId}:`, opErr);
        results.push({
          operationId,
          localId: entityId,
          status: "rejected",
          message: opErr.message || "Failed to process operation",
        });
      }
    }

    return res.status(200).json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (err) {
    console.error("pushSync controller error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error during sync",
    });
  }
};

/**
 * PULL SYNCHRONIZATION
 * Downloads all modified entities since the client's last-synced cursor timestamp.
 */
export const pullSync = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { since, limit = 100 } = req.query;

    const queryLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const sinceDate = since && !isNaN(Date.parse(since)) ? new Date(since) : null;

    const baseFilter = { owner: userId };
    const dateFilter = sinceDate ? { updatedAt: { $gt: sinceDate } } : {};

    // 1. Fetch modified tasks
    const tasks = await Task.find({
      ...baseFilter,
      ...dateFilter,
      isDeleted: { $ne: true },
    })
      .sort({ updatedAt: 1 })
      .limit(queryLimit)
      .lean();

    // 2. Fetch soft-deleted task IDs since cursor
    const deletedTasks = sinceDate
      ? await Task.find({
          ...baseFilter,
          isDeleted: true,
          updatedAt: { $gt: sinceDate },
        })
          .select("_id")
          .lean()
      : [];

    // 3. Fetch modified projects
    const projects = await Project.find({
      ...baseFilter,
      ...dateFilter,
      isDeleted: { $ne: true },
    })
      .sort({ updatedAt: 1 })
      .limit(queryLimit)
      .lean();

    const deletedProjects = sinceDate
      ? await Project.find({
          ...baseFilter,
          isDeleted: true,
          updatedAt: { $gt: sinceDate },
        })
          .select("_id")
          .lean()
      : [];

    // 4. Fetch modified reminders
    const reminders = await Reminder.find({
      ...baseFilter,
      ...dateFilter,
    })
      .sort({ updatedAt: 1 })
      .limit(queryLimit)
      .lean();

    const now = new Date().toISOString();

    return res.status(200).json({
      success: true,
      timestamp: now,
      hasMore: tasks.length === queryLimit || projects.length === queryLimit,
      changes: {
        tasks,
        projects,
        reminders,
        deleted: {
          tasks: deletedTasks.map((t) => String(t._id)),
          projects: deletedProjects.map((p) => String(p._id)),
          reminders: [],
        },
      },
    });
  } catch (err) {
    console.error("pullSync controller error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to pull changes",
    });
  }
};

/**
 * SYNC STATUS
 * Provides high-level sync diagnostics and timestamps for client sanity checks.
 */
export const getSyncStatus = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const activeTasksCount = await Task.countDocuments({
      owner: userId,
      isDeleted: { $ne: true },
    });

    const lastTask = await Task.findOne({ owner: userId })
      .sort({ updatedAt: -1 })
      .select("updatedAt")
      .lean();

    return res.status(200).json({
      success: true,
      userId,
      serverTime: new Date().toISOString(),
      activeTasksCount,
      lastModifiedAt: lastTask?.updatedAt || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
