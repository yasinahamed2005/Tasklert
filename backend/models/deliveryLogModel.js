import mongoose from "mongoose";

const deliveryLogSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reminder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reminder",
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      index: true,
    },
    channel: {
      type: String,
      enum: ["push", "email", "in_app"],
      required: true,
    },
    target: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["accepted", "success", "failed", "failed_retryable", "unsubscribed"],
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      default: null,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    errorCategory: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    payloadSummary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

deliveryLogSchema.index({ owner: 1, createdAt: -1 });

const DeliveryLog =
  mongoose.models.DeliveryLog ||
  mongoose.model("DeliveryLog", deliveryLogSchema);

export default DeliveryLog;
