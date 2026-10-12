import cron from "node-cron";
import Task from "../models/taskModel.js";
import Notification from "../models/notificationModel.js";
import Reminder from "../models/reminderModel.js";
import User from "../models/userModel.js";
import UserPreferences from "../models/userPreferencesModel.js";
import { sendEmail } from "../utils/mailer.js";
import { sendPushToUser } from "../services/pushService.js";

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const createNotification = async ({
  owner,
  task,
  kind,
  title,
  message,
  scheduledFor,
}) => {
  await Notification.updateOne(
    { owner, task, kind, scheduledFor },
    {
      $setOnInsert: {
        owner,
        task,
        kind,
        title,
        message,
        scheduledFor,
        read: false,
      },
    },
    { upsert: true }
  );
};

const isCompleted = (value) => {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "completed";
  }
  return false;
};

// Check if current time falls into user's quiet hours
const isWithinQuietHours = (prefs, now) => {
  if (!prefs?.quietHours?.enabled) return false;
  const { start, end } = prefs.quietHours;
  if (!start || !end) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);

  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight quiet hours (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
};

// Helper: Calculate next recurrence date
const getNextRecurringDate = (currentDate, repeat) => {
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

/**
 * 1. PROCESS EXACT-TIME SCHEDULED ALARMS & MULTI-DEVICE PUSH
 * Uses atomic claiming to prevent duplicate dispatch in clusters/restarts.
 */
const processScheduledAlarms = async (now) => {
  try {
    // Unstuck any jobs that were claimed more than 5 minutes ago without completion (e.g. crash recovery)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    await Reminder.updateMany(
      { isClaimed: true, claimedAt: { $lt: fiveMinutesAgo } },
      { isClaimed: false, claimedAt: null }
    );

    // Find all due alarms: scheduledAt <= now, enabled, status is scheduled or snoozed
    const dueReminders = await Reminder.find({
      alarmEnabled: true,
      status: { $in: ["scheduled", "snoozed"] },
      scheduledAt: { $lte: now },
      isClaimed: false,
    }).populate("task", "title description priority completed dueDate");

    for (const item of dueReminders) {
      // Atomically claim the reminder occurrence
      const claimed = await Reminder.findOneAndUpdate(
        {
          _id: item._id,
          isClaimed: false,
          status: { $in: ["scheduled", "snoozed"] },
        },
        {
          isClaimed: true,
          claimedAt: now,
        },
        { new: true }
      ).populate("task", "title description priority completed dueDate");

      if (!claimed) continue; // Claimed by another concurrent process

      // Rule: If task is completed or deleted, mark reminder completed and skip alert
      if (!claimed.task || isCompleted(claimed.task.completed)) {
        await Reminder.updateOne(
          { _id: claimed._id },
          {
            status: "completed",
            isClaimed: false,
            alarmEnabled: false,
          }
        );
        continue;
      }

      // Fetch user preferences
      const prefs = await UserPreferences.findOne({ owner: claimed.owner });
      const inQuietHours = isWithinQuietHours(prefs, now);

      const taskId = String(claimed.task._id || claimed.task);
      const reminderId = String(claimed._id);
      const appUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

      // 1. Dispatch Web Push to all active devices of the user
      if (claimed.channels?.push !== false) {
        const pushPayload = {
          title: `⏰ Tasklert Alarm: ${claimed.title}`,
          body: claimed.message || `Priority ${claimed.priority}: "${claimed.title}" is due now!`,
          icon: "/tasklert-icon.svg",
          badge: "/favicon.png",
          tag: `tasklert-alarm-${reminderId}`,
          url: `${appUrl}/?alarmId=${reminderId}&taskId=${taskId}`,
          alarmId: reminderId,
          taskId: taskId,
          priority: claimed.priority || "Medium",
          sound: claimed.sound || prefs?.defaultSound || "digital",
          volume: claimed.volume || prefs?.defaultVolume || 80,
          scheduledAt: claimed.scheduledAt,
          silent: inQuietHours,
          actions: [
            { action: "open", title: "Open Task" },
            { action: "snooze", title: `Snooze ${claimed.snoozeDuration || 5}m` },
            { action: "dismiss", title: "Dismiss" },
          ],
        };

        await sendPushToUser(claimed.owner, pushPayload, {
          reminderId: claimed._id,
          taskId: claimed.task._id,
          priority: claimed.priority,
        });
      }

      // 2. Create in-app notification for notification bell
      if (claimed.channels?.inApp !== false) {
        await createNotification({
          owner: claimed.owner,
          task: claimed.task._id,
          kind: "reminder",
          title: `⏰ Alarm: ${claimed.title}`,
          message: claimed.message || `Scheduled alarm for "${claimed.title}".`,
          scheduledFor: claimed.scheduledAt,
        });
      }

      // 3. Optional Email delivery if enabled on this reminder
      if (claimed.channels?.email) {
        const user = await User.findById(claimed.owner).select("name email");
        if (user?.email) {
          const actionLink = `${appUrl}/?taskId=${taskId}`;
          await sendEmail({
            to: user.email,
            subject: `⏰ Tasklert Alarm: ${claimed.title}`,
            text: `Hi ${user.name || "User"},\n\nThis is your scheduled Tasklert alarm for "${claimed.title}".\n\nOpen your workspace: ${actionLink}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e9d5ff; border-radius: 14px; background-color: #ffffff; max-width: 520px;">
                <div style="display: flex; align-items: center; margin-bottom: 16px;">
                  <span style="font-size: 24px; margin-right: 8px;">⏰</span>
                  <h2 style="color: #7e22ce; margin: 0;">Tasklert Scheduled Alarm</h2>
                </div>
                <p style="color: #334155; font-size: 15px;">Hi <strong>${user.name || "User"}</strong>,</p>
                <div style="background-color: #faf5ff; border-left: 4px solid #8b2cf5; padding: 14px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0; color: #1e1b4b; font-size: 16px; font-weight: bold;">${claimed.title}</p>
                  ${claimed.message ? `<p style="margin: 6px 0 0 0; color: #6b21a8; font-size: 13px;">${claimed.message}</p>` : ""}
                  <p style="margin: 6px 0 0 0; color: #64748b; font-size: 12px;">Priority: <strong>${claimed.priority}</strong></p>
                </div>
                <div style="text-align: center; margin-top: 24px;">
                  <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #8b2cf5 0%, #d946ef 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                    Open Tasklert &amp; Manage Task
                  </a>
                </div>
              </div>
            `,
          }).catch((err) => console.error("Email alarm dispatch error:", err.message));
        }
      }

      // 4. Update reminder occurrence state & handle repetition
      if (claimed.repeat && claimed.repeat !== "never") {
        const nextDate = getNextRecurringDate(claimed.scheduledAt, claimed.repeat);
        if (nextDate) {
          await Reminder.updateOne(
            { _id: claimed._id },
            {
              scheduledAt: nextDate,
              status: "scheduled",
              isClaimed: false,
              claimedAt: null,
              lastDispatchedAt: now,
              snoozedUntil: null,
              $inc: { occurrenceCount: 1 },
            }
          );
          continue;
        }
      }

      // If non-repeating, mark dispatched
      await Reminder.updateOne(
        { _id: claimed._id },
        {
          status: "dispatched",
          isClaimed: false,
          claimedAt: null,
          lastDispatchedAt: now,
          $inc: { occurrenceCount: 1 },
        }
      );
    }
  } catch (err) {
    console.error("processScheduledAlarms error:", err);
  }
};

