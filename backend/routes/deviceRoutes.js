import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  registerDevice,
  heartbeatDevice,
  confirmAlarmScheduled,
  getUserDevices,
  deregisterDevice,
} from "../controllers/deviceController.js";

const deviceRouter = express.Router();

deviceRouter.use(authMiddleware);

deviceRouter.post("/register", registerDevice);
deviceRouter.post("/heartbeat", heartbeatDevice);
deviceRouter.post("/confirm-alarm", confirmAlarmScheduled);
deviceRouter.get("/", getUserDevices);
deviceRouter.delete("/:deviceId", deregisterDevice);

export default deviceRouter;

