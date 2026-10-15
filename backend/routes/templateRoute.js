import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  getTemplates,
  createTemplate,
  deleteTemplate,
} from "../controllers/templateController.js";

const templateRouter = express.Router();

templateRouter
  .route("/")
  .get(authMiddleware, getTemplates)
  .post(authMiddleware, createTemplate);

templateRouter
  .route("/:id")
  .delete(authMiddleware, deleteTemplate);

export default templateRouter;
