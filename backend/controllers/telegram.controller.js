import {
  sendTelegramAuthCode,
  verifyTelegramAuthCode,
  verifyTelegramPassword,
  cancelTelegramAuth,
  getTelegramAuthStatus,
  getTelegramUserProfile,
  disconnectTelegramUser,
} from "../services/telegram/telegramAuth.service.js";
import { getTelegramConfig } from "../services/telegram/telegramConfig.js";
import { getTelegramContacts } from "../services/telegram/telegramContacts.service.js";
import { getTelegramChats } from "../services/telegram/telegramChats.service.js";
import {
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
  markChatAsRead,
  sendPollMessage,
  sendLocationMessage,
  sendVoiceMessage,
} from "../services/telegram/telegramMessages.service.js";
import { downloadMessageMedia, downloadProfileAvatar } from "../services/telegram/telegramMedia.service.js";
import { handleTelegramSSE, broadcastUserEvent } from "../services/telegram/telegramUpdates.service.js";
import {
  createScheduledMessage,
  getUserScheduledMessages,
  updateScheduledMessage,
  cancelScheduledMessage,
} from "../services/telegram/telegramScheduler.service.js";

// ==========================================
// 1. AUTHENTICATION & PROFILE
// ==========================================

export const handleSendCode = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number with country code.",
      });
    }

    const result = await sendTelegramAuthCode(userId, phoneNumber);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send verification code.",
    });
  }
};

export const handleVerifyCode = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required.",
      });
    }

    const result = await verifyTelegramAuthCode(userId, code);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to verify code.",
    });
  }
};

export const handleVerifyPassword = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required for two-step verification.",
      });
    }

    const result = await verifyTelegramPassword(userId, password);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to verify 2FA password.",
    });
  }
};

export const handleCancelAuth = async (req, res) => {
  try {
    const userId = req.user?._id;
    const result = await cancelTelegramAuth(userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to cancel authentication.",
    });
  }
};

export const handleGetAuthStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    const config = getTelegramConfig();

    const status = await getTelegramAuthStatus(userId);
    return res.status(200).json({
      ...status,
      isConfiguredOnServer: config.isConfigured,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to check authentication status.",
    });
  }
};

export const handleGetProfile = async (req, res) => {
  try {
    const userId = req.user?._id;
    const profile = await getTelegramUserProfile(userId);
    return res.status(200).json({
      success: true,
      profile,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to retrieve Telegram profile.",
    });
  }
};

export const handleDisconnect = async (req, res) => {
  try {
    const userId = req.user?._id;
    const result = await disconnectTelegramUser(userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to disconnect Telegram account.",
    });
  }
};

// ==========================================
// 2. CONTACTS
// ==========================================

export const handleGetContacts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { search } = req.query;
    const contacts = await getTelegramContacts(userId, search);
    return res.status(200).json({
      success: true,
      contacts,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch Telegram contacts.",
    });
  }
};

// ==========================================
// 3. CHATS & DIALOGS
// ==========================================

export const handleGetChats = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { filter = "all", search = "", limit = 100 } = req.query;
    const chats = await getTelegramChats(userId, { filter, search, limit });
    return res.status(200).json({
      success: true,
      chats,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch Telegram chats.",
    });
  }
};

// ==========================================
// 4. MESSAGES
// ==========================================

