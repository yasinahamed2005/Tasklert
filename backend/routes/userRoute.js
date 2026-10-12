import express from 'express';
import {getCurrentUser,loginUser,requestSignupOtp,verifySignupOtp,updatePassword,updateProfile,requestForgotPasswordOtp,resetPasswordWithOtp } from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js'

const userRouter = express.Router();

//  PUBLIC ROUTES
// Two-step signup: request a 6-digit email code, then verify it to create the account.
userRouter.post('/register/request-otp', requestSignupOtp);
userRouter.post('/register/verify-otp', verifySignupOtp);
userRouter.post('/login', loginUser);
userRouter.post('/forgot-password/request-otp', requestForgotPasswordOtp);
userRouter.post('/forgot-password/reset', resetPasswordWithOtp);

//  PROTECTED ROUTES (require authentication)
userRouter.get('/me', authMiddleware, getCurrentUser);
userRouter.put('/profile', authMiddleware, updateProfile);
userRouter.put('/password', authMiddleware, updatePassword);

export default userRouter;

