# 🔔 Tasklert — Smart Alarm & Cross-Device Notification Platform

Tasklert is a modern task management and calendar-grade smart alarm platform built with React, Vite, Node.js, Express, and MongoDB. It features real-time, cross-device background Web Push notifications that wake devices up with persistent system alerts—even when the website or mobile web app is closed.

---

## 🚀 Key Features

- **Exact-Time Smart Alarms**: Schedule reminders with exact date, time, and custom alarm tones (*Digital Alarm, Classic Bell, Gentle Chime, Morning Bell, Soft Reminder*).
- **Cross-Device Web Push Synchronization**: Multi-device fleet management associating both desktop and mobile devices (Android & iOS PWA) to a single user account.
- **Background System Notifications**: Web Push service worker displays actionable system alerts (`Open Task`, `Snooze 10m`, `Dismiss`) with custom vibration patterns.
- **Comprehensive Task Management**: Full task CRUD with priority levels (Low, Medium, High), categories, attachments, search, and completion tracking.
- **Enterprise Authentication**: Email/password authentication with JWT, alongside OAuth 2.0 / OpenID Connect (Google, GitHub) and OTP verification.
- **Multi-Channel Dispatch**: Support for device push notifications, email alerts (SMTP), and SMS notifications (Twilio).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Lucide Icons, React Router v7, Framer Motion |
| **Backend** | Node.js, Express, Mongoose, Node-Cron, Web-Push (VAPID) |
| **Database** | MongoDB / MongoDB Atlas |
| **Target Hosting** | Frontend on **Vercel**, Backend API on **Railway** |

---

## 📁 Project Architecture

```
FlowTask-update/
├── .gitignore                   # Root Git ignore rules (node_modules, .env, build outputs)
├── package.json                 # Root orchestration scripts
├── package-lock.json
├── README.md                    # Project documentation
│
├── backend/                     # Node.js + Express REST API
│   ├── .env.example             # Backend environment variables template
│   ├── .gitignore               # Backend-specific ignore rules
│   ├── server.js                # Express app entry point & CORS configuration
│   ├── package.json             # Backend dependencies & scripts
│   ├── config/                  # Database connection (Mongoose)
│   ├── controllers/             # Business logic (auth, tasks, notifications, push)
│   ├── cron/                    # Atomic 30s background reminder scheduler
│   ├── middleware/              # JWT auth and file upload middlewares
│   ├── models/                  # Mongoose schemas (User, Task, PushSubscription, etc.)
│   ├── routes/                  # Express route definitions
│   ├── services/                # Push notification and email delivery services
│   ├── uploads/                 # Static asset and file attachment storage
│   └── utils/                   # Helper functions (SMS, tokens, sound helpers)
│
└── frontend/                    # React 19 + Vite Single Page Application
    ├── .env.example             # Frontend environment variables template
    ├── .gitignore               # Frontend-specific ignore rules
    ├── index.html               # SPA HTML entry point
    ├── vercel.json              # Vercel SPA routing rewrite rules
    ├── vite.config.js           # Vite configuration
    ├── package.json             # Frontend dependencies & scripts
    ├── public/
    │   ├── sw.js                # Service Worker handling background Web Push
    │   └── favicon / icons      # Web app manifest and icons
    └── src/
        ├── assets/              # Icons, logos, and UI constants
        ├── components/          # Reusable UI components (TaskModal, DeviceSettings, etc.)
        ├── pages/               # Main route views (Dashboard, Pending, Complete, etc.)
        └── utils/               # Client push manager and Web Audio sound synthesizer
```

---

## ⚙️ Environment Variables

### 1. Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and populate your credentials:

```env
# Server Port & Database
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/tasklert?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_min_32_chars

# Application Origins
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email Dispatch (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com

# SMS Dispatch (Optional - Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Web Push Notifications (VAPID)
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@tasklert.com
```

### 2. Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env`:

```env
# Points to Express backend API
# Local development:
VITE_API_URL=http://localhost:5000

# Production (e.g. deployed on Railway):
# VITE_API_URL=https://tasklert-backend.up.railway.app
```

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js** (v18 or v20+ recommended)
- **npm** (v9+ recommended)
- **MongoDB** instance (local or MongoDB Atlas connection string)

### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Backend Service
```bash
cd backend
npm run dev
# Backend server runs at http://localhost:5000
```

### 3. Start Frontend Service
```bash
cd frontend
npm run dev
# Frontend Vite dev server runs at http://localhost:5173
```

---

## 🚢 Deployment Guide

### Deploying the Backend to Railway

1. **Create Project**: Sign in to [Railway](https://railway.app) and create a **New Project**.
2. **Deploy from GitHub**: Select your GitHub repository (`yasinahamed2005/Tasklert`) and choose the root directory as `/backend`.
3. **Configure Environment Variables**: Under the service **Variables** tab, add:
   - `PORT` (Railway provides this automatically)
   - `MONGO_URI` (Paste your MongoDB Atlas connection string or attach a Railway MongoDB database)
   - `JWT_SECRET`
   - `FRONTEND_URL` (Set to your Vercel URL, e.g., `https://tasklert.vercel.app`)
   - `BACKEND_URL` (Set to your Railway generated domain, e.g., `https://tasklert-production.up.railway.app`)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - `SMTP_*` and `GOOGLE_*` / `GITHUB_*` credentials
4. **Deploy**: Railway runs `npm install` and `npm start` automatically. Note your public Railway domain.

### Deploying the Frontend to Vercel

1. **Import Project**: Sign in to [Vercel](https://vercel.com) and click **Add New → Project**.
2. **Select Repository**: Select `yasinahamed2005/Tasklert`.
3. **Configure Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Set Environment Variables**:
   - `VITE_API_URL`: Your deployed Railway backend URL (e.g., `https://tasklert-production.up.railway.app`)
5. **Deploy**: Vercel will build the frontend with `vercel.json` rewrite rules configured for SPA routing.

---

## 📄 License
This project is licensed under the ISC License.
