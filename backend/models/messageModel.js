import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, default: null },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["email", "telegram", "whatsapp", "sms"],
      required: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
      index: true,
    },
    direction: {
      type: String,
      enum: ["outgoing", "incoming"],
      default: "outgoing",
    },
    cc: {
      type: String,
      default: "",
      trim: true,
    },
    bcc: {
      type: String,
      default: "",
      trim: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    reaction: {
      type: String,
      default: "",
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "processing", "sent", "failed", "cancelled", "queued"],
      default: "queued",
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    timeZone: {
      type: String,
      default: "UTC",
    },
    sentAt: {
      type: Date,
      default: null,
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    deliveryAttempts: {
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
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for scheduler queue processing
messageSchema.index({ status: 1, scheduledAt: 1, isClaimed: 1 });
messageSchema.index({ owner: 1, status: 1, createdAt: -1 });

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
