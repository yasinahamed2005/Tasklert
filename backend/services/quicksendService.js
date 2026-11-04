import validator from "validator";
import mongoose from "mongoose";
import { sendEmail, isEmailConfigured, isSmtpConfigured, escapeHtml } from "../utils/mailer.js";
import { sendSms } from "../utils/sms.js";
import { decryptCredential } from "../utils/crypto.js";
import MessagingAccount from "../models/messagingAccountModel.js";

/**
 * Validates whether a Twilio Account SID is genuine (34 chars, starts with AC)
 */
export const isValidTwilioAccountSid = (sid) => {
  if (!sid || typeof sid !== "string") return false;
  const clean = sid.trim();
  return clean.startsWith("AC") && clean.length === 34 && !clean.toLowerCase().includes("your_");
};

/**
 * Validates whether a Twilio Auth Token is genuine (min 32 chars, not placeholder)
 */
export const isValidTwilioAuthToken = (token) => {
  if (!token || typeof token !== "string") return false;
  const clean = token.trim();
  return clean.length >= 32 && !clean.toLowerCase().includes("your_");
};

/**
 * Returns honest system-wide readiness status of each messaging provider
 * without exposing secret keys.
 */
export const getProviderStatus = () => {
  const emailConfigured = isEmailConfigured();
  let emailProvider = "none";
  if (process.env.BREVO_API_KEY) {
    emailProvider = "brevo";
  } else if (process.env.RESEND_API_KEY) {
    emailProvider = "resend";
  } else if (isSmtpConfigured()) {
    emailProvider = "smtp";
  }

  const telegramToken = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const telegramConfigured = Boolean(
    telegramToken &&
      !telegramToken.toLowerCase().includes("your_") &&
      telegramToken.length > 10
  );
  const telegramBotUsername = (process.env.TELEGRAM_BOT_USERNAME || "").replace(
    /^@/,
    ""
  );

  const waAccessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const hasMetaWa = Boolean(
    waAccessToken &&
      waPhoneId &&
      !waAccessToken.toLowerCase().includes("your_") &&
      !waPhoneId.toLowerCase().includes("your_")
  );

  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioWaNumber = (
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    ""
  ).trim();
  const hasTwilioWa = Boolean(
    isValidTwilioAccountSid(twilioSid) &&
      isValidTwilioAuthToken(twilioToken) &&
      twilioWaNumber &&
      !twilioWaNumber.includes("xxxx")
  );

  let whatsappProvider = "none";
  let whatsappConfigured = false;
  if (hasMetaWa) {
    whatsappProvider = "cloud_api";
    whatsappConfigured = true;
  } else if (hasTwilioWa) {
    whatsappProvider = "twilio";
    whatsappConfigured = true;
  }

  const smsPhone = (process.env.TWILIO_PHONE_NUMBER || "").trim();
  const smsConfigured = Boolean(
    isValidTwilioAccountSid(twilioSid) &&
      isValidTwilioAuthToken(twilioToken) &&
      smsPhone &&
      !smsPhone.includes("xxxx")
  );

  const emailSender = (
    process.env.RESEND_FROM ||
    process.env.BREVO_FROM ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "noreply@tasklert.com"
  ).trim();
  const waSender =
    process.env.WHATSAPP_DISPLAY_PHONE_NUMBER ||
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    null;

  return {
    email: {
      configured: emailConfigured,
      provider: emailProvider,
      sender: emailSender,
      accountIdentifier: emailSender,
      label: emailConfigured
        ? `Ready (${emailProvider.toUpperCase()})`
        : "Not configured (Setup SMTP / Resend / Brevo)",
    },
    telegram: {
      configured: telegramConfigured,
      botUsername: telegramBotUsername || null,
      accountIdentifier: telegramBotUsername ? `@${telegramBotUsername}` : null,
      label: telegramConfigured
        ? telegramBotUsername
          ? `Ready (@${telegramBotUsername})`
          : "Ready (Bot Token Active)"
        : "Setup required (TELEGRAM_BOT_TOKEN)",
    },
    whatsapp: {
      configured: whatsappConfigured,
      provider: whatsappProvider,
      senderNumber: waSender,
      accountIdentifier: waSender,
      label: whatsappConfigured
        ? `Ready (${whatsappProvider === "cloud_api" ? "Meta Cloud API" : "Twilio WhatsApp"})`
        : "Setup required (Cloud API or Twilio)",
    },
    sms: {
      configured: smsConfigured,
      label: smsConfigured ? "Ready (Twilio)" : "Setup required (Twilio)",
    },
  };
};

