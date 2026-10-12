import nodemailer from "nodemailer";

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

const getTransporter = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = port === 465;

  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured with valid credentials in backend/.env");
  }

  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

export const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const transporter = getTransporter();
  const rawFrom = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const from = rawFrom.includes("<") ? rawFrom : `"Tasklert" <${rawFrom}>`;

  await transporter.sendMail({
    from,
    to: to.trim(),
    subject,
    text,
    html,
    attachments,
  });
};

