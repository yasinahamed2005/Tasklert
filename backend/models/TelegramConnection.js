import mongoose from "mongoose";

const telegramConnectionSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      unique: true,
      index: true,
    },
    telegramId: {
      type: String,
      default: "",
      index: true,
    },
    phoneNumber: {
      type: String,
      default: "",
      trim: true,
    },
    firstName: {
      type: String,
      default: "",
      trim: true,
    },
    lastName: {
      type: String,
      default: "",
      trim: true,
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    photoUrl: {
      type: String,
      default: "",
    },
    encryptedSession: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["connected", "disconnected", "connecting", "error"],
      default: "connected",
      index: true,
    },
    is2FA: {
      type: Boolean,
      default: false,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Never expose the encryptedSession or internal fields when sending user-facing models
telegramConnectionSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    telegramId: this.telegramId,
    phoneNumber: this.phoneNumber,
    firstName: this.firstName,
    lastName: this.lastName,
    username: this.username,
    photoUrl: this.photoUrl,
    status: this.status,
    is2FA: this.is2FA,
    lastActiveAt: this.lastActiveAt,
    connectedAt: this.createdAt,
  };
};

const TelegramConnection =
  mongoose.models.TelegramConnection ||
  mongoose.model("TelegramConnection", telegramConnectionSchema);

export default TelegramConnection;