/**
 * Returns user-specific provider status by merging connected accounts from MongoDB
 * with strict user isolation and clear unconfigured states.
 */
export const getUserProviderStatus = async (userId) => {
  const systemStatus = getProviderStatus();
  if (!userId) return systemStatus;

  const defaultUnconnectedWa = {
    configured: false,
    status: "unconnected",
    provider: null,
    isPersonalDirect: false,
    isUserAccount: false,
    senderNumber: null,
    accountIdentifier: null,
    accountName: null,
    label: "First-time setup required",
    lastVerifiedAt: null,
    lastError: null,
  };

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { ...systemStatus, whatsapp: defaultUnconnectedWa };
  }

  // If database is not currently connected (e.g. running unit tests), return unconfigured user status safely
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return { ...systemStatus, whatsapp: defaultUnconnectedWa };
  }

  try {
    const userAccounts = await MessagingAccount.find({
      owner: userId,
    }).lean();

    const merged = { ...systemStatus, whatsapp: defaultUnconnectedWa };

    // WhatsApp: User account takes absolute precedence. If no user account is configured,
    // require first-time connection onboarding rather than falling back to shared system tokens.
    const userWa = userAccounts.find((a) => a.channel === "whatsapp");
    if (userWa) {
      const isConnected = userWa.status === "connected";
      const isWebDirect = userWa.providerType === "web_direct";
      merged.whatsapp = {
        configured: isConnected,
        status: userWa.status,
        provider: userWa.providerType,
        isPersonalDirect: isWebDirect,
        isUserAccount: true,
        senderNumber: userWa.accountIdentifier || null,
        accountIdentifier: userWa.accountIdentifier,
        accountName: userWa.accountName || (isWebDirect ? "Personal WhatsApp" : "WhatsApp Business"),
        label: isConnected
          ? isWebDirect
            ? `Personal WhatsApp Active (${userWa.accountIdentifier})`
            : `Connected (${userWa.accountIdentifier})`
          : userWa.status === "error"
          ? "Connection needs attention"
          : "Disconnected",
        lastVerifiedAt: userWa.lastVerifiedAt,
        lastError: userWa.lastError || null,
      };
    } else {
      merged.whatsapp = {
        configured: false,
        status: "unconnected",
        provider: null,
        isPersonalDirect: false,
        isUserAccount: false,
        senderNumber: null,
        accountIdentifier: null,
        accountName: null,
        label: "First-time setup required",
        lastVerifiedAt: null,
        lastError: null,
      };
    }

    // Telegram & Email
    for (const acc of userAccounts) {
      if (acc.channel === "telegram" && acc.status === "connected") {
        const username = (acc.credentials?.botUsername || acc.accountIdentifier || "").replace(/^@/, "");
        merged.telegram = {
          configured: true,
          status: "connected",
          botUsername: username || merged.telegram.botUsername,
          accountIdentifier: username ? `@${username}` : acc.accountIdentifier,
          accountName: acc.accountName || "Telegram Bot",
          label: username ? `Connected (@${username})` : "Connected",
          lastVerifiedAt: acc.lastVerifiedAt,
          isUserAccount: true,
        };
      } else if (acc.channel === "email" && acc.status === "connected") {
        merged.email = {
          configured: true,
          status: "connected",
          provider: acc.providerType,
          sender: acc.accountIdentifier || merged.email.sender,
          accountIdentifier: acc.accountIdentifier,
          accountName: acc.accountName || "Custom SMTP",
          label: `Connected (${acc.accountIdentifier})`,
          lastVerifiedAt: acc.lastVerifiedAt,
          isUserAccount: true,
        };
      }
    }

    return merged;
  } catch (err) {
    console.warn("getUserProviderStatus fallback to system status:", err.message);
    return systemStatus;
  }
};

