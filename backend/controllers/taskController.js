import Task from "../models/taskModel.js";
import Notification from "../models/notificationModel.js";
import Reminder from "../models/reminderModel.js";

export const normalizeCompleted = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "completed";
  }
  return false;
};

export const normalizeSubtasks = (subtasks) => {
  if (!Array.isArray(subtasks)) return [];
  return subtasks
    .filter((item) => item && typeof item.title === "string" && item.title.trim())
    .map((item) => ({
      title: item.title.trim(),
      completed: normalizeCompleted(item.completed),
    }));
};

export const normalizeRecurrence = (recurrence, existingRecurrence) => {
  const frequency = recurrence?.frequency || "none";
  const safeFrequency = ["none", "daily", "weekly", "monthly"].includes(frequency)
    ? frequency
    : "none";

  const endsOn = recurrence?.endsOn ? new Date(recurrence.endsOn) : null;

  // Alerts only make sense for an actual repeating series with a real end date.
  let alertBeforeEnd = null;
  if (safeFrequency !== "none" && endsOn) {
    const raw = Number(recurrence?.alertBeforeEnd);
    if (Number.isFinite(raw) && raw >= 1) {
      alertBeforeEnd = Math.min(3, Math.max(1, Math.round(raw)));
    }
  }

  // If the end date or the alert count changed, forget what's already been
  // sent so the new schedule can fire again from scratch.
  const endsOnChanged =
    (existingRecurrence?.endsOn ? new Date(existingRecurrence.endsOn).getTime() : null) !==
    (endsOn ? endsOn.getTime() : null);
  const alertCountChanged = (existingRecurrence?.alertBeforeEnd || null) !== alertBeforeEnd;

  const endAlertsSent =
    endsOnChanged || alertCountChanged ? [] : existingRecurrence?.endAlertsSent || [];

  return {
    frequency: safeFrequency,
    interval: Math.max(1, Number(recurrence?.interval || 1)),
    endsOn,
    alertBeforeEnd,
    endAlertsSent,
  };
};

export const getNextDueDate = (dueDate, recurrence) => {
  if (!recurrence || recurrence.frequency === "none") return null;

  const baseDate = dueDate ? new Date(dueDate) : new Date();
  if (isNaN(baseDate.getTime())) return null;

  const next = new Date(baseDate);
  const interval = Math.max(1, Number(recurrence.interval || 1));

  if (recurrence.frequency === "daily") {
    next.setDate(next.getDate() + interval);
  } else if (recurrence.frequency === "weekly") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (recurrence.frequency === "monthly") {
    next.setMonth(next.getMonth() + interval);
  } else {
    return null;
  }

  if (recurrence.endsOn) {
    const end = new Date(recurrence.endsOn);
    if (!isNaN(end.getTime()) && next > end) return null;
  }
  return next;
};

// CREATE A NEW TASK
export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      completed,
      subtasks,
      reminderEnabled,
      reminderAt,
      recurrence,
      attachments,
      project,
      tags,
    } = req.body;

    const parsedRecurrence = normalizeRecurrence(recurrence, null);
    const parsedTags = Array.isArray(tags)
      ? Array.from(new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)))
      : [];

    const isCompleted = normalizeCompleted(completed);

    const task = new Task({
      title,
      description,
      priority,
      dueDate,
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null,
      subtasks: normalizeSubtasks(subtasks),
      reminderEnabled: Boolean(reminderEnabled),
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      alarmSound: req.body.alarmSound || req.body.sound || "digital",
      alarmVolume: req.body.alarmVolume !== undefined ? Number(req.body.alarmVolume) : 80,
      alarmRepeat: req.body.alarmRepeat || req.body.repeat || "never",
      snoozeDuration: req.body.snoozeDuration ? Number(req.body.snoozeDuration) : 5,
      advanceNoticeMinutes: req.body.advanceNoticeMinutes ? Number(req.body.advanceNoticeMinutes) : 0,
      channels: {
        push: req.body.channels?.push !== undefined ? Boolean(req.body.channels.push) : true,
        inApp: req.body.channels?.inApp !== undefined ? Boolean(req.body.channels.inApp) : true,
        email: req.body.channels?.email !== undefined ? Boolean(req.body.channels.email) : false,
      },
      timeZone: req.body.timeZone || "UTC",
      recurrence: parsedRecurrence,
      recurrenceSpawned: false,
      project: project || null,
      tags: parsedTags,
      attachments: Array.isArray(attachments) ? attachments : [],
      owner: req.user.id,
    });

    const saved = await task.save();
    await saved.populate("project", "name color");

    // Auto-create exact-time Reminder if alarm/reminder is enabled
    if (saved.reminderEnabled && saved.reminderAt) {
      try {
        await Reminder.create({
          owner: req.user.id,
          task: saved._id,
          title: saved.title,
          message: saved.description || "",
          scheduledAt: saved.reminderAt,
          timeZone: req.body.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          alarmEnabled: true,
          sound: req.body.alarmSound || req.body.sound || "digital",
          volume: req.body.alarmVolume !== undefined ? Number(req.body.alarmVolume) : 80,
          repeat: req.body.alarmRepeat || req.body.repeat || "never",
          snoozeDuration: req.body.snoozeDuration ? Number(req.body.snoozeDuration) : 5,
          advanceNoticeMinutes: req.body.advanceNoticeMinutes ? Number(req.body.advanceNoticeMinutes) : 0,
          channels: {
            push: req.body.channels?.push !== undefined ? Boolean(req.body.channels.push) : true,
            inApp: req.body.channels?.inApp !== undefined ? Boolean(req.body.channels.inApp) : true,
            email: req.body.channels?.email !== undefined ? Boolean(req.body.channels.email) : false,
          },
          status: "scheduled",
          priority: saved.priority || "Medium",
        });
      } catch (remErr) {
        console.error("Failed to auto-create linked Reminder:", remErr.message);
      }
    }

    res.status(201).json({ success: true, task: saved });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET ALL TASKS FOR LOGGED-IN USER (excludes soft-deleted)
