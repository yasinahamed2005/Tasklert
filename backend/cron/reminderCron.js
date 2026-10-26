import Task from "../models/taskModel.js";
import Notification from "../models/notificationModel.js";
import Reminder from "../models/reminderModel.js";
import User from "../models/userModel.js";
import UserPreferences from "../models/userPreferencesModel.js";
import DeliveryLog from "../models/deliveryLogModel.js";
import { sendEmail, isEmailConfigured, escapeHtml } from "../utils/mailer.js";
import { sendPushToUser, isVapidConfigured } from "../services/pushService.js";
import {
  isWithinQuietHours,
  getQuietHoursEndInstant,
  getNextWallClockOccurrence,
  sanitizeTimeZone,
} from "../utils/timeZone.js";
import { processScheduledMessages } from "./messageScheduler.js";


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

/**
 * 1. PROCESS EXACT-TIME SCHEDULED ALARMS & MULTI-DEVICE PUSH
 * Bounded query, atomic claiming, time-zone awareness, quiet-hours deferral,
 * and durable bounded retries for transient failures.
 */
export const processScheduledAlarms = async (now = new Date()) => {
  try {
    // A. Unstuck stale claims from crashed workers (claimed > 5 mins ago)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    await Reminder.updateMany(
      { isClaimed: true, claimedAt: { $lt: fiveMinutesAgo } },
      {
        isClaimed: false,
        claimedAt: null,
        $inc: { deliveryAttempts: 1 },
      }
    );

    // B. Find due reminders with bounded batch size
    const dueReminders = await Reminder.find({
      alarmEnabled: true,
      status: { $in: ["scheduled", "snoozed", "failed_retryable"] },
      $or: [
        { nextRetryAt: { $ne: null, $lte: now } },
        { nextRetryAt: null, scheduledAt: { $lte: now } },
      ],
      isClaimed: false,
    })
      .limit(50) // Bounded batch to avoid memory exhaustion & burst storms
      .populate("task", "title description priority completed dueDate");

    for (const item of dueReminders) {
      // C. Atomically claim the reminder occurrence
      const claimed = await Reminder.findOneAndUpdate(
        {
          _id: item._id,
          isClaimed: false,
          status: { $in: ["scheduled", "snoozed", "failed_retryable"] },
        },
        {
          isClaimed: true,
          claimedAt: now,
        },
        { new: true }
      ).populate("task", "title description priority completed dueDate");

      if (!claimed) continue; // Claimed concurrently by another process

      // D. Rule: If task is completed or deleted, mark reminder completed and skip alert
      if (!claimed.task || isCompleted(claimed.task.completed)) {
        await Reminder.updateOne(
          { _id: claimed._id },
          {
            status: "completed",
            isClaimed: false,
            alarmEnabled: false,
            claimedAt: null,
          }
        );
        continue;
      }

      // E. Check user preferences & quiet hours in user's IANA time zone
      const prefs = await UserPreferences.findOne({ owner: claimed.owner });
      const userTz = sanitizeTimeZone(claimed.timeZone || prefs?.quietHours?.timeZone || "UTC");
      const inQuietHours = isWithinQuietHours(prefs?.quietHours, now, userTz);

      // Handle Quiet Hours Deferral Mode
      if (inQuietHours && prefs?.quietHours?.mode === "defer") {
        const deferUntil = getQuietHoursEndInstant(prefs.quietHours, now, userTz);
        if (deferUntil && deferUntil > now) {
          await Reminder.updateOne(
            { _id: claimed._id },
            {
              scheduledAt: deferUntil,
              nextRetryAt: null,
              isClaimed: false,
              claimedAt: null,
              lastError: `Alarm deferred during quiet hours until ${deferUntil.toISOString()}`,
            }
          );

          await DeliveryLog.create({
            owner: claimed.owner,
            reminder: claimed._id,
            task: claimed.task._id,
            channel: "push",
            target: "Quiet Hours Deferral",
            status: "failed_retryable",
            statusCode: null,
            errorCategory: "quiet_hours_deferred",
            error: `Alarm deferred until quiet hours end at ${deferUntil.toISOString()}`,
            payloadSummary: claimed.title,
          }).catch(() => {});

          continue; // Successfully deferred, proceed to next reminder
        }
      }

      const taskId = String(claimed.task._id || claimed.task);
      const reminderId = String(claimed._id);
      const appUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

      // Generate stable idempotency occurrence tag
      const occurrenceId = `${reminderId}_${claimed.occurrenceCount || 0}_${new Date(claimed.scheduledAt).getTime()}`;

      let pushResult = null;
      let inAppSuccess = false;
      let emailSuccess = false;

      // 1. DISPATCH WEB PUSH
      if (claimed.channels?.push !== false) {
        if (isVapidConfigured()) {
          const pushPayload = {
            title: `⏰ Tasklert Alarm: ${claimed.title}`,
            body: claimed.message || `Priority ${claimed.priority}: "${claimed.title}" is due now!`,
            icon: "/tasklert-icon.svg",
            badge: "/favicon.png",
            tag: `tasklert-alarm-${occurrenceId}`,
            url: `${appUrl}/?alarmId=${reminderId}&taskId=${taskId}`,
            alarmId: reminderId,
            taskId: taskId,
            priority: claimed.priority || "Medium",
            sound: claimed.sound || prefs?.defaultSound || "digital",
            volume: inQuietHours ? 0 : (claimed.volume || prefs?.defaultVolume || 80),
            scheduledAt: claimed.scheduledAt,
            silent: inQuietHours,
            actions: [
              { action: "open", title: "Open Task" },
              { action: "snooze", title: `Snooze ${claimed.snoozeDuration || 5}m` },
              { action: "dismiss", title: "Dismiss" },
            ],
          };

          pushResult = await sendPushToUser(claimed.owner, pushPayload, {
            reminderId: claimed._id,
            taskId: claimed.task._id,
            priority: claimed.priority,
            attempt: (claimed.deliveryAttempts || 0) + 1,
          });
        }
      }

      // 2. DISPATCH IN-APP NOTIFICATION
      if (claimed.channels?.inApp !== false) {
        try {
          await createNotification({
            owner: claimed.owner,
            task: claimed.task._id,
            kind: "reminder",
            title: `⏰ Alarm: ${claimed.title}`,
            message: claimed.message || `Scheduled alarm for "${claimed.title}".`,
            scheduledFor: claimed.scheduledAt,
          });
          inAppSuccess = true;
        } catch (inAppErr) {
          console.error(`In-app notification error for reminder ${claimed._id}:`, inAppErr.message);
        }
      }

      // 3. DISPATCH EMAIL (If requested and configured)
      if (claimed.channels?.email && isEmailConfigured()) {
        const user = await User.findById(claimed.owner).select("name email");
        if (user?.email) {
          const actionLink = `${appUrl}/?taskId=${taskId}`;
          try {
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
                  <p style="color: #334155; font-size: 15px;">Hi <strong>${escapeHtml(user.name || "User")}</strong>,</p>
                  <div style="background-color: #faf5ff; border-left: 4px solid #8b2cf5; padding: 14px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 0; color: #1e1b4b; font-size: 16px; font-weight: bold;">${escapeHtml(claimed.title)}</p>
                    ${claimed.message ? `<p style="margin: 6px 0 0 0; color: #6b21a8; font-size: 13px;">${escapeHtml(claimed.message)}</p>` : ""}
                    <p style="margin: 6px 0 0 0; color: #64748b; font-size: 12px;">Priority: <strong>${claimed.priority}</strong></p>
                  </div>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #8b2cf5 0%, #d946ef 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                      Open Tasklert &amp; Manage Task
                    </a>
                  </div>
                </div>
              `,
            });
            emailSuccess = true;

            await DeliveryLog.create({
              owner: claimed.owner,
              reminder: claimed._id,
              task: claimed.task._id,
              channel: "email",
              target: user.email,
              status: "accepted",
              statusCode: 200,
              attempt: (claimed.deliveryAttempts || 0) + 1,
              payloadSummary: claimed.title,
            }).catch(() => {});
          } catch (emailErr) {
            console.error(`Email alarm dispatch error for reminder ${claimed._id}:`, emailErr.message);
            await DeliveryLog.create({
              owner: claimed.owner,
              reminder: claimed._id,
              task: claimed.task._id,
              channel: "email",
              target: user.email,
              status: "failed",
              statusCode: null,
              errorCategory: "email_failure",
              error: emailErr.message,
              attempt: (claimed.deliveryAttempts || 0) + 1,
              payloadSummary: claimed.title,
            }).catch(() => {});
          }
        }
      }

      // F. EVALUATE DISPATCH OUTCOMES & RETRIES
      const pushSuccess = pushResult ? pushResult.success : true;
      const anySuccess = (pushResult && pushResult.acceptedCount > 0) || inAppSuccess || emailSuccess;
      const pushFailedRetryable = pushResult && !pushResult.success && pushResult.hasRetryableError;

      // If all requested channels failed and push is retryable, apply exponential backoff
      if (!anySuccess && pushFailedRetryable) {
        const currentAttempts = (claimed.deliveryAttempts || 0) + 1;
        if (currentAttempts <= (claimed.maxRetries || 3)) {
          // Bounded exponential backoff: 30s, 60s, 120s, up to 300s
          const backoffSeconds = Math.min(30 * Math.pow(2, currentAttempts - 1), 300);
          const nextRetryAt = new Date(now.getTime() + backoffSeconds * 1000);

          await Reminder.updateOne(
            { _id: claimed._id },
            {
              status: "failed_retryable",
              isClaimed: false,
              claimedAt: null,
              deliveryAttempts: currentAttempts,
              nextRetryAt,
              lastError: pushResult?.errors?.[0] || "All channels failed, scheduled for retry",
            }
          );
          continue;
        } else {
          // Exceeded max retries: mark permanently failed
          await Reminder.updateOne(
            { _id: claimed._id },
            {
              status: "failed",
              isClaimed: false,
              claimedAt: null,
              nextRetryAt: null,
              deliveryAttempts: currentAttempts,
              lastError: "Maximum retry attempts exceeded",
            }
          );
          continue;
        }
      }

      // G. DISPATCH SUCCESSFUL: UPDATE OCCURRENCE / RECURRENCE
      // If repeating, calculate next wall-clock occurrence in user's timezone
      if (claimed.repeat && claimed.repeat !== "never") {
        const nextDate = getNextWallClockOccurrence(claimed.scheduledAt, claimed.repeat, userTz);
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
              deliveryAttempts: 0,
              nextRetryAt: null,
              lastError: null,
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
          deliveryAttempts: 0,
          nextRetryAt: null,
          lastError: null,
          $inc: { occurrenceCount: 1 },
        }
      );
    }
  } catch (err) {
    console.error("processScheduledAlarms error:", err);
  }
};

// Check and send Priority-based advance email alerts
export const processPriorityEmailAlerts = async (now = new Date()) => {
  if (!isEmailConfigured()) return;

  const tasks = await Task.find({
    dueDate: { $ne: null },
    completed: false,
  }).limit(50);

  for (const task of tasks) {
    if (isCompleted(task.completed)) continue;

    const dueMs = new Date(task.dueDate).getTime();
    if (now.getTime() >= dueMs) continue;

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

        // Atomic distributed claim to prevent duplicate dispatches
        const claimedTask = await Task.findOneAndUpdate(
          { _id: task._id, sentPriorityAlerts: { $ne: rule.key } },
          { $addToSet: { sentPriorityAlerts: rule.key } },
          { new: true }
        );
        if (!claimedTask) continue;

        try {
          const safeUserName = escapeHtml(user.name || "User");
          const safeTitle = escapeHtml(task.title || "");
          await sendEmail({
            to: user.email,
            subject: rule.subject,
            text: `Hi ${user.name || "User"},\n\nYour ${task.priority} priority task "${task.title}" is due soon on ${dueString}.\n\nOpen Tasklert to complete your task: ${actionLink}`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff; max-width: 500px;">
                <h2 style="color: #7e22ce; margin-top: 0;">Task Due Soon Alert ⏰</h2>
                <p style="color: #334155; font-size: 15px;">Hi <strong>${safeUserName}</strong>,</p>
                <p style="color: #334155; font-size: 14px; line-height: 1.5;">
                  Your <strong>${task.priority} Priority</strong> task <strong>"${safeTitle}"</strong> is due on <strong>${dueString}</strong> (in ~${rule.hours} hours).
                </p>
                <div style="margin-top: 25px; margin-bottom: 15px; text-align: center;">
                  <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #c026d3 0%, #7e22ce 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
                    👉 Open Tasklert &amp; Complete Task
                  </a>
                </div>
                <p style="margin-top: 15px; color: #94a3b8; font-size: 12px; text-align: center;">Stay focused with Tasklert!</p>
              </div>
            `,
          });
        } catch (err) {
          console.error(`Error sending ${rule.key} email for task ${task._id}:`, err.message);
        }
      }
    }
  }
};

