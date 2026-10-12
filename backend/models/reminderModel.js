import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    timeZone: {
      type: String,
      default: () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
    alarmEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    sound: {
      type: String,
      enum: ["digital", "classic", "chime", "bell", "soft"],
      default: "digital",
    },
    volume: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    repeat: {
      type: String,
      enum: ["never", "daily", "weekly"],
      default: "never",
    },
    snoozeDuration: {
      type: Number,
      enum: [5, 10, 15, 30],
      default: 5,
    },
    advanceNoticeMinutes: {
      type: Number,
      enum: [0, 5, 10, 15, 30],
      default: 0,
    },
    channels: {
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ["scheduled", "dispatched", "snoozed", "dismissed", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    lastDispatchedAt: {
      type: Date,
      default: null,
    },
    snoozedUntil: {
      type: Date,
      default: null,
    },
    nextOccurrence: {
      type: Date,
      default: null,
    },
    occurrenceCount: {
      type: Number,
      default: 0,
    },
    isClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Composite indexes for rapid due reminder queries
reminderSchema.index({ status: 1, alarmEnabled: 1, scheduledAt: 1, isClaimed: 1 });
reminderSchema.index({ owner: 1, status: 1, scheduledAt: 1 });

const Reminder =
  mongoose.models.Reminder || mongoose.model("Reminder", reminderSchema);

export default Reminder;