/**
 * Real live connection verification against Telegram Bot API
 */
export const verifyTelegramBotToken = async (botToken) => {
  const token = (botToken || "").trim();
  if (!token) throw new Error("Telegram Bot token is required");
  if (!/^[0-9]{8,12}:[a-zA-Z0-9_-]{35}$/.test(token) && !token.includes(":")) {
    throw new Error("Invalid Telegram bot token format. Expected format: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ");
  }

  const start = Date.now();
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const latencyMs = Date.now() - start;

  const data = await res.json();
  if (!data.ok) {
    if (data.error_code === 401 || data.description?.includes("Unauthorized")) {
      throw new Error("Telegram authentication failed: 401 Unauthorized. The bot token is invalid or was revoked.");
    }
    throw new Error(`Telegram error (${data.error_code}): ${data.description || "Verification failed"}`);
  }

  return {
    valid: true,
    latencyMs,
    botUsername: data.result?.username,
    botName: data.result?.first_name,
    botId: data.result?.id,
    canJoinGroups: data.result?.can_join_groups,
  };
};

/**
 * Real live connection verification against Meta WhatsApp Cloud API
 */
export const verifyWhatsAppCloudApiCredentials = async (phoneNumberId, accessToken) => {
  const phoneId = (phoneNumberId || "").trim();
  const token = (accessToken || "").trim();

  if (!phoneId) throw new Error("WhatsApp Phone Number ID is required");
  if (!token) throw new Error("Meta Permanent Access Token is required");

  const start = Date.now();
  const url = `https://graph.facebook.com/v20.0/${phoneId}?fields=verified_name,display_phone_number,code_verification_status,quality_rating`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const latencyMs = Date.now() - start;

  const data = await res.json();
  if (!res.ok || data.error) {
    const code = data.error?.code;
    const msg = data.error?.message || `WhatsApp verification failed with HTTP ${res.status}`;
    if (code === 190) {
      throw new Error(`Meta Access Token expired or invalid: ${msg}`);
    }
    if (code === 100) {
      throw new Error(`Invalid Phone Number ID: ${phoneId}. Verify your Phone Number ID in Meta App Dashboard.`);
    }
    throw new Error(msg);
  }

  return {
    valid: true,
    latencyMs,
    displayPhoneNumber: data.display_phone_number || phoneId,
    verifiedName: data.verified_name || "WhatsApp Business Account",
    qualityRating: data.quality_rating || "UNKNOWN",
  };
};

/**
 * Real live connection verification against Twilio WhatsApp API
 */
export const verifyTwilioWhatsAppCredentials = async (accountSid, authToken, fromNumber) => {
  const sid = (accountSid || "").trim();
  const token = (authToken || "").trim();

  if (!sid) throw new Error("Twilio Account SID is required");
  if (!sid.startsWith("AC")) throw new Error("Twilio Account SID must start with 'AC'");
  if (!isValidTwilioAccountSid(sid)) {
    throw new Error("Invalid Twilio Account SID format. Expected 34-character string starting with AC.");
  }
  if (!token) throw new Error("Twilio Auth Token is required");
  if (!isValidTwilioAuthToken(token)) {
    throw new Error("Invalid Twilio Auth Token format.");
  }

  const { default: twilio } = await import("twilio");
  const client = twilio(sid, token);

  const start = Date.now();
  const account = await client.api.v2010.accounts(sid).fetch();
  const latencyMs = Date.now() - start;

  return {
    valid: true,
    latencyMs,
    friendlyName: account.friendlyName,
    status: account.status,
    fromNumber: fromNumber || "",
  };
};

/**
 * Validates recipient format depending on channel.
 */
