import express from "express";
import {
  initiateOAuth,
  handleOAuthCallback,
  getAuthStatus,
} from "../controllers/authController.js";

const authRouter = express.Router();

// Configuration status for all providers
authRouter.get("/status", getAuthStatus);

// Genuine OAuth initiation: /api/auth/:provider (google, facebook, github, linkedin)
authRouter.get("/:provider", initiateOAuth);

// Genuine OAuth callback: /api/auth/:provider/callback
authRouter.get("/:provider/callback", handleOAuthCallback);

export default authRouter;
