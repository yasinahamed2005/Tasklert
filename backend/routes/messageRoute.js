import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
import {
  cancelScheduledMessage,
  updateScheduledMessage,
  createTemplate,
  deleteMessage,
  deleteTemplate,
  getMessages,
  getProviders,
  getTemplates,
  retryMessage,
  sendMessage,
  sendMessageNow,
  markMessageSent,
  testProviderConnection,
  connectProvider,
  disconnectProvider,
  webhookWhatsAppGet,
  webhookWhatsAppPost,
} from "../controllers/messageController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }, // 15MB per file, up to 5 files
});

const messageRouter = express.Router();

// Webhook endpoints (public, validated via Meta hub.verify_token / secrets)
messageRouter.get("/webhook/whatsapp", webhookWhatsAppGet);
messageRouter.post("/webhook/whatsapp", webhookWhatsAppPost);

// Provider readiness status & live connection management
messageRouter.get("/providers", authMiddleware, getProviders);
messageRouter.post("/providers/test", authMiddleware, testProviderConnection);
messageRouter.post("/providers/connect", authMiddleware, connectProvider);
messageRouter.post("/providers/disconnect/:channel", authMiddleware, disconnectProvider);
messageRouter.delete("/providers/disconnect/:channel", authMiddleware, disconnectProvider);
messageRouter.delete("/providers/:channel", authMiddleware, disconnectProvider);

// Templates
messageRouter.get("/templates", authMiddleware, getTemplates);
messageRouter.post("/templates", authMiddleware, createTemplate);
messageRouter.delete("/templates/:id", authMiddleware, deleteTemplate);

// Messages list & send
messageRouter.get("/", authMiddleware, getMessages);
messageRouter.post(
  "/",
  authMiddleware,
  (req, res, next) => {
    upload.array("attachments", 5)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  sendMessage
);

// Actions on individual messages
messageRouter.post("/:id/send-now", authMiddleware, sendMessageNow);
messageRouter.post("/:id/mark-sent", authMiddleware, markMessageSent);
messageRouter.patch("/:id", authMiddleware, updateScheduledMessage);
messageRouter.put("/:id", authMiddleware, updateScheduledMessage);
messageRouter.post("/:id", authMiddleware, updateScheduledMessage);
messageRouter.post("/:id/reschedule", authMiddleware, updateScheduledMessage);
messageRouter.post("/:id/cancel", authMiddleware, cancelScheduledMessage);
messageRouter.post("/:id/retry", authMiddleware, retryMessage);
messageRouter.delete("/:id", authMiddleware, deleteMessage);

export default messageRouter;
