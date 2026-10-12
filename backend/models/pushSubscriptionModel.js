import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    deviceId: {
      type: String,
      default: "",
    },
    deviceName: {
      type: String,
      default: "Browser Device",
    },
    customLabel: {
      type: String,
      default: "",
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ["windows", "mac", "android", "ios", "linux", "other"],
      default: "other",
    },
    browser: {
      type: String,
      default: "Unknown",
    },
    isPWA: {
      type: Boolean,
      default: false,
    },
    subscriptionStatus: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      index: true,
    },
    userAgent: {
      type: String,
      default: "",
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    lastSuccessfulPush: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ owner: 1, deviceId: 1 });

const PushSubscription =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);

export default PushSubscription;
