import Reminder from "../models/reminderModel.js";
import Task from "../models/taskModel.js";
import UserPreferences from "../models/userPreferencesModel.js";

// Helper: Calculate next occurrence for repeating reminders
const calculateNextOccurrence = (currentDate, repeat) => {
  const next = new Date(currentDate);
  if (repeat === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (repeat === "weekly") {
    next.setDate(next.getDate() + 7);
  } else {
    return null;
  }
  return next;
};

// CREATE REMINDER / ALARM
export const createReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      taskId,
      title,
      message,
      scheduledAt,
      timeZone,
      alarmEnabled,
      sound,
      volume,
      repeat,
      snoozeDuration,
      advanceNoticeMinutes,
      channels,
      priority,
    } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, message: "Associated taskId is required." });
    }

    const task = await Task.findOne({ _id: taskId, owner: userId });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found or not yours." });
    }

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: "Exact reminder scheduledAt date/time is required." });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format for scheduledAt." });
    }

    // Cancel any existing active reminders for this task to prevent silent duplicates
    await Reminder.updateMany(
      { task: taskId, owner: userId, status: { $in: ["scheduled", "snoozed"] } },
      { status: "cancelled", alarmEnabled: false }
    );

    const reminder = new Reminder({
      owner: userId,
      task: taskId,
      title: title || task.title,
      message: message || task.description || "",
      scheduledAt: scheduledDate,
      timeZone: timeZone || "Asia/Kolkata",
      alarmEnabled: alarmEnabled !== undefined ? Boolean(alarmEnabled) : true,
      sound: sound || "digital",
      volume: volume !== undefined ? Number(volume) : 80,
      repeat: repeat || "never",
      snoozeDuration: snoozeDuration ? Number(snoozeDuration) : 5,
      advanceNoticeMinutes: advanceNoticeMinutes ? Number(advanceNoticeMinutes) : 0,
      channels: {
        push: channels?.push !== undefined ? Boolean(channels.push) : true,
        inApp: channels?.inApp !== undefined ? Boolean(channels.inApp) : true,
        email: channels?.email !== undefined ? Boolean(channels.email) : false,
      },
      status: "scheduled",
      priority: priority || task.priority || "Medium",
    });

    const saved = await reminder.save();

    // Also sync back to Task document for backwards compatibility
    await Task.updateOne(
      { _id: taskId },
      {
        reminderEnabled: saved.alarmEnabled,
        reminderAt: saved.scheduledAt,
      }
    );

    res.status(201).json({ success: true, reminder: saved });
  } catch (err) {
    console.error("createReminder error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET ALL REMINDERS FOR LOGGED-IN USER
export const getReminders = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { status, filter } = req.query;

    const query = { owner: userId };

    if (status) {
      query.status = status;
    } else if (filter === "upcoming") {
      query.status = { $in: ["scheduled", "snoozed"] };
      query.alarmEnabled = true;
    } else if (filter === "history") {
      query.status = { $in: ["dispatched", "dismissed", "completed", "cancelled"] };
    }

    const reminders = await Reminder.find(query)
      .sort({ scheduledAt: 1 })
      .populate("task", "title dueDate priority completed");

    // Filter out reminders whose tasks were deleted or completed
    const validReminders = reminders.filter((r) => r.task && !r.task.completed);

    res.json({ success: true, reminders: validReminders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET UPCOMING ALARMS (Next 24h / 7 days)
export const getUpcomingAlarms = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const now = new Date();

    const upcoming = await Reminder.find({
      owner: userId,
      alarmEnabled: true,
      status: { $in: ["scheduled", "snoozed"] },
      $or: [
        { scheduledAt: { $gte: now } },
        { snoozedUntil: { $gte: now } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .limit(10)
      .populate("task", "title dueDate priority completed");

    res.json({ success: true, upcoming });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET SINGLE REMINDER
export const getReminderById = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminder = await Reminder.findOne({ _id: req.params.id, owner: userId }).populate("task");

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE REMINDER
export const updateReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const existing = await Reminder.findOne({ _id: req.params.id, owner: userId });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Reminder not found or not yours" });
    }

    const data = { ...req.body };
    if (data.scheduledAt) {
      data.scheduledAt = new Date(data.scheduledAt);
      data.status = "scheduled";
      data.isClaimed = false;
      data.snoozedUntil = null;
    }

    const updated = await Reminder.findOneAndUpdate(
      { _id: req.params.id, owner: userId },
      data,
      { new: true, runValidators: true }
    ).populate("task");

    // Sync to Task
    if (updated.task) {
      await Task.updateOne(
        { _id: updated.task._id },
        {
          reminderEnabled: updated.alarmEnabled,
          reminderAt: updated.scheduledAt,
        }
      );
    }

    res.json({ success: true, reminder: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// TOGGLE REMINDER ENABLED / DISABLED
export const toggleReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminder = await Reminder.findOne({ _id: req.params.id, owner: userId });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    reminder.alarmEnabled = !reminder.alarmEnabled;
    if (reminder.alarmEnabled && reminder.status === "dismissed") {
      reminder.status = "scheduled";
    }
    await reminder.save();

    // Sync to Task
    await Task.updateOne(
      { _id: reminder.task },
      { reminderEnabled: reminder.alarmEnabled }
    );

    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// SNOOZE REMINDER (e.g. 5, 10, 15, 30 minutes)
export const snoozeReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminder = await Reminder.findOne({ _id: req.params.id, owner: userId });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    const minutes = Number(req.body.durationMinutes || reminder.snoozeDuration || 5);
    const snoozedTime = new Date(Date.now() + minutes * 60 * 1000);

    reminder.status = "snoozed";
    reminder.snoozedUntil = snoozedTime;
    reminder.scheduledAt = snoozedTime; // scheduled for the snoozed point
    reminder.isClaimed = false;
    reminder.occurrenceCount += 1;

    await reminder.save();

    res.json({
      success: true,
      message: `Alarm snoozed for ${minutes} minutes until ${snoozedTime.toLocaleTimeString()}`,
      reminder,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DISMISS REMINDER
export const dismissReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminder = await Reminder.findOne({ _id: req.params.id, owner: userId });

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    if (reminder.repeat && reminder.repeat !== "never") {
      const nextOccurrence = calculateNextOccurrence(reminder.scheduledAt, reminder.repeat);
      if (nextOccurrence) {
        reminder.scheduledAt = nextOccurrence;
        reminder.status = "scheduled";
        reminder.isClaimed = false;
        reminder.snoozedUntil = null;
        reminder.occurrenceCount += 1;
        await reminder.save();

        return res.json({
          success: true,
          message: `Alarm dismissed. Next recurring alarm scheduled for ${nextOccurrence.toLocaleString()}.`,
          reminder,
        });
      }
    }

    reminder.status = "dismissed";
    reminder.isClaimed = false;
    reminder.snoozedUntil = null;
    await reminder.save();

    res.json({
      success: true,
      message: "Alarm dismissed.",
      reminder,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE REMINDER
export const deleteReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const deleted = await Reminder.findOneAndDelete({ _id: req.params.id, owner: userId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Reminder not found or not yours" });
    }

    // Disable reminder on Task if linked
    await Task.updateOne(
      { _id: deleted.task },
      { reminderEnabled: false, reminderAt: null }
    );

    res.json({ success: true, message: "Reminder deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET USER NOTIFICATION PREFERENCES
export const getUserPreferences = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let prefs = await UserPreferences.findOne({ owner: userId });

    if (!prefs) {
      prefs = await UserPreferences.create({ owner: userId });
    }

    res.json({ success: true, preferences: prefs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UPDATE USER NOTIFICATION PREFERENCES
export const updateUserPreferences = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const updated = await UserPreferences.findOneAndUpdate(
      { owner: userId },
      { ...req.body },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, preferences: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
