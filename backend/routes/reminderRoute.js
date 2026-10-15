import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createReminder,
  deleteReminder,
  dismissReminder,
  getReminderById,
  getReminders,
  getUpcomingAlarms,
  getUserPreferences,
  snoozeReminder,
  toggleReminder,
  updateReminder,
  updateUserPreferences,
} from "../controllers/reminderController.js";

const reminderRouter = express.Router();

// Base routes
reminderRouter.route("/")
  .get(authMiddleware, getReminders)
  .post(authMiddleware, createReminder);

// Special routes (must be defined before /:id)
reminderRouter.get("/upcoming", authMiddleware, getUpcomingAlarms);
reminderRouter.route("/preferences")
  .get(authMiddleware, getUserPreferences)
  .put(authMiddleware, updateUserPreferences);

// Specific ID routes
reminderRouter.route("/:id")
  .get(authMiddleware, getReminderById)
  .put(authMiddleware, updateReminder)
  .delete(authMiddleware, deleteReminder);

reminderRouter.route("/:id/toggle")
  .patch(authMiddleware, toggleReminder)
  .put(authMiddleware, toggleReminder)
  .post(authMiddleware, toggleReminder);
reminderRouter.post("/:id/snooze", authMiddleware, snoozeReminder);
reminderRouter.post("/:id/dismiss", authMiddleware, dismissReminder);

export default reminderRouter;
