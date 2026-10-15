import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  getAnalyticsSummary,
  exportDataCSV,
} from "../controllers/analyticsController.js";

const analyticsRouter = express.Router();

analyticsRouter.get("/summary", authMiddleware, getAnalyticsSummary);
analyticsRouter.get("/export", authMiddleware, exportDataCSV);

export default analyticsRouter;
