import mongoose from "mongoose";

const emailAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, default: null },
    attachmentId: { type: String, default: null },
  },
  { _id: false }
);

const emailMessageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailAccount",
      required: false,
      default: null,
      index: true,
    },
    label: {
      type: String,
      default: null,
      index: true,
    },
    providerMessageId: {
      type: String,
      default: null,
      index: true,
    },
    threadId: {
      type: String,
      default: null,
      index: true,
    },
    folder: {
      type: String,
      enum: ["INBOX", "SENT", "DRAFTS", "STARRED", "TRASH", "SPAM", "ARCHIVE", "SCHEDULED"],
      default: "INBOX",
      index: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    fromName: {
      type: String,
      default: "",
      trim: true,
    },
    to: {
      type: [String],
      required: true,
      default: [],
    },
    cc: {
      type: [String],
      default: [],
    },
    bcc: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    snippet: {
      type: String,
      default: "",
    },
    body: {
      type: String,
      default: "",
    },
    htmlBody: {
      type: String,
      default: "",
    },
    textBody: {
      type: String,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isStarred: {
      type: Boolean,
      default: false,
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "important", "action_required"],
      default: "normal",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "queued", "sending", "sent", "delivered", "failed", "bounced"],
      default: "sent",
      index: true,
    },
    actionRequiredDeadline: {
      type: Date,
      default: null,
    },
    errorDetails: {
      type: String,
      default: null,
    },
    isTasklertMail: {
      type: Boolean,
      default: false,
      index: true,
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [emailAttachmentSchema],
      default: [],
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

emailMessageSchema.index({ owner: 1, folder: 1, date: -1 });
emailMessageSchema.index({ accountId: 1, providerMessageId: 1 });

const EmailMessage =
  mongoose.models.EmailMessage ||
  mongoose.model("EmailMessage", emailMessageSchema);

export default EmailMessage;

