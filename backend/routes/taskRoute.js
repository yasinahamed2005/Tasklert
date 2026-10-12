import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../middleware/auth.js";

import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask,
} from "../controllers/taskController.js";

const taskRouter = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads", "tasks");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `task-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

taskRouter.post("/upload", authMiddleware, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, message: "File size exceeds 10MB limit." });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const fileUrl = `http://localhost:5000/uploads/tasks/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith("image/")
      ? "image"
      : req.file.mimetype.startsWith("video/")
      ? "video"
      : "document";

    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        url: fileUrl,
        fileType,
        size: req.file.size,
      },
    });
  });
});

taskRouter.route("/gp")
  .get(authMiddleware, getTasks)
  .post(authMiddleware, createTask);

taskRouter.route("/:id/gp")
  .get(authMiddleware, getTaskById)
  .put(authMiddleware, updateTask)
  .delete(authMiddleware, deleteTask);

export default taskRouter;
