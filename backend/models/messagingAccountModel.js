import mongoose from "mongoose";
import { encryptCredential, decryptCredential } from "../utils/crypto.js";

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

// Pre-save hook: Encrypt sensitive tokens with AES-256-GCM before saving to MongoDB
messagingAccountSchema.pre("save", function (next) {
  if (this.credentials) {
    const creds = this.credentials;
    const sensitiveFields = [
      "accessToken",
      "authToken",
      "botToken",
      "sessionString",
      "smtpPass",
      "apiHash",
    ];

    for (const field of sensitiveFields) {
      if (creds[field] && typeof creds[field] === "string" && !creds[field].startsWith("enc:")) {
        creds[field] = encryptCredential(creds[field]);
      }
    }
  }
  next();
});

// Post-init hook: Decrypt sensitive tokens transparently on read for internal service usage
messagingAccountSchema.post("init", function (doc) {
  if (doc && doc.credentials) {
    const creds = doc.credentials;
    const sensitiveFields = [
      "accessToken",
      "authToken",
      "botToken",
      "sessionString",
      "smtpPass",
      "apiHash",
    ];

    for (const field of sensitiveFields) {
      if (creds[field] && typeof creds[field] === "string" && creds[field].startsWith("enc:")) {
        creds[field] = decryptCredential(creds[field]);
      }
    }
  }
});

// Security: Strip sensitive tokens from all JSON and Object responses so they are never leaked
const sanitizeCredentials = (ret) => {
  if (ret && ret.credentials) {
    const sanitized = { ...ret.credentials };
    delete sanitized.accessToken;
    delete sanitized.authToken;
    delete sanitized.botToken;
    delete sanitized.sessionString;
    delete sanitized.smtpPass;
    delete sanitized.apiHash;
    ret.credentials = sanitized;
  }
  return ret;
};

messagingAccountSchema.set("toJSON", {
  transform: (doc, ret) => sanitizeCredentials(ret),
});

messagingAccountSchema.set("toObject", {
  transform: (doc, ret) => sanitizeCredentials(ret),
});

const MessagingAccount =
  mongoose.models.MessagingAccount ||
  mongoose.model("MessagingAccount", messagingAccountSchema);

export default MessagingAccount;
