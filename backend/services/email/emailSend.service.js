import nodemailer from "nodemailer";
import EmailAccount from "../../models/EmailAccount.js";
import EmailMessage from "../../models/EmailMessage.js";
import { decryptCredential } from "../../utils/crypto.js";
import {
  sendEmail as sendViaSystemMailer,
  sendViaResend,
  sendViaBrevo,
  isEmailConfigured,
  isSmtpConfigured,
} from "../../utils/mailer.js";
import { sendGmailMessage } from "./gmail.service.js";
import { generateTasklertMailHtml, generateTasklertMailText } from "./tasklertMailTemplate.js";

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

  // 2. Dispatch via User's Connected Gmail API or SMTP Account
  if (account && account.provider === "gmail") {
    sentResult = await sendGmailMessage(account, {
      from: senderAddress || account.email,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments,
    });
    senderAddress = account.email;
  } else if (account && account.provider === "smtp" && account.credentials?.smtpHost) {
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
      mimeType: a.mimetype || a.type || "application/octet-stream",
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

/**
 * Send real outbound email specifically through Tasklert Mail
 * Uses the authenticated Gmail account (or configured provider), Tasklert branded template,
 * Reply-To configuration, and priority handling.
 */
export const sendTasklertMail = async (user, mailData) => {
  if (!user || !user._id) throw new Error("Authenticated user required.");

  const {
    to = [],
    cc = [],
    bcc = [],
    subject = "",
    message = "",
    priority = "normal",
    actionDeadline = null,
    attachments = [],
  } = mailData;

  const toList = (Array.isArray(to) ? to : [to]).map((e) => String(e).trim()).filter(Boolean);
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).map((e) => String(e).trim()).filter(Boolean);
  const bccList = (Array.isArray(bcc) ? bcc : bcc ? [bcc] : []).map((e) => String(e).trim()).filter(Boolean);

  if (toList.length === 0) {
    throw new Error("At least one recipient email address is required.");
  }

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of [...toList, ...ccList, ...bccList]) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address format: "${email}"`);
    }
  }

  const cleanSubject = String(subject || "").trim();
  if (!cleanSubject) {
    throw new Error("Email subject is required.");
  }

  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) {
    throw new Error("Email message body is required.");
  }

  // Final subject with priority prefix if requested
  let finalSubject = cleanSubject;
  if (priority === "action_required" && !finalSubject.toLowerCase().startsWith("action required")) {
    finalSubject = `Action Required: ${finalSubject}`;
  }

  const senderName = user.name || "Tasklert User";
  const senderEmail = user.email;

  // Generate responsive HTML & plain-text templates
  const htmlContent = generateTasklertMailHtml({
    senderName,
    senderEmail,
    subject: finalSubject,
    messageHtml: cleanMessage.includes("<") ? cleanMessage : cleanMessage.replace(/\n/g, "<br>"),
    priority,
    actionDeadline,
  });

  const textContent = generateTasklertMailText({
    senderName,
    senderEmail,
    subject: finalSubject,
    messageText: cleanMessage.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    priority,
    actionDeadline,
  });

  const formattedAttachments = attachments.map((att) => ({
    filename: att.originalname || att.name || att.filename || "attachment",
    content: att.buffer || att.content,
    path: att.path,
    mimeType: att.mimetype || att.mimeType,
  }));

  const TARGET_TASKLERT_GMAIL = (
    process.env.TASKLERT_MAIL_SENDER || "tasksflow.iya@gmail.com"
  ).trim().toLowerCase();

  const providerMode = (
    process.env.TASKLERT_MAIL_PROVIDER || "auto"
  ).trim().toLowerCase();

  let sentResult = null;
  let actualFromEmail = "";

  // Strategy 1: Resend HTTPS API (When explicitly configured or for custom verified domain)
  if (providerMode === "resend" && process.env.RESEND_API_KEY) {
    const resendFrom = (process.env.TASKLERT_MAIL_SENDER || "noreply@tasklert.shop").trim();
    const fromHeader = `"${senderName} via Tasklert" <${resendFrom}>`;
    actualFromEmail = resendFrom;
    sentResult = await sendViaResend({
      from: fromHeader,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: finalSubject,
      html: htmlContent,
      text: textContent,
      replyTo: `"${senderName}" <${senderEmail}>`,
      attachments: formattedAttachments,
    });
  } else if (providerMode === "smtp" && isSmtpConfigured()) {
    // Strategy 2: Dedicated SMTP (When explicitly configured)
    const smtpFrom = (process.env.SMTP_FROM || process.env.SMTP_USER || TARGET_TASKLERT_GMAIL).trim();
    actualFromEmail = smtpFrom;
    sentResult = await sendViaSystemMailer({
      to: toList.join(", "),
      cc: ccList.length ? ccList.join(", ") : undefined,
      bcc: bccList.length ? bccList.join(", ") : undefined,
      subject: finalSubject,
      html: htmlContent,
      text: textContent,
      replyTo: `"${senderName}" <${senderEmail}>`,
      attachments: formattedAttachments,
    });
  } else {
    // Strategy 3: Genuine Gmail REST API (Primary — Port 443 HTTPS, immune to cloud SMTP blocks)
    // A) Search for account matching TARGET_TASKLERT_GMAIL
    let gmailAccount = await EmailAccount.findOne({
      provider: "gmail",
      status: "connected",
      email: { $regex: new RegExp(`^${TARGET_TASKLERT_GMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    // B) Search for current authenticated user's connected Gmail account
    if (!gmailAccount) {
      gmailAccount = await EmailAccount.findOne({
        owner: user._id,
        provider: "gmail",
        status: "connected",
      }).sort({ isDefault: -1, createdAt: -1 });
    }

    // C) Search for any system-connected Gmail account
    if (!gmailAccount) {
      gmailAccount = await EmailAccount.findOne({
        provider: "gmail",
        status: "connected",
      }).sort({ isDefault: -1, createdAt: -1 });
    }

    if (gmailAccount) {
      const isTargetAccount = gmailAccount.email.toLowerCase() === TARGET_TASKLERT_GMAIL;
      // Requirement 2: Set actual From header to tasksflow.iya@gmail.com, provided this is the authenticated Gmail account
      actualFromEmail = isTargetAccount ? TARGET_TASKLERT_GMAIL : gmailAccount.email;
      const fromHeader = `"${senderName} via Tasklert" <${actualFromEmail}>`;
      const replyToHeader = `"${senderName}" <${senderEmail}>`;

      try {
        sentResult = await sendGmailMessage(gmailAccount, {
          from: fromHeader,
          to: toList,
          cc: ccList,
          bcc: bccList,
          replyTo: replyToHeader,
          subject: finalSubject,
          html: htmlContent,
          text: textContent,
          attachments: formattedAttachments,
        });
      } catch (gmailErr) {
        console.warn("[TasklertMail] Gmail API send failed, falling back to Brevo HTTPS:", gmailErr.message);
        if (process.env.BREVO_API_KEY) {
          actualFromEmail = (process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || TARGET_TASKLERT_GMAIL).trim();
          sentResult = await sendViaBrevo({
            from: actualFromEmail,
            senderName: `${senderName} via Tasklert`,
            to: toList,
            cc: ccList,
            bcc: bccList,
            subject: finalSubject,
            html: htmlContent,
            text: textContent,
            replyTo: `"${senderName}" <${senderEmail}>`,
            attachments: formattedAttachments,
          });
        } else {
          throw gmailErr;
        }
      }
    } else if (process.env.BREVO_API_KEY) {
      // Primary HTTPS API for Railway / Cloud environments (Port 443 — NEVER BLOCKED)
      actualFromEmail = (process.env.BREVO_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || TARGET_TASKLERT_GMAIL).trim();
      sentResult = await sendViaBrevo({
        from: actualFromEmail,
        senderName: `${senderName} via Tasklert`,
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: finalSubject,
        html: htmlContent,
        text: textContent,
        replyTo: `"${senderName}" <${senderEmail}>`,
        attachments: formattedAttachments,
      });
    } else if (process.env.RESEND_API_KEY) {
      // Fallback: Resend HTTPS
      actualFromEmail = "noreply@tasklert.shop";
      sentResult = await sendViaResend({
        from: `"Tasklert" <${actualFromEmail}>`,
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: finalSubject,
        html: htmlContent,
        text: textContent,
        replyTo: `"${senderName}" <${senderEmail}>`,
        attachments: formattedAttachments,
      });
    } else if (isEmailConfigured()) {
      actualFromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || TARGET_TASKLERT_GMAIL;
      sentResult = await sendViaSystemMailer({
        to: toList.join(", "),
        cc: ccList.length ? ccList.join(", ") : undefined,
        bcc: bccList.length ? bccList.join(", ") : undefined,
        subject: finalSubject,
        html: htmlContent,
        text: textContent,
        replyTo: `"${senderName}" <${senderEmail}>`,
        attachments: formattedAttachments,
      });
    } else {
      throw new Error(
        "No authenticated Gmail account or email provider is available. Please connect your Gmail account in Message Center or configure an email provider."
      );
    }
  }

  if (!sentResult || !sentResult.messageId) {
    throw new Error("Failed to verify email transmission confirmation from provider.");
  }

  // Save in EmailMessage under "SENT" folder with isTasklertMail: true
  const savedMessage = await EmailMessage.create({
    owner: user._id,
    folder: "SENT",
    from: actualFromEmail || senderEmail,
    fromName: senderName,
    to: toList,
    cc: ccList,
    bcc: bccList,
    subject: finalSubject,
    snippet: cleanMessage.replace(/<[^>]+>/g, " ").slice(0, 150),
    body: cleanMessage,
    htmlBody: htmlContent,
    textBody: textContent,
    priority,
    status: "sent",
    actionRequiredDeadline: actionDeadline ? new Date(actionDeadline) : null,
    isTasklertMail: true,
    isRead: true,
    isStarred: false,
    hasAttachment: formattedAttachments.length > 0,
    attachments: formattedAttachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType || "application/octet-stream",
      size: a.content?.length || 0,
    })),
    providerMessageId: sentResult?.messageId || `tasklert_${Date.now()}`,
    date: new Date(),
  });

  return {
    success: true,
    message: "Email sent successfully via Tasklert Mail.",
    messageId: savedMessage.providerMessageId,
    savedMessage,
  };
};
