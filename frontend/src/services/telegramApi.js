import axios from "axios";
import { API_BASE_URL } from "../config/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
};

// ==========================================
// AUTHENTICATION & PROFILE
// ==========================================

export const fetchTelegramAuthStatus = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/auth/status`,
    { ...getAuthHeaders(), timeout: 12000 }
  );
  return response.data;
};

export const sendTelegramCode = async (phoneNumber) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/auth/send-code`,
    { phoneNumber },
    getAuthHeaders()
  );
  return response.data;
};

export const verifyTelegramCode = async (code) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/auth/verify-code`,
    { code },
    getAuthHeaders()
  );
  return response.data;
};

export const verifyTelegramPassword = async (password) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/auth/verify-password`,
    { password },
    getAuthHeaders()
  );
  return response.data;
};

export const cancelTelegramAuth = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/auth/cancel`,
    {},
    getAuthHeaders()
  );
  return response.data;
};

export const disconnectTelegram = async () => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/auth/disconnect`,
    {},
    getAuthHeaders()
  );
  return response.data;
};

export const fetchTelegramProfile = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/profile`,
    getAuthHeaders()
  );
  return response.data;
};

// ==========================================
// CONTACTS & CHATS
// ==========================================

export const fetchTelegramContacts = async (search = "") => {
  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/contacts`,
    {
      ...getAuthHeaders(),
      params: { search },
    }
  );
  return response.data.contacts || [];
};

export const fetchTelegramChats = async (filter = "all", search = "", folder = null) => {
  const params = { filter, search };
  if (folder !== null && folder !== undefined) {
    params.folder = folder;
  }
  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/chats`,
    {
      ...getAuthHeaders(),
      params,
    }
  );
  return response.data.chats || [];
};

export const fetchTelegramMessages = async (chatId, options = {}) => {
  const { limit = 50, offsetId = 0, accessHash = null, peerType = null } =
    typeof options === "object" ? options : { limit: options };

  const params = { limit, offsetId };
  if (accessHash) params.accessHash = accessHash;
  if (peerType) params.peerType = peerType;

  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/chats/${encodeURIComponent(chatId)}/messages`,
    {
      ...getAuthHeaders(),
      params,
    }
  );
  return response.data.messages || [];
};

// ==========================================
// MESSAGING & MEDIA
// ==========================================

export const sendTelegramMessage = async (chatId, message, { replyTo = null, accessHash = null, peerType = null } = {}) => {
  const payload = { chatId, message };
  if (replyTo) payload.replyTo = replyTo;
  if (accessHash) payload.accessHash = accessHash;
  if (peerType) payload.peerType = peerType;

  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/messages`,
    payload,
    getAuthHeaders()
  );
  return response.data;
};

export const sendTelegramMedia = async (chatId, file, caption = "", { replyTo = null, accessHash = null, peerType = null } = {}) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("chatId", chatId);
  if (caption) formData.append("message", caption);
  if (replyTo) formData.append("replyTo", replyTo);
  if (accessHash) formData.append("accessHash", accessHash);
  if (peerType) formData.append("peerType", peerType);

  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/messages/upload`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  return response.data;
};

export const sendTelegramPoll = async (chatId, { question, options, multipleChoice = false, quiz = false, publicVoters = true, accessHash = null, peerType = null } = {}) => {
  const payload = {
    chatId,
    question,
    options,
    multipleChoice,
    quiz,
    publicVoters,
  };
  if (accessHash) payload.accessHash = accessHash;
  if (peerType) payload.peerType = peerType;

  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/messages/poll`,
    payload,
    getAuthHeaders()
  );
  return response.data;
};

export const sendTelegramLocation = async (chatId, { latitude, longitude, accuracyRadius = 0, accessHash = null, peerType = null } = {}) => {
  const payload = {
    chatId,
    latitude,
    longitude,
    accuracyRadius,
  };
  if (accessHash) payload.accessHash = accessHash;
  if (peerType) payload.peerType = peerType;

  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/messages/location`,
    payload,
    getAuthHeaders()
  );
  return response.data;
};

export const sendTelegramVoice = async (chatId, audioBlob, duration = 0, { accessHash = null, peerType = null } = {}) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("file", audioBlob, `voice-${Date.now()}.ogg`);
  formData.append("chatId", chatId);
  formData.append("duration", Math.round(duration || 0));
  if (accessHash) formData.append("accessHash", accessHash);
  if (peerType) formData.append("peerType", peerType);

  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/messages/voice`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  return response.data;
};

export const deleteTelegramMessage = async (chatId, messageId, { accessHash = null, peerType = null, revoke = true } = {}) => {
  const params = { revoke: Boolean(revoke) };
  if (accessHash) params.accessHash = accessHash;
  if (peerType) params.peerType = peerType;

  const response = await axios.delete(
    `${API_BASE_URL}/api/telegram/messages/${encodeURIComponent(chatId)}/${messageId}`,
    {
      ...getAuthHeaders(),
      params,
    }
  );
  return response.data;
};

export const markTelegramChatAsRead = async (chatId, { maxId = 0, accessHash = null, peerType = null } = {}) => {
  if (!chatId) return null;
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/chats/${encodeURIComponent(chatId)}/read`,
    { maxId, accessHash, peerType },
    getAuthHeaders()
  );
  return response.data;
};

export const getTelegramMediaUrl = (chatId, messageId) => {
  if (!chatId || !messageId) return "";
  const token = localStorage.getItem("token");
  return `${API_BASE_URL}/api/telegram/media/${encodeURIComponent(chatId)}/${messageId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
};

export const getTelegramAvatarUrl = (chatId) => {
  if (!chatId) return "";
  const token = localStorage.getItem("token");
  return `${API_BASE_URL}/api/telegram/avatar/${encodeURIComponent(chatId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
};

// ==========================================
// SCHEDULING
// ==========================================

export const fetchTelegramScheduledMessages = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/telegram/scheduled`,
    getAuthHeaders()
  );
  return response.data.scheduled || [];
};

export const scheduleTelegramMessage = async (scheduledData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/telegram/scheduled`,
    scheduledData,
    getAuthHeaders()
  );
  return response.data.scheduled;
};

export const updateTelegramScheduledMessage = async (id, updates) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/telegram/scheduled/${id}`,
    updates,
    getAuthHeaders()
  );
  return response.data.scheduled;
};

export const cancelTelegramScheduledMessage = async (id) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/telegram/scheduled/${id}`,
    getAuthHeaders()
  );
  return response.data.scheduled;
};

// ==========================================
// REAL-TIME SSE STREAM
// ==========================================

export const createTelegramEventSource = () => {
  const token = localStorage.getItem("token");
  const url = `${API_BASE_URL}/api/telegram/events?token=${encodeURIComponent(token || "")}`;
  return new EventSource(url);
};
