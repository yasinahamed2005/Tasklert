import nodemailer from "nodemailer";
import EmailAccount from "../../models/EmailAccount.js";
import EmailMessage from "../../models/EmailMessage.js";
import { decryptCredential } from "../../utils/crypto.js";
import { sendEmail as sendViaSystemMailer, isEmailConfigured } from "../../utils/mailer.js";

/**
 * Send real outbound email through the user's connected account or fallback
 */
export const sendOutboundEmail = async (userId, emailData) => {
  if (!userId) throw new Error("Authenticated user required.");

  const {
    accountId,
    from,
    to = [],
    cc = [],
    bcc = [],
    subject = "",
    body = "",
    attachments = [],
  } = emailData;

  const toList = Array.isArray(to) ? to : [to];
  const ccList = Array.isArray(cc) ? cc : cc ? [cc] : [];
  const bccList = Array.isArray(bcc) ? bcc : bcc ? [bcc] : [];

  if (toList.length === 0) {
    throw new Error("At least one recipient email address is required.");
  }

  // 1. Find user's connected email account
  let account = null;
  if (accountId) {
    account = await EmailAccount.findOne({ _id: accountId, owner: userId });
  }
  if (!account) {
    account = await EmailAccount.findOne({
      owner: userId,
      status: "connected",
    }).sort({ isDefault: -1, createdAt: -1 });
  }

  let sentResult = null;
  let senderAddress = from || account?.email || "";

  // 2. Dispatch via User's Connected SMTP Account
  if (account && account.provider === "smtp" && account.credentials?.smtpHost) {
    const rawPass = decryptCredential(account.credentials.smtpPass);
    const transporter = nodemailer.createTransport({
      host: account.credentials.smtpHost,
      port: Number(account.credentials.smtpPort) || 587,
      secure: Number(account.credentials.smtpPort) === 465,
      auth: {
        user: account.credentials.smtpUser,
        pass: rawPass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    const formattedAttachments = attachments.map((att) => ({
      filename: att.originalname || att.name || att.filename,
      content: att.buffer || att.content,
      path: att.path,
    }));

    const mailOptions = {
      from: account.credentials.smtpFrom || account.email,
      to: toList.join(", "),
      cc: ccList.length ? ccList.join(", ") : undefined,
      bcc: bccList.length ? bccList.join(", ") : undefined,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments: formattedAttachments.length ? formattedAttachments : undefined,
    };

    sentResult = await transporter.sendMail(mailOptions);
    senderAddress = mailOptions.from;
  } else if (isEmailConfigured()) {
    // 3. Fallback: System email provider (Brevo / Resend / Default SMTP)
    const formattedAttachments = attachments.map((att) => ({
      filename: att.originalname || att.name || att.filename,
      content: att.buffer || att.content,
    }));

    sentResult = await sendViaSystemMailer({
      to: toList[0],
      cc: ccList.length ? ccList[0] : undefined,
      bcc: bccList.length ? bccList[0] : undefined,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments: formattedAttachments,
    });
    senderAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "Tasklert";
  } else {
    throw new Error(
      "No active email account connected. Please connect your Gmail, Outlook, or SMTP account to send emails."
    );
  }

  // 4. Save record in EmailMessage under "SENT" folder
  const savedMessage = await EmailMessage.create({
    owner: userId,
    accountId: account?._id || null,
    providerMessageId: sentResult?.messageId || `msg_${Date.now()}`,
    folder: "SENT",
    from: senderAddress,
    fromName: senderAddress.split("<")[0].replace(/"/g, "").trim(),
    to: toList,
    cc: ccList,
    bcc: bccList,
    subject,
    snippet: body.replace(/<[^>]+>/g, " ").slice(0, 150),
    body,
    htmlBody: body,
    textBody: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    isRead: true,
    isStarred: false,
    hasAttachment: attachments.length > 0,
    attachments: attachments.map((a) => ({
      filename: a.originalname || a.name || a.filename || "file",
      mimeType: a.mimetype || "application/octet-stream",
      size: a.size || 0,
    })),
    date: new Date(),
  });

  return {
    success: true,
    messageId: sentResult?.messageId || savedMessage._id,
    savedMessage,
  };
};

