import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  codeHash: { type: String, required: true }, action: { type: String, required: true }, deviceSessionId: mongoose.Schema.Types.ObjectId,
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, attempts: { type: Number, default: 0 }, lastSentAt: { type: Date, default: Date.now },
});
export default mongoose.models.SecurityOtp || mongoose.model("SecurityOtp", schema);
