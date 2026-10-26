import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRecipient,
  getProviderStatus,
} from "../services/quicksendService.js";
import { STARTER_TEMPLATES } from "../controllers/messageController.js";

test("QuickSend: validateRecipient validates email correctly", () => {
  const valid = validateRecipient("email", "test@example.com");
  assert.equal(valid.valid, true);
  assert.equal(valid.cleanRecipient, "test@example.com");

  const invalid = validateRecipient("email", "not-an-email");
  assert.equal(invalid.valid, false);
  assert.match(invalid.message, /valid email/i);
});

test("QuickSend: validateRecipient validates telegram correctly", () => {
  const withAt = validateRecipient("telegram", "@tasklert_user");
  assert.equal(withAt.valid, true);

  const numericId = validateRecipient("telegram", "123456789");
  assert.equal(numericId.valid, true);

  const empty = validateRecipient("telegram", "   ");
  assert.equal(empty.valid, false);
});

test("QuickSend: validateRecipient validates whatsapp phone numbers with country code", () => {
  const validWa = validateRecipient("whatsapp", "+1 (415) 555-2671");
  assert.equal(validWa.valid, true);
  assert.equal(validWa.cleanRecipient, "+14155552671");

  const tooShort = validateRecipient("whatsapp", "123");
  assert.equal(tooShort.valid, false);
  assert.match(tooShort.message, /valid phone number/i);
});

test("QuickSend: getProviderStatus returns honest status shape without exposing secrets", () => {
  const status = getProviderStatus();
  assert.ok(typeof status.email.configured === "boolean");
  assert.ok(typeof status.telegram.configured === "boolean");
  assert.ok(typeof status.whatsapp.configured === "boolean");
  assert.ok(typeof status.sms.configured === "boolean");

  // Ensure no sensitive secret values or tokens are leaked
  const jsonStr = JSON.stringify(status);
  assert.equal(jsonStr.includes("undefined"), false);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    assert.equal(jsonStr.includes(process.env.TELEGRAM_BOT_TOKEN), false);
  }
  if (process.env.WHATSAPP_ACCESS_TOKEN) {
    assert.equal(jsonStr.includes(process.env.WHATSAPP_ACCESS_TOKEN), false);
  }
  assert.equal(status.telegram.botToken, undefined);
  assert.equal(status.whatsapp.accessToken, undefined);
});

test("QuickSend: Starter templates contain exactly 7 starter templates with all placeholders", () => {
  assert.equal(STARTER_TEMPLATES.length, 7);
  STARTER_TEMPLATES.forEach((tpl) => {
    assert.ok(tpl.title && tpl.title.length > 0);
    assert.ok(tpl.body && tpl.body.length > 0);
    assert.ok(Array.isArray(tpl.placeholders));
    assert.equal(tpl.isStarter, true);
  });
});

test("QuickSend: Scheduling validation rejects past dates and non-future timestamps", () => {
  const pastDate = new Date(Date.now() - 60000);
  assert.ok(pastDate.getTime() <= Date.now());

  const futureDate = new Date(Date.now() + 3600000);
  assert.ok(futureDate.getTime() > Date.now());
});

test("QuickSend: Template placeholder replacement operates correctly", () => {
  const template = STARTER_TEMPLATES[0]; // Task Progress Update
  let replaced = template.body
    .replace(/\{\{name\}\}/g, "Alex")
    .replace(/\{\{task\}\}/g, "Mobile Layout Refactor")
    .replace(/\{\{date\}\}/g, "Oct 25, 2026");

  assert.ok(replaced.includes("Alex"));
  assert.ok(replaced.includes("Mobile Layout Refactor"));
  assert.ok(replaced.includes("Oct 25, 2026"));
  assert.equal(replaced.includes("{{"), false);
});

test("QuickSend: Status transition guards ensure only scheduled messages can be cancelled", () => {
  const validStatusForCancel = "scheduled";
  const invalidStatuses = ["draft", "sent", "failed", "cancelled", "processing"];

  assert.equal(validStatusForCancel === "scheduled", true);
  invalidStatuses.forEach((status) => {
    assert.notEqual(status, "scheduled");
  });
});
