import User from '../models/userModel.js'
import EmailOtp from '../models/emailOtpModel.js'
import validator from 'validator'
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../utils/mailer.js';
import { getJwtSecret } from '../config/jwt.js';
import { createDeviceSession } from './securityController.js';
import { upload as uploadStorage, remove as removeStorage } from '../utils/storage.js';

// JWT_SECRET handled via getJwtSecret()
const TOKEN_EXPIRES = '24h';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const createToken = (userId) => 
  jwt.sign({ id: userId }, getJwtSecret(), { expiresIn: TOKEN_EXPIRES })

const generateOtp = () => crypto.randomInt(100000, 1000000).toString(); // always 6 digits

// STEP 1 of signup: validate details, email a 6-digit code, don't create the account yet.
export async function requestSignupOtp(req, res) {
  const { name, email, password, termsAccepted, termsVersion = "1.0", privacyVersion = "1.0" } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  if (!termsAccepted) {
    return res.status(400).json({
      success: false,
      message: "You must accept Tasklert's Terms of Service and Privacy Policy to create an account.",
    });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ success: false, message: "Invalid email" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const existingOtp = await EmailOtp.findOne({ email: normalizedEmail });
    if (
      existingOtp?.lastSentAt &&
      Date.now() - existingOtp.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      const waitSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (Date.now() - existingOtp.lastSentAt.getTime())) / 1000
      );
      return res
        .status(429)
        .json({ success: false, message: `Please wait ${waitSeconds}s before requesting another code.` });
    }

    const otp = generateOtp();
    const [codeHash, passwordHash] = await Promise.all([
      bcrypt.hash(otp, 10),
      bcrypt.hash(password, 10),
    ]);

    await EmailOtp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        codeHash,
        name,
        passwordHash,
        termsAccepted: true,
        termsVersion: String(termsVersion),
        privacyVersion: String(privacyVersion),
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let emailSent = false;
    let emailErrorMessage = "";

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: `Your Tasklert Verification Code: ${otp}`,
        text: `Hi ${name || "User"},\n\nYour Tasklert verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\n- Tasklert Team`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 480px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="color: #7e22ce; margin-top: 0; font-size: 22px; font-weight: 800;">Tasklert</h2>
              <p style="color: #64748b; font-size: 13px; margin: 0;">Account Verification Code</p>
            </div>
            <p style="color: #334155; font-size: 15px;">Hi <strong>${name || "User"}</strong>,</p>
            <p style="color: #334155; font-size: 14px;">Your 6-digit Tasklert verification code is:</p>
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1.5px solid #d8b4fe; padding: 16px; border-radius: 10px; text-align: center; margin: 18px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #7e22ce; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 13px; text-align: center;">This code is valid for 10 minutes.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; text-align: center;">Tasklert Productivity Workspace</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error("Email send failed:", emailErr.message);
      emailErrorMessage = emailErr.message;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[TASKLERT OTP] Verification code dispatched for ${normalizedEmail}`);
    }

    if (emailSent) {
      res.json({
        success: true,
        message: "Verification code sent to your email address! Please check your inbox.",
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Could not send verification email to ${normalizedEmail}. ${emailErrorMessage || "Please check your SMTP credentials in backend/.env"}`,
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Server error: ' + (err.message || '') });
  }
}

