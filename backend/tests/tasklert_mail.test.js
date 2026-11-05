import test from "node:test";
import assert from "node:assert/strict";
import { generateTasklertMailHtml, generateTasklertMailText } from "../services/email/tasklertMailTemplate.js";

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
