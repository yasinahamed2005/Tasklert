import Reminder from "../models/reminderModel.js";
import Task from "../models/taskModel.js";
import UserPreferences from "../models/userPreferencesModel.js";
import {
  isValidTimeZone,
  sanitizeTimeZone,
  getNextWallClockOccurrence,
} from "../utils/timeZone.js";
import { isEmailConfigured } from "../utils/mailer.js";
import { isVapidConfigured } from "../services/pushService.js";

const isCompleted = (val) =>
  [true, 1, "yes", "true", "completed"].includes(
    typeof val === "string" ? val.trim().toLowerCase() : val
  );

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

    let linkedTask = null;
    if (taskId) {
      linkedTask = await Task.findOne({ _id: taskId, owner: userId });
      if (!linkedTask) {
        return res.status(404).json({ success: false, message: "Task not found or not yours." });
      }
      if (isCompleted(linkedTask.completed)) {
        return res.status(400).json({
          success: false,
          message: "Cannot schedule an alarm for an already completed task.",
        });
      }
    } else {
      // Standalone alarm: create underlying Task so all cron and aggregation systems work seamlessly
      const fallbackDueDate = scheduledAt ? new Date(scheduledAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
      linkedTask = new Task({
        title: title || "Alarm Reminder",
        description: message || "Scheduled alarm",
        dueDate: fallbackDueDate,
        owner: userId,
        priority: priority || "Medium",
        reminderEnabled: alarmEnabled !== undefined ? Boolean(alarmEnabled) : true,
        reminderAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      });
      await linkedTask.save();
    }

    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: "Exact reminder scheduledAt date/time is required." });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format for scheduledAt." });
    }

    // Validate timeZone if provided
    const safeTz = timeZone ? sanitizeTimeZone(timeZone, "UTC") : "UTC";
    if (timeZone && !isValidTimeZone(timeZone)) {
      return res.status(400).json({
        success: false,
        message: `Invalid IANA time zone identifier: "${timeZone}". Example: "Asia/Kolkata", "America/New_York", "UTC".`,
      });
    }

    // Validate snooze duration (minutes)
    const validSnooze = [5, 10, 15, 30, 60];
    const snooze = snoozeDuration ? Number(snoozeDuration) : 5;
    if (snoozeDuration && (!Number.isInteger(snooze) || snooze <= 0 || snooze > 1440)) {
      return res.status(400).json({
        success: false,
        message: "Snooze duration must be a positive integer up to 1440 minutes.",
      });
    }

    // Channel credentials warning check
    const warnings = [];
    const pushRequested = channels?.push !== false;
    const emailRequested = Boolean(channels?.email);

    if (pushRequested && !isVapidConfigured()) {
      warnings.push("Web Push credentials (VAPID) are not configured on server.");
    }
    if (emailRequested && !isEmailConfigured()) {
      warnings.push("Email service credentials (SMTP/Resend/Brevo) are not configured on server.");
    }

    // Cancel any existing active reminders for this task to prevent silent duplicates
    if (taskId) {
      await Reminder.updateMany(
        { task: linkedTask._id, owner: userId, status: { $in: ["scheduled", "snoozed", "failed_retryable"] } },
        { status: "cancelled", alarmEnabled: false }
      );
    }

    const reminder = new Reminder({
      owner: userId,
      task: linkedTask._id,
      title: title || linkedTask.title,
      message: message || linkedTask.description || "",
      scheduledAt: scheduledDate,
      timeZone: safeTz,
      alarmEnabled: alarmEnabled !== undefined ? Boolean(alarmEnabled) : true,
      sound: sound || "digital",
      volume: volume !== undefined ? Math.max(0, Math.min(100, Number(volume))) : 80,
      repeat: ["never", "daily", "weekly"].includes(repeat) ? repeat : "never",
      snoozeDuration: validSnooze.includes(snooze) ? snooze : 5,
      advanceNoticeMinutes: advanceNoticeMinutes ? Number(advanceNoticeMinutes) : 0,
      channels: {
        push: pushRequested,
        inApp: channels?.inApp !== undefined ? Boolean(channels.inApp) : true,
        email: emailRequested,
      },
      status: "scheduled",
      priority: priority || linkedTask.priority || "Medium",
      deliveryAttempts: 0,
      nextRetryAt: null,
      isClaimed: false,
    });

    const saved = await reminder.save();

    // Sync back to Task document
    await Task.updateOne(
      { _id: linkedTask._id },
      {
        reminderEnabled: saved.alarmEnabled,
        reminderAt: saved.scheduledAt,
      }
    );

    res.status(201).json({
      success: true,
      reminder: saved,
      warnings: warnings.length ? warnings : undefined,
    });
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
      query.status = { $in: ["scheduled", "snoozed", "failed_retryable"] };
      query.alarmEnabled = true;
    } else if (filter === "history") {
      query.status = { $in: ["dispatched", "dismissed", "completed", "cancelled", "failed"] };
    }

    const reminders = await Reminder.find(query)
      .sort({ scheduledAt: 1 })
      .populate("task", "title dueDate priority completed");

    // Filter out reminders whose tasks were deleted
    const validReminders = reminders.filter((r) => r.task);

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
      status: { $in: ["scheduled", "snoozed", "failed_retryable"] },
      $or: [
        { scheduledAt: { $gte: now } },
        { snoozedUntil: { $gte: now } },
        { nextRetryAt: { $gte: now } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .limit(20)
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
      data.claimedAt = null;
      data.snoozedUntil = null;
      data.nextRetryAt = null;
      data.deliveryAttempts = 0;
    }
    if (data.timeZone) {
      if (!isValidTimeZone(data.timeZone)) {
        return res.status(400).json({ success: false, message: `Invalid time zone: ${data.timeZone}` });
      }
      data.timeZone = sanitizeTimeZone(data.timeZone);
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
    if (reminder.alarmEnabled && ["dismissed", "failed"].includes(reminder.status)) {
      reminder.status = "scheduled";
      reminder.isClaimed = false;
      reminder.claimedAt = null;
      reminder.nextRetryAt = null;
    }
    await reminder.save();

    // Sync to Task if linked
    if (reminder.task) {
      await Task.updateOne(
        { _id: reminder.task },
        { reminderEnabled: reminder.alarmEnabled }
      );
    }

    res.json({ success: true, reminder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// SNOOZE REMINDER (Elapsed-time based with duration validation & concurrency safety)
export const snoozeReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminderId = req.params.id;

    const requestedMinutes = Number(req.body.durationMinutes);
    const minutes = Number.isInteger(requestedMinutes) && requestedMinutes > 0 && requestedMinutes <= 1440
      ? requestedMinutes
      : 5;

    const snoozedTime = new Date(Date.now() + minutes * 60 * 1000);

    // Concurrency-safe atomic transition: Only snooze if reminder exists and belongs to user
    const updated = await Reminder.findOneAndUpdate(
      {
        _id: reminderId,
        owner: userId,
        status: { $in: ["scheduled", "dispatched", "snoozed", "failed_retryable"] },
      },
      {
        status: "snoozed",
        snoozedUntil: snoozedTime,
        scheduledAt: snoozedTime,
        isClaimed: false,
        claimedAt: null,
        nextRetryAt: null,
        $inc: { occurrenceCount: 1 },
      },
      { new: true }
    ).populate("task", "title");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found or already completed/cancelled.",
      });
    }

    res.json({
      success: true,
      message: `Alarm snoozed for ${minutes} minutes until ${snoozedTime.toLocaleTimeString()}`,
      reminder: updated,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DISMISS REMINDER (Handles recurring wall-clock recurrence & completed tasks)
export const dismissReminder = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reminder = await Reminder.findOne({ _id: req.params.id, owner: userId }).populate("task");

    if (!reminder) {
      return res.status(404).json({ success: false, message: "Reminder not found" });
    }

    // Check if task is active and repeat is enabled
    const taskCompleted = !reminder.task || isCompleted(reminder.task.completed);

    if (!taskCompleted && reminder.repeat && reminder.repeat !== "never") {
      const userTz = sanitizeTimeZone(reminder.timeZone, "UTC");
      const nextOccurrence = getNextWallClockOccurrence(reminder.scheduledAt, reminder.repeat, userTz);

      if (nextOccurrence) {
        reminder.scheduledAt = nextOccurrence;
        reminder.status = "scheduled";
        reminder.isClaimed = false;
        reminder.claimedAt = null;
        reminder.snoozedUntil = null;
        reminder.nextRetryAt = null;
        reminder.deliveryAttempts = 0;
        reminder.occurrenceCount += 1;
        await reminder.save();

        return res.json({
          success: true,
          message: `Alarm dismissed. Next recurring alarm scheduled for ${nextOccurrence.toLocaleString()}.`,
          reminder,
        });
      }
    }

    // Non-repeating or task completed: mark dismissed
    reminder.status = "dismissed";
    reminder.isClaimed = false;
    reminder.claimedAt = null;
    reminder.snoozedUntil = null;
    reminder.nextRetryAt = null;
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
    if (deleted.task) {
      await Task.updateOne(
        { _id: deleted.task },
        { reminderEnabled: false, reminderAt: null }
      );
    }

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
    const data = { ...req.body };

    // Validate quietHours timezone if provided
    if (data.quietHours?.timeZone) {
      data.quietHours.timeZone = sanitizeTimeZone(data.quietHours.timeZone, "UTC");
    }

    const updated = await UserPreferences.findOneAndUpdate(
      { owner: userId },
      data,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, preferences: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
