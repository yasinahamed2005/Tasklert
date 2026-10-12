import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  deleteAllNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import {
  deleteDevice,
  getDevices,
  getVapidPublicKey,
  sendTestNotification,
  sendDeviceTestNotification,
  subscribeDevice,
  unsubscribeDevice,
  updateDevice,
} from "../controllers/pushController.js";

const notificationRouter = express.Router();

// Web Push Public Key (safe for all clients, used during subscription initiation)
notificationRouter.get("/vapid-public-key", getVapidPublicKey);

// Web Push Subscription & Device Management
notificationRouter.post("/subscribe", authMiddleware, subscribeDevice);
notificationRouter.post("/unsubscribe", authMiddleware, unsubscribeDevice);
notificationRouter.get("/devices", authMiddleware, getDevices);
notificationRouter.patch("/devices/:id", authMiddleware, updateDevice);
notificationRouter.delete("/devices/:id", authMiddleware, deleteDevice);
notificationRouter.post("/devices/:id/test", authMiddleware, sendDeviceTestNotification);
notificationRouter.post("/test", authMiddleware, sendTestNotification);

// In-app Notification Inbox History
notificationRouter.get("/", authMiddleware, getNotifications);
notificationRouter.patch("/read-all", authMiddleware, markAllNotificationsRead);
notificationRouter.delete("/", authMiddleware, deleteAllNotifications);
notificationRouter.patch("/:id/read", authMiddleware, markNotificationRead);

export default notificationRouter;
