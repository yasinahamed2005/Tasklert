import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config(); // fallback to cwd if any

import { connectDB } from './config/db.js';
import { getJwtSecret } from './config/jwt.js';
import Task from './models/taskModel.js';
import userRouter from './routes/userRoute.js';
import taskRouter from './routes/taskRoute.js';
import notificationRouter from './routes/notificationRoute.js';
import messageRouter from './routes/messageRoute.js';
import contactRouter from './routes/contactRoute.js';
import authRouter from './routes/authRoute.js';
import reminderRouter from './routes/reminderRoute.js';
import projectRouter from './routes/projectRoute.js';
import templateRouter from './routes/templateRoute.js';
import focusRouter from './routes/focusRoute.js';
import analyticsRouter from './routes/analyticsRoute.js';
import telegramRouter from './routes/telegram.routes.js';
import emailRouter from './routes/email.routes.js';
import scheduledRouter from './routes/unifiedScheduleRoute.js';
import deviceRouter from './routes/deviceRoutes.js';
import syncRouter from './routes/syncRoute.js';
import { closeAllTelegramClients } from './services/telegram/telegramClient.service.js';
import { startReminderCron, getLastCronRunTime } from './cron/reminderCron.js';

// Verify JWT secret configuration at startup
try {
  getJwtSecret();
} catch (err) {
  console.error("STARTUP ERROR:", err.message);
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

// Trust reverse proxy (Render, Vercel, Railway)
app.set("trust proxy", 1);

// Security Headers via Helmet (configured to allow cross-origin avatar and image loading)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

// CORS Configuration: Allow only FRONTEND_URL and ALLOWED_ORIGINS from env (no loose regex)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : []),
].filter(Boolean);

// In non-production, include standard localhost development ports
if (process.env.NODE_ENV !== "production") {
  [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:9090",
    "http://127.0.0.1:5173",
  ].forEach((origin) => {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === "production") {
        return callback(new Error(`CORS origin not allowed: ${origin}`));
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing with 1mb limit and raw body preservation for webhook HMAC verification
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting: Protect authentication endpoints and general API from abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again after 15 minutes." },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Strict limit: 5 requests per 15 min per IP + email
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown_ip";
    return email ? `${ip}_${email}` : ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification requests. Please wait 15 minutes before requesting another OTP.",
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 1500 : 3000, // Generous ceiling preventing premature 429 throttling
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
});

// Apply rate limiters
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/user/login", authLimiter);
app.use("/api/user/register", authLimiter);
app.use("/api/user/register/request-otp", otpLimiter);
app.use("/api/user/register/verify-otp", otpLimiter);
app.use("/api/user/forgot-password/request-otp", otpLimiter);
app.use("/api/user/forgot-password/reset", otpLimiter);

// Public static access ONLY for avatars (never the entire /uploads folder)
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

// Authenticated route for task attachments (requires valid user ownership)
app.get('/uploads/tasks/:filename', async (req, res) => {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required to access task attachments.' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    userId = decoded.id;
  } catch (_) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  const safeFilename = path.basename(req.params.filename);
  const task = await Task.findOne({
    owner: userId,
    'attachments.url': { $regex: safeFilename },
  });

  if (!task) {
    return res.status(403).json({ success: false, message: 'Access denied: attachment does not belong to your account.' });
  }

  const filePath = path.join(__dirname, 'uploads', 'tasks', safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Attachment file not found.' });
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (isImage) {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeFilename)}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeFilename)}"`);
  }

  return res.sendFile(filePath);
});

// Connect to DB and start cron only after connection succeeds
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
app.use("/api/contacts", contactRouter);
app.use("/api/focus", focusRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/telegram", telegramRouter);
app.use("/api/email", emailRouter);
app.use("/api/scheduled", scheduledRouter);
app.use("/api/devices", deviceRouter);
app.use("/api/sync", syncRouter);

app.get('/', (req, res) => {
  res.send('API WORKING');
});

// Health check endpoint with MongoDB connection state and last cron run info
app.get('/healthz', (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const status = isMongoConnected ? "ok" : "degraded";
  const code = isMongoConnected ? 200 : 503;
  res.status(code).json({
    status,
    database: isMongoConnected ? "connected" : "disconnected",
    mongoReadyState: mongoose.connection.readyState,
    lastCronRun: getLastCronRunTime(),
    timestamp: new Date().toISOString(),
  });
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

// Graceful shutdown
const shutdown = async () => {
  try {
    await closeAllTelegramClients();
  } catch (_) {}
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server: Bind to 0.0.0.0 for Render compatibility
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
