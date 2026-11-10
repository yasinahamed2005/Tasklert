import nodemailer from "nodemailer";
import { getFreshGmailAccessToken } from "./emailAuth.service.js";

/**
 * Decode base64url string to utf-8 text
 */
const decodeBase64Url = (str) => {
  if (!str) return "";
  try {
    return Buffer.from(str, "base64url").toString("utf8");
  } catch {
    return "";
  }
};

/**
 * Parse standard email header string: "Sender Name <email@domain.com>"
 */
export const parseEmailAddress = (raw = "") => {
  if (!raw) return { name: "", email: "" };
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    let name = match[1].replace(/^["']|["']$/g, "").trim();
    return { name: name || match[2], email: match[2].trim() };
  }
  return { name: trimmed.split("@")[0], email: trimmed };
};

/**
 * Recursively parse MIME parts to extract HTML body, plain text, and attachments
 */
const extractMimeContent = (part, result = { html: "", text: "", attachments: [] }) => {
  if (!part) return result;

  const mimeType = (part.mimeType || "").toLowerCase();
  const filename = part.filename || "";

  // Check if attachment
  if (filename && filename.trim() !== "") {
    result.attachments.push({
      attachmentId: part.body?.attachmentId || "",
      filename: filename.trim(),
      mimeType: part.mimeType || "application/octet-stream",
      size: part.body?.size || 0,
    });
  }

  // Check body data
  if (part.body && part.body.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (mimeType === "text/html" && !result.html) {
      result.html = decoded;
    } else if (mimeType === "text/plain" && !result.text) {
      result.text = decoded;
    }
  }

  // Check nested parts
  if (Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      extractMimeContent(subPart, result);
    }
  }

  return result;
};

/**
 * Fetch Gmail user profile (total messages, email address, historyId)
 */
export const fetchGmailProfile = async (account) => {
  const token = await getFreshGmailAccessToken(account);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API profile error (${res.status})`);
  }

  return await res.json();
};

/**
 * Fetch Gmail Labels and actual unread & total counts
 */
export const fetchGmailLabels = async (account) => {
  const token = await getFreshGmailAccessToken(account);
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch Gmail labels (${res.status})`);
  }

  const data = await res.json();
  const rawLabels = data.labels || [];

  // Fetch detailed count for major folders in parallel
  const targetLabelIds = [
    "INBOX",
    "STARRED",
    "SENT",
    "DRAFT",
    "IMPORTANT",
    "TRASH",
    "SPAM",
    "CATEGORY_PROMOTIONS",
    "CATEGORY_UPDATES",
    "CATEGORY_SOCIAL",
  ];

  const detailPromises = rawLabels
    .filter((l) => targetLabelIds.includes(l.id) || l.type === "user")
    .map(async (l) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(l.id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (detailRes.ok) return await detailRes.json();
      } catch (_) {}
      return l;
    });

  const detailedLabels = await detailPromises.length > 0 ? await Promise.all(detailPromises) : rawLabels;

  const unreadCounts = {};
  const totalCounts = {};
  const categoryCounts = {
    promotions: 0,
    updates: 0,
    social: 0,
  };

  const userLabels = [];

  for (const l of detailedLabels) {
    if (!l) continue;
    unreadCounts[l.id] = l.messagesUnread || 0;
    totalCounts[l.id] = l.messagesTotal || 0;

    if (l.id === "CATEGORY_PROMOTIONS") {
      categoryCounts.promotions = l.messagesUnread || 0;
    } else if (l.id === "CATEGORY_UPDATES") {
      categoryCounts.updates = l.messagesUnread || 0;
    } else if (l.id === "CATEGORY_SOCIAL") {
      categoryCounts.social = l.messagesUnread || 0;
    } else if (l.type === "user") {
      userLabels.push({
        id: l.id,
        name: l.name,
        unread: l.messagesUnread || 0,
        total: l.messagesTotal || 0,
      });
    }
  }

  return {
    labels: detailedLabels,
    unreadCounts: {
      INBOX: unreadCounts.INBOX || 0,
      DRAFTS: totalCounts.DRAFT || unreadCounts.DRAFT || 0,
      STARRED: totalCounts.STARRED || 0,
      SENT: totalCounts.SENT || 0,
      TRASH: totalCounts.TRASH || 0,
      SPAM: unreadCounts.SPAM || 0,
      ...unreadCounts,
    },
    totalCounts,
    categoryCounts,
    userLabels,
  };
};

/**
 * Format timestamp into Gmail style: "12:27 AM" (today) or "Nov 2", "Oct 30"
 */
export const formatGmailDate = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
};

/**
 * Fetch Gmail message list and populate message headers from Gmail API
 */
