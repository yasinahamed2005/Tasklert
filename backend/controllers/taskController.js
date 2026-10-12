import Task from "../models/taskModel.js";
import Notification from "../models/notificationModel.js";
import Reminder from "../models/reminderModel.js";

const normalizeCompleted = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "completed";
  }
  return false;
};

const normalizeSubtasks = (subtasks) => {
  if (!Array.isArray(subtasks)) return [];
  return subtasks
    .filter((item) => item && typeof item.title === "string" && item.title.trim())
    .map((item) => ({
      title: item.title.trim(),
      completed: normalizeCompleted(item.completed),
    }));
};

const normalizeRecurrence = (recurrence, existingRecurrence) => {
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

const getNextDueDate = (dueDate, recurrence) => {
  if (!dueDate || recurrence.frequency === "none") return null;

  const next = new Date(dueDate);
  const interval = recurrence.interval || 1;

  if (recurrence.frequency === "daily") {
    next.setDate(next.getDate() + interval);
  } else if (recurrence.frequency === "weekly") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (recurrence.frequency === "monthly") {
    next.setMonth(next.getMonth() + interval);
  }

  if (recurrence.endsOn && next > new Date(recurrence.endsOn)) return null;
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
    } = req.body;

    const parsedRecurrence = normalizeRecurrence(recurrence, null);

    const task = new Task({
      title,
      description,
      priority,
      dueDate,
      completed: normalizeCompleted(completed),
      subtasks: normalizeSubtasks(subtasks),
      reminderEnabled: Boolean(reminderEnabled),
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      recurrence: parsedRecurrence,
      attachments: Array.isArray(attachments) ? attachments : [],
      owner: req.user.id,
    });

    const saved = await task.save();

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

// GET ALL TASKS FOR LOGGED-IN USER
export const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, tasks });
} 
catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET SINGLE TASK BY ID (MUST BELONG TO THAT USER)
export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) return res.status(404).json({
      success: false,
      message: "Task not found"
    });

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// UPDATE A TASK
export const updateTask = async (req, res) => {
  try {
    const existingTask = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not yours",
      });
    }

    const data = { ...req.body };

    if (data.completed !== undefined) {
      data.completed = normalizeCompleted(data.completed);
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

    const updated = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      data,
      { new: true, runValidators: true }
    );

    const turnedCompleted = !normalizeCompleted(existingTask.completed) && normalizeCompleted(updated.completed);
    const recurrence = normalizeRecurrence(updated.recurrence || {}, updated.recurrence);
    const shouldCreateNext = turnedCompleted && recurrence.frequency !== "none";

    if (turnedCompleted) {
      await Notification.deleteMany({ owner: req.user.id, task: updated._id });
      await Reminder.updateMany(
        { owner: req.user.id, task: updated._id },
        { status: "completed", alarmEnabled: false }
      );
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
          subtasks: (updated.subtasks || []).map((item) => ({ title: item.title, completed: false })),
          reminderEnabled: false,
          reminderAt: null,
          recurrence,
        });
      }
    }

    res.json({ success: true, task: updated });
  } 
  catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// DELETE A TASK
export const deleteTask = async (req, res) => {
  try {
    const deleted = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user.id });

    if (!deleted) 
      return res.status(404).json({ success: false, message: "Task not found or not yours" });

    await Notification.deleteMany({ owner: req.user.id, task: deleted._id });
    await Reminder.deleteMany({ owner: req.user.id, task: deleted._id });

    res.json({ success: true, message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

