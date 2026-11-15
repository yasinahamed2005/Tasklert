import crypto from "crypto";
import bcrypt from "bcryptjs";
import DeviceSession from "../models/deviceSessionModel.js";
import SecurityOtp from "../models/securityOtpModel.js";
import LoginSecurityEvent from "../models/loginSecurityEventModel.js";
import User from "../models/userModel.js";
import SecurityActionToken from "../models/securityActionTokenModel.js";
import { sendEmail } from "../utils/mailer.js";

const masked = (email = "") => email.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");
const classify = (ua = "") => /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : /mac|windows|linux/i.test(ua) ? "laptop" : "desktop";
const browser = (ua = "") => /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Unknown";
const os = (ua = "") => /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown";
export const tokenDigest = (token) => crypto.createHash("sha256").update(token).digest("hex");

export async function createDeviceSession(user, req, deviceId) {
  const ua = req.headers["user-agent"] || "";
  const type = classify(ua);
  const existing = await DeviceSession.findOne({ userId: user._id, deviceId, isActive: true, isRevoked: false });
  if (!existing) {
    const active = await DeviceSession.find({ userId: user._id, isActive: true, isRevoked: false });
    const mobileCount = active.filter((s) => s.deviceType === "mobile").length;
    const computerCount = active.filter((s) => s.deviceType !== "mobile").length;
    if ((type === "mobile" && mobileCount >= 2) || (type !== "mobile" && computerCount >= 1) || active.length >= 3) {
      const error = new Error("Device limit reached (2 mobile devices and 1 laptop/desktop). Remove an existing device first."); error.status = 409; throw error;
    }
  }
  const edgeCountry = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "").toUpperCase();
  const location = /^[A-Z]{2}$/.test(edgeCountry) ? edgeCountry : "Unavailable";
  const session = existing || new DeviceSession({ userId: user._id, deviceId, deviceType: type, deviceName: req.body.deviceName || `${os(ua)} ${type}`, browser: browser(ua), operatingSystem: os(ua), location });
  session.lastActiveAt = new Date();
  const jwt = (await import("jsonwebtoken")).default;
  const { getJwtSecret } = await import("../config/jwt.js");
  const token = jwt.sign({ id: user._id, sid: session._id, did: deviceId }, getJwtSecret(), { expiresIn: "24h" });
  session.tokenHash = tokenDigest(token); await session.save();
  if (!existing) {
    const event = await LoginSecurityEvent.create({ userId: user._id, deviceSessionId: session._id, eventType: "new_device", deviceName: session.deviceName, deviceType: session.deviceType, emailNotificationStatus: "pending" });
    try {
      const base = process.env.FRONTEND_URL || "http://localhost:5173";
      const issueAction = async (choice) => {
        const raw = crypto.randomBytes(32).toString("base64url");
        await SecurityActionToken.create({ userId: user._id, deviceSessionId: session._id, loginEventId: event._id, tokenHash: tokenDigest(raw), actionType: choice, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) });
        return `${base}/security-action?token=${encodeURIComponent(raw)}`;
      };
      const [yesLink, noLink] = await Promise.all([issueAction("acknowledge"), issueAction("report")]);
      await sendEmail({ to: user.email, subject: "New Tasklert device sign-in", text: `A new device signed in: ${session.deviceName} (${session.deviceType}), ${session.browser} on ${session.operatingSystem}, approximate location ${session.location}, at ${new Date().toISOString()}. If this was you: ${yesLink} If not: ${noLink}`, html: `<p>A new device signed in to Tasklert.</p><p>${session.deviceName} · ${session.deviceType} · ${session.browser} · ${session.operatingSystem} · ${session.location} · ${new Date().toISOString()}</p><p><a href="${yesLink}">YES, IT WAS ME</a></p><p><a href="${noLink}">NO, IT WASN'T ME</a></p><p>These links open a confirmation page; no security action occurs until confirmed.</p>` });
      event.emailNotificationStatus = "sent";
    } catch { event.emailNotificationStatus = "failed"; }
    await event.save();
  } else await LoginSecurityEvent.create({ userId: user._id, deviceSessionId: session._id, eventType: "successful_login", deviceName: session.deviceName, deviceType: session.deviceType });
  return { token, session };
}

