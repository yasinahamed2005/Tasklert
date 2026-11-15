import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  deviceId: { type: String, required: true }, deviceName: { type: String, default: "Tasklert device" },
  deviceType: { type: String, enum: ["mobile", "laptop", "desktop"], required: true },
  browser: { type: String, default: "Unknown" }, operatingSystem: { type: String, default: "Unknown" },
  location: { type: String, default: "Unavailable" }, firstLoginAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }, tokenHash: { type: String, required: true },
  isActive: { type: Boolean, default: true, index: true }, isRevoked: { type: Boolean, default: false }, revokedAt: Date,
}, { timestamps: true });
schema.index({ userId: 1, deviceId: 1 });
export default mongoose.models.DeviceSession || mongoose.model("DeviceSession", schema);
