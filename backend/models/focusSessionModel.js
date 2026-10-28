import mongoose from "mongoose";

const focusSessionSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    sessionType: {
      type: String,
      enum: ["focus", "short_break", "long_break"],
      default: "focus",
    },
    plannedDuration: {
      type: Number,
      required: true, // in seconds (e.g. 1500 = 25 minutes)
    },
    actualElapsedSeconds: {
      type: Number,
      default: 0,
    },
    accumulatedSeconds: {
      type: Number,
      default: 0, // seconds accumulated from prior pause/resume intervals
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastResumedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["running", "paused", "completed", "cancelled"],
      default: "running",
      index: true,
    },
    completedCycles: {
      type: Number,
      default: 1,
    },
    targetEndAt: {
      type: Date,
      default: null,
      index: true,
    },
    pushDispatched: {
      type: Boolean,
      default: false,
      index: true,
    },
    sound: {
      type: String,
      default: "chime",
    },
    clientNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

focusSessionSchema.index({ owner: 1, status: 1, createdAt: -1 });
focusSessionSchema.index({ owner: 1, sessionType: 1, startedAt: -1 });

const FocusSession =
  mongoose.models.FocusSession ||
  mongoose.model("FocusSession", focusSessionSchema);

export default FocusSession;