export async function listSessions(req, res) {
  const sessions = await DeviceSession.find({ userId: req.user._id }).sort({ lastActiveAt: -1 }).lean();
  res.json({ success: true, sessions: sessions.map((s) => ({ ...s, isCurrent: String(s._id) === String(req.sessionId) })), capacity: { mobile: `${sessions.filter((s) => s.isActive && !s.isRevoked && s.deviceType === "mobile").length}/2`, computer: `${sessions.filter((s) => s.isActive && !s.isRevoked && s.deviceType !== "mobile").length}/1`, total: `${sessions.filter((s) => s.isActive && !s.isRevoked).length}/3` } });
}
export async function activity(req, res) { res.json({ success: true, events: await LoginSecurityEvent.find({ userId: req.user._id }).sort({ eventTimestamp: -1 }).limit(100).lean() }); }
export async function requestOtp(req, res) {
  if (!req.sessionId) return res.status(401).json({ success: false, message: "Sign in again to manage devices." });
  if (!["single", "others"].includes(req.body.action || "single")) return res.status(400).json({ success: false, message: "Invalid device management action." });
  if (!req.body.deviceSessionId && req.body.action !== "others") return res.status(400).json({ success: false, message: "Choose a device." });
  if (req.body.deviceSessionId && String(req.body.deviceSessionId) === String(req.sessionId)) return res.status(400).json({ success: false, message: "The current device cannot be removed here." });
  if (req.body.deviceSessionId && !(await DeviceSession.exists({ _id: req.body.deviceSessionId, userId: req.user._id, isActive: true, isRevoked: false }))) return res.status(404).json({ success: false, message: "Active device not found." });
  const previous = await SecurityOtp.findOne({ userId: req.user._id });
  if (previous && Date.now() - previous.lastSentAt.getTime() < 60_000) return res.status(429).json({ success: false, message: "Please wait one minute before requesting another code." });
  const user = await User.findById(req.user._id);
  const otp = crypto.randomInt(100000, 1000000).toString();
  await SecurityOtp.deleteMany({ userId: req.user._id });
  await SecurityOtp.create({ userId: req.user._id, codeHash: await bcrypt.hash(otp, 10), action: req.body.action === "others" ? "others" : "single", deviceSessionId: req.body.deviceSessionId, expiresAt: new Date(Date.now() + 5 * 60_000) });
  try { await sendEmail({ to: user.email, subject: "Tasklert device removal code", text: `Your device management code is ${otp}. It expires in five minutes.` }); }
  catch { await SecurityOtp.deleteMany({ userId: req.user._id }); return res.status(503).json({ success: false, message: "Email delivery is unavailable. No device was removed." }); }
  res.json({ success: true, maskedEmail: masked(user.email), expiresIn: 300 });
}
export async function verifyOtp(req, res) {
  const record = await SecurityOtp.findOne({ userId: req.user._id });
  if (!record || record.expiresAt < new Date()) return res.status(400).json({ success: false, message: "Code expired. Request a new one." });
  record.attempts += 1;
  if (record.attempts > 5) { await record.deleteOne(); return res.status(429).json({ success: false, message: "Too many attempts. Request a new code." }); }
  if (!await bcrypt.compare(String(req.body.otp || ""), record.codeHash)) { await record.save(); return res.status(401).json({ success: false, message: "Incorrect code." }); }
  const query = { userId: req.user._id, isActive: true, isRevoked: false };
  if (record.action === "single") query._id = record.deviceSessionId; else query._id = { $ne: req.sessionId };
  const revoked = await DeviceSession.updateMany(query, { $set: { isActive: false, isRevoked: true, revokedAt: new Date() } });
  await LoginSecurityEvent.create({ userId: req.user._id, deviceSessionId: record.deviceSessionId || req.sessionId, eventType: record.action === "single" ? "device_removed" : "other_devices_logged_out", securityAction: "revoked" });
  await record.deleteOne();
  try { await sendEmail({ to: req.user.email, subject: "Tasklert device security updated", text: `${revoked.modifiedCount} device session(s) were revoked after OTP verification.` }); } catch {}
  res.json({ success: true, revoked: revoked.modifiedCount });
}

export async function inspectSecurityAction(req, res) {
  const hash = tokenDigest(String(req.body.token || ""));
  const record = await SecurityActionToken.findOne({ tokenHash: hash, usedAt: null, expiresAt: { $gt: new Date() } }).populate("deviceSessionId", "deviceName deviceType browser operatingSystem");
  if (!record) return res.status(400).json({ success: false, message: "This security link is invalid, expired, or already used." });
  res.json({ success: true, action: record.actionType, device: record.deviceSessionId });
}

export async function confirmSecurityAction(req, res) {
  const record = await SecurityActionToken.findOne({ tokenHash: tokenDigest(String(req.body.token || "")), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!record) return res.status(400).json({ success: false, message: "This security link is invalid, expired, or already used." });
  record.usedAt = new Date(); await record.save();
  const session = await DeviceSession.findOne({ _id: record.deviceSessionId, userId: record.userId });
  const event = await LoginSecurityEvent.findOne({ _id: record.loginEventId, userId: record.userId });
  if (record.actionType === "report" && session) {
    session.isActive = false; session.isRevoked = true; session.revokedAt = new Date(); await session.save();
    if (event) event.securityAction = "unauthorized_login_reported_and_session_revoked";
    await LoginSecurityEvent.create({ userId: record.userId, deviceSessionId: session._id, eventType: "unauthorized_login_reported", deviceName: session.deviceName, deviceType: session.deviceType, securityAction: "session_revoked" });
  } else if (event) { event.acknowledgedAt = new Date(); event.securityAction = "acknowledged"; }
  if (event) await event.save();
  const user = await User.findById(record.userId);
  if (record.actionType === "report" && user) { try { await sendEmail({ to: user.email, subject: "Tasklert session revoked", text: `A reported device session was revoked at ${new Date().toISOString()}.` }); } catch {} }
  res.json({ success: true, action: record.actionType, message: record.actionType === "report" ? "The reported device session was revoked." : "This sign-in was acknowledged." });
}
