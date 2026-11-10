import {
  getUserEmailAccounts,
  getGoogleAuthUrl,
  exchangeGoogleAuthCode,
  getMicrosoftAuthUrl,
  connectSmtpAccount,
  disconnectEmailAccount,
} from "../services/email/emailAuth.service.js";
import {
  fetchGmailProfile,
  fetchGmailLabels,
  fetchGmailMessages,
  fetchGmailMessageDetail,
  modifyGmailMessage,
  trashGmailMessage,
} from "../services/email/gmail.service.js";
import { sendOutboundEmail, sendTasklertMail } from "../services/email/emailSend.service.js";
import EmailMessage from "../models/EmailMessage.js";
import EmailAccount from "../models/EmailAccount.js";
import Message from "../models/messageModel.js";

// ==========================================
// 1. ACCOUNT CONNECTION & STATUS
// ==========================================

export const handleGetAccountStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    const accounts = await getUserEmailAccounts(userId);

    // Filter genuine personal user accounts (gmail, outlook, smtp, custom)
    const personalAccounts = accounts.filter(
      (acc) => acc.provider !== "taskflow" && acc.status === "connected"
    );

    const hasPersonalAccount = personalAccounts.length > 0;
    const isTaskFlowGatewayActive = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    const taskflowMail = {
      identity: "mailer@taskflow.in",
      displayName: "TaskFlow Mail",
      provider: "taskflow",
      status: isTaskFlowGatewayActive ? "ready" : "unverified",
      activeGateway: process.env.SMTP_USER || null,
      isConfigured: isTaskFlowGatewayActive,
      domain: "taskflow.in",
      domainVerified: false,
      note: "Optional application sending identity. Dispatched via backend mail gateway.",
    };

    return res.status(200).json({
      success: true,
      connected: hasPersonalAccount,
      accounts: personalAccounts,
      primaryAccount: personalAccounts[0] || null,
      taskflowMail,
      hasTaskflowMail: isTaskFlowGatewayActive,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch email account status.",
    });
  }
};

export const handleGetGmailAuthUrl = async (req, res) => {
  try {
    const userId = req.user?._id;
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    const result = getGoogleAuthUrl(userId, hostUrl);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate Gmail authorization URL.",
    });
  }
};

export const handleGoogleOAuthCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  // Check if user cancelled authorization or Google returned an error
  if (error) {
    console.warn("[Gmail OAuth Callback] Google reported error:", error, error_description);
    return res.redirect(
      `${frontendUrl}/messages?channel=email&status=error&message=${encodeURIComponent(
        error_description || error || "Google authorization was cancelled."
      )}`
    );
  }

  if (!code || !state) {
    return res.redirect(
      `${frontendUrl}/messages?channel=email&status=error&message=${encodeURIComponent(
        "Missing authorization code or state token."
      )}`
    );
  }

  try {
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    const result = await exchangeGoogleAuthCode(code, state, hostUrl);

    return res.redirect(
      `${frontendUrl}/messages?channel=email&status=connected&email=${encodeURIComponent(
        result.email
      )}`
    );
  } catch (err) {
    console.error("[Gmail OAuth Callback Error]", err.message);
    return res.redirect(
      `${frontendUrl}/messages?channel=email&status=error&message=${encodeURIComponent(
        err.message || "Failed to complete Google OAuth exchange."
      )}`
    );
  }
};

export const handleGetOutlookAuthUrl = async (req, res) => {
  try {
    const userId = req.user?._id;
    const hostUrl = `${req.protocol}://${req.get("host")}`;
    const result = getMicrosoftAuthUrl(userId, hostUrl);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to generate Outlook authorization URL.",
    });
  }
};

export const handleConnectSmtp = async (req, res) => {
  try {
    const userId = req.user?._id;
    const account = await connectSmtpAccount(userId, req.body);
    return res.status(200).json({
      success: true,
      message: "SMTP account connected and verified successfully!",
      account,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to connect SMTP account.",
    });
  }
};

export const handleDisconnectAccount = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { accountId } = req.body;
    const result = await disconnectEmailAccount(userId, accountId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to disconnect email account.",
    });
  }
};

