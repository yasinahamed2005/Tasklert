import mongoose from "mongoose";

/**
 * Temporary, single-use authorization code for secure OAuth handoff.
 * Prevents JWT and sensitive tokens from ever appearing in URL query strings.
 * Expires automatically after 120 seconds via MongoDB TTL index.
 */
const authCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
  },
  user: {
    id: { type: String, required: true },
    name: { type: String, default: "User" },
    email: { type: String, default: "" },
    avatar: { type: String, default: "" },
    provider: { type: String, default: "social" },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 120, // 2 minutes TTL
  },
});

const AuthCode = mongoose.models.AuthCode || mongoose.model("AuthCode", authCodeSchema);

export default AuthCode;
