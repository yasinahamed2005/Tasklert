import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function () {
        // Password required only for local email/password accounts
        return !this.provider || this.provider === "local";
      },
    },
    avatar: {
      type: String,
      default: "",
    },
    provider: {
      type: String,
      enum: ["local", "google", "facebook", "github", "linkedin"],
      default: "local",
    },
    providerId: {
      type: String,
      default: "",
    },
    legalAcceptance: {
      termsAccepted: {
        type: Boolean,
        default: false,
      },
      privacyAccepted: {
        type: Boolean,
        default: false,
      },
      termsVersion: {
        type: String,
        default: "1.0",
      },
      privacyVersion: {
        type: String,
        default: "1.0",
      },
      acceptedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 });

const userModel = mongoose.models.user || mongoose.model("user", userSchema);

export default userModel;