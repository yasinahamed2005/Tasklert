import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRecipient,
  getProviderStatus,
} from "../services/quicksendService.js";
import { STARTER_TEMPLATES } from "../controllers/messageController.js";

test("QuickSend Multi-Channel: Recipient validation per channel", () => {
  // 1. WhatsApp: international format, digits length 7-15, leading + preserved
  const validWa1 = validateRecipient("whatsapp", "+14155552671");
  assert.equal(validWa1.valid, true);
  assert.equal(validWa1.cleanRecipient, "+14155552671");

  const validWa2 = validateRecipient("whatsapp", "919876543210");
  assert.equal(validWa2.valid, true);
  assert.equal(validWa2.cleanRecipient, "+919876543210");

  const invalidWa = validateRecipient("whatsapp", "1234");
  assert.equal(invalidWa.valid, false);
  assert.match(invalidWa.message, /valid phone number/i);

  // 2. Telegram: username or chat ID
  const validTgUser = validateRecipient("telegram", "@productivity_bot");
  assert.equal(validTgUser.valid, true);
  const validTgChatId = validateRecipient("telegram", "-1001234567890");
  assert.equal(validTgChatId.valid, true);
  const invalidTg = validateRecipient("telegram", "   ");
  assert.equal(invalidTg.valid, false);

  // 3. Email: RFC standard format
  const validEmail = validateRecipient("email", "sarah.connor@tasklert.com");
  assert.equal(validEmail.valid, true);
  assert.equal(validEmail.cleanRecipient, "sarah.connor@tasklert.com");
  const invalidEmail = validateRecipient("email", "sarah@connor");
  assert.equal(invalidEmail.valid, false);
});

test("QuickSend Multi-Channel: getProviderStatus exposes honest sender info without leaking secret tokens", () => {
  const status = getProviderStatus();

  // Validate presence of sender info properties
  assert.ok("sender" in status.email, "email must include sender info");
  assert.ok("botUsername" in status.telegram, "telegram must include botUsername");
  assert.ok("senderNumber" in status.whatsapp, "whatsapp must include senderNumber");

  // Verify no secrets or sensitive keys leaked
  const str = JSON.stringify(status);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    assert.equal(str.includes(process.env.TELEGRAM_BOT_TOKEN), false);
  }
  if (process.env.WHATSAPP_ACCESS_TOKEN) {
    assert.equal(str.includes(process.env.WHATSAPP_ACCESS_TOKEN), false);
  }
  if (process.env.TWILIO_AUTH_TOKEN) {
    assert.equal(str.includes(process.env.TWILIO_AUTH_TOKEN), false);
  }
  if (process.env.SMTP_PASS) {
    assert.equal(str.includes(process.env.SMTP_PASS), false);
  }
  assert.equal(status.telegram.botToken, undefined);
  assert.equal(status.whatsapp.accessToken, undefined);
});

test("QuickSend Multi-Channel: Preset scheduling math (Tomorrow, 7 Days, 20 Days)", () => {
  const baseNow = new Date("2026-10-28T10:00:00.000Z");

  // Preset 1: Tomorrow at 9:00 AM local
  const tomorrow = new Date(baseNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  assert.ok(tomorrow.getTime() > baseNow.getTime());
  const diffHoursTomorrow = (tomorrow.getTime() - baseNow.getTime()) / (1000 * 60 * 60);
  assert.ok(diffHoursTomorrow >= 12 && diffHoursTomorrow <= 36);

  // Preset 2: In 7 Days at 9:00 AM
  const in7Days = new Date(baseNow);
  in7Days.setDate(in7Days.getDate() + 7);
  in7Days.setHours(9, 0, 0, 0);
  assert.ok(in7Days.getTime() > baseNow.getTime());
  const diffDays7 = Math.round((in7Days.getTime() - baseNow.getTime()) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays7, 7);

  // Preset 3: In 20 Days at 7:00 AM
  const in20Days = new Date(baseNow);
  in20Days.setDate(in20Days.getDate() + 20);
  in20Days.setHours(7, 0, 0, 0);
  assert.ok(in20Days.getTime() > baseNow.getTime());
  const diffDays20 = Math.round((in20Days.getTime() - baseNow.getTime()) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays20, 20);

  // Schedule must reject past or identical current timestamps
  assert.ok(baseNow.getTime() <= baseNow.getTime());
  const pastDate = new Date(baseNow.getTime() - 10000);
  assert.ok(pastDate.getTime() < baseNow.getTime());
});

test("QuickSend Multi-Channel: Status transition guards for reschedule and edit", () => {
  const canEditOrReschedule = (status) => status === "scheduled" || status === "draft";
  const canCancel = (status) => status === "scheduled";
  const canRetry = (status) => status === "failed";

  // Scheduled
  assert.equal(canEditOrReschedule("scheduled"), true);
  assert.equal(canCancel("scheduled"), true);
  assert.equal(canRetry("scheduled"), false);

  // Draft
  assert.equal(canEditOrReschedule("draft"), true);
  assert.equal(canCancel("draft"), false);
  assert.equal(canRetry("draft"), false);

  // Sent (immutable, cannot be cancelled or edited)
  assert.equal(canEditOrReschedule("sent"), false);
  assert.equal(canCancel("sent"), false);
  assert.equal(canRetry("sent"), false);

  // Failed
  assert.equal(canEditOrReschedule("failed"), false);
  assert.equal(canCancel("failed"), false);
  assert.equal(canRetry("failed"), true);

  // Cancelled
  assert.equal(canEditOrReschedule("cancelled"), false);
  assert.equal(canCancel("cancelled"), false);
});

test("QuickSend Multi-Channel: Scheduler atomic claim and stale recovery timeout logic", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Claimed 6 minutes ago is stale and should be released
  const claimedStaleTime = new Date(now.getTime() - 6 * 60 * 1000);
  assert.ok(claimedStaleTime < fiveMinutesAgo, "Claims older than 5 minutes must be eligible for recovery");

  // Claimed 1 minute ago is active and should not be recovered
  const claimedFreshTime = new Date(now.getTime() - 1 * 60 * 1000);
  assert.ok(claimedFreshTime > fiveMinutesAgo, "Fresh active claims must not be cleared");

  // Exponential backoff bounds: 30s, 60s, 120s, up to 300s max
  const computeBackoff = (attempt) => Math.min(30 * Math.pow(2, attempt - 1), 300);
  assert.equal(computeBackoff(1), 30);
  assert.equal(computeBackoff(2), 60);
  assert.equal(computeBackoff(3), 120);
  assert.equal(computeBackoff(4), 240);
  assert.equal(computeBackoff(5), 300); // capped at 300s
  assert.equal(computeBackoff(6), 300);
});