// Check and send Priority-based email alerts
const processPriorityEmailAlerts = async (now) => {
  const tasks = await Task.find({
    dueDate: { $ne: null },
    completed: false,
  });

  for (const task of tasks) {
    if (isCompleted(task.completed)) continue;

    const dueMs = new Date(task.dueDate).getTime();
    if (now.getTime() >= dueMs) continue; // Past due, handle elsewhere

    const priority = (task.priority || "Low").toLowerCase();
    const sentAlerts = task.sentPriorityAlerts || [];

    const alertRules = [];
    if (priority === "low") {
      alertRules.push({ key: "low_18", hours: 18, subject: `Low Priority Task Reminder: ${task.title}` });
    } else if (priority === "medium") {
      alertRules.push({ key: "medium_24", hours: 24, subject: `Medium Priority Task Alert: ${task.title}` });
    } else if (priority === "high") {
      alertRules.push({ key: "high_32", hours: 32, subject: `High Priority Advance Notice (32h): ${task.title}` });
      alertRules.push({ key: "high_18", hours: 18, subject: `Urgent High Priority Alert (18h): ${task.title}` });
    }

    for (const rule of alertRules) {
      if (sentAlerts.includes(rule.key)) continue;

      const triggerTime = dueMs - rule.hours * 60 * 60 * 1000;
      if (now.getTime() >= triggerTime) {
        const user = await User.findById(task.owner).select("name email");
        if (!user?.email) continue;

        const dueString = new Date(task.dueDate).toLocaleString();
        const appUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
        const actionLink = `${appUrl}/pending`;

        try {
          await sendEmail({
            to: user.email,
            subject: rule.subject,
            text: `Hi ${user.name || "User"},\n\nYour ${task.priority} priority task "${task.title}" is due soon on ${dueString}.\n\nOpen Tasklert to complete your task: ${actionLink}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff; max-width: 500px;">
                <h2 style="color: #7e22ce; margin-top: 0;">Task Due Soon Alert ⏰</h2>
                <p style="color: #334155; font-size: 15px;">Hi <strong>${user.name || "User"}</strong>,</p>
                <p style="color: #334155; font-size: 14px; line-height: 1.5;">
                  Your <strong>${task.priority} Priority</strong> task <strong>"${task.title}"</strong> is due on <strong>${dueString}</strong> (in ~${rule.hours} hours).
                </p>
                <div style="margin-top: 25px; margin-bottom: 15px; text-align: center;">
                  <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #c026d3 0%, #7e22ce 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(126, 34, 206, 0.35);">
                    👉 Open Tasklert &amp; Complete Task
                  </a>
                </div>
                <p style="margin-top: 15px; color: #94a3b8; font-size: 12px; text-align: center;">Stay focused with Tasklert!</p>
              </div>
            `,
          });

          await Task.updateOne(
            { _id: task._id },
            { $addToSet: { sentPriorityAlerts: rule.key } }
          );
        } catch (err) {
          console.error(`Error sending ${rule.key} email for task ${task._id}:`, err.message);
        }
      }
    }
  }
};

