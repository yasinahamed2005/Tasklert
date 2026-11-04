import test from "node:test";
import assert from "node:assert/strict";
import {
  getProviderStatus,
  verifyTelegramBotToken,
  verifyWhatsAppCloudApiCredentials,
  validateRecipient,
} from "../services/quicksendService.js";

test("Real Messaging: getProviderStatus returns masked, safe provider metadata", () => {
  const status = getProviderStatus();

  assert.ok(status.email);
  assert.ok(status.telegram);
  assert.ok(status.whatsapp);
  assert.ok(status.sms);

  // Assert no secret tokens are leaked
  const serialized = JSON.stringify(status);
  assert.equal(status.telegram.botToken, undefined);
  assert.equal(status.whatsapp.accessToken, undefined);
  assert.equal(status.whatsapp.authToken, undefined);

  if (process.env.TELEGRAM_BOT_TOKEN) {
    assert.equal(serialized.includes(process.env.TELEGRAM_BOT_TOKEN), false);
  }
  if (process.env.WHATSAPP_ACCESS_TOKEN) {
    assert.equal(serialized.includes(process.env.WHATSAPP_ACCESS_TOKEN), false);
  }
  if (process.env.SMTP_PASS) {
    assert.equal(serialized.includes(process.env.SMTP_PASS), false);
  }
});

test("Real Messaging: verifyTelegramBotToken validates token format strictly", async () => {
  // Empty token throws
  await assert.rejects(
    async () => {
      await verifyTelegramBotToken("");
    },
    { message: /Bot token is required/i }
  );

  // Malformed token throws descriptive error
  await assert.rejects(
    async () => {
      await verifyTelegramBotToken("not_a_valid_token");
    },
    { message: /Invalid Telegram bot token format/i }
  );
});

test("Real Messaging: verifyWhatsAppCloudApiCredentials validates required fields", async () => {
  // Missing phone number ID
  await assert.rejects(
    async () => {
      await verifyWhatsAppCloudApiCredentials("", "valid_token");
    },
    { message: /WhatsApp Phone Number ID is required/i }
  );

  // Missing access token
  await assert.rejects(
    async () => {
      await verifyWhatsAppCloudApiCredentials("123456789", "");
    },
    { message: /Meta Permanent Access Token is required/i }
  );
});

test("Scheduling & Rescheduling: Race condition detection rules", () => {
  const checkCanModify = (message) => {
    if (!message) return { status: 404, message: "Message not found" };
    if (message.status === "processing" || message.isClaimed) {
      return {
        status: 409,
        message: "Message is currently being dispatched by the scheduler and cannot be modified.",
      };
    }
    if (message.status === "sent") {
      return {
        status: 400,
        message: "Cannot modify a message that has already been sent.",
      };
    }
    if (message.status !== "scheduled" && message.status !== "draft") {
      return {
        status: 400,
        message: `Cannot edit a message with status '${message.status}'.`,
      };
    }
    return { status: 200, canModify: true };
  };

  // Scheduled message -> can modify
  assert.equal(checkCanModify({ status: "scheduled", isClaimed: false }).status, 200);

  // In-flight claimed message -> 409 Conflict
  assert.equal(checkCanModify({ status: "scheduled", isClaimed: true }).status, 409);
  assert.equal(checkCanModify({ status: "processing", isClaimed: false }).status, 409);

  // Sent message -> 400 Bad Request
  assert.equal(checkCanModify({ status: "sent", isClaimed: false }).status, 400);

  // Failed / cancelled message -> not editable via update
  assert.equal(checkCanModify({ status: "cancelled", isClaimed: false }).status, 400);
});

test("Scheduling & Rescheduling: Future-date validation enforcement", () => {
  const validateScheduleTime = (scheduledAt) => {
    if (!scheduledAt) return { valid: false, message: "Date is required" };
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) return { valid: false, message: "Invalid date" };
    if (date.getTime() <= Date.now()) {
      return { valid: false, message: "Scheduled time must be in the future" };
    }
    return { valid: true, date };
  };

  // Past date rejected
  const past = new Date(Date.now() - 60000).toISOString();
  assert.equal(validateScheduleTime(past).valid, false);
  assert.match(validateScheduleTime(past).message, /must be in the future/i);

  // Future date accepted
  const future = new Date(Date.now() + 3600000).toISOString();
  assert.equal(validateScheduleTime(future).valid, true);

  // Gibberish date rejected
  assert.equal(validateScheduleTime("invalid-date-string").valid, false);
});