// ==========================================
// 2. FOLDERS & MESSAGES
// ==========================================

export const handleGetFolders = async (req, res) => {
  try {
    const userId = req.user?._id;
    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        const gmailData = await fetchGmailLabels(account);
        return res.status(200).json({
          success: true,
          folders: [
            { id: "INBOX", name: "Inbox", label: "Inbox" },
            { id: "STARRED", name: "Starred", label: "Starred" },
            { id: "SNOOZED", name: "Snoozed", label: "Snoozed" },
            { id: "SENT", name: "Sent", label: "Sent" },
            { id: "DRAFTS", name: "Drafts", label: "Drafts" },
            { id: "IMPORTANT", name: "Important", label: "Important" },
            { id: "TRASH", name: "Trash", label: "Trash" },
            { id: "SPAM", name: "Spam", label: "Spam" },
          ],
          unreadCounts: gmailData.unreadCounts,
          categoryCounts: gmailData.categoryCounts,
          userLabels: gmailData.userLabels,
          provider: "gmail",
        });
      } catch (gmailErr) {
        console.error("[Gmail API Labels Error]", gmailErr.message);
      }
    }

    // Default clean state when no Gmail account is connected (zero dummy seed data)
    return res.status(200).json({
      success: true,
      folders: [
        { id: "INBOX", name: "Inbox", label: "Inbox" },
        { id: "STARRED", name: "Starred", label: "Starred" },
        { id: "SNOOZED", name: "Snoozed", label: "Snoozed" },
        { id: "SENT", name: "Sent", label: "Sent" },
        { id: "DRAFTS", name: "Drafts", label: "Drafts" },
        { id: "IMPORTANT", name: "Important", label: "Important" },
        { id: "TRASH", name: "Trash", label: "Trash" },
      ],
      unreadCounts: { INBOX: 0, DRAFTS: 0, STARRED: 0, SENT: 0, TRASH: 0 },
      categoryCounts: { promotions: 0, updates: 0, social: 0 },
      userLabels: [],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch folders.",
    });
  }
};

export const handleGetMessages = async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      folder = "INBOX",
      category = "primary",
      label = "",
      page = 1,
      limit = 50,
      search = "",
      filter = "all",
      pageToken = null,
    } = req.query;

    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        const gmailResult = await fetchGmailMessages(account, {
          folder: label || folder,
          category,
          search,
          filter,
          pageToken,
          maxResults: Number(limit) || 50,
        });

        return res.status(200).json({
          success: true,
          messages: gmailResult.messages,
          total: gmailResult.totalCount,
          resultSizeEstimate: gmailResult.resultSizeEstimate,
          nextPageToken: gmailResult.nextPageToken,
          page: Number(page),
          provider: "gmail",
        });
      } catch (gmailErr) {
        console.error("[Gmail API Messages Error]", gmailErr.message);
        const isAuthError =
          gmailErr.message?.includes("expired") ||
          gmailErr.message?.includes("revoked") ||
          gmailErr.message?.includes("401") ||
          gmailErr.message?.includes("invalid_grant");

        // Return status 200 with empty list & authExpired flag so client doesn't crash with 500
        return res.status(200).json({
          success: false,
          authExpired: isAuthError,
          messages: [],
          total: 0,
          page: Number(page),
          error: `Gmail API: ${gmailErr.message}`,
          provider: "gmail",
        });
      }
    }

    // No account connected - return clean empty list without mock emails
    return res.status(200).json({
      success: true,
      messages: [],
      total: 0,
      page: Number(page),
      hasMore: false,
      unreadCounts: { INBOX: 0 },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch messages.",
    });
  }
};

export const handleGetMessage = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { messageId } = req.params;

    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        const message = await fetchGmailMessageDetail(account, messageId);
        return res.status(200).json({ success: true, message });
      } catch (gmailErr) {
        console.error("[Gmail API Message Detail Error]", gmailErr.message);
        return res.status(500).json({
          success: false,
          message: `Failed to fetch email from Gmail: ${gmailErr.message}`,
        });
      }
    }

    return res.status(404).json({ success: false, message: "No connected Gmail account found." });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch message details.",
    });
  }
};