// Check Smart Reminders (exact date and time email notification for tasks)
export const processSmartReminders = async (now = new Date()) => {
  if (!isEmailConfigured()) return;

  const tasks = await Task.find({
    reminderEnabled: true,
    reminderAt: { $ne: null, $lte: now },
    completed: false,
    sentPriorityAlerts: { $ne: "smart_reminder" },
  }).limit(50);

  for (const task of tasks) {
    if (isCompleted(task.completed)) continue;

    const user = await User.findById(task.owner).select("name email");
    if (!user?.email) continue;

    const reminderTimeStr = new Date(task.reminderAt).toLocaleString();
    const appUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const actionLink = `${appUrl}/pending`;

    // Atomic distributed claim to prevent duplicate smart reminders
    const claimedSmartTask = await Task.findOneAndUpdate(
      { _id: task._id, sentPriorityAlerts: { $ne: "smart_reminder" } },
      { $addToSet: { sentPriorityAlerts: "smart_reminder" } },
      { new: true }
    );
    if (!claimedSmartTask) continue;

    try {
      const safeUserName = escapeHtml(user.name || "User");
      const safeTitle = escapeHtml(task.title || "");
      await sendEmail({
        to: user.email,
        subject: `Smart Reminder: ${task.title}`,
        text: `Hi ${user.name || "User"},\n\nThis is your Smart Reminder for task "${task.title}" scheduled for ${reminderTimeStr}.\n\nOpen Tasklert to complete your task: ${actionLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff; max-width: 500px;">
            <h2 style="color: #7e22ce; margin-top: 0;">Smart Task Reminder ⏰</h2>
            <p style="color: #334155; font-size: 15px;">Hi <strong>${safeUserName}</strong>,</p>
            <p style="color: #334155; font-size: 14px; line-height: 1.5;">
              This is your requested Smart Reminder for: <strong>"${safeTitle}"</strong>
            </p>
            <p style="color: #475569; font-size: 14px;">Scheduled Time: <strong>${reminderTimeStr}</strong></p>
            <div style="margin-top: 25px; margin-bottom: 15px; text-align: center;">
              <a href="${actionLink}" target="_blank" style="background: linear-gradient(135deg, #c026d3 0%, #7e22ce 100%); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
                👉 Open Tasklert &amp; Complete Task
              </a>
            </div>
            <p style="margin-top: 15px; color: #94a3b8; font-size: 12px; text-align: center;">Stay productive with Tasklert!</p>
          </div>
        `,
      });
    } catch (err) {
      console.error(`Smart reminder email error for task ${task._id}:`, err.message);
    }
  }
};

