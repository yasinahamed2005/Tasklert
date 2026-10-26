import validator from "validator";
import { sendEmail, isEmailConfigured, isSmtpConfigured } from "../utils/mailer.js";
import { sendSms } from "../utils/sms.js";

/**
 * Returns honest readiness status of each messaging provider
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
      !telegramToken.includes("your_bot_token") &&
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
      !waAccessToken.includes("your_token") &&
      !waPhoneId.includes("your_phone_id")
  );

  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioWaNumber = (
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    ""
  ).trim();
  const hasTwilioWa = Boolean(
    twilioSid &&
      twilioToken &&
      twilioWaNumber &&
      !twilioSid.includes("your_sid")
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
    twilioSid && twilioToken && smsPhone && !twilioSid.includes("your_sid")
  );

  return {
    email: {
      configured: emailConfigured,
      provider: emailProvider,
      label: emailConfigured
        ? `Ready (${emailProvider.toUpperCase()})`
        : "Not configured (Setup SMTP / Resend / Brevo)",
    },
    telegram: {
      configured: telegramConfigured,
      botUsername: telegramBotUsername || null,
      label: telegramConfigured
        ? telegramBotUsername
          ? `Ready (@${telegramBotUsername})`
          : "Ready (Bot Token Active)"
        : "Setup required (TELEGRAM_BOT_TOKEN)",
    },
    whatsapp: {
      configured: whatsappConfigured,
      provider: whatsappProvider,
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
 * Dispatch message via Telegram Bot API
 */
export const sendViaTelegram = async ({ recipient, subject, message, reaction, files = [] }) => {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token || token.includes("your_bot_token")) {
    throw new Error(
      "Telegram bot token is not configured in backend/.env. Please set TELEGRAM_BOT_TOKEN."
    );
  }

  // Telegram accepts numeric chat ID or @channelusername
  const chatId = recipient.trim();
  const textBody = [
    subject ? `*${subject.trim()}*` : "",
    message ? message.trim() : "",
    reaction ? `Reaction: ${reaction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const baseUrl = `https://api.telegram.org/bot${token}`;

  // If attachments are provided, send document(s)
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
            "Telegram recipient not found. Telegram users must first open your bot and tap /start before bots can message them."
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
export const sendViaWhatsApp = async ({ recipient, subject, message, reaction, files = [] }) => {
  const waAccessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const waPhoneId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();

  const formattedText = [
    subject ? `*${subject.trim()}*` : "",
    message ? message.trim() : "",
    reaction ? `Reaction: ${reaction}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const digitsOnly = recipient.replace(/[^0-9]/g, "");

  // 1. Meta WhatsApp Cloud API
  if (waAccessToken && waPhoneId && !waAccessToken.includes("your_token")) {
    const url = `https://graph.facebook.com/v20.0/${waPhoneId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digitsOnly,
      type: "text",
      text: { body: formattedText || " " },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${waAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(
        data.error?.message || `WhatsApp Cloud API error: HTTP ${res.status}`
      );
    }

    return {
      providerMessageId: data.messages?.[0]?.id || String(Date.now()),
      raw: data,
    };
  }

  // 2. Twilio WhatsApp
  const twilioSid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const twilioToken = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const twilioWaNumber = (
    process.env.TWILIO_WHATSAPP_NUMBER ||
    process.env.TWILIO_PHONE_NUMBER ||
    ""
  ).trim();

  if (twilioSid && twilioToken && twilioWaNumber && !twilioSid.includes("your_sid")) {
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
    "WhatsApp provider is not configured. Please set WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API) or Twilio credentials in backend/.env."
  );
};

/**
 * Dispatch message via Email
 */
export const sendViaEmail = async ({ to, subject, message, reaction, files = [] }) => {
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
      <div style="margin-top: 24px; pt: 16px; border-top: 1px solid #f3e8ff; font-size: 12px; color: #9ca3af; text-align: center;">
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
}) => {
  switch (channel) {
    case "email":
      return await sendViaEmail({ to: recipient, subject, message, reaction, files });

    case "telegram":
      return await sendViaTelegram({ recipient, subject, message, reaction, files });

    case "whatsapp":
      return await sendViaWhatsApp({ recipient, subject, message, reaction, files });

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
