import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/jwt.js";
import authMiddleware from "../middleware/auth.js";
import { telegramUpload } from "../services/telegram/telegramMedia.service.js";
import {
  handleSendCode,
  handleVerifyCode,
  handleVerifyPassword,
  handleCancelAuth,
  handleGetAuthStatus,
  handleGetProfile,
  handleDisconnect,
  handleGetContacts,
  handleGetChats,
  handleGetChatMessages,
  handleSendMessage,
  handleSendMedia,
  handleSendPoll,
  handleSendLocation,
  handleSendVoice,
  handleDeleteMessage,
  handleMarkChatAsRead,
  handleDownloadMedia,
  handleDownloadAvatar,
  handleEventsStream,
  handleGetScheduled,
  handleCreateScheduled,
  handleUpdateScheduled,
  handleCancelScheduled,
} from "../controllers/telegram.controller.js";

const telegramRouter = express.Router();

// Generate a one-time short-lived stream ticket valid for 60 seconds
telegramRouter.post("/stream-ticket", authMiddleware, (req, res) => {
  const userId = req.user.id || req.user._id;
  const ticket = jwt.sign(
    { id: String(userId), type: "stream_ticket" },
    getJwtSecret(),
    { expiresIn: "60s" }
  );
  res.json({ success: true, ticket });
});

// SSE event stream and media/avatar authorization
// Accepts either standard Bearer header or a valid one-time ticket in ?ticket=
const sseAuthMiddleware = (req, res, next) => {
  if (req.headers.authorization) {
    return authMiddleware(req, res, next);
  }

  const ticket = req.query.ticket;
  if (!ticket) {
    return res.status(401).json({
      success: false,
      message: "Authentication required: valid ticket or Bearer authorization required.",
    });
  }

  try {
    const decoded = jwt.verify(ticket, getJwtSecret());
    if (decoded.type !== "stream_ticket") {
      return res.status(401).json({ success: false, message: "Invalid ticket type." });
    }
    req.user = { id: decoded.id, _id: decoded.id };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Ticket expired or invalid." });
  }
};

// All endpoints require user authentication & multi-user isolation
telegramRouter.use(sseAuthMiddleware);

// 1. Authentication flows
telegramRouter.post("/auth/send-code", handleSendCode);
telegramRouter.post("/auth/verify-code", handleVerifyCode);
telegramRouter.post("/auth/verify-password", handleVerifyPassword);
telegramRouter.post("/auth/cancel", handleCancelAuth);
telegramRouter.get("/auth/status", handleGetAuthStatus);
telegramRouter.post("/auth/disconnect", handleDisconnect);

// 2. Profile
telegramRouter.get("/profile", handleGetProfile);

// 3. Contacts
telegramRouter.get("/contacts", handleGetContacts);

// 4. Chats & Dialogs
telegramRouter.get("/chats", handleGetChats);
telegramRouter.get("/chats/:chatId/messages", handleGetChatMessages);
telegramRouter.post("/chats/:chatId/read", handleMarkChatAsRead);

// 5. Messaging, Media & Avatars
telegramRouter.post("/messages", handleSendMessage);
telegramRouter.post("/messages/upload", telegramUpload.single("file"), handleSendMedia);
telegramRouter.post("/messages/poll", handleSendPoll);
telegramRouter.post("/messages/location", handleSendLocation);
telegramRouter.post("/messages/voice", telegramUpload.single("file"), handleSendVoice);
telegramRouter.delete("/messages/:chatId/:messageId", handleDeleteMessage);
telegramRouter.get("/media/:chatId/:messageId", handleDownloadMedia);
telegramRouter.get("/avatar/:chatId", handleDownloadAvatar);

// 6. Real-time updates (SSE)
telegramRouter.get("/events", handleEventsStream);

// 7. Scheduling
telegramRouter.get("/scheduled", handleGetScheduled);
telegramRouter.post("/scheduled", handleCreateScheduled);
telegramRouter.put("/scheduled/:id", handleUpdateScheduled);
telegramRouter.delete("/scheduled/:id", handleCancelScheduled);

export default telegramRouter;
