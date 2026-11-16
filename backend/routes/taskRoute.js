import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../middleware/auth.js";
import Task from "../models/taskModel.js";
import { upload as uploadStorage } from "../utils/storage.js";
import { fileFilterAllowlist, sanitizeFilename } from "../utils/uploadSecurity.js";

import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
  restoreTask,
  bulkTaskOperations,
  getUserTags,
} from "../controllers/taskController.js";

const taskRouter = express.Router();

taskRouter.post("/bulk", authMiddleware, bulkTaskOperations);
taskRouter.get("/tags", authMiddleware, getUserTags);

// Memory storage for task attachments before persisting to cloud/storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilterAllowlist,
});

taskRouter.post("/upload", authMiddleware, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "File size exceeds 10MB limit." });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    try {
      const safeName = sanitizeFilename(req.file.originalname);
      const isImage = req.file.mimetype.startsWith("image/");
      const isVideo = req.file.mimetype.startsWith("video/");
      const fileType = isImage ? "image" : isVideo ? "video" : "document";

      const result = await uploadStorage(req.file.buffer, {
        folder: "tasks",
        filename: safeName,
        resourceType: isImage ? "image" : isVideo ? "video" : "auto",
      });

      res.json({
        success: true,
        file: {
          name: safeName,
          url: result.url,
          publicId: result.public_id,
          fileType,
          size: req.file.size,
        },
      });
    } catch (uploadErr) {
      console.error("[Task Upload Error]", uploadErr);
      res.status(500).json({ success: false, message: uploadErr.message || "Failed to upload task attachment." });
    }
  });
});

// Authenticated route to serve local task attachments with strict ownership verification
taskRouter.get("/attachment/:filename", authMiddleware, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const userId = req.user.id;

    // Check if attachment belongs to a task owned by the requesting user
    const task = await Task.findOne({
      owner: userId,
      "attachments.url": { $regex: filename },
    });

    if (!task) {
      return res.status(403).json({ success: false, message: "Access denied: Attachment does not belong to your account." });
    }

    const filePath = path.join(process.cwd(), "uploads", "tasks", filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Attachment file not found." });
    }

    const ext = path.extname(filename).toLowerCase();
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext);

    res.setHeader("X-Content-Type-Options", "nosniff");
    if (isImage) {
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    } else {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error retrieving attachment." });
  }
});

taskRouter.post("/:id/restore", authMiddleware, restoreTask);
taskRouter.post("/:id/restore/gp", authMiddleware, restoreTask);

taskRouter.route("/")
  .get(authMiddleware, getTasks)
  .post(authMiddleware, createTask);

taskRouter.route("/gp")
  .get(authMiddleware, getTasks)
  .post(authMiddleware, createTask);

taskRouter.route("/:id")
  .get(authMiddleware, getTaskById)
  .put(authMiddleware, updateTask)
  .delete(authMiddleware, deleteTask);

taskRouter.route("/:id/gp")
  .get(authMiddleware, getTaskById)
  .put(authMiddleware, updateTask)
  .delete(authMiddleware, deleteTask);

export default taskRouter;
