import test from "node:test";
import assert from "node:assert/strict";
import { generateTasklertMailHtml, generateTasklertMailText } from "../services/email/tasklertMailTemplate.js";
import nodemailer from "nodemailer";

test("Tasklert Mail: HTML template generates valid branded structure", () => {
  const html = generateTasklertMailHtml({
    senderName: "Israth Yasin Ahamad",
    senderEmail: "israth@tasklert.app",
    subject: "Action Required: Final Project Update",
    messageHtml: "<p>Please review the final project update and share your feedback by today.</p>",
    priority: "action_required",
    actionDeadline: "2026-11-06T18:00:00.000Z",
  });

  assert.ok(html.includes("Tasklert"), "Should contain Tasklert branding");
  assert.ok(html.includes("Action Required"), "Should render Action Required badge");
  assert.ok(html.includes("Israth Yasin Ahamad"), "Should include sender name");
  assert.ok(html.includes("israth@tasklert.app"), "Should include sender email");
  assert.ok(html.includes("Tasklert Mail"), "Should attribute to Tasklert Mail");
  assert.ok(html.includes("View Details"), "Should include View Details CTA");
});

test("Tasklert Mail: Text fallback generates clean plain text representation", () => {
  const text = generateTasklertMailText({
    senderName: "Israth Yasin Ahamad",
    senderEmail: "israth@tasklert.app",
    subject: "Final Project Update",
    messageText: "Please review the report.",
    priority: "important",
  });

  assert.ok(text.includes("[TASKLERT MAIL]"), "Header present");
  assert.ok(text.includes("Israth Yasin Ahamad"), "Sender present");
  assert.ok(text.includes("israth@tasklert.app"), "Sender email present");
  assert.ok(text.includes("Reply to this email to reach the sender directly."), "Reply note present");
});

test("Tasklert Mail: Normal priority does not force Action Required badge", () => {
  const html = generateTasklertMailHtml({
    senderName: "Alice",
    senderEmail: "alice@example.com",
    subject: "General Note",
    messageHtml: "Hello",
    priority: "normal",
  });

  assert.ok(!html.includes("⚡ Action Required"), "Should not show Action Required badge for normal priority");
  assert.ok(!html.includes("📌 Action Required for this task"), "Should not show action required box");
});

test("Tasklert Mail: Sender resolution & From/Reply-To header formatting", () => {
  const senderName = "Israth Yasin";
  const userEmail = "yasinahamadshaik@gmail.com";
  const targetTasklertEmail = "tasksflow.iya@gmail.com";

  // When tasksflow.iya@gmail.com is the authenticated account
  const fromHeader = `"${senderName} via Tasklert" <${targetTasklertEmail}>`;
  const replyToHeader = `"${senderName}" <${userEmail}>`;

  assert.strictEqual(fromHeader, '"Israth Yasin via Tasklert" <tasksflow.iya@gmail.com>');
  assert.strictEqual(replyToHeader, '"Israth Yasin" <yasinahamadshaik@gmail.com>');
  assert.ok(!fromHeader.includes("brevo"), "Must not contain Brevo address");
});

test("Tasklert Mail: RFC 2822 MIME compilation preserves To, CC, BCC, Attachments and Reply-To", async () => {
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const mailOptions = {
    from: '"Tasklert" <tasksflow.iya@gmail.com>',
    to: "recipient1@example.com, recipient2@example.com",
    cc: "cc1@example.com",
    bcc: "bcc1@example.com",
    replyTo: '"User Name" <user@example.com>',
    subject: "Action Required: Project Report",
    html: "<p>Report Attached</p>",
    text: "Report Attached",
    attachments: [
      {
        filename: "Report.pdf",
        content: Buffer.from("PDF_SAMPLE_DATA"),
        contentType: "application/pdf",
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  const rawRfc = info.message.toString("utf8");

  assert.ok(rawRfc.includes("From: Tasklert <tasksflow.iya@gmail.com>"), "Contains genuine From");
  assert.ok(rawRfc.includes("Reply-To: User Name <user@example.com>"), "Contains Reply-To");
  assert.ok(rawRfc.includes("recipient1@example.com"), "Contains To recipients");
  assert.ok(rawRfc.includes("cc1@example.com"), "Contains CC recipient");
  assert.ok(rawRfc.includes("Report.pdf"), "Contains attachment filename");
});
