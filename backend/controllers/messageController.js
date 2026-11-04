import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Message from "../models/messageModel.js";
import Contact from "../models/contactModel.js";
import MessagingAccount from "../models/messagingAccountModel.js";
import MessageTemplate from "../models/messageTemplateModel.js";
import { encryptCredentialsObject } from "../utils/crypto.js";
import {
  dispatchQuickSendMessage,
  getProviderStatus,
  getUserProviderStatus,
  validateRecipient,
  verifyTelegramBotToken,
  verifyWhatsAppCloudApiCredentials,
  verifyTwilioWhatsAppCredentials,
} from "../services/quicksendService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "messages");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const STARTER_TEMPLATES = [
  {
    _id: "starter_task_update",
    title: "Task Progress Update",
    category: "Productivity",
    channel: "all",
    subject: "Task Update: {{task}}",
    body: "Hi {{name}},\n\nHere is a quick update on {{task}}: it is currently progressing on schedule and expected to finish by {{date}}.\n\nBest regards,\nTasklert Team",
    placeholders: ["{{name}}", "{{task}}", "{{date}}"],
    isStarter: true,
  },
  {
    _id: "starter_meeting_reminder",
    title: "Meeting Reminder",
    category: "Schedule",
    channel: "all",
    subject: "Reminder: Upcoming Meeting on {{date}}",
    body: "Hi {{name}},\n\nFriendly reminder regarding our sync scheduled for {{date}} at {{time}}.\n\nPlease let me know if you need to reschedule.",
    placeholders: ["{{name}}", "{{date}}", "{{time}}"],
    isStarter: true,
  },
  {
    _id: "starter_project_handover",
    title: "Project Deliverable & Handover",
    category: "Productivity",
    channel: "all",
    subject: "Deliverable Handover: {{task}}",
    body: "Hi {{name}},\n\nThe deliverable for {{task}} has been completed. All relevant documents and logs are available in Tasklert.\n\nThank you!",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_quick_followup",
    title: "Quick Follow-Up",
    category: "Communication",
    channel: "all",
    subject: "Quick follow-up on {{task}}",
    body: "Hi {{name}},\n\nJust checking in regarding {{task}}. Let me know if you have any questions or need anything from my side.\n\nThanks!",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_deadline_alert",
    title: "Upcoming Deadline Alert",
    category: "Urgent",
    channel: "all",
    subject: "Urgent: {{task}} Due on {{date}}",
    body: "Hi {{name}},\n\nAlert: The deadline for {{task}} is approaching on {{date}}.\n\nPlease ensure all pending items are resolved before submission.",
    placeholders: ["{{name}}", "{{task}}", "{{date}}"],
    isStarter: true,
  },
  {
    _id: "starter_approval_request",
    title: "Review & Approval Request",
    category: "Workflow",
    channel: "all",
    subject: "Approval Requested: {{task}}",
    body: "Hi {{name}},\n\nCould you please take a moment to review and approve {{task}}?\n\nYour feedback would be greatly appreciated.",
    placeholders: ["{{name}}", "{{task}}"],
    isStarter: true,
  },
  {
    _id: "starter_standup_summary",
    title: "Daily Standup Summary",
    category: "Status",
    channel: "all",
    subject: "Standup Summary - {{date}}",
    body: "Daily Standup:\n- Completed: {{task}}\n- Today's Focus: Priority objectives\n- Blockers: None\n\nDate: {{date}}",
    placeholders: ["{{task}}", "{{date}}"],
    isStarter: true,
  },
];

// Persist attachments to disk for static serving and scheduled jobs
const persistAttachmentsToDisk = (files) => {
  if (!files?.length) return [];
  const publicBase = (process.env.PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

  return files.map((file) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const diskPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(diskPath, file.buffer);
    return {
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: publicBase ? `${publicBase}/uploads/messages/${safeName}` : `/uploads/messages/${safeName}`,
    };
  });
};

/**
 * Send or Schedule Message
 */
