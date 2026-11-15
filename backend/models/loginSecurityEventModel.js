import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  deviceSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "DeviceSession" }, eventType: { type: String, required: true },
  deviceName: String, deviceType: String, eventTimestamp: { type: Date, default: Date.now },
  emailNotificationStatus: { type: String, default: "not_sent" }, acknowledgedAt: Date, securityAction: String,
}, { timestamps: true });
schema.index({ userId: 1, eventTimestamp: -1 });
export default mongoose.models.LoginSecurityEvent || mongoose.model("LoginSecurityEvent", schema);