export const fetchGmailMessages = async (account, options = {}) => {
  const {
    folder = "INBOX",
    category = "primary",
    search = "",
    filter = "all",
    pageToken = null,
    maxResults = 50,
  } = options;

  const token = await getFreshGmailAccessToken(account);

  // Build Gmail search query
  const queryParts = [];

  if (folder === "INBOX") {
    queryParts.push("in:inbox");
    // Handle Gmail category tabs:
    // In Gmail search API, categories are: promotions, social, updates, forums.
    // 'primary' is the standard inbox; 'category:primary' is NOT a valid search operator in Gmail API and causes 400 errors.
    if (category === "promotions") {
      queryParts.push("category:promotions");
    } else if (category === "social") {
      queryParts.push("category:social");
    } else if (category === "updates") {
      queryParts.push("category:updates");
    }
  } else if (folder === "STARRED") {
    queryParts.push("is:starred");
  } else if (folder === "SENT") {
    queryParts.push("in:sent");
  } else if (folder === "DRAFTS") {
    queryParts.push("in:draft");
  } else if (folder === "TRASH") {
    queryParts.push("in:trash");
  } else if (folder === "SPAM") {
    queryParts.push("in:spam");
  } else if (folder === "IMPORTANT") {
    queryParts.push("is:important");
  } else if (folder && folder !== "ALL") {
    queryParts.push(`label:${folder}`);
  }

  // Secondary filters
  if (filter === "unread") {
    queryParts.push("is:unread");
  } else if (filter === "starred") {
    queryParts.push("is:starred");
  } else if (filter === "has_attachment" || filter === "attachments") {
    queryParts.push("has:attachment");
  }

  // User search query
  if (search && search.trim()) {
    queryParts.push(search.trim());
  }

  const q = queryParts.join(" ").trim();

  const urlParams = new URLSearchParams({
    maxResults: String(maxResults),
    includeSpamTrash: folder === "TRASH" || folder === "SPAM" ? "true" : "false",
  });
  if (q) urlParams.set("q", q);
  if (pageToken) urlParams.set("pageToken", pageToken);

  let listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${urlParams.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // Fallback: If query fails (e.g. invalid query syntax), retry with simple folder query
  if (!listRes.ok && q) {
    console.warn(`[Gmail API] Search query "${q}" returned status ${listRes.status}. Retrying with folder fallback...`);
    const fallbackParams = new URLSearchParams({
      maxResults: String(maxResults),
      includeSpamTrash: folder === "TRASH" || folder === "SPAM" ? "true" : "false",
    });
    if (folder === "INBOX") fallbackParams.set("q", "in:inbox");
    else if (folder === "SENT") fallbackParams.set("q", "in:sent");
    else if (folder === "DRAFTS") fallbackParams.set("q", "in:draft");
    else if (folder === "STARRED") fallbackParams.set("q", "is:starred");
    if (pageToken) fallbackParams.set("pageToken", pageToken);

    listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${fallbackParams.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch messages from Gmail (${listRes.status})`);
  }

  const listData = await listRes.json();
  const messageItems = listData.messages || [];
  const nextPageToken = listData.nextPageToken || null;
  const resultSizeEstimate = listData.resultSizeEstimate || messageItems.length;

  if (messageItems.length === 0) {
    return {
      messages: [],
      nextPageToken: null,
      resultSizeEstimate: 0,
      totalCount: 0,
    };
  }

  // Fetch headers for messages in parallel batches of 15
  const fetchBatch = async (batch) => {
    return Promise.all(
      batch.map(async (item) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!detailRes.ok) return null;
          return await detailRes.json();
        } catch {
          return null;
        }
      })
    );
  };

  const batches = [];
  const BATCH_SIZE = 15;
  for (let i = 0; i < messageItems.length; i += BATCH_SIZE) {
    batches.push(messageItems.slice(i, i + BATCH_SIZE));
  }

  const rawDetails = [];
  for (const b of batches) {
    const res = await fetchBatch(b);
    rawDetails.push(...res);
  }

  // Map to clean email objects
  const messages = rawDetails
    .filter(Boolean)
    .map((msg) => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name) =>
        headers.find((h) => h?.name && h.name.toLowerCase() === name.toLowerCase())?.value || "";

      const rawFrom = getHeader("From");
      const { name: fromName, email: fromEmail } = parseEmailAddress(rawFrom);
      const rawDate = getHeader("Date");
      const timestamp = msg.internalDate ? Number(msg.internalDate) : new Date(rawDate).getTime();
      const safeTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
      const labelIds = msg.labelIds || [];

      // Detect attachment presence from snippet or headers
      const hasAttachment =
        labelIds.includes("ATTACHMENT") ||
        (msg.payload?.mimeType && msg.payload.mimeType.startsWith("multipart/mixed"));

      return {
        _id: msg.id,
        id: msg.id,
        threadId: msg.threadId,
        from: rawFrom,
        fromName: fromName || fromEmail || "Unknown Sender",
        fromEmail,
        to: getHeader("To"),
        subject: getHeader("Subject") || "(no subject)",
        snippet: msg.snippet || "",
        date: new Date(safeTimestamp).toISOString(),
        displayDate: formatGmailDate(safeTimestamp),
        timestamp: safeTimestamp,
        isRead: !labelIds.includes("UNREAD"),
        isStarred: labelIds.includes("STARRED"),
        isImportant: labelIds.includes("IMPORTANT"),
        hasAttachment,
        labelIds,
      };
    });

  return {
    messages,
    nextPageToken,
    resultSizeEstimate,
    totalCount: resultSizeEstimate,
  };
};

/**
 * Fetch full Gmail message detail (HTML body, plain text, and attachments)
 */
export const fetchGmailMessageDetail = async (account, messageId) => {
  const token = await getFreshGmailAccessToken(account);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch message details (${res.status})`);
  }

  const msg = await res.json();
  const headers = msg.payload?.headers || [];
  const getHeader = (name) =>
    headers.find((h) => h?.name && h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const rawFrom = getHeader("From");
  const { name: fromName, email: fromEmail } = parseEmailAddress(rawFrom);
  const rawDate = getHeader("Date");
  const timestamp = msg.internalDate ? Number(msg.internalDate) : new Date(rawDate).getTime();
  const safeTimestamp = isNaN(timestamp) ? Date.now() : timestamp;
  const labelIds = msg.labelIds || [];

  const { html, text, attachments } = extractMimeContent(msg.payload);

  return {
    _id: msg.id,
    id: msg.id,
    threadId: msg.threadId,
    from: rawFrom,
    fromName: fromName || fromEmail || "Unknown Sender",
    fromEmail,
    to: getHeader("To"),
    cc: getHeader("Cc"),
    bcc: getHeader("Bcc"),
    subject: getHeader("Subject") || "(no subject)",
    snippet: msg.snippet || "",
    body: text || "",
    htmlBody: html || (text ? `<pre style="font-family: inherit; white-space: pre-wrap;">${text}</pre>` : ""),
    date: new Date(safeTimestamp).toISOString(),
    displayDate: formatGmailDate(safeTimestamp),
    timestamp: safeTimestamp,
    isRead: !labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    isImportant: labelIds.includes("IMPORTANT"),
    hasAttachment: attachments.length > 0,
    attachments,
    labelIds,
  };
};

/**
 * Modify Gmail Message Labels (mark read/unread, star/unstar, archive)
 */
export const modifyGmailMessage = async (account, messageId, { addLabelIds = [], removeLabelIds = [] }) => {
  const token = await getFreshGmailAccessToken(account);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ addLabelIds, removeLabelIds }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to modify message labels (${res.status})`);
  }

  return await res.json();
};

/**
 * Move message to Trash in Gmail
 */
export const trashGmailMessage = async (account, messageId) => {
  const token = await getFreshGmailAccessToken(account);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to move message to trash (${res.status})`);
  }

  return await res.json();
};

