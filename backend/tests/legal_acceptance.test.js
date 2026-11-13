import { test, describe } from "node:test";
import assert from "node:assert/strict";
import User from "../models/userModel.js";
import EmailOtp from "../models/emailOtpModel.js";

describe("Terms of Service & Privacy Policy Acceptance Suite", () => {
  test("User Schema: Contains legalAcceptance subdocument with versioning and timestamp", () => {
    const user = new User({
      name: "Alex Vance",
      email: "alex@example.com",
      password: "hashedPassword123",
      legalAcceptance: {
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: "1.0",
        privacyVersion: "1.0",
        acceptedAt: new Date("2026-11-12T00:00:00.000Z"),
      },
    });

    assert.strictEqual(user.legalAcceptance.termsAccepted, true);
    assert.strictEqual(user.legalAcceptance.privacyAccepted, true);
    assert.strictEqual(user.legalAcceptance.termsVersion, "1.0");
    assert.strictEqual(user.legalAcceptance.privacyVersion, "1.0");
    assert.ok(user.legalAcceptance.acceptedAt instanceof Date);
  });

  test("User Schema: Defaults legalAcceptance safely for backward-compatibility", () => {
    const user = new User({
      name: "Legacy User",
      email: "legacy@example.com",
      password: "hashedPassword123",
    });

    assert.strictEqual(user.legalAcceptance.termsAccepted, false);
    assert.strictEqual(user.legalAcceptance.privacyAccepted, false);
    assert.strictEqual(user.legalAcceptance.termsVersion, "1.0");
    assert.strictEqual(user.legalAcceptance.privacyVersion, "1.0");
  });

  test("EmailOtp Schema: Validates and persists terms acceptance fields", () => {
    const otp = new EmailOtp({
      email: "test@tasklert.com",
      codeHash: "hash123",
      name: "Test User",
      passwordHash: "passHash123",
      termsAccepted: true,
      termsVersion: "1.0",
      privacyVersion: "1.0",
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 600000),
    });

    assert.strictEqual(otp.termsAccepted, true);
    assert.strictEqual(otp.termsVersion, "1.0");
    assert.strictEqual(otp.privacyVersion, "1.0");
    assert.ok(otp.acceptedAt instanceof Date);
  });
});

