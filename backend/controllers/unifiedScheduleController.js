import ScheduledDelivery from "../models/ScheduledDelivery.js";
import User from "../models/userModel.js";
import { sendTasklertMail, sendOutboundEmail } from "../services/email/emailSend.service.js";
import { getClientForUser } from "../services/telegram/telegramClient.service.js";
import validator from "validator";

/**
 * Create a new scheduled delivery for Tasklert Mail, Google Mail, or Telegram
 */
export const createScheduledDelivery = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const {
      channel,
      recipient,
      recipientName,
      recipientHandle,
      peerType,
      subject,
      message,
      cc,
      bcc,
      priority,
      actionDeadline,
      attachments,
      scheduledAt,
      timeZone,
      repeat,
    } = req.body;

    // 1. Channel validation
    if (!channel || !["tasklert_mail", "google_mail", "telegram"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel. Must be 'tasklert_mail', 'google_mail', or 'telegram'.",
      });
    }

    // 2. Recipient validation
    const cleanRecipient = String(recipient || "").trim();
    if (!cleanRecipient) {
      return res.status(400).json({ success: false, message: "Recipient is required." });
    }

    if (["tasklert_mail", "google_mail"].includes(channel)) {
      if (!validator.isEmail(cleanRecipient)) {
        return res.status(400).json({
          success: false,
          message: `Invalid recipient email address format: "${cleanRecipient}"`,
        });
      }
    }

    // 3. Content validation
    const cleanMessage = String(message || "").trim();
    const cleanSubject = String(subject || "").trim();
    if (!cleanMessage && (!attachments || attachments.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Message body or attachment is required.",
      });
    }

    // 4. Date validation
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: "Delivery date and time is required." });
    }

    const targetDate = new Date(scheduledAt);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date or time provided." });
    }

    if (targetDate.getTime() <= Date.now() + 10000) {
      return res.status(400).json({
        success: false,
        message: "Scheduled delivery time must be at least 10 seconds in the future.",
      });
    }

    // 5. Parse arrays
    const ccList = Array.isArray(cc) ? cc : cc ? [cc] : [];
    const bccList = Array.isArray(bcc) ? bcc : bcc ? [bcc] : [];

    const delivery = await ScheduledDelivery.create({
      owner: userId,
      channel,
      recipient: cleanRecipient,
      recipientName: recipientName || cleanRecipient,
      recipientHandle: recipientHandle || "",
      peerType: peerType || "user",
      subject: cleanSubject,
      message: cleanMessage,
      cc: ccList,
      bcc: bccList,
      priority: priority || "normal",
      actionDeadline: actionDeadline ? new Date(actionDeadline) : null,
      attachments: attachments || [],
      scheduledAt: targetDate,
      timeZone: timeZone || "Asia/Kolkata",
      status: "scheduled",
      repeat: repeat || { type: "none" },
    });

    return res.status(201).json({
      success: true,
      message: "Delivery scheduled successfully.",
      delivery,
    });
  } catch (err) {
    console.error("[UnifiedSchedule] Create error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to schedule delivery." });
  }
};

/**
 * Retrieve list of scheduled deliveries with filtering
 */
export const getScheduledDeliveries = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { channel, status, search, limit = 50 } = req.query;

    const query = { owner: userId };

    if (channel && channel !== "all") {
      query.channel = channel;
    }

    if (req.query.recipient) {
      const rec = String(req.query.recipient).trim();
      query.$or = [
        { recipient: rec },
        { recipientHandle: rec },
        { recipientHandle: `@${rec.replace(/^@/, "")}` },
      ];
    }

    if (status && status !== "all") {
      if (status === "upcoming") {
        query.status = "scheduled";
        query.scheduledAt = { $gte: new Date() };
      } else {
        query.status = status;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { recipient: regex },
        { recipientName: regex },
        { subject: regex },
        { message: regex },
      ];
    }

    const deliveries = await ScheduledDelivery.find(query)
      .sort({ scheduledAt: 1 })
      .limit(Number(limit) || 50)
      .lean();

    return res.status(200).json({
      success: true,
      deliveries,
      count: deliveries.length,
    });
  } catch (err) {
    console.error("[UnifiedSchedule] Get error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load scheduled items." });
  }
};

/**
 * Retrieve comprehensive statistics for the Scheduled dashboard
 */
export const getScheduledStats = async (req, res) => {
  try {
    const userId = req.user?._id;
    const now = new Date();

    const [
      totalCount,
      tasklertMailCount,
      googleMailCount,
      telegramCount,
      upcomingCount,
      completedCount,
      failedCount,
      cancelledCount,
    ] = await Promise.all([
      ScheduledDelivery.countDocuments({ owner: userId, status: "scheduled" }),
      ScheduledDelivery.countDocuments({ owner: userId, channel: "tasklert_mail", status: "scheduled" }),
      ScheduledDelivery.countDocuments({ owner: userId, channel: "google_mail", status: "scheduled" }),
      ScheduledDelivery.countDocuments({ owner: userId, channel: "telegram", status: "scheduled" }),
      ScheduledDelivery.countDocuments({ owner: userId, status: "scheduled", scheduledAt: { $gte: now } }),
      ScheduledDelivery.countDocuments({ owner: userId, status: "sent" }),
      ScheduledDelivery.countDocuments({ owner: userId, status: "failed" }),
      ScheduledDelivery.countDocuments({ owner: userId, status: "cancelled" }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalCount,
        tasklertMailCount,
        googleMailCount,
        telegramCount,
        upcomingCount,
        completedCount,
        failedCount,
        cancelledCount,
      },
    });
  } catch (err) {
    console.error("[UnifiedSchedule] Stats error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to load schedule stats." });
  }
};

/**
 * Retrieve single scheduled item details
 */
