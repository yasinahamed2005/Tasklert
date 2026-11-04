import mongoose from "mongoose";

const messagingAccountSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["whatsapp", "telegram", "email", "sms"],
      required: true,
    },
    providerType: {
      type: String,
      enum: ["cloud_api", "twilio", "bot_api", "mtproto", "smtp", "resend", "brevo", "web_direct"],
      required: true,
    },
    status: {
      type: String,
      enum: ["connected", "disconnected", "error", "pending"],
      default: "connected",
      index: true,
    },
    accountIdentifier: {
      type: String,
      default: "",
      trim: true,
    },
    accountName: {
      type: String,
      default: "",
      trim: true,
    },
    credentials: {
      // Personal WhatsApp Messenger (Web Direct)
      personalNumber: { type: String, default: "" },
      // WhatsApp Cloud API
      phoneNumberId: { type: String, default: "" },
      accessToken: { type: String, default: "" },
      businessAccountId: { type: String, default: "" },
      // Twilio WhatsApp / SMS
      accountSid: { type: String, default: "" },
      authToken: { type: String, default: "" },
      fromNumber: { type: String, default: "" },
      // Telegram Bot API
      botToken: { type: String, default: "" },
      botUsername: { type: String, default: "" },
      // Telegram MTProto (Option B)
      apiId: { type: String, default: "" },
      apiHash: { type: String, default: "" },
      sessionString: { type: String, default: "" },
      // Email (Custom SMTP)
      smtpHost: { type: String, default: "" },
      smtpPort: { type: Number, default: 465 },
      smtpUser: { type: String, default: "" },
      smtpPass: { type: String, default: "" },
      smtpFrom: { type: String, default: "" },
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

messagingAccountSchema.index({ owner: 1, channel: 1 }, { unique: true });

const MessagingAccount =
  mongoose.models.MessagingAccount ||
  mongoose.model("MessagingAccount", messagingAccountSchema);

export default MessagingAccount;
