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
const sendViaResend = async ({ to, subject, text, html, attachments }) => {
  const apiKey = process.env.RESEND_API_KEY.trim();
  const rawFrom = (process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const from = rawFrom.includes("@") && !rawFrom.includes("gmail.com")
    ? (rawFrom.includes("<") ? rawFrom : `"Tasklert" <${rawFrom}>`)
    : "Tasklert <onboarding@resend.dev>";

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to.trim()],
      subject,
      text,
      html,
      attachments: formattedAttachments?.length ? formattedAttachments : undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Resend API error: ${response.statusText}`);
  }
  return data;
};

// -------------------------------------------------------------
// 2. HTTPS Email API: Brevo / Sendinblue (Port 443 — Port 443 HTTPS)
// -------------------------------------------------------------
const sendViaBrevo = async ({ to, subject, text, html, attachments }) => {
  const apiKey = process.env.BREVO_API_KEY.trim();
  const rawFrom = (process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "admin@tasklert.com").trim();

  const formattedAttachments = attachments
    ?.map((att) => ({
      name: att.filename,
      content: Buffer.isBuffer(att.content)
        ? att.content.toString("base64")
        : typeof att.content === "string"
        ? Buffer.from(att.content).toString("base64")
        : undefined,
    }))
    .filter((a) => a.content);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Tasklert", email: rawFrom },
      to: [{ email: to.trim() }],
      subject,
      textContent: text,
      htmlContent: html,
      attachment: formattedAttachments?.length ? formattedAttachments : undefined,
    }),
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
    tls: { rejectUnauthorized: false },
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
export const sendEmail = async ({ to, subject, text, html, attachments }) => {
  // Strategy A: If RESEND_API_KEY is present, deliver via Resend HTTPS REST API (Port 443)
  if (process.env.RESEND_API_KEY) {
    return await sendViaResend({ to, subject, text, html, attachments });
  }

  // Strategy B: If BREVO_API_KEY is present, deliver via Brevo HTTPS REST API (Port 443)
  if (process.env.BREVO_API_KEY) {
    return await sendViaBrevo({ to, subject, text, html, attachments });
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