// STEP 2 of signup: check the 6-digit code, then actually create the account.
export async function verifySignupOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and verification code are required" });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const record = await EmailOtp.findOne({ email: normalizedEmail });
    if (!record) {
      return res
        .status(400)
        .json({ success: false, message: "No pending verification for this email. Please sign up again." });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await EmailOtp.deleteOne({ _id: record._id });
      return res
        .status(400)
        .json({ success: false, message: "Verification code expired. Please sign up again." });
    }

    const match = await bcrypt.compare(String(otp), record.codeHash);
    if (!match) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        await EmailOtp.deleteOne({ _id: record._id });
        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. This verification code has been invalidated for security. Please request a new code.",
        });
      }
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(401).json({
        success: false,
        message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    if (await User.findOne({ email: normalizedEmail })) {
      await EmailOtp.deleteOne({ _id: record._id });
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name: record.name,
      email: normalizedEmail,
      password: record.passwordHash,
      legalAcceptance: {
        termsAccepted: record.termsAccepted !== undefined ? record.termsAccepted : true,
        privacyAccepted: record.termsAccepted !== undefined ? record.termsAccepted : true,
        termsVersion: record.termsVersion || "1.0",
        privacyVersion: record.privacyVersion || "1.0",
        acceptedAt: record.acceptedAt || new Date(),
      },
    });

    await EmailOtp.deleteOne({ _id: record._id });

    const token = createToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

//logic function
 export async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    const deviceId = String(req.body.deviceId || "");
    if (!deviceId) return res.status(400).json({ success: false, message: "Device identifier is required. Connect to the internet and try again." });
    const { token } = await createDeviceSession(user, req, deviceId);
    res.json({success: true,token,user: {id: user._id, name: user.name, email: user.email, provider: user.provider}});
 }
 catch(err){
    console.log(err);
    res.status(500).json({ success: false, message: 'Server error' });
 }
}

//get current user
export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user.id).select("name email avatar provider createdAt");
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

