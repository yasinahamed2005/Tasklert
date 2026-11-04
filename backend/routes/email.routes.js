import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
import {
  handleGetAccountStatus,
  handleGetGmailAuthUrl,
  handleGoogleOAuthCallback,
  handleGetOutlookAuthUrl,
  handleConnectSmtp,
  handleDisconnectAccount,
  handleGetFolders,
  handleGetMessages,
  handleGetMessage,
  handleMarkRead,
  handleMarkStar,
  handleMoveToTrash,
  handleArchive,
  handleSendEmail,
  handleSaveDraft,
  handleUpdateDraft,
  handleScheduleEmail,
  handleGetScheduledEmails,
  handleCancelScheduledEmail,
  handleSyncMailbox,
} from "../controllers/email.controller.js";

const emailRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25MB per file, up to 10 files
});

// OAuth Callback from Google (Public callback - authenticated cryptographically via signed PKCE state token)
emailRouter.get("/auth/gmail/callback", handleGoogleOAuthCallback);

// All subsequent email endpoints require authenticated Tasklert user session
emailRouter.use(authMiddleware);

// 1. Account Connection & Status
emailRouter.get("/account/status", handleGetAccountStatus);
emailRouter.post("/account/disconnect", handleDisconnectAccount);
emailRouter.get("/auth/gmail/url", handleGetGmailAuthUrl);
emailRouter.get("/auth/outlook/url", handleGetOutlookAuthUrl);
emailRouter.post("/auth/smtp/connect", handleConnectSmtp);

// 2. Folders & Mailbox
emailRouter.get("/folders", handleGetFolders);
emailRouter.get("/messages", handleGetMessages);
emailRouter.get("/messages/:messageId", handleGetMessage);
emailRouter.post("/messages/:messageId/read", handleMarkRead);
emailRouter.post("/messages/:messageId/star", handleMarkStar);
emailRouter.post("/messages/:messageId/trash", handleMoveToTrash);
emailRouter.post("/messages/:messageId/archive", handleArchive);

// 3. Compose, Send & Drafts
emailRouter.post(
  "/send",
  (req, res, next) => {
    upload.array("attachments", 10)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  },
  handleSendEmail
);
emailRouter.post("/drafts", handleSaveDraft);
emailRouter.put("/drafts/:draftId", handleUpdateDraft);

// 4. Scheduling
emailRouter.post("/schedule", handleScheduleEmail);
emailRouter.get("/scheduled", handleGetScheduledEmails);
emailRouter.delete("/scheduled/:id", handleCancelScheduledEmail);

// 5. Sync
emailRouter.post("/sync", handleSyncMailbox);

export default emailRouter;