export const getTasks = async (req, res) => {
  try {
    const filter = { owner: req.user.id, isDeleted: { $ne: true } };

    if (req.query.project) {
      filter.project = req.query.project;
    }
    if (req.query.tag) {
      filter.tags = req.query.tag.trim().toLowerCase();
    }
    if (req.query.search) {
      const q = req.query.search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { tags: regex },
      ];
    }

    const tasks = await Task.find(filter)
      .populate("project", "name color")
      .sort({ createdAt: -1 });

    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE TASK BY ID (MUST BELONG TO THAT USER AND NOT BE DELETED)
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: { $ne: true } })
      .populate("project", "name color");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// UPDATE A TASK
export const updateTask = async (req, res) => {
  try {
    const existingTask = await Task.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: { $ne: true } });
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not yours",
      });
    }

    const data = { ...req.body };

    if (data.completed !== undefined) {
      const isCurrentlyCompleted = normalizeCompleted(existingTask.completed);
      const willBeCompleted = normalizeCompleted(data.completed);
      data.completed = willBeCompleted;
      if (!isCurrentlyCompleted && willBeCompleted) {
        data.completedAt = new Date();
      } else if (isCurrentlyCompleted && !willBeCompleted) {
        data.completedAt = null;
      } else if (isCurrentlyCompleted && willBeCompleted) {
        data.completedAt = existingTask.completedAt || null;
      }
    }
    if (data.subtasks !== undefined) data.subtasks = normalizeSubtasks(data.subtasks);
    if (data.recurrence !== undefined) {
      data.recurrence = normalizeRecurrence(data.recurrence, existingTask.recurrence);
    }
    if (data.reminderAt !== undefined) {
      data.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
    }
    if (data.reminderEnabled !== undefined) data.reminderEnabled = Boolean(data.reminderEnabled);

    const toTime = (value) => (value ? new Date(value).getTime() : null);
    const dueDateChanged =
      data.dueDate !== undefined &&
      toTime(data.dueDate) !== toTime(existingTask.dueDate);
    const priorityChanged =
      data.priority !== undefined && data.priority !== existingTask.priority;

    const shouldResetEmailReminder = dueDateChanged || priorityChanged;

    if (shouldResetEmailReminder) {
      data.emailReminderLastSentAt = null;
    }

    if (data.tags !== undefined) {
      data.tags = Array.isArray(data.tags)
        ? Array.from(new Set(data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)))
        : [];
    }
    if (data.project !== undefined) {
      data.project = data.project || null;
    }

    const updated = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id, isDeleted: { $ne: true } },
      data,
      { new: true, runValidators: true }
    ).populate("project", "name color");

    const turnedCompleted = !normalizeCompleted(existingTask.completed) && normalizeCompleted(updated.completed);
    const turnedIncomplete = normalizeCompleted(existingTask.completed) && !normalizeCompleted(updated.completed);
    const recurrence = normalizeRecurrence(updated.recurrence || {}, updated.recurrence);
    const shouldCreateNext = turnedCompleted && recurrence.frequency !== "none" && !existingTask.recurrenceSpawned;

    if (turnedCompleted) {
      await Notification.deleteMany({ owner: req.user.id, task: updated._id });
      await Reminder.updateMany(
        { owner: req.user.id, task: updated._id },
        { status: "completed", alarmEnabled: false }
      );
    }

    if (turnedIncomplete) {
      // Allow future completion to spawn recurrence if toggled back
      await Task.updateOne({ _id: updated._id }, { recurrenceSpawned: false });
    }

    // Sync reminder changes to Reminder collection
    if (data.reminderEnabled !== undefined || data.reminderAt !== undefined) {
      if (updated.reminderEnabled && updated.reminderAt && !updated.completed) {
        await Reminder.findOneAndUpdate(
          { task: updated._id, owner: req.user.id },
          {
            title: updated.title,
            message: updated.description || "",
            scheduledAt: updated.reminderAt,
            alarmEnabled: true,
            status: "scheduled",
            priority: updated.priority,
            isClaimed: false,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else if (!updated.reminderEnabled) {
        await Reminder.updateMany(
          { task: updated._id, owner: req.user.id },
          { alarmEnabled: false, status: "cancelled" }
        );
      }
    }

    if (shouldCreateNext) {
      const nextDueDate = getNextDueDate(updated.dueDate, recurrence);
      if (nextDueDate) {
        await Task.create({
          title: updated.title,
          description: updated.description,
          priority: updated.priority,
          dueDate: nextDueDate,
          owner: updated.owner,
          completed: false,
          completedAt: null,
          subtasks: (updated.subtasks || []).map((item) => ({ title: item.title, completed: false })),
          reminderEnabled: false,
          reminderAt: null,
          recurrence: { ...recurrence, endAlertsSent: [] },
          recurrenceSpawned: false,
          project: updated.project?._id || updated.project || null,
          tags: updated.tags || [],
        });
        await Task.updateOne({ _id: updated._id }, { recurrenceSpawned: true });
      }
    }

    res.json({ success: true, task: updated });
  } 
  catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE A TASK (Soft-delete to allow undo)
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: { $ne: true } });

    if (!task) 
      return res.status(404).json({ success: false, message: "Task not found or not yours" });

    task.isDeleted = true;
    task.deletedAt = new Date();
    await task.save();

    // Cancel active reminders so alarms do not fire for deleted tasks
    await Reminder.updateMany({ owner: req.user.id, task: task._id }, { alarmEnabled: false, status: "cancelled" });
    await Notification.deleteMany({ owner: req.user.id, task: task._id });

    res.json({ success: true, message: "Task moved to trash", task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// RESTORE A SOFT-DELETED TASK (Undo delete)
export const restoreTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: true });

    if (!task) {
      return res.status(404).json({ success: false, message: "Deleted task not found" });
    }

    task.isDeleted = false;
    task.deletedAt = null;
    await task.save();

    // Re-schedule reminder if it was active and in the future
    if (task.reminderEnabled && task.reminderAt && new Date(task.reminderAt) > new Date() && !task.completed) {
      await Reminder.updateMany(
        { owner: req.user.id, task: task._id },
        { alarmEnabled: true, status: "scheduled" }
      );
    }

    res.json({ success: true, message: "Task restored successfully", task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// BULK TASK OPERATIONS (Complete, Incomplete, Priority, Project, Delete)
export const bulkTaskOperations = async (req, res) => {
  try {
    const { taskIds, action, value } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: "No task IDs provided" });
    }

    const filter = {
      _id: { $in: taskIds },
      owner: req.user.id,
      isDeleted: { $ne: true },
    };

    let result;
    if (action === "complete") {
      const now = new Date();
      // Set completedAt only on tasks currently incomplete
      result = await Task.updateMany({ ...filter, completed: false }, { completed: true, completedAt: now });
      // Ensure any already completed tasks are also updated in result count
      const alreadyDone = await Task.updateMany({ ...filter, completed: true }, { completed: true });
      result = { modifiedCount: (result.modifiedCount || 0) + (alreadyDone.modifiedCount || 0) };
      await Notification.deleteMany({ owner: req.user.id, task: { $in: taskIds } });
    } else if (action === "incomplete") {
      result = await Task.updateMany(filter, { completed: false, completedAt: null });
    } else if (action === "priority") {
      if (!["Low", "Medium", "High"].includes(value)) {
        return res.status(400).json({ success: false, message: "Invalid priority value" });
      }
      result = await Task.updateMany(filter, { priority: value });
    } else if (action === "project") {
      result = await Task.updateMany(filter, { project: value || null });
    } else if (action === "delete") {
      result = await Task.updateMany(filter, { isDeleted: true, deletedAt: new Date() });
      await Reminder.updateMany(
        { task: { $in: taskIds }, owner: req.user.id },
        { alarmEnabled: false, status: "cancelled" }
      );
      await Notification.deleteMany({ owner: req.user.id, task: { $in: taskIds } });
    } else {
      return res.status(400).json({ success: false, message: `Unknown bulk action: ${action}` });
    }

    res.json({
      success: true,
      message: `Bulk action '${action}' applied to ${result.modifiedCount} task${result.modifiedCount === 1 ? "" : "s"}.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL DISTINCT TAGS FOR LOGGED-IN USER
export const getUserTags = async (req, res) => {
  try {
    const tasks = await Task.find({ owner: req.user.id, isDeleted: { $ne: true } }).select("tags");
    const tagSet = new Set();
    tasks.forEach((t) => {
      if (Array.isArray(t.tags)) {
        t.tags.forEach((tag) => {
          if (tag && typeof tag === "string" && tag.trim()) {
            tagSet.add(tag.trim().toLowerCase());
          }
        });
      }
    });
    res.json({ success: true, tags: Array.from(tagSet).sort() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


