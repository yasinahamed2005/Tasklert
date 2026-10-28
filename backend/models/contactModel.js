import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    whatsappPhone: {
      type: String,
      default: "",
      trim: true,
    },
    telegramUsername: {
      type: String,
      default: "",
      trim: true,
    },
    telegramChatId: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    channels: {
      type: [String],
      enum: ["whatsapp", "telegram", "email", "sms"],
      default: [],
      index: true,
    },
    lastMessage: {
      type: String,
      default: "",
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
contactSchema.index({ owner: 1, isFavorite: -1, lastMessageAt: -1, updatedAt: -1 });
contactSchema.index({ owner: 1, channels: 1 });
contactSchema.index({ owner: 1, name: 1 });

const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

export default Contact;
