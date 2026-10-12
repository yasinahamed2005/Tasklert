import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  codeHash: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  lastSentAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

emailOtpSchema.index({ email: 1 }, { unique: true });
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailOtp =
  mongoose.models.EmailOtp || mongoose.model("EmailOtp", emailOtpSchema);

export default EmailOtp;
