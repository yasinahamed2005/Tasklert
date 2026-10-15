import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  startSession,
  getActiveSession,
  pauseSession,
  resumeSession,
  completeSession,
  cancelSession,
  getFocusHistory,
} from "../controllers/focusController.js";

const focusRouter = express.Router();

focusRouter.post("/start", authMiddleware, startSession);
focusRouter.get("/active", authMiddleware, getActiveSession);
focusRouter.get("/history", authMiddleware, getFocusHistory);

focusRouter.post("/:id/pause", authMiddleware, pauseSession);
focusRouter.post("/:id/resume", authMiddleware, resumeSession);
focusRouter.post("/:id/complete", authMiddleware, completeSession);
focusRouter.post("/:id/cancel", authMiddleware, cancelSession);

export default focusRouter;
