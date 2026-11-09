import mongoose from "mongoose";

const scheduledAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, default: null },
    diskPath: { type: String, default: null },
  },
  { _id: false }
);

const repeatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly", "custom"],
      default: "none",
    },
    interval: { type: Number, default: 1 }, // e.g. every 1 day/week/month
    endDate: { type: Date, default: null },
    nextOccurrence: { type: Date, default: null },
  },
  { _id: false }
);

const scheduledDeliverySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["tasklert_mail", "google_mail", "telegram"],
      required: true,
      index: true,
    },
    // Recipient identifier: email address for mails, or peerId for Telegram
    recipient: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: "",
      trim: true,
    },
    recipientHandle: {
      type: String,
      default: "",
      trim: true,
    },
    // Peer type for Telegram ("user" | "chat" | "channel")
    peerType: {
      type: String,
      enum: ["user", "chat", "channel"],
      default: "user",
    },
    // Subject (primarily for Tasklert Mail & Google Mail)
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    // Message body / text
    message: {
      type: String,
      default: "",
      trim: true,
    },
    // CC & BCC for email channels
    cc: {
      type: [String],
      default: [],
    },
    bcc: {
      type: [String],
      default: [],
    },
    // Priority (for Tasklert Mail)
    priority: {
      type: String,
      enum: ["normal", "important", "action_required"],
      default: "normal",
    },
    // Action required deadline for Tasklert Mail
    actionDeadline: {
      type: Date,
      default: null,
    },
    // Optional template ID
    templateId: {
      type: String,
      default: null,
    },
    attachments: {
      type: [scheduledAttachmentSchema],
      default: [],
    },
    // Scheduled execution instant in UTC
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    // User's original intended timezone for display & recurrence calculation
    timeZone: {
      type: String,
      default: "Asia/Kolkata",
      trim: true,
    },
    // Delivery status
    status: {
      type: String,
      enum: ["draft", "scheduled", "processing", "sent", "failed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    // Concurrency lock for background worker
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    nextRetryAt: {
      type: Date,
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Recurrence configuration
    repeat: {
      type: repeatSchema,
      default: () => ({ type: "none" }),
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for background worker queries
scheduledDeliverySchema.index({
  status: 1,
  scheduledAt: 1,
  isClaimed: 1,
});

scheduledDeliverySchema.index({
  owner: 1,
  channel: 1,
  status: 1,
  scheduledAt: 1,
});

const ScheduledDelivery =
  mongoose.models.ScheduledDelivery ||
  mongoose.model("ScheduledDelivery", scheduledDeliverySchema);

export default ScheduledDelivery;