export const validateRecipient = (channel, recipient) => {
  if (!recipient || typeof recipient !== "string" || !recipient.trim()) {
    return { valid: false, message: "Recipient is required." };
  }
  const trimmed = recipient.trim();

  switch (channel) {
    case "email":
      if (!validator.isEmail(trimmed)) {
        return { valid: false, message: "Enter a valid email address (e.g., user@example.com)." };
      }
      return { valid: true, cleanRecipient: trimmed };

    case "telegram": {
      const clean = trimmed.replace(/^@/, "").trim();
      if (!clean) {
        return { valid: false, message: "Enter a valid Telegram username or numeric chat ID." };
      }
      return { valid: true, cleanRecipient: trimmed };
    }

    case "whatsapp": {
      const digits = trimmed.replace(/[^0-9]/g, "");
      if (digits.length < 7 || digits.length > 15) {
        return {
          valid: false,
          message: "Enter a valid phone number in international format with country code (e.g. +14155552671).",
        };
      }
      const formatted = trimmed.startsWith("+") ? `+${digits}` : `+${digits}`;
      return { valid: true, cleanRecipient: formatted };
    }

    case "sms": {
      if (!validator.isMobilePhone(trimmed, "any")) {
        return {
          valid: false,
          message: "Enter a valid phone number with country code, e.g. +15551234567.",
        };
      }
      return { valid: true, cleanRecipient: trimmed };
    }

    default:
      return { valid: false, message: `Unsupported channel: ${channel}` };
  }
};

/**
 * Dispatch message via Telegram Bot API with optional user credentials
 */
