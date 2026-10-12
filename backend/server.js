import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';

import path from 'path';
import { fileURLToPath } from 'url';

import userRouter from './routes/userRoute.js'
import taskRouter from './routes/taskRoute.js'
import notificationRouter from './routes/notificationRoute.js'
import messageRouter from './routes/messageRoute.js'
import authRouter from './routes/authRoute.js'
import reminderRouter from './routes/reminderRoute.js'
import { startReminderCron } from './cron/reminderCron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 5000;

// CORS Configuration: Supports local dev, custom production domains (FRONTEND_URL), and Vercel
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:9090",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /\.vercel\.app$/.test(origin)
    ) {
      return callback(null, true);
    }
    // Fallback: in non-strict development environments allow origin
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static access for MMS attachments (only reachable when the server itself
// is publicly hosted, see PUBLIC_BACKEND_URL in .env)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to DB
connectDB().then(() => {
  startReminderCron();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/reminders", reminderRouter);
app.use("/api/messages", messageRouter);

app.get('/', (req, res) => {
  res.send('API WORKING');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
