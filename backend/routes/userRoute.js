import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getCurrentUser,
  loginUser,
  requestSignupOtp,
  verifySignupOtp,
  updatePassword,
  updateProfile,
  uploadAvatar,
  requestForgotPasswordOtp,
  resetPasswordWithOtp,
} from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';

const userRouter = express.Router();

// Ensure uploads/avatars directory exists
const avatarDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

// Multer storage for profile avatar images
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `avatar_${req.user.id}_${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

const avatarFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP, and GIF images are permitted for profile avatars."));
  }
};

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
  fileFilter: avatarFilter,
});

// PUBLIC ROUTES
userRouter.post('/register/request-otp', requestSignupOtp);
userRouter.post('/register/verify-otp', verifySignupOtp);
userRouter.post('/login', loginUser);
userRouter.post('/forgot-password/request-otp', requestForgotPasswordOtp);
userRouter.post('/forgot-password/reset', resetPasswordWithOtp);

// PROTECTED ROUTES (require authentication)
userRouter.get('/me', authMiddleware, getCurrentUser);
userRouter.put('/profile', authMiddleware, updateProfile);
userRouter.put('/password', authMiddleware, updatePassword);
userRouter.post('/avatar', authMiddleware, avatarUpload.single('avatar'), uploadAvatar);

export default userRouter;
