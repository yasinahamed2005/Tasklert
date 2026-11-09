import ScheduledDelivery from "../../models/ScheduledDelivery.js";
import User from "../../models/userModel.js";
import Notification from "../../models/notificationModel.js";
import { sendTasklertMail } from "../email/emailSend.service.js";
import { sendOutboundEmail } from "../email/emailSend.service.js";
import { getClientForUser } from "../telegram/telegramClient.service.js";

/**
 * Calculates next date for recurring schedules
 */
const calculateNextOccurrence = (currentDate, repeatConfig, timeZone = "Asia/Kolkata") => {
  if (!repeatConfig || !repeatConfig.type || repeatConfig.type === "none") return null;

  const next = new Date(currentDate);
  const interval = Number(repeatConfig.interval) || 1;

  switch (repeatConfig.type) {
    case "daily":
      next.setDate(next.getDate() + interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7 * interval);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      break;
    default:
      return null;
  }

  if (repeatConfig.endDate && next > new Date(repeatConfig.endDate)) {
    return null;
  }

  return next;
};

/**
 * Creates in-app Tasklert notification for the user
 */
const notifyUser = async (userId, title, message) => {
  try {
    await Notification.create({
      owner: userId,
      title,
      message,
      kind: "system",
      scheduledFor: new Date(),
      read: false,
    });
  } catch (err) {
    console.warn("[UnifiedScheduler] Failed to create in-app notification:", err.message);
  }
};

/**
 * Core Background Worker: Atomically claims and dispatches due scheduled deliveries
 */
