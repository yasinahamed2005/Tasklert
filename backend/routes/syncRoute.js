import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  pushSync,
  pullSync,
  getSyncStatus,
} from "../controllers/syncController.js";

const syncRouter = express.Router();

// All sync endpoints require user authentication
syncRouter.use(authMiddleware);

syncRouter.post("/push", pushSync);
syncRouter.get("/pull", pullSync);
syncRouter.get("/status", getSyncStatus);

export default syncRouter;
