import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
import {
  deleteMessage,
  getMessages,
  sendMessage,
} from "../controllers/messageController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }, // 15MB per file, up to 5 files
});

const messageRouter = express.Router();

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
messageRouter.delete("/:id", authMiddleware, deleteMessage);

export default messageRouter;
