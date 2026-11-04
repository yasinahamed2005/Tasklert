import TelegramScheduledMessage from "../../models/TelegramScheduledMessage.js";
import { getClientForUser } from "./telegramClient.service.js";

/**
 * Schedule a Telegram message for future dispatch
 */
export const createScheduledMessage = async (
  userId,
  { peerId, peerType = "user", recipientName, recipientHandle, message, scheduledAt, attachments = [] }
) => {
  if (!userId) throw new Error("Authenticated user required.");
  if (!peerId) throw new Error("Recipient peer ID is required.");
  if (!message && (!attachments || attachments.length === 0)) {
    throw new Error("Message text or attachment is required.");
  }

  const dateObj = new Date(scheduledAt);
  if (isNaN(dateObj.getTime()) || dateObj <= new Date()) {
    throw new Error("Please select a valid future date and time.");
  }

  const scheduled = await TelegramScheduledMessage.create({
    owner: userId,
    peerId: String(peerId),
    peerType,
    recipientName: recipientName || "Telegram Contact",
    recipientHandle: recipientHandle || "",
    message: message || "",
    attachments: attachments || [],
    scheduledAt: dateObj,
    status: "scheduled",
  });

  return scheduled;
};

/**
 * Retrieve all upcoming scheduled messages for a user
 */
export const getUserScheduledMessages = async (userId) => {
  return await TelegramScheduledMessage.find({ owner: userId }).sort({ scheduledAt: 1 });
};

/**
 * Update / Reschedule an existing scheduled message
 */
export const updateScheduledMessage = async (userId, messageId, updates) => {
  const msg = await TelegramScheduledMessage.findOne({ _id: messageId, owner: userId });
  if (!msg) throw new Error("Scheduled message not found.");
  if (msg.status === "sent") throw new Error("Cannot modify an already sent message.");

  if (updates.scheduledAt) {
    const newDate = new Date(updates.scheduledAt);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      throw new Error("Rescheduled time must be in the future.");
    }
    msg.scheduledAt = newDate;
  }

  if (updates.message !== undefined) {
    msg.message = updates.message;
  }

  if (updates.status && ["scheduled", "cancelled"].includes(updates.status)) {
    msg.status = updates.status;
  }

  await msg.save();
  return msg;
};

/**
 * Cancel a scheduled message
 */
export const cancelScheduledMessage = async (userId, messageId) => {
  const msg = await TelegramScheduledMessage.findOneAndUpdate(
    { _id: messageId, owner: userId, status: "scheduled" },
    { status: "cancelled" },
    { new: true }
  );

  if (!msg) throw new Error("Scheduled message not found or cannot be cancelled.");
  return msg;
};

/**
 * Background worker task: Atomically process due scheduled Telegram messages
 */
export const processDueTelegramScheduledMessages = async () => {
  const now = new Date();

  // 1. Recover stale claims older than 5 minutes
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  await TelegramScheduledMessage.updateMany(
    { isClaimed: true, claimedAt: { $lt: fiveMinutesAgo }, status: "processing" },
    { isClaimed: false, claimedAt: null, status: "scheduled" }
  );

  // 2. Find due messages
  const dueMessages = await TelegramScheduledMessage.find({
    status: "scheduled",
    isClaimed: false,
    scheduledAt: { $lte: now },
  }).limit(10);

  for (const msg of dueMessages) {
    // Atomically claim message
    const claimed = await TelegramScheduledMessage.findOneAndUpdate(
      { _id: msg._id, isClaimed: false, status: "scheduled" },
      { isClaimed: true, claimedAt: new Date(), status: "processing", $inc: { attempts: 1 } },
      { new: true }
    );

    if (!claimed) continue;

    try {
      // Load user's TelegramClient
      const client = await getClientForUser(claimed.owner);
      if (!client) {
        throw new Error("Sender's Telegram session is not connected or revoked.");
      }

      let sentResult;
      if (claimed.attachments && claimed.attachments.length > 0) {
        // Send with attachment
        const att = claimed.attachments[0];
        sentResult = await client.sendFile(claimed.peerId, {
          file: att.diskPath || att.url,
          caption: claimed.message || "",
        });
      } else {
        // Send pure text message
        sentResult = await client.sendMessage(claimed.peerId, {
          message: claimed.message,
        });
      }

      claimed.status = "sent";
      claimed.sentAt = new Date();
      claimed.telegramMessageId = sentResult?.id || null;
      claimed.error = null;
      claimed.isClaimed = false;
      await claimed.save();

      console.log(`[TelegramScheduler] Dispatched message ${claimed._id} to ${claimed.recipientName} (Tg ID: ${claimed.telegramMessageId})`);
    } catch (err) {
      console.error(`[TelegramScheduler] Dispatch failure for message ${claimed._id}:`, err.message);
      claimed.error = err.message;
      claimed.isClaimed = false;

      // Fail permanently if attempts exceed 3
      if (claimed.attempts >= 3) {
        claimed.status = "failed";
      } else {
        claimed.status = "scheduled";
      }
      await claimed.save();
    }
  }
};
