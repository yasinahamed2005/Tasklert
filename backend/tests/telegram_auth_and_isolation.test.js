import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhoneNumber } from "../services/telegram/telegramAuth.service.js";
import {
  encryptSession,
  decryptSession,
} from "../services/telegram/telegramSession.service.js";
import { getTelegramConfig } from "../services/telegram/telegramConfig.js";
import TelegramConnection from "../models/TelegramConnection.js";

test("Telegram MTProto: Phone number normalization and validation", () => {
  // Standard international formats
  assert.equal(normalizePhoneNumber("+1 (415) 555-2671"), "+14155552671");
  assert.equal(normalizePhoneNumber("+91 98765 43210"), "+919876543210");
  assert.equal(normalizePhoneNumber("447911123456"), "+447911123456");
  assert.equal(normalizePhoneNumber("+49-30-1234567"), "+49301234567");

  // Invalid formats
  assert.throws(() => normalizePhoneNumber(""), /Phone number is required/);
  assert.throws(() => normalizePhoneNumber("123"), /valid phone number with country code/);
  assert.throws(() => normalizePhoneNumber("abc-def-ghij"), /valid phone number with country code/);
});

test("Telegram MTProto: AES-256-GCM Session Encryption and Decryption", () => {
  const dummySession = "1BJWap8kBAAAAACuB0l_V2P68oA4...";
  const encrypted = encryptSession(dummySession);

  // Verification of encryption format
  assert.ok(encrypted.startsWith("enc:"), "Encrypted session must use enc: prefix");
  const parts = encrypted.split(":");
  assert.equal(parts.length, 4, "Must contain enc, IV, Auth Tag, and Ciphertext");

  // Verification of decryption
  const decrypted = decryptSession(encrypted);
  assert.equal(decrypted, dummySession, "Decrypted session must match original plaintext exactly");

  // Integrity validation: tampered ciphertext must fail safely
  const tamperedCipher = `enc:${parts[1]}:${parts[2]}:ff00ff00`;
  const failedDecrypt = decryptSession(tamperedCipher);
  assert.equal(failedDecrypt, "", "Tampered session must fail to decrypt and return empty string");

  // Tampered tag must fail safely
  const badTagCipher = `enc:${parts[1]}:00000000000000000000000000000000:${parts[3]}`;
  const badTagDecrypt = decryptSession(badTagCipher);
  assert.equal(badTagDecrypt, "", "Tampered authentication tag must return empty string");
});

test("Telegram MTProto: Multi-User Session Isolation", () => {
  const userASession = "session_token_for_user_A_999";
  const userBSession = "session_token_for_user_B_888";

  const encA = encryptSession(userASession);
  const encB = encryptSession(userBSession);

  // Ensure different sessions have distinct IVs and ciphertexts
  assert.notEqual(encA, encB);

  // Simulate two user records
  const userARecord = {
    owner: "user_id_A",
    encryptedSession: encA,
    phoneNumber: "+14155550001",
    status: "connected",
  };

  const userBRecord = {
    owner: "user_id_B",
    encryptedSession: encB,
    phoneNumber: "+14155550002",
    status: "connected",
  };

  // User A can only decrypt session A
  assert.equal(decryptSession(userARecord.encryptedSession), userASession);
  assert.notEqual(decryptSession(userARecord.encryptedSession), userBSession);

  // User B can only decrypt session B
  assert.equal(decryptSession(userBRecord.encryptedSession), userBSession);
  assert.notEqual(decryptSession(userBRecord.encryptedSession), userASession);
});

test("Telegram MTProto: Security - Safe Object serialization never leaks sensitive session", () => {
  const connection = new TelegramConnection({
    owner: "507f1f77bcf86cd799439011",
    telegramId: "123456789",
    phoneNumber: "+14155552671",
    firstName: "Test",
    lastName: "User",
    username: "test_telegram_user",
    encryptedSession: "enc:iv:tag:secret_ciphertext_here",
    status: "connected",
    is2FA: false,
  });

  const safe = connection.toSafeObject();

  assert.equal(safe.encryptedSession, undefined, "toSafeObject must never include encryptedSession");
  assert.equal(safe.username, "test_telegram_user");
  assert.equal(safe.phoneNumber, "+14155552671");
  assert.equal(safe.status, "connected");
});

test("Telegram MTProto: Server Configuration Reader", () => {
  const prevId = process.env.TELEGRAM_API_ID;
  const prevHash = process.env.TELEGRAM_API_HASH;

  try {
    process.env.TELEGRAM_API_ID = "123456";
    process.env.TELEGRAM_API_HASH = "0123456789abcdef0123456789abcdef";

    const config = getTelegramConfig();
    assert.equal(config.apiId, 123456);
    assert.equal(config.apiHash, "0123456789abcdef0123456789abcdef");
    assert.equal(config.isConfigured, true);

    process.env.TELEGRAM_API_ID = "";
    process.env.TELEGRAM_API_HASH = "";
    const unconfig = getTelegramConfig();
    assert.equal(unconfig.isConfigured, false);
  } finally {
    process.env.TELEGRAM_API_ID = prevId;
    process.env.TELEGRAM_API_HASH = prevHash;
  }
});