export const sendViaTelegram = async ({
  recipient,
  subject,
  message,
  reaction,
  files = [],
  credentials = null,
}) => {
  const rawToken = credentials?.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
  const token = (decryptCredential(rawToken) || rawToken).trim();
  if (!token || token.includes("your_bot_token")) {
    throw new Error(
      "Telegram bot token is not configured. Please connect your bot token in Connection Settings or set TELEGRAM_BOT_TOKEN."
    );
  }

  const chatId = recipient.trim();
  const textBody = [
    subject ? `*${subject.trim()}*` : "",
    message ? message.trim() : "",
    reaction ? `Reaction: ${reaction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const baseUrl = `https://api.telegram.org/bot${token}`;

  // Attachments (Documents / Audio / Images)
  if (files.length > 0) {
    let lastResponse = null;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("chat_id", chatId);

      const blob = new Blob([file.buffer || Buffer.from(file.content || "")], {
        type: file.mimetype || "application/octet-stream",
      });
      formData.append("document", blob, file.originalname || `attachment-${i + 1}`);

      // First document carries the message text caption
      if (i === 0 && textBody) {
        formData.append("caption", textBody.slice(0, 1024));
        formData.append("parse_mode", "Markdown");
      }

      const res = await fetch(`${baseUrl}/sendDocument`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        if (data.description?.includes("chat not found")) {
          throw new Error(
            "Telegram recipient not found. The user must first open your bot (@" +
              (credentials?.botUsername || process.env.TELEGRAM_BOT_USERNAME || "your_bot") +
              ") and tap /start before the bot can message them."
          );
        }
        throw new Error(`Telegram sendDocument error: ${data.description || "Unknown error"}`);
      }
      lastResponse = data;
    }
    return {
      providerMessageId: String(lastResponse?.result?.message_id || Date.now()),
      raw: lastResponse,
    };
  }

  // Text-only message
  const res = await fetch(`${baseUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: textBody,
      parse_mode: "Markdown",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    if (data.description?.includes("chat not found")) {
      throw new Error(
        "Telegram recipient not found. The user or group has not started a chat with this bot. Please ask them to send /start to your bot first."
      );
    }
    throw new Error(`Telegram sendMessage error: ${data.description || res.statusText}`);
  }

  return {
    providerMessageId: String(data?.result?.message_id || Date.now()),
    raw: data,
  };
};

/**
 * Dispatch message via WhatsApp (Meta Cloud API or Twilio WhatsApp fallback)
 */
export const sendViaWhatsApp = async ({
  recipient,
  subject,
  message,
  reaction,
  files = [],
  credentials = null,
}) => {
  const rawWaToken = credentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || "";
  const waAccessToken = (decryptCredential(rawWaToken) || rawWaToken).trim();
  const waPhoneId = (
    credentials?.phoneNumberId ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  ).trim();

  const formattedText = [
    subject ? `*${subject.trim()}*` : "",
    message ? message.trim() : "",
    reaction ? `Reaction: ${reaction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const digitsOnly = recipient.replace(/[^0-9]/g, "");

  // 0. Personal WhatsApp (Web Direct / Click-to-Chat)
  if (
    credentials?.providerType === "web_direct" ||
    credentials?.isWebDirect ||
    Boolean(credentials?.personalNumber)
  ) {
    const directUrl = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(formattedText)}`;
    return {
      providerMessageId: `wd_${Date.now()}`,
      isWebDirect: true,
      webDirectUrl: directUrl,
      raw: { type: "web_direct", recipient: digitsOnly, url: directUrl },
    };
  }

  // 1. Meta WhatsApp Cloud API
  if (
    waAccessToken &&
    waPhoneId &&
    !waAccessToken.toLowerCase().includes("your_") &&
    !waPhoneId.toLowerCase().includes("your_")
  ) {
    const baseUrl = `https://graph.facebook.com/v20.0/${waPhoneId}`;

    // If attachments present, upload media to Meta Graph API first
    if (files.length > 0 && files[0]?.buffer) {
      const file = files[0];
      const mediaForm = new FormData();
      mediaForm.append("messaging_product", "whatsapp");
      const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
      mediaForm.append("file", blob, file.originalname || "attachment");

      const uploadRes = await fetch(`${baseUrl}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${waAccessToken}` },
        body: mediaForm,
      });
      const uploadData = await uploadRes.json();

      if (uploadRes.ok && uploadData.id) {
        const isImage = (file.mimetype || "").startsWith("image/");
        const isAudio = (file.mimetype || "").startsWith("audio/");
        const mediaType = isImage ? "image" : isAudio ? "audio" : "document";

        const mediaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digitsOnly,
          type: mediaType,
          [mediaType]: {
            id: uploadData.id,
            ...(isImage || mediaType === "document" ? { caption: formattedText || undefined } : {}),
            ...(mediaType === "document" ? { filename: file.originalname } : {}),
          },
        };

        const sendMediaRes = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${waAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mediaPayload),
        });
        const sendMediaData = await sendMediaRes.json();

        if (!sendMediaRes.ok || sendMediaData.error) {
          throw new Error(
            sendMediaData.error?.message || `WhatsApp Cloud API Media Send Error: HTTP ${sendMediaRes.status}`
          );
        }

        return {
          providerMessageId: sendMediaData.messages?.[0]?.id || String(Date.now()),
          raw: sendMediaData,
        };
      }
    }

    // Standard Text Message
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly,
      type: "text",
      text: { body: formattedText || " " },
    };

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${waAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      const code = data.error?.code;
      if (code === 131047 || data.error?.message?.includes("24 hours")) {
        throw new Error(
          "Meta WhatsApp 24-hour customer window has expired for this recipient. Official Meta policy requires an approved template message for outbound conversations after 24 hours. You can switch to a template or open WhatsApp directly."
        );
      }
      throw new Error(
        data.error?.message || `WhatsApp Cloud API error: HTTP ${res.status}`
      );
    }

    return {
      providerMessageId: data.messages?.[0]?.id || String(Date.now()),
      raw: data,
    };
  }

  // 2. Twilio WhatsApp (only if genuine credentials are provided)
  const twilioSid = (credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID || "").trim();
  const rawTwilioToken = credentials?.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  const twilioToken = (decryptCredential(rawTwilioToken) || rawTwilioToken).trim();
  const twilioWaNumber = (
    credentials?.fromNumber ||
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    ""
  ).trim();

  if (
    isValidTwilioAccountSid(twilioSid) &&
    isValidTwilioAuthToken(twilioToken) &&
    twilioWaNumber &&
    !twilioWaNumber.includes("xxxx")
  ) {
    const { default: twilio } = await import("twilio");
    const client = twilio(twilioSid, twilioToken);

    const fromNum = twilioWaNumber.startsWith("whatsapp:")
      ? twilioWaNumber
      : `whatsapp:${twilioWaNumber.startsWith("+") ? twilioWaNumber : `+${twilioWaNumber}`}`;
    const toNum = `whatsapp:+${digitsOnly}`;

    const res = await client.messages.create({
      from: fromNum,
      to: toNum,
      body: formattedText || " ",
    });

    return {
      providerMessageId: res.sid,
      raw: res,
    };
  }

  throw new Error(
    "WhatsApp provider is not configured. Please connect your Personal WhatsApp phone number or configure Meta Cloud API in Connection Settings."
  );
};

