import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import validator from "validator";
import Message from "../models/messageModel.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSms } from "../utils/sms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "messages");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Persist attachments to disk only when the backend is publicly reachable,
// since Twilio MMS needs a public URL. Email attachments never need this —
// they're streamed straight from memory.
const persistForPublicAccess = (files) => {
  const publicBase = process.env.PUBLIC_BACKEND_URL;
  if (!publicBase || !files?.length) return [];

  return files.map((file) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    const diskPath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(diskPath, file.buffer);
    return `${publicBase.replace(/\/$/, "")}/uploads/messages/${safeName}`;
  });
};

export const sendMessage = async (req, res) => {
  try {
    const { channel, recipient, message, reaction } = req.body;
    const files = req.files || [];

    if (!channel || !["email", "sms"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "Choose a valid channel: email or sms",
      });
    }

    if (!recipient || !recipient.trim()) {
      return res.status(400).json({
        success: false,
        message: "Recipient is required",
      });
    }

    if (!message?.trim() && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write a message or attach a document",
      });
    }

    if (channel === "email" && !validator.isEmail(recipient.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    if (
      channel === "sms" &&
      !validator.isMobilePhone(recipient.trim(), "any")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid phone number in international format, e.g. +15551234567",
      });
    }

    const attachmentMeta = files.map((file) => ({
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    }));

    const log = new Message({
      owner: req.user.id,
      channel,
      recipient: recipient.trim(),
      message: message?.trim() || "",
      reaction: reaction || "",
      attachments: attachmentMeta,
      status: "queued",
    });

    try {
      if (channel === "email") {
        const emailAttachments = files.map((file) => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        }));

        await sendEmail({
          to: recipient.trim(),
          subject: "New message from Tasklert",
          text: `${message || ""}${reaction ? `  ${reaction}` : ""}`,
          html: `<p style="font-size:15px;color:#1f2937;">${
            (message || "").replace(/\n/g, "<br/>")
          }${reaction ? ` <span style="font-size:18px;">${reaction}</span>` : ""}</p>
          <p style="font-size:12px;color:#9ca3af;margin-top:16px;">Sent via Tasklert QuickSend</p>`,
          attachments: emailAttachments,
        });
      } else {
        const mediaUrls = persistForPublicAccess(files);
        await sendSms({
          to: recipient.trim(),
          body: `${message || ""}${reaction ? ` ${reaction}` : ""}`,
          mediaUrls,
        });

        if (files.length > 0 && mediaUrls.length === 0) {
          log.error =
            "Attachment skipped: set PUBLIC_BACKEND_URL in backend/.env so documents can be sent as MMS.";
        }
      }

      log.status = "sent";
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

    res.json({
      success: true,
      message:
        log.error ||
        (channel === "email"
          ? "Email sent successfully"
          : "Text message sent successfully"),
      log,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const logs = await Message.find({ owner: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
