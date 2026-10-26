import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Message from "../models/messageModel.js";
import { dispatchQuickSendMessage } from "../services/quicksendService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "messages");

/**
 * Reads attachment buffers from disk if present for scheduled messages
 */
const loadAttachmentsFromDisk = (attachments = []) => {
  if (!attachments || !attachments.length) return [];
  return attachments
    .map((att) => {
      try {
        if (att.url && att.url.includes("/uploads/messages/")) {
          const filename = path.basename(att.url);
          const diskPath = path.join(UPLOAD_DIR, filename);
          if (fs.existsSync(diskPath)) {
            return {
              originalname: att.filename,
              filename: att.filename,
              mimetype: att.mimeType,
              buffer: fs.readFileSync(diskPath),
            };
          }
        }
      } catch (err) {
        console.warn(`Could not read scheduled attachment ${att.filename}:`, err.message);
      }
      return null;
    })
    .filter(Boolean);
};

/**
 * Processes due scheduled messages with atomic claiming,
 * exponential backoff retry on transient failures, and bounded batching.
 */
export const processScheduledMessages = async (now = new Date()) => {
  try {
    // 1. Unstuck stale claims older than 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    await Message.updateMany(
      { isClaimed: true, claimedAt: { $lt: fiveMinutesAgo } },
      {
        isClaimed: false,
        claimedAt: null,
        $inc: { deliveryAttempts: 1 },
      }
    );

    // 2. Query due messages
    const dueMessages = await Message.find({
      status: "scheduled",
      isClaimed: false,
      $or: [
        { nextRetryAt: { $ne: null, $lte: now } },
        { nextRetryAt: null, scheduledAt: { $lte: now } },
      ],
    })
      .sort({ scheduledAt: 1 })
      .limit(50);

    for (const item of dueMessages) {
      // 3. Atomically claim
      const claimed = await Message.findOneAndUpdate(
        {
          _id: item._id,
          isClaimed: false,
          status: "scheduled",
        },
        {
          isClaimed: true,
          claimedAt: now,
          status: "processing",
        },
        { new: true }
      );

      if (!claimed) continue; // Claimed concurrently by another process

      try {
        // Load attachments if any
        const files = loadAttachmentsFromDisk(claimed.attachments);

        // Dispatch via provider
        const result = await dispatchQuickSendMessage({
          channel: claimed.channel,
          recipient: claimed.recipient,
          subject: claimed.subject || "",
          message: claimed.message || "",
          reaction: claimed.reaction || "",
          files,
        });

        // Mark sent
        await Message.updateOne(
          { _id: claimed._id },
          {
            status: "sent",
            sentAt: now,
            isClaimed: false,
            claimedAt: null,
            providerMessageId: result?.providerMessageId || null,
            providerResponse: result?.raw || null,
            error: null,
          }
        );
      } catch (sendErr) {
        console.error(`Scheduled message dispatch error (${claimed._id}):`, sendErr.message);

        const currentAttempts = (claimed.deliveryAttempts || 0) + 1;
        const maxRetries = claimed.maxRetries || 3;

        if (currentAttempts < maxRetries) {
          // Bounded exponential backoff: 30s, 60s, 120s... max 300s
          const backoffSec = Math.min(30 * Math.pow(2, currentAttempts - 1), 300);
          const nextRetryAt = new Date(now.getTime() + backoffSec * 1000);

          await Message.updateOne(
            { _id: claimed._id },
            {
              status: "scheduled",
              isClaimed: false,
              claimedAt: null,
              deliveryAttempts: currentAttempts,
              nextRetryAt,
              error: sendErr.message,
            }
          );
        } else {
          // Reached max retries
          await Message.updateOne(
            { _id: claimed._id },
            {
              status: "failed",
              isClaimed: false,
              claimedAt: null,
              deliveryAttempts: currentAttempts,
              nextRetryAt: null,
              error: sendErr.message,
            }
          );
        }
      }
    }
  } catch (err) {
    console.error("processScheduledMessages error:", err.message);
  }
};