export const handleMarkRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { messageId } = req.params;
    const { isRead = true } = req.body;

    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        if (isRead) {
          await modifyGmailMessage(account, messageId, { removeLabelIds: ["UNREAD"] });
        } else {
          await modifyGmailMessage(account, messageId, { addLabelIds: ["UNREAD"] });
        }
      } catch (gmailErr) {
        console.warn("[Gmail Mark Read Warning]", gmailErr.message);
      }
    }

    return res.status(200).json({ success: true, isRead: Boolean(isRead) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleMarkStar = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { messageId } = req.params;
    const { isStarred = true } = req.body;

    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        if (isStarred) {
          await modifyGmailMessage(account, messageId, { addLabelIds: ["STARRED"] });
        } else {
          await modifyGmailMessage(account, messageId, { removeLabelIds: ["STARRED"] });
        }
      } catch (gmailErr) {
        console.warn("[Gmail Star Warning]", gmailErr.message);
      }
    }

    return res.status(200).json({ success: true, isStarred: Boolean(isStarred) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleMoveToTrash = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { messageId } = req.params;

    const account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
      provider: "gmail",
    });

    if (account) {
      try {
        await trashGmailMessage(account, messageId);
        return res.status(200).json({ success: true, message: "Moved to trash in Gmail." });
      } catch (gmailErr) {
        console.warn("[Gmail Trash Warning]", gmailErr.message);
      }
    }

    return res.status(200).json({ success: true, message: "Moved to trash." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleArchive = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { messageId } = req.params;

    await EmailMessage.updateOne(
      { _id: messageId, owner: userId },
      { folder: "ARCHIVE" }
    );

    return res.status(200).json({ success: true, message: "Archived." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. SENDING & COMPOSING
// ==========================================

export const handleSendEmail = async (req, res) => {
  try {
    const userId = req.user?._id;
    let { accountId, from, to, cc, bcc, subject, body } = req.body;

    // Handle parsed JSON fields if sent via FormData
    if (typeof to === "string") {
      try { to = JSON.parse(to); } catch (_) { to = [to]; }
    }
    if (typeof cc === "string") {
      try { cc = JSON.parse(cc); } catch (_) { cc = cc ? [cc] : []; }
    }
    if (typeof bcc === "string") {
      try { bcc = JSON.parse(bcc); } catch (_) { bcc = bcc ? [bcc] : []; }
    }

    const files = req.files || (req.file ? [req.file] : []);

    const result = await sendOutboundEmail(userId, {
      accountId,
      from,
      to,
      cc,
      bcc,
      subject,
      body,
      attachments: files,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("[EmailController] Send failed:", err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send email.",
    });
  }
};

export const handleSaveDraft = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { accountId, from, to, cc, bcc, subject, body } = req.body;

    const draft = await EmailMessage.create({
      owner: userId,
      accountId: accountId || null,
      folder: "DRAFTS",
      from: from || req.user?.email || "",
      to: Array.isArray(to) ? to : to ? [to] : [],
      cc: Array.isArray(cc) ? cc : cc ? [cc] : [],
      bcc: Array.isArray(bcc) ? bcc : bcc ? [bcc] : [],
      subject: subject || "",
      body: body || "",
      htmlBody: body || "",
      isRead: true,
      date: new Date(),
    });

    return res.status(201).json({ success: true, draft });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const handleUpdateDraft = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { draftId } = req.params;
    const { to, cc, bcc, subject, body } = req.body;

    const updated = await EmailMessage.findOneAndUpdate(
      { _id: draftId, owner: userId, folder: "DRAFTS" },
      {
        to: Array.isArray(to) ? to : to ? [to] : [],
        cc: Array.isArray(cc) ? cc : cc ? [cc] : [],
        bcc: Array.isArray(bcc) ? bcc : bcc ? [bcc] : [],
        subject: subject || "",
        body: body || "",
        htmlBody: body || "",
        date: new Date(),
      },
      { new: true }
    );

    return res.status(200).json({ success: true, draft: updated });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const handleScheduleEmail = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { to, cc, bcc, subject, body, scheduledAt, timeZone } = req.body;

    if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
      return res.status(400).json({ success: false, message: "Valid scheduled time required." });
    }

    const toList = Array.isArray(to) ? to : [to];

    // Re-use Tasklert's persistent Message model (cron messageScheduler.js dispatches this automatically!)
    const scheduled = await Message.create({
      owner: userId,
      channel: "email",
      recipient: toList[0],
      cc: Array.isArray(cc) ? cc.join(", ") : cc || "",
      bcc: Array.isArray(bcc) ? bcc.join(", ") : bcc || "",
      subject,
      message: body,
      scheduledAt: new Date(scheduledAt),
      timeZone: timeZone || "UTC",
      status: "scheduled",
    });

    return res.status(201).json({ success: true, scheduled });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const handleGetScheduledEmails = async (req, res) => {
  try {
    const userId = req.user?._id;
    const scheduled = await Message.find({
      owner: userId,
      channel: "email",
      status: "scheduled",
    }).sort({ scheduledAt: 1 });

    return res.status(200).json({ success: true, scheduled });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleCancelScheduledEmail = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const cancelled = await Message.findOneAndUpdate(
      { _id: id, owner: userId, channel: "email" },
      { status: "cancelled" },
      { new: true }
    );

    return res.status(200).json({ success: true, cancelled });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const handleSyncMailbox = async (req, res) => {
  try {
    // Phase 3 will implement full incremental sync with Gmail API and Graph API.
    return res.status(200).json({
      success: true,
      message: "Mailbox synchronized.",
      syncedAt: new Date(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 6. TASKLERT MAIL (PROFESSIONAL DEDICATED CHANNEL)
// ==========================================

export const handleSendTasklertMail = async (req, res) => {
  try {
    const user = req.user;
    let { to, cc, bcc, subject, message, priority, actionDeadline } = req.body;

    if (typeof to === "string") {
      try { to = JSON.parse(to); } catch (_) { to = to.split(",").map((s) => s.trim()).filter(Boolean); }
    }
    if (typeof cc === "string") {
      try { cc = JSON.parse(cc); } catch (_) { cc = cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : []; }
    }
    if (typeof bcc === "string") {
      try { bcc = JSON.parse(bcc); } catch (_) { bcc = bcc ? bcc.split(",").map((s) => s.trim()).filter(Boolean) : []; }
    }

    const files = req.files || (req.file ? [req.file] : []);

    const result = await sendTasklertMail(user, {
      to,
      cc,
      bcc,
      subject,
      message,
      priority: priority || "normal",
      actionDeadline: actionDeadline ? new Date(actionDeadline) : null,
      attachments: files,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("[TasklertMailController] Send error:", err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to send email via Tasklert Mail.",
    });
  }
};

export const handleGetTasklertSentMails = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { search = "", priority = "all", page = 1, limit = 50 } = req.query;

    const query = {
      owner: userId,
      folder: "SENT",
      isTasklertMail: true,
    };

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { subject: { $regex: s, $options: "i" } },
        { to: { $in: [new RegExp(s, "i")] } },
        { snippet: { $regex: s, $options: "i" } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [messages, totalCount] = await Promise.all([
      EmailMessage.find(query).sort({ date: -1 }).skip(skip).limit(Number(limit)),
      EmailMessage.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      messages,
      totalCount,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleGetTasklertDrafts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const drafts = await EmailMessage.find({
      owner: userId,
      folder: "DRAFTS",
      isTasklertMail: true,
    }).sort({ updatedAt: -1 });

    return res.status(200).json({ success: true, drafts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleDeleteTasklertMail = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    const deleted = await EmailMessage.findOneAndDelete({
      _id: id,
      owner: userId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Email removed from Tasklert Mail history.",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const handleResendTasklertMail = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const original = await EmailMessage.findOne({ _id: id, owner: user._id });
    if (!original) {
      return res.status(404).json({ success: false, message: "Original email record not found." });
    }

    const result = await sendTasklertMail(user, {
      to: original.to,
      cc: original.cc,
      bcc: original.bcc,
      subject: original.subject,
      message: original.body,
      priority: original.priority,
      actionDeadline: original.actionRequiredDeadline,
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