/**
 * Dispatch message via Email
 */
export const sendViaEmail = async ({
  to,
  subject,
  message,
  reaction,
  files = [],
  cc = "",
  bcc = "",
}) => {
  const mailSubject = subject?.trim() || "New message from Tasklert";
  const safeSubject = escapeHtml(subject?.trim() || "");
  const safeMessage = escapeHtml(message || "").replace(/\n/g, "<br/>");
  const safeReaction = escapeHtml(reaction || "");
  const textContent = `${message || ""}${reaction ? `\n\nReaction: ${reaction}` : ""}`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e9d5ff; border-radius: 16px; background-color: #ffffff;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #f3e8ff; padding-bottom: 14px;">
        <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7e22ce 0%, #a855f7 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">T</div>
        <span style="font-size: 18px; font-weight: bold; color: #4c1d95;">Tasklert QuickSend</span>
      </div>
      ${subject ? `<h3 style="color: #1e1b4b; margin: 0 0 16px 0; font-size: 18px;">${safeSubject}</h3>` : ""}
      <div style="background-color: #faf5ff; border-left: 4px solid #8b2cf5; padding: 16px; border-radius: 8px; color: #1f2937; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
        ${safeMessage}
      </div>
      ${reaction ? `<div style="margin-top: 16px; font-size: 24px;">${safeReaction}</div>` : ""}
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f3e8ff; font-size: 12px; color: #9ca3af; text-align: center;">
        Sent via Tasklert QuickSend · Fast &amp; Reliable Task Messaging
      </div>
    </div>
  `;

  const emailAttachments = files.map((file) => ({
    filename: file.originalname || file.filename,
    content: file.buffer,
    contentType: file.mimetype || file.mimeType,
  }));

  const res = await sendEmail({
    to: to.trim(),
    subject: mailSubject,
    text: textContent,
    html: htmlContent,
    cc: cc?.trim() || undefined,
    bcc: bcc?.trim() || undefined,
    attachments: emailAttachments.length ? emailAttachments : undefined,
  });

  return {
    providerMessageId: res?.messageId || res?.id || String(Date.now()),
    raw: res,
  };
};

/**
 * Universal dispatcher
 */
export const dispatchQuickSendMessage = async ({
  channel,
  recipient,
  subject = "",
  message = "",
  reaction = "",
  files = [],
  cc = "",
  bcc = "",
  credentials = null,
}) => {
  switch (channel) {
    case "email":
      return await sendViaEmail({ to: recipient, subject, message, reaction, files, cc, bcc });

    case "telegram":
      return await sendViaTelegram({ recipient, subject, message, reaction, files, credentials });

    case "whatsapp":
      return await sendViaWhatsApp({ recipient, subject, message, reaction, files, credentials });

    case "sms": {
      const smsBody = [
        subject ? `[${subject.trim()}]` : "",
        message ? message.trim() : "",
        reaction ? reaction : "",
      ]
        .filter(Boolean)
        .join(" ");
      const smsRes = await sendSms({ to: recipient, body: smsBody });
      return {
        providerMessageId: smsRes?.sid || String(Date.now()),
        raw: smsRes,
      };
    }

    default:
      throw new Error(`Unsupported channel: ${channel}`);
  }
};
