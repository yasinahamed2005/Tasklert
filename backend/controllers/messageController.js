import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Message from "../models/messageModel.js";
import Contact from "../models/contactModel.js";
import MessageTemplate from "../models/messageTemplateModel.js";
import {
  dispatchQuickSendMessage,
  getProviderStatus,
  validateRecipient,
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

    try {
      const result = await dispatchQuickSendMessage({
        channel,
        recipient: cleanRecipient,
        subject: subject.trim(),
        message: message.trim(),
        reaction: reaction || "",
        files,
        cc: cc.trim(),
        bcc: bcc.trim(),
      });

      log.status = "sent";
      log.sentAt = new Date();
      log.providerMessageId = result?.providerMessageId || null;
      log.providerResponse = result?.raw || null;
      log.error = null;
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

    if (message.status !== "scheduled" && message.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a message with status '${message.status}'. Only scheduled messages and drafts can be edited.`,
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

    if (message.status !== "scheduled") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a message with status '${message.status}'. Only scheduled messages can be cancelled.`,
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
      const result = await dispatchQuickSendMessage({
        channel: message.channel,
        recipient: message.recipient,
        subject: message.subject || "",
        message: message.message || "",
        reaction: message.reaction || "",
        files: [],
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
    const providers = getProviderStatus();
    res.json({ success: true, providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
