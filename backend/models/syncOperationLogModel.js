import mongoose from "mongoose";

const syncOperationLogSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: "unknown_device",
      index: true,
    },
    entityType: {
      type: String,
      enum: ["task", "project", "reminder", "focusSession"],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE"],
      required: true,
    },
    status: {
      type: String,
      enum: ["applied", "conflict", "rejected", "already_processed"],
      default: "applied",
    },
    resultServerId: {
      type: String,
      default: null,
    },
    clientVersion: {
      type: Number,
      default: 1,
    },
    serverVersion: {
      type: Number,
      default: 1,
    },
    payloadSummary: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: "90d", // Automatically clean up old idempotency logs after 90 days
    },
  },
  { timestamps: true }
);

syncOperationLogSchema.index({ userId: 1, operationId: 1 });
syncOperationLogSchema.index({ userId: 1, entityId: 1 });

const SyncOperationLog =
  mongoose.models.SyncOperationLog ||
  mongoose.model("SyncOperationLog", syncOperationLogSchema);

export default SyncOperationLog;
