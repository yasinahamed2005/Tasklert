import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  deviceSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "DeviceSession", required: true },
  loginEventId: { type: mongoose.Schema.Types.ObjectId, ref: "LoginSecurityEvent", required: true },
  tokenHash: { type: String, required: true, unique: true }, actionType: { type: String, enum: ["acknowledge", "report"], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, usedAt: Date,
});
export default mongoose.models.SecurityActionToken || mongoose.model("SecurityActionToken", schema);
