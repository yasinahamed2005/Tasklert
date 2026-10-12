import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const recurrenceSchema = new mongoose.Schema(
  {
    frequency: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    interval: { type: Number, min: 1, default: 1 },
    endsOn: { type: Date, default: null },
    // How many "series ending soon" email alerts to send before endsOn (1-3).
    // null/undefined = no end alerts requested.
    alertBeforeEnd: { type: Number, min: 1, max: 3, default: null },
    // Which offsets (days-before-end) have already been emailed, e.g. [7, 14].
    // Reset whenever endsOn or alertBeforeEnd changes so alerts can re-fire.
    endAlertsSent: { type: [Number], default: [] },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Low",
  },
  dueDate: {
    type: Date,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  subtasks: {
    type: [subtaskSchema],
    default: [],
  },
  reminderEnabled: {
    type: Boolean,
    default: false,
  },
  reminderAt: {
    type: Date,
    default: null,
  },
  emailReminderLastSentAt: {
    type: Date,
    default: null,
  },
  attachments: {
    type: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String, default: "document" },
        size: { type: Number, default: 0 },
      },
    ],
    default: [],
  },
  sentPriorityAlerts: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
