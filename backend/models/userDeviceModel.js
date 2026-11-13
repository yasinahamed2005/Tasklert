import mongoose from "mongoose";

/**
 * Tasklert Multi-Device Registry Model
 * Tracks user devices, platform capabilities, permissions, and alarm ownership.
 * Mobile devices with native alarm capability receive PRIMARY scheduling priority.
 * Laptops/desktops act as fallback when mobile is offline or unconfirmed.
 */
const userDeviceSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ["mobile", "laptop", "desktop", "tablet", "mobile_primary", "laptop_fallback", "unknown"],
      default: "unknown",
    },
    platform: {
      type: String,
      enum: ["android", "android_native", "android_pwa", "web_desktop", "web_mobile", "ios", "unknown"],
      default: "unknown",
    },
    deviceName: {
      type: String,
      default: "Tasklert Client",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
    },
    nativeAlarmCapability: {
      type: Boolean,
      default: false,
    },
    exactAlarmPermission: {
      type: Boolean,
      default: false,
    },
    notificationPermission: {
      type: Boolean,
      default: false,
    },
    fullScreenIntentPermission: {
      type: Boolean,
      default: false,
    },
    activeStatus: {
      type: String,
      enum: ["active", "online", "idle", "offline"],
      default: "active",
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    confirmedAlarmIds: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

userDeviceSchema.index({ owner: 1, deviceId: 1 }, { unique: true });
userDeviceSchema.index({ owner: 1, nativeAlarmCapability: 1, lastSeenAt: -1 });

const UserDevice = mongoose.models.UserDevice || mongoose.model("UserDevice", userDeviceSchema);

export default UserDevice;
