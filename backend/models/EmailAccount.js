import mongoose from "mongoose";

const emailAccountSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    provider: {
      type: String,
      enum: ["gmail", "outlook", "smtp", "custom", "taskflow"],
      required: true,
    },
    status: {
      type: String,
      enum: ["connected", "disconnected", "error", "expired", "revoked"],
      default: "connected",
      index: true,
    },
    // OAuth Tokens & Credentials (Encrypted with AES-256-GCM before DB save)
    credentials: {
      accessToken: { type: String, default: "" },
      refreshToken: { type: String, default: "" },
      tokenExpiresAt: { type: Date, default: null },
      scope: { type: String, default: "" },
      // SMTP / IMAP Settings
      smtpHost: { type: String, default: "" },
      smtpPort: { type: Number, default: 587 },
      smtpUser: { type: String, default: "" },
      smtpPass: { type: String, default: "" }, // Encrypted
      smtpFrom: { type: String, default: "" },
      imapHost: { type: String, default: "" },
      imapPort: { type: Number, default: 993 },
    },
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for user accounts
emailAccountSchema.index({ owner: 1, email: 1 }, { unique: true });

// Do not return raw encrypted credentials to client
emailAccountSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  if (obj.credentials) {
    delete obj.credentials.accessToken;
    delete obj.credentials.refreshToken;
    delete obj.credentials.smtpPass;
  }
  return obj;
};

const EmailAccount =
  mongoose.models.EmailAccount ||
  mongoose.model("EmailAccount", emailAccountSchema);

export default EmailAccount;

