export const escapeHtml = (str) => {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

import nodemailer from "nodemailer";

export const isEmailConfigured = () => {
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.BREVO_API_KEY) return true;
  return isSmtpConfigured();
};

export const isSmtpConfigured = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return false;
  if (
    user.includes("your_gmail_address") ||
    pass.includes("your_16_char_app_password") ||
    pass.includes("PASTE_YOUR_NEW_16_LETTER_APP_PASSWORD_HERE")
  ) {
    return false;
  }
  return true;
};

// -------------------------------------------------------------
// 1. HTTPS Email API: Resend (Port 443 — NEVER BLOCKED BY CLOUD HOSTS)
// -------------------------------------------------------------
export const sendViaResend = async ({ from: customFrom, to, subject, text, html, attachments, cc, bcc, replyTo }) => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const rawFrom = customFrom || (process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const from = rawFrom && rawFrom.includes("@") && !rawFrom.includes("gmail.com")
    ? (rawFrom.includes("<") ? rawFrom : `"Tasklert" <${rawFrom}>`)
    : (customFrom || "Tasklert <onboarding@resend.dev>");

  const toList = (Array.isArray(to) ? to : [to]).map((s) => String(s).trim()).filter(Boolean);
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).map((s) => String(s).trim()).filter(Boolean);
  const bccList = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : []).map((s) => String(s).trim()).filter(Boolean);

  const formattedAttachments = attachments
    ?.map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : undefined,
    }))
    .filter((a) => a.content);

  const payload = {
    from,
    to: toList,
    subject,
    text,
    html,
    attachments: formattedAttachments?.length ? formattedAttachments : undefined,
  };
  if (ccList.length > 0) payload.cc = ccList;
  if (bccList.length > 0) payload.bcc = bccList;
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Resend API error: ${response.statusText}`);
  }
  return data;
};

// -------------------------------------------------------------
// 2. HTTPS Email API: Brevo / Sendinblue (Port 443 HTTPS — NEVER BLOCKED BY RAILWAY)
// -------------------------------------------------------------
export const sendViaBrevo = async ({ from: customFrom, senderName, to, subject, text, html, attachments, cc, bcc, replyTo }) => {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured.");

  const rawFrom = (customFrom || process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "taskflow.iya@gmail.com").trim();

  const parseEmailList = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((s) => (typeof s === "object" && s.email ? s : { email: String(s).trim() })).filter((x) => x.email);
    }
    return String(input)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((e) => ({ email: e }));
  };

  const toList = parseEmailList(to);
  const ccList = parseEmailList(cc);
  const bccList = parseEmailList(bcc);

  if (toList.length === 0) {
    throw new Error("At least one recipient email address is required for Brevo delivery.");
  }

  let replyToObj = undefined;
  if (replyTo) {
    if (typeof replyTo === "object" && replyTo.email) {
      replyToObj = { email: replyTo.email, name: replyTo.name || undefined };
    } else if (typeof replyTo === "string") {
      const match = replyTo.match(/^(.*?)\s*<(.+?)>$/);
      if (match) {
        replyToObj = { name: match[1].replace(/["']/g, "").trim(), email: match[2].trim() };
      } else {
        replyToObj = { email: replyTo.trim() };
      }
    }
  }

  const formattedAttachments = attachments
    ?.map((att) => ({
      name: att.filename || att.name || "attachment",
      content: Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : undefined,
    }))
    .filter((a) => a.content);

  const payload = {
    sender: { name: senderName || "Tasklert", email: rawFrom },
    to: toList,
    subject,
    textContent: text,
    htmlContent: html,
    attachment: formattedAttachments?.length ? formattedAttachments : undefined,
  };

  if (ccList.length > 0) payload.cc = ccList;
  if (bccList.length > 0) payload.bcc = bccList;
  if (replyToObj) payload.replyTo = replyToObj;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Brevo API error: ${response.statusText}`);
  }
  return data;
};

// -------------------------------------------------------------
// 3. SMTP Transport: Nodemailer (For Localhost or Unblocked Hosts)
// -------------------------------------------------------------
let cachedTransporter = null;

const createTransporterInstance = () => {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured with valid credentials in environment variables");
  }

  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);

  const isGmail = host.includes("gmail") || user.endsWith("@gmail.com");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      family: 4,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    family: 4,
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });
};

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createTransporterInstance();
  }
  return cachedTransporter;
};

const getFromAddress = () => {
  const rawFrom = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  return rawFrom.includes("<") ? rawFrom : `"Tasklert" <${rawFrom}>`;
};

// -------------------------------------------------------------
// Unified Dispatch Engine
// -------------------------------------------------------------
export const sendEmail = async ({ to, subject, text, html, attachments, cc, bcc, replyTo, from, senderName }) => {
  // Strategy A: If BREVO_API_KEY is present, deliver via Brevo HTTPS REST API (Port 443 — NEVER BLOCKED BY CLOUD HOSTS)
  if (process.env.BREVO_API_KEY) {
    return await sendViaBrevo({ from, senderName, to, subject, text, html, attachments, cc, bcc, replyTo });
  }

  // Strategy B: If RESEND_API_KEY is present, deliver via Resend HTTPS REST API
  if (process.env.RESEND_API_KEY) {
    return await sendViaResend({ to, subject, text, html, attachments, cc, bcc });
  }

  // Strategy C: Direct SMTP connection via Nodemailer
  try {
    const transporter = getTransporter();
    return await transporter.sendMail({
      from: getFromAddress(),
      to: to.trim(),
      subject,
      text,
      html,
      attachments,
    });
  } catch (err) {
    // Check if cloud provider blocked outbound SMTP ports
    if (err.message?.toLowerCase().includes("timeout") || err.code === "ETIMEDOUT") {
      throw new Error(
        "SMTP connection timed out. Railway and other cloud hosts block outbound ports 465 & 587. Please add RESEND_API_KEY (from resend.com) to your Railway Variables for instant HTTPS delivery."
      );
    }
    throw err;
  }
};
