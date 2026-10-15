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
  completedAt: {
    type: Date,
    default: null,
    index: true,
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
  recurrence: {
    type: recurrenceSchema,
    default: () => ({ frequency: "none", interval: 1, endsOn: null, alertBeforeEnd: null, endAlertsSent: [] }),
  },
  alarmSound: {
    type: String,
    default: "digital",
  },
  alarmVolume: {
    type: Number,
    default: 80,
  },
  alarmRepeat: {
    type: String,
    default: "never",
  },
  snoozeDuration: {
    type: Number,
    default: 5,
  },
  advanceNoticeMinutes: {
    type: Number,
    default: 0,
  },
  channels: {
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
  },
  timeZone: {
    type: String,
    default: "UTC",
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    default: null,
    index: true,
  },
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  recurrenceSpawned: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

taskSchema.index({ owner: 1, completed: 1, completedAt: 1 });
taskSchema.index({ owner: 1, createdAt: 1 });
taskSchema.index({ owner: 1, dueDate: 1 });
taskSchema.index({ owner: 1, isDeleted: 1, completed: 1 });
taskSchema.index({ owner: 1, isDeleted: 1, createdAt: -1 });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
