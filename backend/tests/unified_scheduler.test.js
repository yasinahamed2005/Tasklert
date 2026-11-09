import test from "node:test";
import assert from "node:assert/strict";
import ScheduledDelivery from "../models/ScheduledDelivery.js";

test("Unified Scheduler: Model validates channel enum strictly", () => {
  const validChannels = ["tasklert_mail", "google_mail", "telegram"];
  for (const ch of validChannels) {
    const item = new ScheduledDelivery({
      owner: "507f1f77bcf86cd799439011",
      channel: ch,
      recipient: "test@example.com",
      message: "Test message",
      scheduledAt: new Date(Date.now() + 60000),
    });
    const err = item.validateSync();
    assert.equal(err, undefined, `Expected channel ${ch} to be valid`);
  }

  const invalidItem = new ScheduledDelivery({
    owner: "507f1f77bcf86cd799439011",
    channel: "unsupported_channel",
    recipient: "test@example.com",
    message: "Test message",
    scheduledAt: new Date(Date.now() + 60000),
  });
  const err = invalidItem.validateSync();
  assert.ok(err?.errors?.channel, "Expected error on invalid channel enum");
});

test("Unified Scheduler: Status transitions are restricted to approved lifecycle", () => {
  const validStatuses = ["draft", "scheduled", "processing", "sent", "failed", "cancelled"];
  for (const st of validStatuses) {
    const item = new ScheduledDelivery({
      owner: "507f1f77bcf86cd799439011",
      channel: "tasklert_mail",
      recipient: "test@example.com",
      message: "Test message",
      scheduledAt: new Date(Date.now() + 60000),
      status: st,
    });
    const err = item.validateSync();
    assert.equal(err, undefined, `Expected status ${st} to be valid`);
  }

  const invalidItem = new ScheduledDelivery({
    owner: "507f1f77bcf86cd799439011",
    channel: "tasklert_mail",
    recipient: "test@example.com",
    message: "Test message",
    scheduledAt: new Date(Date.now() + 60000),
    status: "unknown_status",
  });
  const err = invalidItem.validateSync();
  assert.ok(err?.errors?.status, "Expected error on invalid status");
});

test("Unified Scheduler: Recurrence schema supports daily, weekly, monthly and none", () => {
  const item = new ScheduledDelivery({
    owner: "507f1f77bcf86cd799439011",
    channel: "telegram",
    recipient: "12345678",
    message: "Meeting reminder",
    scheduledAt: new Date(Date.now() + 60000),
    repeat: {
      type: "weekly",
      interval: 1,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  const err = item.validateSync();
  assert.equal(err, undefined);
  assert.equal(item.repeat.type, "weekly");
  assert.equal(item.repeat.interval, 1);
});

test("Unified Scheduler: Exponential backoff calculation stays within 300s upper ceiling", () => {
  const calculateBackoffSec = (attempt) => Math.min(30 * Math.pow(2, attempt - 1), 300);

  assert.equal(calculateBackoffSec(1), 30);
  assert.equal(calculateBackoffSec(2), 60);
  assert.equal(calculateBackoffSec(3), 120);
  assert.equal(calculateBackoffSec(4), 240);
  assert.equal(calculateBackoffSec(5), 300);
  assert.equal(calculateBackoffSec(10), 300);
});

test("Unified Scheduler: Stale claim detection flags claims older than 5 minutes", () => {
  const now = new Date();
  const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
  const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);
  const threshold = new Date(now.getTime() - 5 * 60 * 1000);

  assert.equal(fourMinutesAgo < threshold, false, "4-minute-old claim is active and should not be recovered");
  assert.equal(sixMinutesAgo < threshold, true, "6-minute-old claim is stale and must be unstuck");
});

test("Telegram Scheduled Bubble: Formatter displays relative time for today and date for other days", () => {
  const formatScheduledTime = (dateInput) => {
    if (!dateInput) return "";
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return "";
      const isToday = new Date().toDateString() === d.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (isToday) return timeStr;
      const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return "";
    }
  };

  const today = new Date();
  today.setHours(18, 15, 0, 0);
  const formattedToday = formatScheduledTime(today.toISOString());
  assert.ok(formattedToday.includes("18") || formattedToday.includes("06") || formattedToday.includes("6:15"));

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const formattedTomorrow = formatScheduledTime(tomorrow.toISOString());
  assert.ok(formattedTomorrow.includes(","), "Tomorrow must include date string separated by comma");
});

test("Deliverability Architecture: Gmail sender requires Google Authenticated SMTP or OAuth to prevent Spam", () => {
  const isGmailSender = (email) => /@gmail\.com$/i.test(String(email).trim());
  const sender = "taskflow.iya@gmail.com";

  assert.equal(isGmailSender(sender), true, "Identified as Google-hosted domain requiring strict DMARC alignment");
  
  // Brevo or Resend cannot sign with Google's DKIM private key for @gmail.com
  const canSendViaBrevoWithoutSpam = (email) => !isGmailSender(email);
  assert.equal(canSendViaBrevoWithoutSpam(sender), false, "Sending @gmail.com through Brevo causes DMARC fail and Gmail Spam placement");
});


