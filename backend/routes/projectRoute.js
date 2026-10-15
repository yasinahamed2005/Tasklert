import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

projectRouter
  .route("/")
  .get(authMiddleware, getProjects)
  .post(authMiddleware, createProject);

projectRouter
  .route("/:id")
  .put(authMiddleware, updateProject)
  .delete(authMiddleware, deleteProject);

export default projectRouter;
