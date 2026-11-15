import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { getJwtSecret } from '../config/jwt.js';
import DeviceSession from '../models/deviceSessionModel.js';
import { tokenDigest } from '../controllers/securityController.js';

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: "Not Authorized, token missing",
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, getJwtSecret());
    // Older JWTs did not carry a device session id. Requiring a fresh sign-in
    // prevents those untracked credentials from bypassing device revocation.
    if (!payload.sid) return res.status(401).json({ success: false, message: "Please sign in again to activate device security." });
    const user = await User.findById(payload.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (payload.sid) {
      const session = await DeviceSession.findOne({ _id: payload.sid, userId: user._id, isActive: true, isRevoked: false, tokenHash: tokenDigest(token) });
      if (!session) return res.status(401).json({ success: false, message: "This device session has been revoked. Please sign in again.", code: "SESSION_REVOKED" });
      session.lastActiveAt = new Date();
      session.save().catch(() => {});
      req.sessionId = String(session._id);
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token invalid or expired" });
  }
}
