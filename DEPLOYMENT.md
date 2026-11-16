# Tasklert Production Deployment & Reliability Guide

This document describes how to deploy Tasklert to production across **Render (Backend)**, **MongoDB Atlas (Database)**, and **Vercel (Frontend PWA)**, with continuous health checks and zero-loss backup policies.

---

## 1. Render Backend Setup

### A. Service Settings
- **Environment**: Node
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Health Check Path**: `/healthz` (returns HTTP 200 with DB status and cron timestamp)

### B. Always-On / Spin-Down Prevention
On Render's free tier, the web service spins down after 15 minutes of inactivity:
1. **Option 1 (Render Paid Starter Plan)**: Set the instance type to Starter ($7/mo) to keep the instance running 24/7 without cold starts.
2. **Option 2 (UptimeRobot Free Ping)**:
   - Create a free account at [https://uptimerobot.com](https://uptimerobot.com).
   - Add a new **HTTP(s) Monitor**.
   - URL: `https://your-backend.onrender.com/healthz`
   - Monitoring Interval: **Every 5 minutes**.
   - This keeps the process awake, ensuring background reminders and cron jobs fire on time.

---

## 2. MongoDB Atlas Automatic Backups

1. Log into your [MongoDB Atlas Dashboard](https://cloud.mongodb.com).
2. Select your cluster and navigate to the **Backup** tab.
3. Enable **Cloud Backup**:
   - Retention policy: **Daily snapshots retained for 7 days**.
   - Point-in-time recovery (PITR): Enable if available on your tier.
4. Set up an automated alert for storage usage exceeding 80% under **Project Alerts**.

---

## 3. Required Environment Variables

### A. Render (Backend Environment Variables)

| Variable | Required | Description | Example / Recommended Value |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | App environment mode | `production` |
| `PORT` | **Yes** | Server port (Render sets automatically) | `5000` |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/tasklert?retryWrites=true&w=majority` |
| `JWT_SECRET` | **Yes** | High-entropy JWT signing key (min 32 chars) | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ENCRYPTION_KEY` | **Yes** | AES-256 key for provider credentials (32-byte hex) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FRONTEND_URL` | **Yes** | Production frontend URL for strict CORS | `https://tasklert-delta.vercel.app` |
| `ALLOWED_ORIGINS` | No | Additional allowed origins (comma separated) | `https://tasklert-delta.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary cloud name for file uploads | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API Key | `your_api_key` |
| `CLOUDINARY_API_SECRET`| Optional | Cloudinary API Secret | `your_api_secret` |
| `WHATSAPP_VERIFY_TOKEN`| Optional | Meta webhook verification token | `your_custom_verify_token` |
| `WHATSAPP_APP_SECRET`  | Optional | Meta App Secret for HMAC-SHA256 signature check | `your_app_secret` |
| `GMAIL_CONNECT_ENABLED`| **Yes** | Controls Gmail OAuth connect endpoint | `false` (default until Google verifies app) |
| `VAPID_PUBLIC_KEY`     | Optional | Web Push VAPID public key | Generated via `web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY`    | Optional | Web Push VAPID private key | Generated via `web-push generate-vapid-keys` |
| `VAPID_MAILTO`         | Optional | Web Push contact mailto | `mailto:support@tasklert.app` |
| `TELEGRAM_API_ID`      | Optional | Telegram MTProto App ID | `12345678` |
| `TELEGRAM_API_HASH`    | Optional | Telegram MTProto App Hash | `your_telegram_hash` |

### B. Vercel (Frontend Environment Variables)

| Variable | Required | Description | Example / Recommended Value |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | Render production backend URL | `https://tasklert.onrender.com` |

---

## 4. Verification & Health Monitoring

- **Health Check**: Test with `curl -i https://your-backend.onrender.com/healthz`
  - Response:
    ```json
    {
      "status": "ok",
      "uptime": 123.4,
      "db": "connected",
      "cronLastRun": "2026-11-16T16:00:00.000Z",
      "timestamp": "2026-11-16T16:01:00.000Z"
    }
    ```
- **PWA Offline Mode**: The Service Worker precaches the SPA shell (`index.html`, bundles, fonts, icons) so all core routes (`/dashboard`, `/tasks`, `/calendar`, `/focus`, `/analytics`) load instantly offline on both Android Chrome and desktop.