export const handleGetChatMessages = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId } = req.params;
    const { limit = 50, offsetId = 0, accessHash, peerType } = req.query;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }

    const messages = await getChatMessages(userId, chatId, { limit, offsetId, accessHash, peerType });
    return res.status(200).json({
      success: true,
      chatId,
      messages,
    });
  } catch (err) {
    console.error(`[TelegramController] Failed to fetch chat messages for ${req.params.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch chat messages.",
    });
  }
};

export const handleSendMessage = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, message, replyTo, accessHash, peerType } = req.body;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }

    const result = await sendChatMessage(userId, chatId, { message, replyTo, accessHash, peerType });
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to send message to ${req.body?.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send message.",
    });
  }
};

export const handleSendMedia = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, message, replyTo, accessHash, peerType } = req.body;
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: "Attachment file is required." });
    }

    const result = await sendChatMessage(userId, chatId, {
      message: message || "",
      replyTo,
      file: file.path,
      accessHash,
      peerType,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to send media to ${req.body?.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send media.",
    });
  }
};

export const handleSendPoll = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, question, options, multipleChoice, quiz, publicVoters, accessHash, peerType } = req.body;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: "Poll question is required." });
    }

    const result = await sendPollMessage(userId, chatId, {
      question,
      options,
      multipleChoice,
      quiz,
      publicVoters,
      accessHash,
      peerType,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to create poll in ${req.body?.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to create poll.",
    });
  }
};

export const handleSendLocation = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, latitude, longitude, accuracyRadius, accessHash, peerType } = req.body;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: "Latitude and longitude are required." });
    }

    const result = await sendLocationMessage(userId, chatId, {
      latitude,
      longitude,
      accuracyRadius,
      accessHash,
      peerType,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to send location in ${req.body?.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send location.",
    });
  }
};

export const handleSendVoice = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, duration, accessHash, peerType } = req.body;
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: "Voice recording file is required." });
    }

    const result = await sendVoiceMessage(userId, chatId, {
      filePath: file.path,
      duration,
      accessHash,
      peerType,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to send voice message in ${req.body?.chatId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send voice message.",
    });
  }
};

export const handleDeleteMessage = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, messageId } = req.params;
    const { accessHash, peerType } = req.query;
    const revoke = req.query.revoke !== undefined
      ? req.query.revoke === "true" || req.query.revoke === true
      : req.body?.revoke !== undefined
        ? Boolean(req.body.revoke)
        : true;

    if (!chatId || !messageId) {
      return res.status(400).json({ success: false, message: "chatId and messageId are required." });
    }

    const result = await deleteChatMessage(userId, chatId, messageId, { accessHash, peerType, revoke });

    // Broadcast deletion event to all user connections
    broadcastUserEvent(userId, {
      type: "messages_deleted",
      chatId: String(chatId),
      messageIds: [Number(messageId)],
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to delete message ${req.params?.messageId}:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to delete message.",
    });
  }
};

export const handleMarkChatAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId } = req.params;
    const { maxId = 0, accessHash, peerType } = req.body || {};

    if (!chatId) {
      return res.status(400).json({ success: false, message: "chatId is required." });
    }

    const result = await markChatAsRead(userId, chatId, { maxId, accessHash, peerType });

    // Broadcast read update to all user connections
    broadcastUserEvent(userId, {
      type: "chat_read",
      chatId: String(chatId),
      maxId: Number(maxId) || 0,
      unreadCount: 0,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(`[TelegramController] Failed to mark chat ${req.params?.chatId} as read:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to mark chat as read.",
    });
  }
};

export const handleDownloadMedia = async (req, res) => {
  const userId = req.user?._id;
  const { chatId, messageId } = req.params;
  return downloadMessageMedia(userId, chatId, messageId, res);
};

export const handleDownloadAvatar = async (req, res) => {
  const userId = req.user?._id;
  const { chatId } = req.params;
  return downloadProfileAvatar(userId, chatId, res);
};

// ==========================================
// 5. SERVER-SENT EVENTS (SSE)
// ==========================================

export const handleEventsStream = async (req, res) => {
  return handleTelegramSSE(req, res);
};

// ==========================================
// 6. SCHEDULING
// ==========================================

export const handleGetScheduled = async (req, res) => {
  try {
    const userId = req.user?._id;
    const scheduled = await getUserScheduledMessages(userId);
    return res.status(200).json({
      success: true,
      scheduled,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch scheduled messages.",
    });
  }
};

export const handleCreateScheduled = async (req, res) => {
  try {
    const userId = req.user?._id;
    const scheduled = await createScheduledMessage(userId, req.body);
    return res.status(201).json({
      success: true,
      scheduled,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to schedule message.",
    });
  }
};

export const handleUpdateScheduled = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const updated = await updateScheduledMessage(userId, id, req.body);
    return res.status(200).json({
      success: true,
      scheduled: updated,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to update scheduled message.",
    });
  }
};

export const handleCancelScheduled = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const cancelled = await cancelScheduledMessage(userId, id);
    return res.status(200).json({
      success: true,
      scheduled: cancelled,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to cancel scheduled message.",
    });
  }
};
