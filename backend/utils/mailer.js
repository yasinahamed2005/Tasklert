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

// Cached transporter instance for fast connection reuse
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
    // For Gmail, use service: 'gmail' with family: 4 to prevent cloud IPv6 route hangs
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000, // 10s connection timeout prevents infinite loading spinners
      greetingTimeout: 10000,
      socketTimeout: 20000,
      family: 4, // Force IPv4 to prevent hanging on cloud hosts without IPv6 routing
    });
  }

  // Generic SMTP provider (SendGrid, Mailgun, custom host, etc.)
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    family: 4,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = createTransporterInstance();
  }
  return cachedTransporter;
};

export const sendEmail = async ({ to, subject, text, html, attachments }) => {
  const rawFrom = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  const from = rawFrom.includes("<") ? rawFrom : `"Tasklert" <${rawFrom}>`;

  const mailOptions = {
    from,
    to: to.trim(),
    subject,
    text,
    html,
    attachments,
  };

  try {
    const transporter = getTransporter();
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    // If cached connection had an issue, reset and try one fresh attempt
    cachedTransporter = null;
    const freshTransporter = createTransporterInstance();
    return await freshTransporter.sendMail(mailOptions);
  }
};
