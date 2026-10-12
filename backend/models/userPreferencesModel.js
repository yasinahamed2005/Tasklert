import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    defaultSound: {
      type: String,
      enum: ["digital", "classic", "chime", "bell", "soft"],
      default: "digital",
    },
    defaultVolume: {
      type: Number,
      default: 80,
      min: 0,
      max: 100,
    },
    defaultSnoozeDuration: {
      type: Number,
      enum: [5, 10, 15, 30],
      default: 5,
    },
    defaultChannels: {
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" }, // "HH:MM"
      end: { type: String, default: "07:00" },
    },
    priorityRules: {
      High: {
        advanceMinutes: { type: Number, default: 15 },
        sound: { type: String, default: "classic" },
        emailAlert: { type: Boolean, default: true },
        urgency: { type: String, default: "high" },
      },
      Medium: {
        advanceMinutes: { type: Number, default: 5 },
        sound: { type: String, default: "digital" },
        emailAlert: { type: Boolean, default: false },
        urgency: { type: String, default: "normal" },
      },
      Low: {
        advanceMinutes: { type: Number, default: 0 },
        sound: { type: String, default: "soft" },
        emailAlert: { type: Boolean, default: false },
        urgency: { type: String, default: "low" },
      },
    },
  },
  { timestamps: true }
);

const UserPreferences =
  mongoose.models.UserPreferences ||
  mongoose.model("UserPreferences", userPreferencesSchema);

export default UserPreferences;
