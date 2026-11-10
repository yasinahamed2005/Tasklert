import ScheduledDelivery from "../models/ScheduledDelivery.js";
import EmailMessage from "../models/EmailMessage.js";
import Message from "../models/messageModel.js";
import User from "../models/userModel.js";
import { sendTasklertMail, sendOutboundEmail } from "../services/email/emailSend.service.js";
import { getClientForUser } from "../services/telegram/telegramClient.service.js";
import validator from "validator";

const formatOverviewDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

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
 * Retrieve comprehensive overview for QuickSend dashboard:
 * 1. This week statistics (Messages sent, emails sent, scheduled, pending)
 * 2. Recent messages across all channels
 * 3. Upcoming scheduled items
 */
export const getQuicksendOverview = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    // 1. Fetch live metrics for "This Week Overview"
    const [
      sentTgSched,
      sentMailSched,
      sentEmailsCount,
      sentMessagesCount,
      activeSchedCount,
      pendingCount,
    ] = await Promise.all([
      ScheduledDelivery.countDocuments({
        owner: userId,
        channel: "telegram",
        status: "sent",
        sentAt: { $gte: weekAgo },
      }).catch(() => 0),
      ScheduledDelivery.countDocuments({
        owner: userId,
        channel: { $in: ["tasklert_mail", "google_mail"] },
        status: "sent",
        sentAt: { $gte: weekAgo },
      }).catch(() => 0),
      EmailMessage.countDocuments({
        owner: userId,
        folder: "SENT",
        createdAt: { $gte: weekAgo },
      }).catch(() => 0),
      Message.countDocuments({
        owner: userId,
        status: "sent",
        createdAt: { $gte: weekAgo },
      }).catch(() => 0),
      ScheduledDelivery.countDocuments({
        owner: userId,
        status: "scheduled",
      }).catch(() => 0),
      ScheduledDelivery.countDocuments({
        owner: userId,
        status: "processing",
      }).catch(() => 0),
    ]);

    const messagesSent = Math.max(0, sentTgSched + sentMessagesCount);
    const emailsSent = Math.max(0, sentMailSched + sentEmailsCount);

    // 2. Fetch Recent Messages across all channels
    const [recentDeliveries, recentSentEmails, recentLegacyMessages] = await Promise.all([
      ScheduledDelivery.find({ owner: userId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      EmailMessage.find({ owner: userId, folder: "SENT" })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      Message.find({ owner: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
    ]);

    // Unify and normalize recent messages
    const unifiedRecent = [];

    for (const d of recentDeliveries) {
      unifiedRecent.push({
        id: String(d._id),
        channel: d.channel,
        recipient: d.channel === "telegram"
          ? (d.recipientName || d.recipientHandle || d.recipient)
          : (d.recipient ? (d.recipient.startsWith("To:") ? d.recipient : `To: ${d.recipient}`) : "To: (unspecified)"),
        recipientRaw: d.recipient,
        recipientName: d.recipientName || "",
        subject: d.subject || "",
        preview: d.message || d.subject || "",
        hasAttachment: Array.isArray(d.attachments) && d.attachments.length > 0,
        status: d.status === "scheduled" ? "scheduled" : d.status === "failed" ? "failed" : "sent",
        timestamp: d.status === "scheduled" ? (d.scheduledAt || d.createdAt) : (d.sentAt || d.createdAt),
        displayDate: formatOverviewDate(d.status === "scheduled" ? d.scheduledAt : (d.sentAt || d.createdAt)),
        timeZone: d.timeZone || "Asia/Kolkata",
        isScheduledItem: d.status === "scheduled",
      });
    }

    for (const em of recentSentEmails) {
      const rec = Array.isArray(em.to) ? em.to.join(", ") : em.to || "";
      unifiedRecent.push({
        id: String(em._id),
        channel: em.isTasklertMail ? "tasklert_mail" : "google_mail",
        recipient: rec ? (rec.startsWith("To:") ? rec : `To: ${rec}`) : "To: (unspecified)",
        recipientRaw: rec,
        recipientName: em.toName || "",
        subject: em.subject || "",
        preview: em.snippet || em.body || em.subject || "",
        hasAttachment: Array.isArray(em.attachments) && em.attachments.length > 0,
        status: "sent",
        timestamp: em.createdAt,
        displayDate: formatOverviewDate(em.createdAt),
        timeZone: "Asia/Kolkata",
        isScheduledItem: false,
      });
    }

    for (const lm of recentLegacyMessages) {
      unifiedRecent.push({
        id: String(lm._id),
        channel: lm.channel === "email" ? "google_mail" : (lm.channel || "telegram"),
        recipient: lm.channel === "telegram"
          ? (lm.contactName || lm.recipient)
          : (lm.recipient ? (lm.recipient.startsWith("To:") ? lm.recipient : `To: ${lm.recipient}`) : "To: (unspecified)"),
        recipientRaw: lm.recipient,
        recipientName: lm.contactName || "",
        subject: lm.subject || "",
        preview: lm.message || lm.subject || "",
        hasAttachment: Array.isArray(lm.attachments) && lm.attachments.length > 0,
        status: lm.status === "scheduled" ? "scheduled" : lm.status === "failed" ? "failed" : "sent",
        timestamp: lm.scheduledAt || lm.createdAt,
        displayDate: formatOverviewDate(lm.scheduledAt || lm.createdAt),
        timeZone: lm.timeZone || "Asia/Kolkata",
        isScheduledItem: lm.status === "scheduled",
      });
    }

    // Sort by timestamp descending and take top 10
    unifiedRecent.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentMessages = unifiedRecent.slice(0, 10);

    // 3. Fetch top upcoming Scheduled Items for right-side column
    const scheduledItemsRaw = await ScheduledDelivery.find({
      owner: userId,
      status: "scheduled",
    })
      .sort({ scheduledAt: 1 })
      .limit(6)
      .lean();

    const scheduledItems = scheduledItemsRaw.map((s) => ({
      id: String(s._id),
      channel: s.channel,
      recipient: s.channel === "telegram"
        ? (s.recipientName ? `To: ${s.recipientName}` : `To: ${s.recipient}`)
        : (s.recipient?.startsWith("To:") ? s.recipient : `To: ${s.recipient}`),
      recipientName: s.recipientName || "",
      subject: s.subject || s.message?.slice(0, 40) || "(No Subject)",
      message: s.message || "",
      scheduledAt: s.scheduledAt,
      timeZone: s.timeZone || "Asia/Kolkata",
      status: s.status,
      formattedTime: s.scheduledAt
        ? new Date(s.scheduledAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    }));

    return res.status(200).json({
      success: true,
      stats: {
        messagesSent,
        emailsSent,
        scheduled: activeSchedCount,
        pending: pendingCount,
      },
      recentMessages,
      scheduledItems,
    });
  } catch (err) {
    console.error("[Quicksend Overview] Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load QuickSend overview.",
    });
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


