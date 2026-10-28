import User from '../models/userModel.js'
import EmailOtp from '../models/emailOtpModel.js'
import validator from 'validator'
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../utils/mailer.js';
import { getJwtSecret } from '../config/jwt.js';

// JWT_SECRET handled via getJwtSecret()
const TOKEN_EXPIRES = '24h';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

const createToken = (userId) => 
  jwt.sign({ id: userId }, getJwtSecret(), { expiresIn: TOKEN_EXPIRES })

const generateOtp = () => crypto.randomInt(100000, 1000000).toString(); // always 6 digits

// STEP 1 of signup: validate details, email a 6-digit code, don't create the account yet.
export async function requestSignupOtp(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
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
    const token = createToken(user._id);
     res.json({success: true,token,user: {id: user._id, name: user.name, email: user.email}});
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
    const relativeUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: relativeUrl },
      { new: true, select: "name email avatar provider createdAt" }
    );
    res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: relativeUrl,
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






