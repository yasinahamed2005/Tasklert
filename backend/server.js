import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { getJwtSecret } from './config/jwt.js';
import userRouter from './routes/userRoute.js';
import taskRouter from './routes/taskRoute.js';
import notificationRouter from './routes/notificationRoute.js';
import messageRouter from './routes/messageRoute.js';
import authRouter from './routes/authRoute.js';
import reminderRouter from './routes/reminderRoute.js';
import projectRouter from './routes/projectRoute.js';
import templateRouter from './routes/templateRoute.js';
import focusRouter from './routes/focusRoute.js';
import analyticsRouter from './routes/analyticsRoute.js';
import { startReminderCron } from './cron/reminderCron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Verify JWT secret configuration at startup
try {
  getJwtSecret();
} catch (err) {
  console.error("STARTUP ERROR:", err.message);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

// Trust reverse proxy (Railway, Vercel)
app.set("trust proxy", 1);

// CORS Configuration: Explicit allowlist for production Vercel and local dev origins
const allowedOrigins = [
  "https://tasklert-delta.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:9090",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/.*\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    // In production, strictly reject unauthorized origins
    if (process.env.NODE_ENV === "production") {
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    }
    // In development only, allow local testing
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Rate limiting: Protect authentication endpoints and general API from abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again after 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiters
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/user/login", authLimiter);
app.use("/api/user/register", authLimiter);

// Static access for uploaded files (task attachments, MMS)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to DB and start cron
connectDB().then(() => {
  startReminderCron();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/projects", projectRouter);
app.use("/api/templates", templateRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/reminders", reminderRouter);
app.use("/api/messages", messageRouter);
app.use("/api/focus", focusRouter);
app.use("/api/analytics", analyticsRouter);

app.get('/', (req, res) => {
  res.send('API WORKING');
});

// Centralized error handling to prevent stack trace leaks
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith("CORS origin not allowed")) {
    return res.status(403).json({ success: false, message: "CORS policy violation: origin not allowed." });
  }
  console.error("[Server Error]", err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error." : (err.message || "Server Error"),
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
