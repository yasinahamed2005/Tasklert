import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createScheduledDelivery,
  getScheduledDeliveries,
  getScheduledStats,
  getScheduledDeliveryById,
  updateScheduledDelivery,
  cancelScheduledDelivery,
  duplicateScheduledDelivery,
  sendNowScheduledDelivery,
} from "../controllers/unifiedScheduleController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createScheduledDelivery);
router.get("/", getScheduledDeliveries);
router.get("/stats", getScheduledStats);
router.get("/:id", getScheduledDeliveryById);
router.put("/:id", updateScheduledDelivery);
router.delete("/:id", cancelScheduledDelivery);
router.post("/:id/duplicate", duplicateScheduledDelivery);
router.post("/:id/send-now", sendNowScheduledDelivery);

export default router;