// Check Smart Reminders (exact date and time email notification)
const processSmartReminders = async (now) => {
  const tasks = await Task.find({
    reminderEnabled: true,
    reminderAt: { $ne: null, $lte: now },
    completed: false,
    sentPriorityAlerts: { $ne: "smart_reminder" },
  });

  for (const task of tasks) {
    if (isCompleted(task.completed)) continue;

    const user = await User.findById(task.owner).select("name email");
    if (!user?.email) continue;

    const reminderTimeStr = new Date(task.reminderAt).toLocaleString();
    const appUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const actionLink = `${appUrl}/pending`;

    try {
      await sendEmail({
        to: user.email,
        subject: `Smart Reminder: ${task.title}`,
        text: `Hi ${user.name || "User"},\n\nThis is your Smart Reminder for task "${task.title}" scheduled for ${reminderTimeStr}.\n\nOpen Tasklert to complete your task: ${actionLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff; max-width: 500px;">
            <h2 style="color: #7e22ce; margin-top: 0;">Smart Task Reminder ⏰</h2>
            <p style="color: #334155; font-size: 15px;">Hi <strong>${user.name || "User"}</strong>,</p>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
              This is your requested Smart Reminder for: <strong>"${task.title}"</strong>
            </p>
            <p style="color: #475569; font-size: 14px;">Scheduled Time: <strong>${reminderTimeStr}</strong></p>
            <div style="margin-top: 25px; margin-bottom: 15px; text-align: center;">
              <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #c026d3 0%, #7e22ce 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(126, 34, 206, 0.35);">
                👉 Open Tasklert &amp; Complete Task
              </a>
            </div>
            <p style="margin-top: 15px; color: #94a3b8; font-size: 12px; text-align: center;">Stay productive with Tasklert!</p>
          </div>
        `,
      });

      await Task.updateOne(
        { _id: task._id },
        { $addToSet: { sentPriorityAlerts: "smart_reminder" } }
      );
    } catch (err) {
      console.error(`Smart reminder email error for task ${task._id}:`, err.message);
    }
  }
};

export const startReminderCron = () => {
  console.log("⏰ Starting Tasklert Smart Alarm & Reminder Dispatch Scheduler");

  // Run dispatch check immediately on server startup
  processScheduledAlarms(new Date()).catch(() => {});

  // High-precision scheduler: every 30 seconds
  const runCronCycle = async () => {
    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);

      // 1. Process Exact-Time Scheduled Alarms & Multi-Device Web Push
      await processScheduledAlarms(now);

      // 2. In-app notifications for due today / overdue
      const dueTodayTasks = await Task.find({
        dueDate: { $gte: todayStart, $lte: todayEnd },
        completed: false,
      });

      for (const task of dueTodayTasks) {
        await createNotification({
          owner: task.owner,
          task: task._id,
          kind: "due_today",
          title: "Due Today",
          message: `Task "${task.title}" is due today (${new Date(task.dueDate).toLocaleDateString()}).`,
          scheduledFor: todayStart,
        });
      }

      const overdueTasks = await Task.find({
        dueDate: { $lt: todayStart },
        completed: false,
      });

      for (const task of overdueTasks) {
        await createNotification({
          owner: task.owner,
          task: task._id,
          kind: "overdue",
          title: "Overdue Task",
          message: `Task "${task.title}" is overdue since ${new Date(task.dueDate).toLocaleDateString()}.`,
          scheduledFor: todayStart,
        });
      }

      // 3. Priority Email Schedule & Legacy Smart Reminders
      await processPriorityEmailAlerts(now);
      await processSmartReminders(now);
    } catch (err) {
      console.error("Reminder scheduler cycle error:", err.message);
    }
  };

  // Run every minute via node-cron
  cron.schedule("* * * * *", runCronCycle);

  // Also offset 30 seconds for 30-second sub-minute alarm precision
  setInterval(runCronCycle, 30000);
};
