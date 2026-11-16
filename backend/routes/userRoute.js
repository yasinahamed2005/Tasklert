import express from 'express';
import multer from 'multer';
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
  requestDeleteAccountOtp,
  deleteUserAccount,
} from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';

const userRouter = express.Router();

// Allowed avatar formats
const avatarFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WEBP, and GIF images are permitted for profile avatars."));
  }
};

// Memory storage for avatar images before uploading to persistent cloud storage
const avatarUpload = multer({
  storage: multer.memoryStorage(),
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
userRouter.post('/account/request-delete-otp', authMiddleware, requestDeleteAccountOtp);
userRouter.delete('/account', authMiddleware, deleteUserAccount);

export default userRouter;
