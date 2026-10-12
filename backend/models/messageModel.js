import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, default: null },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  channel: {
    type: String,
    enum: ["email", "sms"],
    required: true,
  },
  recipient: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    default: "",
    trim: true,
  },
  reaction: {
    type: String,
    default: "",
  },
  attachments: {
    type: [attachmentSchema],
    default: [],
  },
  status: {
    type: String,
    enum: ["sent", "failed", "queued"],
    default: "queued",
  },
  error: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Message =
  mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