/**
 * Send an email via genuine Gmail REST API (https://gmail.googleapis.com/gmail/v1/users/me/messages/send)
 * Compiles full RFC 2822 MIME message with HTML, text, attachments, CC, BCC, and Reply-To headers.
 */
export const sendGmailMessage = async (
  account,
  { from, to, cc, bcc, replyTo, subject, html, text, attachments = [] }
) => {
  if (!account) {
    throw new Error("A connected Gmail account is required to send via Gmail API.");
  }

  const token = await getFreshGmailAccessToken(account);

  const formattedAttachments = (attachments || [])
    .map((att) => ({
      filename: att.originalname || att.name || att.filename || "attachment",
      content: att.buffer || att.content,
      path: att.path,
      contentType: att.mimetype || att.mimeType || att.contentType,
    }))
    .filter((a) => a.content || a.path);

  const toList = (Array.isArray(to) ? to : [to]).map((e) => String(e).trim()).filter(Boolean);
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).map((e) => String(e).trim()).filter(Boolean);
  const bccList = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : []).map((e) => String(e).trim()).filter(Boolean);

  if (toList.length === 0) {
    throw new Error("At least one recipient email address is required.");
  }

  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const mailOptions = {
    from: from || account.email,
    to: toList.join(", "),
    cc: ccList.length ? ccList.join(", ") : undefined,
    bcc: bccList.length ? bccList.join(", ") : undefined,
    replyTo: replyTo || undefined,
    subject: subject || "",
    html: html || undefined,
    text: text || (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""),
    attachments: formattedAttachments.length ? formattedAttachments : undefined,
  };

  const info = await transporter.sendMail(mailOptions);
  const rawBase64 = info.message.toString("base64url");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawBase64 }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errorMsg = errData.error?.message || `Gmail API send error (${res.status})`;
    throw new Error(`Gmail API submission failed: ${errorMsg}`);
  }

  const result = await res.json();
  return {
    success: true,
    messageId: result.id,
    threadId: result.threadId,
    labelIds: result.labelIds,
    rawResult: result,
  };
};
