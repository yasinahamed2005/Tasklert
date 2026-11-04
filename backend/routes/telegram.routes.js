import express from "express";
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

// SSE event stream and image tag support: token can also be in query string for native EventSource and <img> tags
const sseAuthMiddleware = (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return authMiddleware(req, res, next);
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