// Execution mutex to prevent overlapping cycles
let isCronRunning = false;
let schedulerTimer = null;

export const runCronCycle = async () => {
  if (isCronRunning) {
    return; // Overlapping cycle skipped
  }

  isCronRunning = true;
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // 1. Process Exact-Time Scheduled Alarms & Multi-Device Web Push
    await processScheduledAlarms(now);

    // 2. In-app notifications for due today / overdue (Strictly idempotent by task & due date)
    const dueTodayTasks = await Task.find({
      dueDate: { $gte: todayStart, $lte: todayEnd },
      completed: false,
      isDeleted: { $ne: true },
    }).limit(50);

    for (const task of dueTodayTasks) {
      if (isCompleted(task.completed)) continue;
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
      isDeleted: { $ne: true },
    }).limit(50);

    for (const task of overdueTasks) {
      if (isCompleted(task.completed)) continue;
      // Anchor overdue notifications to the task's due date start so it is strictly idempotent
      // and never generates duplicate records for the same overdue task day after day
      const taskDueDay = startOfDay(new Date(task.dueDate));
      await createNotification({
        owner: task.owner,
        task: task._id,
        kind: "overdue",
        title: "Overdue Task",
        message: `Task "${task.title}" is overdue since ${new Date(task.dueDate).toLocaleDateString()}.`,
        scheduledFor: taskDueDay,
      });
    }

    // 3. Priority Email Schedule & Legacy Smart Reminders
    await processPriorityEmailAlerts(now);
    await processSmartReminders(now);

    // 4. QuickSend Scheduled Message Delivery Engine
    await processScheduledMessages(now);
  } catch (err) {
    console.error("Reminder scheduler cycle error:", err.message);
  } finally {
    isCronRunning = false;
  }
};

export const startReminderCron = () => {
  if (schedulerTimer) return; // Prevent duplicate interval registration

  console.log("⏰ Tasklert Smart Alarm Scheduler active (30s interval with concurrency lock)");

  // Initial immediate cycle on startup
  runCronCycle().catch(() => {});

  // High-precision 30s scheduler loop with mutex guard
  schedulerTimer = setInterval(runCronCycle, 30000);
};

export const stopReminderCron = () => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  isCronRunning = false;
};