export const getScheduledDeliveryById = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const delivery = await ScheduledDelivery.findOne({ _id: id, owner: userId }).lean();
    if (!delivery) {
      return res.status(404).json({ success: false, message: "Scheduled delivery not found." });
    }

    return res.status(200).json({ success: true, delivery });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Reschedule or Edit an upcoming delivery before dispatch
 */
export const updateScheduledDelivery = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { subject, message, recipient, recipientName, scheduledAt, timeZone, repeat } = req.body;

    const item = await ScheduledDelivery.findOne({ _id: id, owner: userId });
    if (!item) {
      return res.status(404).json({ success: false, message: "Scheduled delivery not found." });
    }

    if (item.status === "sent") {
      return res.status(400).json({ success: false, message: "Cannot modify a delivery that was already sent." });
    }

    if (item.status === "processing") {
      return res.status(400).json({
        success: false,
        message: "Delivery is currently being processed by the worker and cannot be altered.",
      });
    }

    if (scheduledAt) {
      const nextDate = new Date(scheduledAt);
      if (isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now() + 5000) {
        return res.status(400).json({ success: false, message: "Rescheduled time must be in the future." });
      }
      item.scheduledAt = nextDate;
    }

    if (subject !== undefined) item.subject = String(subject).trim();
    if (message !== undefined) item.message = String(message).trim();
    if (recipient !== undefined) item.recipient = String(recipient).trim();
    if (recipientName !== undefined) item.recipientName = String(recipientName).trim();
    if (timeZone !== undefined) item.timeZone = timeZone;
    if (repeat !== undefined) item.repeat = repeat;

    item.status = "scheduled";
    item.failureReason = null;
    item.nextRetryAt = null;

    await item.save();

    return res.status(200).json({
      success: true,
      message: "Delivery updated successfully.",
      delivery: item,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Atomically cancel a scheduled delivery
 */
export const cancelScheduledDelivery = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const updated = await ScheduledDelivery.findOneAndUpdate(
      { _id: id, owner: userId, status: { $in: ["scheduled", "draft"] }, isClaimed: false },
      { status: "cancelled" },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Delivery could not be cancelled (it may already be sent, processing, or cancelled).",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Scheduled delivery cancelled successfully.",
      delivery: updated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Duplicate an existing delivery as a new schedule
 */
export const duplicateScheduledDelivery = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const { scheduledAt } = req.body;

    const source = await ScheduledDelivery.findOne({ _id: id, owner: userId }).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "Source delivery not found." });
    }

    const nextDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 60 * 60 * 1000); // 1 hr from now
    if (isNaN(nextDate.getTime()) || nextDate.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, message: "Scheduled date must be in the future." });
    }

    const duplicated = await ScheduledDelivery.create({
      owner: userId,
      channel: source.channel,
      recipient: source.recipient,
      recipientName: source.recipientName,
      recipientHandle: source.recipientHandle,
      peerType: source.peerType,
      subject: source.subject,
      message: source.message,
      cc: source.cc,
      bcc: source.bcc,
      priority: source.priority,
      actionDeadline: source.actionDeadline,
      attachments: source.attachments,
      scheduledAt: nextDate,
      timeZone: source.timeZone,
      status: "scheduled",
      repeat: source.repeat,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery duplicated successfully.",
      delivery: duplicated,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Send an existing scheduled message immediately
 */
export const sendNowScheduledDelivery = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const delivery = await ScheduledDelivery.findOne({ _id: id, owner: userId });
    if (!delivery) {
      return res.status(404).json({ success: false, message: "Scheduled delivery not found." });
    }
    if (delivery.status === "sent") {
      return res.status(400).json({ success: false, message: "Delivery has already been sent." });
    }

    delivery.isClaimed = true;
    delivery.claimedAt = new Date();
    delivery.status = "processing";
    await delivery.save();

    let providerMessageId = null;
    const user = await User.findById(userId);

    if (delivery.channel === "telegram") {
      const tgClient = await getClientForUser(userId);
      let targetPeer = delivery.recipient;
      if (/^-?\d+$/.test(targetPeer)) targetPeer = BigInt(targetPeer);
      const sent = await tgClient.sendMessage(targetPeer, { message: delivery.message });
      providerMessageId = sent?.id ? String(sent.id) : `tg_${Date.now()}`;
    } else if (delivery.channel === "tasklert_mail") {
      const result = await sendTasklertMail(user, {
        to: delivery.recipient,
        cc: delivery.cc,
        bcc: delivery.bcc,
        subject: delivery.subject,
        message: delivery.message,
        priority: delivery.priority,
        actionDeadline: delivery.actionDeadline,
        attachments: delivery.attachments,
      });
      providerMessageId = result?.messageId || `tl_${Date.now()}`;
    } else if (delivery.channel === "google_mail") {
      const result = await sendOutboundEmail(delivery.owner, {
        to: delivery.recipient,
        cc: delivery.cc,
        bcc: delivery.bcc,
        subject: delivery.subject,
        body: delivery.message,
        attachments: delivery.attachments,
      });
      providerMessageId = result?.messageId || `gm_${Date.now()}`;
    }

    delivery.status = "sent";
    delivery.sentAt = new Date();
    delivery.providerMessageId = providerMessageId;
    delivery.isClaimed = false;
    delivery.claimedAt = null;
    await delivery.save();

    return res.status(200).json({
      success: true,
      message: "Message delivered successfully.",
      delivery,
    });
  } catch (err) {
    await ScheduledDelivery.findByIdAndUpdate(req.params.id, {
      isClaimed: false,
      claimedAt: null,
      status: "failed",
      failedAt: new Date(),
      failureReason: err.message,
    });
    return res.status(500).json({ success: false, message: err.message || "Failed to dispatch message." });
  }
};