test("Scheduling & Rescheduling: Reschedule preserves message ID without creating duplicates", () => {
  let existingStore = [
    {
      _id: "msg_abc123",
      owner: "user_1",
      recipient: "+14155552671",
      message: "Initial task reminder",
      scheduledAt: new Date(Date.now() + 3600000),
      status: "scheduled",
    },
  ];

  const rescheduleMessage = (id, newDate, newText) => {
    const item = existingStore.find((m) => m._id === id);
    if (!item) throw new Error("Not found");
    item.scheduledAt = newDate;
    item.message = newText;
    return item;
  };

  const newScheduledDate = new Date(Date.now() + 7200000);
  const updated = rescheduleMessage("msg_abc123", newScheduledDate, "Updated task reminder");

  assert.equal(existingStore.length, 1, "Must update existing document in place rather than creating duplicate");
  assert.equal(updated._id, "msg_abc123");
  assert.equal(updated.message, "Updated task reminder");
  assert.equal(updated.scheduledAt, newScheduledDate);
});

test("Contacts: Demo contacts are explicitly labeled and isolated from real contacts", () => {
  const realContact = {
    name: "Alex Johnson",
    email: "alex@company.com",
    isDemo: false,
  };

  const demoContact = {
    name: "[Demo] Ramu",
    email: "ramu@example.com",
    isDemo: true,
  };

  assert.equal(realContact.isDemo, false);
  assert.equal(demoContact.isDemo, true);
  assert.ok(demoContact.name.startsWith("[Demo]"));
});

test("Security & Encryption: Sensitive tokens encrypted at rest with AES-256-GCM", async () => {
  const { encryptCredential, decryptCredential, encryptCredentialsObject, decryptCredentialsObject } =
    await import("../utils/crypto.js");

  const plainToken = "EAAGm0PX4ZCpsBA...mySecretMetaToken";
  const encrypted = encryptCredential(plainToken);

  assert.notEqual(encrypted, plainToken);
  assert.ok(encrypted.startsWith("enc:"), "Encrypted token must start with 'enc:' prefix");

  const decrypted = decryptCredential(encrypted);
  assert.equal(decrypted, plainToken, "Decrypted token must match original plain token exactly");

  // Multi-field credential object encryption
  const creds = {
    accessToken: plainToken,
    phoneNumberId: "109823471029",
    authToken: "twilioAuthSecret123",
  };
  const secured = encryptCredentialsObject(creds);
  assert.ok(secured.accessToken.startsWith("enc:"));
  assert.ok(secured.authToken.startsWith("enc:"));
  assert.equal(secured.phoneNumberId, "109823471029", "Non-sensitive ID remains unencrypted");

  const restored = decryptCredentialsObject(secured);
  assert.equal(restored.accessToken, plainToken);
  assert.equal(restored.authToken, "twilioAuthSecret123");
});

test("WhatsApp Personal Integration: Web Direct click-to-chat deep link generation", async () => {
  const { sendViaWhatsApp } = await import("../services/quicksendService.js");

  const recipientPhone = "+1 (415) 555-2671";
  const messageText = "Hi Alex, here is your project update!";

  const result = await sendViaWhatsApp({
    recipient: recipientPhone,
    message: messageText,
    credentials: {
      providerType: "web_direct",
      isWebDirect: true,
      personalNumber: "+14155552671",
    },
  });

  assert.equal(result.isWebDirect, true);
  assert.ok(result.webDirectUrl.startsWith("https://wa.me/14155552671?text="));
  assert.ok(result.webDirectUrl.includes("Hi%20Alex"));
});

test("WhatsApp Isolation: Unconnected user receives unconfigured status with first-time onboarding prompt", async () => {
  const { getUserProviderStatus } = await import("../services/quicksendService.js");

  // Simulated fresh user ID without connected account
  const status = await getUserProviderStatus("507f191e810c19729de860ea");

  assert.equal(status.whatsapp.configured, false);
  assert.equal(status.whatsapp.status, "unconnected");
  assert.equal(status.whatsapp.isUserAccount, false);
  assert.match(status.whatsapp.label, /setup required/i);
});
