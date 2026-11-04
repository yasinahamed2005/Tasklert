import TelegramConnection from "../../models/TelegramConnection.js";
import { encryptCredential, decryptCredential } from "../../utils/crypto.js";

/**
 * Encrypt a GramJS session string using AES-256-GCM authenticated encryption.
 */
export const encryptSession = (sessionString) => {
  if (!sessionString || typeof sessionString !== "string") {
    throw new Error("Invalid session string for encryption");
  }
  return encryptCredential(sessionString);
};

/**
 * Decrypt an AES-256-GCM encrypted GramJS session string.
 */
export const decryptSession = (encryptedSession) => {
  if (!encryptedSession || typeof encryptedSession !== "string") {
    return "";
  }
  return decryptCredential(encryptedSession);
};

/**
 * Save or update user's authenticated Telegram connection in MongoDB.
 */
export const saveUserConnection = async (userId, {
  sessionString,
  telegramId,
  phoneNumber,
  firstName,
  lastName,
  username,
  photoUrl,
  is2FA = false,
}) => {
  if (!userId) throw new Error("userId is required to persist Telegram connection");

  const encryptedSession = encryptSession(sessionString);

  const connection = await TelegramConnection.findOneAndUpdate(
    { owner: userId },
    {
      owner: userId,
      encryptedSession,
      telegramId: telegramId ? String(telegramId) : "",
      phoneNumber: phoneNumber || "",
      firstName: firstName || "",
      lastName: lastName || "",
      username: username || "",
      photoUrl: photoUrl || "",
      status: "connected",
      is2FA: Boolean(is2FA),
      lastActiveAt: new Date(),
      lastError: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return connection;
};

/**
 * Retrieve user's Telegram connection from MongoDB.
 */
export const getUserConnection = async (userId) => {
  if (!userId) return null;
  return await TelegramConnection.findOne({ owner: userId });
};

/**
 * Mark user's connection as disconnected and remove encrypted session for security.
 */
export const removeUserConnection = async (userId) => {
  if (!userId) return null;
  return await TelegramConnection.findOneAndDelete({ owner: userId });
};

/**
 * Update connection error or status
 */
export const updateConnectionStatus = async (userId, status, lastError = null) => {
  if (!userId) return null;
  return await TelegramConnection.findOneAndUpdate(
    { owner: userId },
    { status, lastError, lastActiveAt: new Date() },
    { new: true }
  );
};