//update user profile
export async function updateProfile(req, res) {
  const { name, email, avatar } = req.body;

  if (!name || !email || !validator.isEmail(email)) {
    return res.status(400).json({ success: false, message: "Valid name and email required" });
  }
  try {
    const exists = await User.findOne({ email, _id: { $ne: req.user.id } });
    if (exists) {
      return res.status(409).json({ success: false, message: "Email already in use by another account." });
    }

    const updateFields = { name, email };
    if (avatar !== undefined) {
      updateFields.avatar = avatar;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true, select: "name email avatar provider createdAt" }
    );

    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// Upload custom avatar image
export async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const currentUser = await User.findById(req.user.id);
    if (currentUser?.avatarPublicId) {
      await removeStorage(currentUser.avatarPublicId).catch(() => {});
    }

    const safeName = `avatar_${req.user.id}_${Date.now()}`;
    const result = await uploadStorage(req.file.buffer || req.file, {
      folder: "avatars",
      filename: req.file.originalname || `${safeName}.png`,
      resourceType: "image",
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: result.url, avatarPublicId: result.public_id },
      { new: true, select: "name email avatar provider createdAt" }
    );
    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: result.url,
      user,
    });
  } catch (err) {
    console.error("[Avatar Upload Error]", err);
    res.status(500).json({ success: false, message: err.message || "Failed to upload avatar" });
  }
}
// CHANGE PASSWORD FUNCTION
export async function updatePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({success: false,message: "Password invalid or too short" });
  }

  try {
    const user = await User.findById(req.user.id).select("password");
    if (!user) {
      return res.status(404).json({success: false, message: "User not found"});
    }

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({success: false,message: "Current password incorrect"});
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({success: true,message: "Password updated successfully"});
  } 

  catch (error) {
      console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// FORGOT PASSWORD STEP 1: Request OTP
export async function requestForgotPasswordOtp(req, res) {
  const { email } = req.body;
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ success: false, message: "Valid email is required" });
  }

  const normalizedEmail = email.toLowerCase();
  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email address." });
    }

    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);

    await EmailOtp.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        codeHash,
        name: user.name,
        passwordHash: "RESET_OTP",
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        lastSentAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let emailSent = false;
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: `Your Tasklert Password Reset Code: ${otp}`,
        text: `Hi ${user.name},\n\nYour password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\n- Tasklert Team`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 480px; border: 1px solid #e9d5ff; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="color: #7e22ce; margin-top: 0; font-size: 22px; font-weight: 800;">Tasklert</h2>
              <p style="color: #64748b; font-size: 13px; margin: 0;">Password Reset Code</p>
            </div>
            <p style="color: #334155; font-size: 15px;">Hi <strong>${user.name}</strong>,</p>
            <p style="color: #334155; font-size: 14px;">Your 6-digit password reset code is:</p>
            <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1.5px solid #d8b4fe; padding: 16px; border-radius: 10px; text-align: center; margin: 18px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #7e22ce; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 13px; text-align: center;">This code is valid for 10 minutes.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (e) {
      console.error("Forgot password email failed:", e.message);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[TASKLERT FORGOT PASS OTP] Reset code dispatched for ${normalizedEmail}`);
    }

    res.json({
      success: true,
      message: emailSent
        ? "Password reset code sent to your email!"
        : "Reset code generated and logged to console.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// FORGOT PASSWORD STEP 2: Verify OTP and reset password
export async function resetPasswordWithOtp(req, res) {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: "Email, OTP code, and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
  }

  const normalizedEmail = email.toLowerCase();
  try {
    const record = await EmailOtp.findOne({ email: normalizedEmail });
    if (!record) {
      return res.status(400).json({ success: false, message: "No password reset request found for this email." });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await EmailOtp.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: "Reset code has expired. Please request a new one." });
    }

    const match = await bcrypt.compare(String(otp), record.codeHash);
    if (!match) {
      record.attempts = (record.attempts || 0) + 1;
      if (record.attempts >= 5) {
        await EmailOtp.deleteOne({ _id: record._id });
        return res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. This reset code has been invalidated for security. Please request a new code.",
        });
      }
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(401).json({
        success: false,
        message: `Incorrect reset code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await EmailOtp.deleteOne({ _id: record._id });

    res.json({ success: true, message: "Password reset successfully! You can now log in with your new password." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// REQUEST OTP FOR PERMANENT ACCOUNT DELETION
export async function requestDeleteAccountOtp(req, res) {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const normalizedEmail = user.email.toLowerCase();
    const existing = await EmailOtp.findOne({ email: normalizedEmail });
    if (existing && Date.now() - existing.updatedAt?.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return res.status(429).json({
        success: false,
        message: "Please wait a minute before requesting another code.",
      });
    }

    const code = generateOtp();
    await EmailOtp.findOneAndUpdate(
      { email: normalizedEmail },
      { code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendEmail({
      to: normalizedEmail,
      subject: "Tasklert Account Deletion Confirmation Code",
      text: `Your Tasklert account deletion confirmation code is ${code}. It expires in 10 minutes. If you did not request this, your account remains completely safe.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #fee2e2; border-radius: 12px; background: #fff5f5; max-width: 480px;">
          <h2 style="color: #b91c1c; margin-top: 0;">Confirm Account Deletion</h2>
          <p style="color: #4b5563; font-size: 14px;">You have requested to permanently delete your Tasklert account and all associated data.</p>
          <div style="background: #ffffff; border: 2px dashed #ef4444; padding: 16px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #dc2626; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">This code expires in 10 minutes. If you did not request this, please ignore this email and your account will remain safe.</p>
        </div>
      `,
    });

    res.json({ success: true, message: "Confirmation code sent to your email address." });
  } catch (err) {
    console.error("[Request Delete OTP Error]", err);
    res.status(500).json({ success: false, message: "Failed to send confirmation code." });
  }
}

// PERMANENTLY DELETE USER ACCOUNT AND CASCADE ALL DATA
export async function deleteUserAccount(req, res) {
  try {
    const userId = req.user.id;
    const { password, otp } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Require password (for password-based accounts) OR verified email OTP
    if (user.password && user.provider === "local") {
      if (!password && !otp) {
        return res.status(400).json({
          success: false,
          message: "Please enter your current password or request an email OTP to confirm account deletion.",
        });
      }

      if (password) {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ success: false, message: "Incorrect password." });
        }
      } else if (otp) {
        const validOtp = await EmailOtp.findOne({
          email: user.email.toLowerCase(),
          code: String(otp).trim(),
          expiresAt: { $gt: new Date() },
        });
        if (!validOtp) {
          return res.status(401).json({ success: false, message: "Invalid or expired confirmation code." });
        }
        await EmailOtp.deleteOne({ _id: validOtp._id });
      }
    } else {
      // OAuth accounts: require OTP if provided
      if (otp) {
        const validOtp = await EmailOtp.findOne({
          email: user.email.toLowerCase(),
          code: String(otp).trim(),
          expiresAt: { $gt: new Date() },
        });
        if (!validOtp) {
          return res.status(401).json({ success: false, message: "Invalid or expired confirmation code." });
        }
        await EmailOtp.deleteOne({ _id: validOtp._id });
      }
    }

    // 1. Delete user files from storage
    if (user.avatarPublicId) {
      await removeStorage(user.avatarPublicId).catch(() => {});
    }

    const Task = (await import("../models/taskModel.js")).default;
    const tasks = await Task.find({ owner: userId }).select("attachments");
    for (const t of tasks) {
      if (Array.isArray(t.attachments)) {
        for (const att of t.attachments) {
          if (att.publicId) {
            await removeStorage(att.publicId).catch(() => {});
          }
        }
      }
    }

    // 2. Disconnect and remove Telegram sessions
    try {
      const { deleteSessionForUser } = await import("../services/telegram/telegramSession.service.js");
      await deleteSessionForUser(userId).catch(() => {});
    } catch (_) {}

    // 3. Cascade delete all data across all collections
    const Reminder = (await import("../models/reminderModel.js")).default;
    const Project = (await import("../models/projectModel.js")).default;
    const Notification = (await import("../models/notificationModel.js")).default;
    const Template = (await import("../models/templateModel.js")).default;
    const Contact = (await import("../models/contactModel.js")).default;
    const Message = (await import("../models/messageModel.js")).default;
    const ScheduledDelivery = (await import("../models/ScheduledDelivery.js")).default;
    const FocusSession = (await import("../models/focusSessionModel.js")).default;
    const PushSubscription = (await import("../models/pushSubscriptionModel.js")).default;
    const UserDevice = (await import("../models/userDeviceModel.js")).default;
    const DeviceSession = (await import("../models/deviceSessionModel.js")).default;
    const MessagingAccount = (await import("../models/messagingAccountModel.js")).default;
    const EmailAccount = (await import("../models/EmailAccount.js")).default;
    const EmailMessage = (await import("../models/EmailMessage.js")).default;
    const SyncOperationLog = (await import("../models/syncOperationLogModel.js")).default;
    const UserPreferences = (await import("../models/userPreferencesModel.js")).default;
    const DeliveryLog = (await import("../models/deliveryLogModel.js")).default;

    await Promise.allSettled([
      Task.deleteMany({ owner: userId }),
      Reminder.deleteMany({ owner: userId }),
      Project.deleteMany({ owner: userId }),
      Template.deleteMany({ owner: userId }),
      Contact.deleteMany({ owner: userId }),
      Message.deleteMany({ owner: userId }),
      ScheduledDelivery.deleteMany({ $or: [{ userId }, { owner: userId }] }),
      FocusSession.deleteMany({ owner: userId }),
      Notification.deleteMany({ owner: userId }),
      PushSubscription.deleteMany({ $or: [{ userId }, { owner: userId }] }),
      UserDevice.deleteMany({ userId }),
      DeviceSession.deleteMany({ userId }),
      MessagingAccount.deleteMany({ owner: userId }),
      EmailAccount.deleteMany({ userId }),
      EmailMessage.deleteMany({ userId }),
      SyncOperationLog.deleteMany({ userId }),
      UserPreferences.deleteMany({ owner: userId }),
      DeliveryLog.deleteMany({ owner: userId }),
      EmailOtp.deleteMany({ email: user.email.toLowerCase() }),
      User.deleteOne({ _id: userId }),
    ]);

    res.json({
      success: true,
      message: "Your account and all associated data have been permanently deleted.",
    });
  } catch (err) {
    console.error("[Delete Account Error]", err);
    res.status(500).json({ success: false, message: err.message || "Failed to delete account" });
  }
}