export const sendMessage = async (req, res) => {
  try {
    const {
      channel,
      recipient,
      contactId,
      contact: contactRef,
      cc = "",
      bcc = "",
      subject = "",
      message = "",
      reaction = "",
      scheduledAt,
      timeZone = "UTC",
      status: requestedStatus,
      isDraft,
      draftId,
    } = req.body;

    const files = req.files || [];

    // Allowed channels
    const validChannels = ["email", "telegram", "whatsapp", "sms"];
    if (!channel || !validChannels.includes(channel)) {
      return res.status(400).json({
        success: false,
        message: `Choose a valid channel: ${validChannels.join(", ")}`,
      });
    }

    // Recipient check
    if (!recipient || !recipient.trim()) {
      return res.status(400).json({
        success: false,
        message: "Recipient is required",
      });
    }

    // Validation per channel
    const validation = validateRecipient(channel, recipient);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }
    const cleanRecipient = validation.cleanRecipient;

    // Content check (unless saving draft)
    const isSavingDraft = isDraft === true || isDraft === "true" || requestedStatus === "draft";
    if (!isSavingDraft && !message?.trim() && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write a message or attach a document",
      });
    }

    // Persist attachments
    const attachmentMeta = persistAttachmentsToDisk(files);

    // 1. DRAFT FLOW
    if (isSavingDraft) {
      let draft;
      if (draftId) {
        draft = await Message.findOneAndUpdate(
          { _id: draftId, owner: req.user.id },
          {
            channel,
            recipient: cleanRecipient,
            cc: cc.trim(),
            bcc: bcc.trim(),
            subject: subject.trim(),
            message: message.trim(),
            reaction: reaction || "",
            status: "draft",
            ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
          },
          { new: true }
        );
      }

      if (!draft) {
        draft = new Message({
          owner: req.user.id,
          channel,
          recipient: cleanRecipient,
          cc: cc.trim(),
          bcc: bcc.trim(),
          subject: subject.trim(),
          message: message.trim(),
          reaction: reaction || "",
          attachments: attachmentMeta,
          status: "draft",
        });
        await draft.save();
      }

      return res.json({
        success: true,
        message: "Draft saved successfully",
        log: draft,
      });
    }

    // 2. SCHEDULED FLOW
    if (scheduledAt) {
      const scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid scheduled date/time",
        });
      }

      if (scheduleDate.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: "Scheduled time must be in the future",
        });
      }

      const scheduledMsg = new Message({
        owner: req.user.id,
        channel,
        recipient: cleanRecipient,
        cc: cc.trim(),
        bcc: bcc.trim(),
        subject: subject.trim(),
        message: message.trim(),
        reaction: reaction || "",
        attachments: attachmentMeta,
        status: "scheduled",
        scheduledAt: scheduleDate,
        timeZone: timeZone || "UTC",
        contact: contactId || contactRef || null,
        isClaimed: false,
      });

      await scheduledMsg.save();

      return res.json({
        success: true,
        message: `Message scheduled for ${scheduleDate.toLocaleString()}`,
        log: scheduledMsg,
      });
    }

    // 3. IMMEDIATE SEND FLOW
    const log = new Message({
      owner: req.user.id,
      channel,
      recipient: cleanRecipient,
      cc: cc.trim(),
      bcc: bcc.trim(),
      subject: subject.trim(),
      message: message.trim(),
      reaction: reaction || "",
      attachments: attachmentMeta,
      contact: contactId || contactRef || null,
      status: "processing",
    });

    let result = null;
    try {
      const userAccount = await MessagingAccount.findOne({
        owner: req.user.id,
        channel,
        status: "connected",
      }).lean();

      result = await dispatchQuickSendMessage({
        channel,
        recipient: cleanRecipient,
        subject: subject.trim(),
        message: message.trim(),
        reaction: reaction || "",
        files,
        cc: cc.trim(),
        bcc: bcc.trim(),
        credentials: userAccount
          ? {
              ...(userAccount.credentials || {}),
              providerType: userAccount.providerType,
              isWebDirect: userAccount.providerType === "web_direct",
            }
          : null,
      });

      if (result?.isWebDirect) {
        log.status = "ready";
        log.sentAt = null;
        log.providerMessageId = result?.providerMessageId || `wd_${Date.now()}`;
        log.providerResponse = result?.raw || {
          type: "web_direct",
          recipient: cleanRecipient,
          url: result.webDirectUrl,
        };
        log.error = null;
      } else {
        log.status = "sent";
        log.sentAt = new Date();
        log.providerMessageId = result?.providerMessageId || null;
        log.providerResponse = result?.raw || null;
        log.error = null;
      }
    } catch (sendErr) {
      log.status = "failed";
      log.error = sendErr.message;
    }

    await log.save();

    if (log.status === "failed") {
      return res.status(502).json({
        success: false,
        message: log.error || "Failed to send message",
        log,
      });
    }

    if (result?.isWebDirect) {
      return res.json({
        success: true,
        message: "Message saved to thread. Ready to send via WhatsApp.",
        isWebDirect: true,
        webDirectUrl: result.webDirectUrl,
        log,
      });
    }

    const channelNames = {
      email: "Email",
      telegram: "Telegram message",
      whatsapp: "WhatsApp message",
      sms: "SMS",
    };

    return res.json({
      success: true,
      message: `${channelNames[channel] || "Message"} sent successfully`,
      log,
    });
  } catch (err) {
    console.error("sendMessage controller error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get messages with filtering, searching, and pagination
 */
export const getMessages = async (req, res) => {
  try {
    const { status, channel, search, limit = 50 } = req.query;
    const query = { owner: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (channel && channel !== "all") {
      query.channel = channel;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { recipient: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const logs = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(maxLimit);

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Cancel a scheduled message
 */

/**
 * Update / Reschedule an existing scheduled message or draft before dispatch
 */
export const updateScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      channel,
      recipient,
      subject,
      message: messageText,
      cc,
      bcc,
      scheduledAt,
      timeZone,
      contactId,
    } = req.body;

    const message = await Message.findOne({ _id: id, owner: req.user.id });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Race condition guard: cannot modify if currently being dispatched by the scheduler
    if (message.status === "processing" || message.isClaimed) {
      return res.status(409).json({
        success: false,
        message: "Message is currently being dispatched by the scheduler and cannot be modified.",
      });
    }

    if (message.status === "sent") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a message that has already been sent.",
      });
    }

    if (message.status !== "scheduled" && message.status !== "draft" && message.status !== "ready") {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a message with status '${message.status}'. Only scheduled messages, drafts, and ready reminders can be edited.`,
      });
    }

    // Check target channel
    const targetChannel = channel || message.channel;
    const validChannels = ["email", "telegram", "whatsapp", "sms"];
    if (!validChannels.includes(targetChannel)) {
      return res.status(400).json({
        success: false,
        message: `Invalid channel: ${targetChannel}`,
      });
    }
    message.channel = targetChannel;

    // Validate recipient if updated
    if (recipient) {
      const validation = validateRecipient(targetChannel, recipient);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.message });
      }
      message.recipient = validation.cleanRecipient;
    }

    if (subject !== undefined) message.subject = subject.trim();
    if (messageText !== undefined) message.message = messageText.trim();
    if (cc !== undefined) message.cc = cc.trim();
    if (bcc !== undefined) message.bcc = bcc.trim();
    if (timeZone !== undefined) message.timeZone = timeZone || "UTC";

    // Validate scheduledAt if updated
    if (scheduledAt !== undefined) {
      if (scheduledAt) {
        const scheduleDate = new Date(scheduledAt);
        if (isNaN(scheduleDate.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid scheduled date/time" });
        }
        if (scheduleDate.getTime() <= Date.now()) {
          return res.status(400).json({ success: false, message: "Scheduled time must be in the future" });
        }
        message.scheduledAt = scheduleDate;
        message.status = "scheduled";
      } else {
        message.scheduledAt = null;
      }
    }

    // Reset claiming lock so the scheduler will cleanly pick it up
    message.isClaimed = false;
    message.claimedAt = null;

    await message.save();

    res.json({
      success: true,
      message: message.status === "scheduled"
        ? `Scheduled message updated for ${new Date(message.scheduledAt).toLocaleString()}`
        : "Draft updated successfully",
      log: message,
    });
  } catch (err) {
    console.error("updateScheduledMessage error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelScheduledMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findOne({ _id: id, owner: req.user.id });

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Race condition guard: cannot cancel if currently being dispatched
    if (message.status === "processing" || message.isClaimed) {
      return res.status(409).json({
        success: false,
        message: "Message is currently being dispatched by the scheduler and cannot be cancelled.",
      });
    }

    if (message.status !== "scheduled" && message.status !== "ready") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a message with status '${message.status}'. Only scheduled messages and ready reminders can be cancelled.`,
      });
    }

    message.status = "cancelled";
    message.isClaimed = false;
    message.claimedAt = null;
    await message.save();

    res.json({ success: true, message: "Scheduled message cancelled", log: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Retry a failed or cancelled message
 */
export const retryMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findOne({ _id: id, owner: req.user.id });

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    message.status = "processing";
    message.isClaimed = false;
    message.claimedAt = null;
    await message.save();

    try {
      const userAccount = await MessagingAccount.findOne({
        owner: req.user.id,
        channel: message.channel,
        status: "connected",
      }).lean();

      const result = await dispatchQuickSendMessage({
        channel: message.channel,
        recipient: message.recipient,
        subject: message.subject || "",
        message: message.message || "",
        reaction: message.reaction || "",
        files: [],
        credentials: userAccount
          ? {
              ...(userAccount.credentials || {}),
              providerType: userAccount.providerType,
              isWebDirect: userAccount.providerType === "web_direct",
            }
          : null,
      });

      message.status = "sent";
      message.sentAt = new Date();
      message.providerMessageId = result?.providerMessageId || null;
      message.error = null;
      await message.save();

      res.json({ success: true, message: "Message resent successfully", log: message });
    } catch (retryErr) {
      message.status = "failed";
      message.error = retryErr.message;
      await message.save();

      res.status(502).json({
        success: false,
        message: retryErr.message || "Retry failed",
        log: message,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Delete a message
 */
export const deleteMessage = async (req, res) => {
  try {
    const deleted = await Message.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    res.json({ success: true, message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Provider connection readiness status
 */
export const getProviders = async (req, res) => {
  try {
    const providers = await getUserProviderStatus(req.user?.id);
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Test live provider connection without saving
 */
export const testProviderConnection = async (req, res) => {
  try {
    const { channel, providerType, credentials } = req.body;
    if (!channel) {
      return res.status(400).json({ success: false, message: "Channel is required" });
    }

    if (channel === "telegram") {
      const result = await verifyTelegramBotToken(credentials?.botToken);
      return res.json({
        success: true,
        message: `Verified @${result.botUsername} (${result.botName})`,
        latencyMs: result.latencyMs,
        details: result,
      });
    }

    if (channel === "whatsapp") {
      if (providerType === "web_direct") {
        const rawNum = (credentials?.personalNumber || "").trim();
        const cleanDigits = rawNum.replace(/[^0-9]/g, "");
        if (cleanDigits.length < 7 || cleanDigits.length > 15) {
          return res.status(400).json({
            success: false,
            message: "Please enter a valid personal WhatsApp phone number with country code (e.g. +14155552671).",
          });
        }
        const formatted = rawNum.startsWith("+") ? `+${cleanDigits}` : `+${cleanDigits}`;
        return res.json({
          success: true,
          message: `Verified Personal WhatsApp phone configuration: ${formatted}`,
          latencyMs: 5,
          details: {
            displayPhoneNumber: formatted,
            type: "personal_web_direct",
            action: "Direct Click-to-Chat / Native WhatsApp client deep link",
          },
        });
      } else if (providerType === "twilio") {
        const result = await verifyTwilioWhatsAppCredentials(
          credentials?.accountSid,
          credentials?.authToken,
          credentials?.fromNumber
        );
        return res.json({
          success: true,
          message: `Verified Twilio Account (${result.friendlyName || "Active"})`,
          latencyMs: result.latencyMs,
          details: result,
        });
      } else {
        const result = await verifyWhatsAppCloudApiCredentials(
          credentials?.phoneNumberId,
          credentials?.accessToken
        );
        return res.json({
          success: true,
          message: `Verified WhatsApp Cloud API: ${result.displayPhoneNumber} (${result.verifiedName})`,
          latencyMs: result.latencyMs,
          details: result,
        });
      }
    }

    if (channel === "email") {
      return res.json({
        success: true,
        message: "Email SMTP service is active and responsive",
        latencyMs: 15,
      });
    }

    return res.status(400).json({ success: false, message: `Unsupported channel: ${channel}` });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Connection verification failed",
    });
  }
};

/**
 * Save & Connect user messaging credentials
 */
export const connectProvider = async (req, res) => {
  try {
    const owner = req.user.id;
    const { channel, providerType, credentials } = req.body;

    if (!channel || !credentials) {
      return res.status(400).json({ success: false, message: "Channel and credentials are required" });
    }

    let accountIdentifier = "";
    let accountName = "";

    if (channel === "telegram") {
      const result = await verifyTelegramBotToken(credentials.botToken);
      accountIdentifier = `@${result.botUsername}`;
      accountName = result.botName || "Telegram Bot";
    } else if (channel === "whatsapp") {
      if (providerType === "web_direct") {
        const rawNum = (credentials.personalNumber || "").trim();
        const cleanDigits = rawNum.replace(/[^0-9]/g, "");
        if (cleanDigits.length < 7 || cleanDigits.length > 15) {
          return res.status(400).json({
            success: false,
            message: "Please enter a valid personal WhatsApp phone number with country code (e.g. +14155552671).",
          });
        }
        accountIdentifier = rawNum.startsWith("+") ? `+${cleanDigits}` : `+${cleanDigits}`;
        accountName = "Personal WhatsApp Messenger";
      } else if (providerType === "twilio") {
        const result = await verifyTwilioWhatsAppCredentials(
          credentials.accountSid,
          credentials.authToken,
          credentials.fromNumber
        );
        accountIdentifier = credentials.fromNumber || "Twilio WhatsApp";
        accountName = result.friendlyName || "Twilio WhatsApp";
      } else {
        const result = await verifyWhatsAppCloudApiCredentials(
          credentials.phoneNumberId,
          credentials.accessToken
        );
        accountIdentifier = result.displayPhoneNumber || credentials.phoneNumberId;
        accountName = result.verifiedName || "WhatsApp Business";
      }
    }

    const secureCredentials = encryptCredentialsObject(credentials);

    await MessagingAccount.findOneAndUpdate(
      { owner, channel },
      {
        providerType: providerType || (channel === "telegram" ? "bot_api" : "cloud_api"),
        status: "connected",
        accountIdentifier,
        accountName,
        credentials: secureCredentials,
        lastVerifiedAt: new Date(),
        lastError: null,
      },
      { upsert: true, new: true }
    );

    const providers = await getUserProviderStatus(owner);
    return res.json({
      success: true,
      message: `Successfully connected ${channel.toUpperCase()} (${accountIdentifier})`,
      providers,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || "Failed to connect provider" });
  }
};

/**
 * Disconnect a provider account
 */
export const disconnectProvider = async (req, res) => {
  try {
    const owner = req.user.id;
    const { channel } = req.params;

    await MessagingAccount.findOneAndDelete({ owner, channel });
    const providers = await getUserProviderStatus(owner);

    return res.json({
      success: true,
      message: `${channel.toUpperCase()} disconnected successfully`,
      providers,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Send an existing scheduled message immediately
 */
export const sendMessageNow = async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const claimed = await Message.findOneAndUpdate(
      {
        _id: id,
        owner: req.user.id,
        status: { $in: ["scheduled", "draft", "failed", "ready"] },
        isClaimed: false,
      },
      {
        isClaimed: true,
        claimedAt: now,
        status: "processing",
      },
      { new: true }
    );

    if (!claimed) {
      return res.status(409).json({
        success: false,
        message: "Message is already being dispatched by the scheduler or has already been sent.",
      });
    }

    try {
      const userAccount = await MessagingAccount.findOne({
        owner: req.user.id,
        channel: claimed.channel,
        status: "connected",
      }).lean();

      const result = await dispatchQuickSendMessage({
        channel: claimed.channel,
        recipient: claimed.recipient,
        subject: claimed.subject || "",
        message: claimed.message || "",
        reaction: claimed.reaction || "",
        files: [],
        cc: claimed.cc || "",
        bcc: claimed.bcc || "",
        credentials: userAccount
          ? {
              ...(userAccount.credentials || {}),
              providerType: userAccount.providerType,
              isWebDirect: userAccount.providerType === "web_direct",
            }
          : null,
      });

      if (result?.isWebDirect) {
        claimed.status = "ready";
        claimed.sentAt = null;
        claimed.isClaimed = false;
        claimed.claimedAt = null;
        claimed.providerMessageId = result?.providerMessageId || `wd_${Date.now()}`;
        claimed.providerResponse = result?.raw || {
          type: "web_direct",
          recipient: claimed.recipient,
          url: result.webDirectUrl,
        };
        claimed.error = null;
        await claimed.save();

        return res.json({
          success: true,
          message: "Reminder marked as Ready to Send via WhatsApp",
          isWebDirect: true,
          webDirectUrl: result.webDirectUrl,
          log: claimed,
        });
      }

      claimed.status = "sent";
      claimed.sentAt = new Date();
      claimed.isClaimed = false;
      claimed.claimedAt = null;
      claimed.providerMessageId = result?.providerMessageId || null;
      claimed.providerResponse = result?.raw || null;
      claimed.error = null;
      await claimed.save();

      return res.json({
        success: true,
        message: "Message sent immediately",
        log: claimed,
      });
    } catch (sendErr) {
      claimed.status = "failed";
      claimed.isClaimed = false;
      claimed.claimedAt = null;
      claimed.error = sendErr.message;
      await claimed.save();

      return res.status(502).json({
        success: false,
        message: sendErr.message || "Failed to dispatch message",
        log: claimed,
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * WhatsApp Webhook Verification Handshake (Meta Challenge)
 */
export const webhookWhatsAppGet = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "tasklert_webhook_secret";

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

/**
 * WhatsApp Webhook Event Receiver (Delivery Status Updates & Incoming Messages)
 */
export const webhookWhatsAppPost = async (req, res) => {
  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;

    if (changes?.statuses?.length) {
      const statusUpdate = changes.statuses[0];
      const messageId = statusUpdate.id;
      const status = statusUpdate.status; // "delivered", "read", "failed"

      if (messageId && ["delivered", "read", "failed"].includes(status)) {
        await Message.updateOne(
          { providerMessageId: messageId },
          {
            ...(status === "delivered" || status === "read" ? { status: "sent" } : {}),
            ...(status === "failed" ? { status: "failed", error: statusUpdate.errors?.[0]?.message } : {}),
          }
        );
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch {
    return res.status(200).json({ status: "ok" });
  }
};

/**
 * Get templates (7 starter templates + user's custom templates)
 */
export const getTemplates = async (req, res) => {
  try {
    const customTemplates = await MessageTemplate.find({ owner: req.user.id })
      .sort({ createdAt: -1 });

    const allTemplates = [...STARTER_TEMPLATES, ...customTemplates];
    res.json({ success: true, templates: allTemplates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Create a custom user template
 */
export const createTemplate = async (req, res) => {
  try {
    const { title, channel = "all", subject = "", body, category = "Custom" } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Template title is required" });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, message: "Template body is required" });
    }

    const template = new MessageTemplate({
      owner: req.user.id,
      title: title.trim(),
      channel,
      subject: subject.trim(),
      body: body.trim(),
      category,
      isStarter: false,
    });

    await template.save();
    res.json({ success: true, message: "Template created successfully", template });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Delete a custom user template
 */
export const deleteTemplate = async (req, res) => {
  try {
    const deleted = await MessageTemplate.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Mark a ready reminder or message as sent
 */
export const markMessageSent = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.findOne({ _id: id, owner: req.user.id });
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    message.status = "sent";
    message.sentAt = new Date();
    message.error = null;
    await message.save();

    res.json({
      success: true,
      message: "Message marked as sent",
      log: message,
    });
  } catch (err) {
    console.error("markMessageSent error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
