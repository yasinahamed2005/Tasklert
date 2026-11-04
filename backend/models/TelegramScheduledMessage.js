import mongoose from "mongoose";

const telegramAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, default: null },
    diskPath: { type: String, default: null },
  },
  { _id: false }
);

const telegramScheduledMessageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    peerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    peerType: {
      type: String,
      enum: ["user", "chat", "channel"],
      default: "user",
    },
    recipientName: {
      type: String,
      default: "Telegram Contact",
      trim: true,
    },
    recipientHandle: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    attachments: {
      type: [telegramAttachmentSchema],
      default: [],
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "processing", "sent", "failed", "cancelled"],
      default: "scheduled",
      index: true,
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
    attempts: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    telegramMessageId: {
      type: Number,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for background worker queue query
telegramScheduledMessageSchema.index({
  status: 1,
  scheduledAt: 1,
  isClaimed: 1,
});
telegramScheduledMessageSchema.index({
  owner: 1,
  scheduledAt: -1,
});

const TelegramScheduledMessage =
  mongoose.models.TelegramScheduledMessage ||
  mongoose.model("TelegramScheduledMessage", telegramScheduledMessageSchema);

export default TelegramScheduledMessage;