export const processDueUnifiedScheduledDeliveries = async (now = new Date()) => {
  try {
    // 1. Recover stale claims older than 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    await ScheduledDelivery.updateMany(
      { isClaimed: true, claimedAt: { $lt: fiveMinutesAgo }, status: "processing" },
      { isClaimed: false, claimedAt: null, status: "scheduled" }
    );

    // 2. Query due deliveries (either scheduled time arrived, or retry time reached)
    const dueItems = await ScheduledDelivery.find({
      status: "scheduled",
      isClaimed: false,
      $or: [
        { nextRetryAt: { $ne: null, $lte: now } },
        { nextRetryAt: null, scheduledAt: { $lte: now } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .limit(20);

    if (!dueItems.length) return;

    for (const item of dueItems) {
      // 3. Atomically claim item to prevent duplicate execution across workers
      const claimed = await ScheduledDelivery.findOneAndUpdate(
        { _id: item._id, isClaimed: false, status: "scheduled" },
        {
          isClaimed: true,
          claimedAt: now,
          status: "processing",
          $inc: { attempts: 1 },
        },
        { new: true }
      );

      if (!claimed) continue; // Concurrently claimed by another worker

      try {
        const user = await User.findById(claimed.owner);
        if (!user) {
          throw new Error("Sender account not found.");
        }

        let providerMessageId = null;
        let providerResponse = null;

        // 4. Dispatch based on channel
        if (claimed.channel === "tasklert_mail") {
          // Tasklert Mail internal delivery
          const result = await sendTasklertMail(user, {
            to: claimed.recipient,
            cc: claimed.cc,
            bcc: claimed.bcc,
            subject: claimed.subject,
            message: claimed.message,
            priority: claimed.priority,
            actionDeadline: claimed.actionDeadline,
            attachments: claimed.attachments,
          });
          providerMessageId = result?.messageId || `tl_${Date.now()}`;
          providerResponse = result;
        } else if (claimed.channel === "google_mail") {
          // Connected Gmail / SMTP delivery
          const result = await sendOutboundEmail(claimed.owner, {
            to: claimed.recipient,
            cc: claimed.cc,
            bcc: claimed.bcc,
            subject: claimed.subject,
            body: claimed.message,
            attachments: claimed.attachments,
          });
          providerMessageId = result?.messageId || result?.id || `gm_${Date.now()}`;
          providerResponse = result;
        } else if (claimed.channel === "telegram") {
          // Telegram MTProto delivery
          const client = await getClientForUser(claimed.owner);
          if (!client) {
            throw new Error("Telegram session is not connected or authorization expired.");
          }

          let sentResult;
          if (claimed.attachments && claimed.attachments.length > 0) {
            const att = claimed.attachments[0];
            sentResult = await client.sendFile(claimed.recipient, {
              file: att.diskPath || att.url,
              caption: claimed.message || "",
            });
          } else {
            sentResult = await client.sendMessage(claimed.recipient, {
              message: claimed.message,
            });
          }
          providerMessageId = String(sentResult?.id || Date.now());
          providerResponse = { id: sentResult?.id };
        } else {
          throw new Error(`Unsupported scheduled channel: ${claimed.channel}`);
        }

        // 5. Mark as sent successfully
        const deliveryTime = new Date();
        await ScheduledDelivery.updateOne(
          { _id: claimed._id },
          {
            status: "sent",
            sentAt: deliveryTime,
            isClaimed: false,
            claimedAt: null,
            providerMessageId,
            providerResponse,
            failureReason: null,
          }
        );

        // 6. In-app delivery success notification
        const channelLabel =
          claimed.channel === "tasklert_mail"
            ? "Tasklert Mail"
            : claimed.channel === "google_mail"
            ? "Google Mail"
            : "Telegram";
        const targetDesc = claimed.recipientName || claimed.recipient;
        await notifyUser(
          claimed.owner,
          `Scheduled ${channelLabel} Delivered`,
          `Your scheduled delivery to ${targetDesc} has been sent successfully.`
        );

        // 7. Handle recurrence if configured
        const nextOccurrence = calculateNextOccurrence(claimed.scheduledAt, claimed.repeat, claimed.timeZone);
        if (nextOccurrence) {
          await ScheduledDelivery.create({
            owner: claimed.owner,
            channel: claimed.channel,
            recipient: claimed.recipient,
            recipientName: claimed.recipientName,
            recipientHandle: claimed.recipientHandle,
            peerType: claimed.peerType,
            subject: claimed.subject,
            message: claimed.message,
            cc: claimed.cc,
            bcc: claimed.bcc,
            priority: claimed.priority,
            actionDeadline: claimed.actionDeadline,
            attachments: claimed.attachments,
            scheduledAt: nextOccurrence,
            timeZone: claimed.timeZone,
            status: "scheduled",
            repeat: claimed.repeat,
          });
        }
      } catch (sendErr) {
        console.error(`[UnifiedScheduler] Failed to dispatch delivery ${claimed._id}:`, sendErr.message);

        const currentAttempts = (claimed.attempts || 1);
        const maxRetries = claimed.maxRetries || 3;

        if (currentAttempts < maxRetries) {
          // Bounded exponential backoff: 30s, 60s, 120s... max 300s
          const backoffSec = Math.min(30 * Math.pow(2, currentAttempts - 1), 300);
          const nextRetryAt = new Date(now.getTime() + backoffSec * 1000);

          await ScheduledDelivery.updateOne(
            { _id: claimed._id },
            {
              status: "scheduled",
              isClaimed: false,
              claimedAt: null,
              nextRetryAt,
              failureReason: sendErr.message,
            }
          );
        } else {
          // Permanently failed after exhausting all retries
          await ScheduledDelivery.updateOne(
            { _id: claimed._id },
            {
              status: "failed",
              isClaimed: false,
              claimedAt: null,
              failedAt: new Date(),
              failureReason: sendErr.message,
            }
          );

          const channelLabel =
            claimed.channel === "tasklert_mail"
              ? "Tasklert Mail"
              : claimed.channel === "google_mail"
              ? "Google Mail"
              : "Telegram";
          const targetDesc = claimed.recipientName || claimed.recipient;
          await notifyUser(
            claimed.owner,
            `Scheduled ${channelLabel} Delivery Failed`,
            `Could not deliver message to ${targetDesc}: ${sendErr.message}`
          );
        }
      }
    }
  } catch (err) {
    console.error("[UnifiedScheduler] Worker cycle error:", err.message);
  }
};

