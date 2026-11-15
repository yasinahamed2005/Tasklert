import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  registerDevice,
  heartbeatDevice,
  confirmAlarmScheduled,
  getUserDevices,
  deregisterDevice,
} from "../controllers/deviceController.js";
import { listSessions, activity, requestOtp, verifyOtp } from "../controllers/securityController.js";
import { inspectSecurityAction, confirmSecurityAction } from "../controllers/securityController.js";

const deviceRouter = express.Router();

deviceRouter.post("/security/action/inspect", inspectSecurityAction);
deviceRouter.post("/security/action/confirm", confirmSecurityAction);

deviceRouter.use(authMiddleware);

deviceRouter.post("/register", registerDevice);
deviceRouter.post("/heartbeat", heartbeatDevice);
deviceRouter.post("/confirm-alarm", confirmAlarmScheduled);
deviceRouter.get("/", getUserDevices);
deviceRouter.delete("/:deviceId", deregisterDevice);
deviceRouter.get("/security/sessions", listSessions);
deviceRouter.get("/security/activity", activity);
deviceRouter.post("/security/otp", requestOtp);
deviceRouter.post("/security/otp/verify", verifyOtp);

export default deviceRouter;

