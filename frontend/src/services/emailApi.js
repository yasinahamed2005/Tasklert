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
// EMAIL ACCOUNT — CONNECTION & STATUS
// ==========================================

export const fetchEmailAccountStatus = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/account/status`,
    { ...getAuthHeaders(), timeout: 10000 }
  );
  return response.data;
};

export const disconnectEmailAccount = async (accountId) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/account/disconnect`,
    { accountId },
    getAuthHeaders()
  );
  return response.data;
};

export const getGmailAuthUrl = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/auth/gmail/url`,
    getAuthHeaders()
  );
  return response.data;
};

export const getOutlookAuthUrl = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/auth/outlook/url`,
    getAuthHeaders()
  );
  return response.data;
};

export const connectSmtpAccount = async (smtpConfig) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/auth/smtp/connect`,
    smtpConfig,
    getAuthHeaders()
  );
  return response.data;
};

// ==========================================
// MAILBOX — FOLDERS & MESSAGES
// ==========================================

export const fetchEmailFolders = async (accountId) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/folders`,
    { ...getAuthHeaders(), params: { accountId }, timeout: 12000 }
  );
  return response.data;
};

export const fetchEmailMessages = async ({
  accountId,
  folder = "INBOX",
  category = "primary",
  page = 1,
  limit = 50,
  search = "",
  filter = "all",
  pageToken = null,
} = {}) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/messages`,
    {
      ...getAuthHeaders(),
      params: { accountId, folder, category, page, limit, search, filter, pageToken },
      timeout: 25000,
    }
  );
  return response.data;
};

export const fetchEmailMessage = async (accountId, messageId) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}`,
    { ...getAuthHeaders(), params: { accountId }, timeout: 12000 }
  );
  return response.data;
};

export const markEmailRead = async (accountId, messageId, isRead = true) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}/read`,
    { accountId, isRead },
    getAuthHeaders()
  );
  return response.data;
};

export const starEmail = async (accountId, messageId, isStarred = true) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}/star`,
    { accountId, isStarred },
    getAuthHeaders()
  );
  return response.data;
};

export const moveEmailToTrash = async (accountId, messageId) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}/trash`,
    { accountId },
    getAuthHeaders()
  );
  return response.data;
};

export const archiveEmail = async (accountId, messageId) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}/archive`,
    { accountId },
    getAuthHeaders()
  );
  return response.data;
};

// ==========================================
// COMPOSE & SEND
// ==========================================

export const sendEmail = async (emailData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/send`,
    emailData,
    { ...getAuthHeaders(), timeout: 30000 }
  );
  return response.data;
};

export const saveDraft = async (draftData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/drafts`,
    draftData,
    getAuthHeaders()
  );
  return response.data;
};

export const updateDraft = async (draftId, draftData) => {
  const response = await axios.put(
    `${API_BASE_URL}/api/email/drafts/${draftId}`,
    draftData,
    getAuthHeaders()
  );
  return response.data;
};

export const scheduleEmail = async (emailData) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/schedule`,
    emailData,
    getAuthHeaders()
  );
  return response.data;
};

export const fetchScheduledEmails = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/scheduled`,
    getAuthHeaders()
  );
  return response.data;
};

export const cancelScheduledEmail = async (id) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/email/scheduled/${id}`,
    getAuthHeaders()
  );
  return response.data;
};

// ==========================================
// ATTACHMENTS
// ==========================================

export const getAttachmentUrl = (accountId, messageId, attachmentId) => {
  const token = localStorage.getItem("token");
  return `${API_BASE_URL}/api/email/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}?accountId=${encodeURIComponent(accountId)}&token=${encodeURIComponent(token || "")}`;
};

// ==========================================
// SYNC
// ==========================================

export const triggerEmailSync = async (accountId) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/sync`,
    { accountId },
    { ...getAuthHeaders(), timeout: 30000 }
  );
  return response.data;
};

// ==========================================
// TASKLERT MAIL (DEDICATED PROFESSIONAL SENDER)
// ==========================================

export const sendTasklertMail = async (formData) => {
  const token = localStorage.getItem("token");
  const response = await axios.post(
    `${API_BASE_URL}/api/email/tasklert-mail/send`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: 35000,
    }
  );
  return response.data;
};

export const fetchTasklertSentMails = async ({ search = "", priority = "all", page = 1, limit = 50 } = {}) => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/tasklert-mail/sent`,
    {
      ...getAuthHeaders(),
      params: { search, priority, page, limit },
      timeout: 15000,
    }
  );
  return response.data;
};

export const fetchTasklertDrafts = async () => {
  const response = await axios.get(
    `${API_BASE_URL}/api/email/tasklert-mail/drafts`,
    { ...getAuthHeaders(), timeout: 15000 }
  );
  return response.data;
};

export const deleteTasklertMail = async (id) => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/email/tasklert-mail/${encodeURIComponent(id)}`,
    getAuthHeaders()
  );
  return response.data;
};

export const resendTasklertMail = async (id) => {
  const response = await axios.post(
    `${API_BASE_URL}/api/email/tasklert-mail/${encodeURIComponent(id)}/resend`,
    {},
    getAuthHeaders()
  );
  return response.data;
};

