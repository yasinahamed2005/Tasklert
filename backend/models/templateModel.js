import mongoose from "mongoose";

const templateSubtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
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
    subtasks: {
      type: [templateSubtaskSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevent duplicate template names for the same user
templateSchema.index({ owner: 1, name: 1 }, { unique: true });

const Template = mongoose.models.Template || mongoose.model("Template", templateSchema);

export default Template;
