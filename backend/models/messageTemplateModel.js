import mongoose from "mongoose";

const messageTemplateSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null, // null for system starter templates
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ["all", "email", "telegram", "whatsapp", "sms"],
      default: "all",
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    placeholders: {
      type: [String],
      default: ["{{name}}", "{{task}}", "{{date}}", "{{time}}"],
    },
    isStarter: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      default: "General",
    },
  },
  {
    timestamps: true,
  }
);

messageTemplateSchema.index({ owner: 1, isStarter: 1 });

const MessageTemplate =
  mongoose.models.MessageTemplate ||
  mongoose.model("MessageTemplate", messageTemplateSchema);

export default MessageTemplate;
