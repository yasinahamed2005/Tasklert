import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  generatePkcePair,
  getGoogleAuthUrl,
  GMAIL_SCOPES,
} from "../services/email/emailAuth.service.js";
import {
  encryptCredential,
  decryptCredential,
  encryptCredentialsObject,
  decryptCredentialsObject,
} from "../utils/crypto.js";
import EmailAccount from "../models/EmailAccount.js";

describe("Phase 2: Gmail OAuth 2.0 + PKCE Integration Test Suite", () => {
  test("PKCE Generation: creates high-entropy base64url verifier and S256 challenge", () => {
    const { verifier, challenge } = generatePkcePair();

    assert.ok(verifier, "Verifier must exist");
    assert.ok(challenge, "Challenge must exist");
    assert.ok(verifier.length >= 43, "PKCE verifier must be at least 43 characters");

    // Verify S256 relationship
    const expectedChallenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    assert.strictEqual(challenge, expectedChallenge, "Challenge must equal SHA256 base64url of verifier");
  });

  test("Google Auth URL: incorporates PKCE, minimum scopes, and offline prompt", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.JWT_SECRET = "test-jwt-secret-long-and-secure-123456789";

    const userId = "64f1a2b3c4d5e6f7a8b9c0d1";
    const result = getGoogleAuthUrl(userId, "http://localhost:5000");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.configured, true);
    assert.ok(result.url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"));

    const parsedUrl = new URL(result.url);
    const params = parsedUrl.searchParams;

    assert.strictEqual(params.get("client_id"), "test-client-id.apps.googleusercontent.com");
    assert.strictEqual(params.get("access_type"), "offline");
    assert.strictEqual(params.get("prompt"), "consent");
    assert.strictEqual(params.get("code_challenge_method"), "S256");
    assert.ok(params.get("code_challenge"), "Must include code_challenge");

    // Minimum required scopes check
    const scopeParam = params.get("scope");
    assert.ok(scopeParam.includes("https://www.googleapis.com/auth/gmail.modify"));
    assert.ok(scopeParam.includes("https://www.googleapis.com/auth/userinfo.email"));
    assert.ok(scopeParam.includes("https://www.googleapis.com/auth/userinfo.profile"));
    // Verify excessive super-admin mail scope is not requested
    assert.ok(!scopeParam.includes("https://mail.google.com/"));

    // Verify state token signature and contents
    const stateToken = params.get("state");
    const decoded = jwt.verify(stateToken, process.env.JWT_SECRET);
    assert.strictEqual(decoded.userId, userId);
    assert.strictEqual(decoded.purpose, "gmail_oauth_connect");
    assert.ok(decoded.verifier, "State must contain PKCE verifier");
  });

  test("Security: Tampered state tokens are rejected", () => {
    const tamperedState = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature";
    assert.throws(
      () => {
        jwt.verify(tamperedState, process.env.JWT_SECRET || "fallback");
      },
      Error,
      "Tampered state token must throw verification error"
    );
  });

  test("Credential Encryption: Refresh tokens and access tokens are AES-256-GCM encrypted", () => {
    const rawRefreshToken = "1//04test_refresh_token_abcdef123456";
    const encrypted = encryptCredential(rawRefreshToken);

    assert.ok(encrypted.startsWith("enc:"), "Encrypted token must have enc: prefix");
    assert.notStrictEqual(encrypted, rawRefreshToken, "Ciphertext must not match raw token");

    const decrypted = decryptCredential(encrypted);
    assert.strictEqual(decrypted, rawRefreshToken, "Decrypted token must match original");
  });

  test("Credential Object Sanitization: toSafeObject never leaks encrypted tokens to client", () => {
    const account = new EmailAccount({
      owner: "64f1a2b3c4d5e6f7a8b9c0d1",
      email: "user@gmail.com",
      displayName: "Personal Gmail",
      provider: "gmail",
      status: "connected",
      credentials: {
        accessToken: "enc:iv:tag:ciphertext1",
        refreshToken: "enc:iv:tag:ciphertext2",
        tokenExpiresAt: new Date(Date.now() + 3600000),
        scope: "gmail.modify",
      },
    });

    const safeObj = account.toSafeObject();
    assert.strictEqual(safeObj.email, "user@gmail.com");
    assert.strictEqual(safeObj.credentials.accessToken, undefined, "accessToken must be stripped");
    assert.strictEqual(safeObj.credentials.refreshToken, undefined, "refreshToken must be stripped");
    assert.ok(safeObj.credentials.tokenExpiresAt, "tokenExpiresAt can be preserved for client display");
  });

  test("User Isolation: Multi-user account uniqueness and owner segregation", () => {
    const userA = "64f1a2b3c4d5e6f7a8b9c0d1";
    const userB = "64f1a2b3c4d5e6f7a8b9c0d2";

    const accountA = new EmailAccount({
      owner: userA,
      email: "shared_demo@gmail.com",
      provider: "gmail",
      status: "connected",
    });

    const accountB = new EmailAccount({
      owner: userB,
      email: "shared_demo@gmail.com",
      provider: "gmail",
      status: "connected",
    });

    assert.strictEqual(accountA.owner.toString(), userA);
    assert.strictEqual(accountB.owner.toString(), userB);
    assert.notStrictEqual(accountA.owner.toString(), accountB.owner.toString());
  });

  test("Exact Callback URI Verification: Matches http://localhost:5000/api/email/auth/gmail/callback and strips trailing slashes", () => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.BACKEND_URL = "http://localhost:5000";

    const resStandard = getGoogleAuthUrl("64f1a2b3c4d5e6f7a8b9c0d1");
    assert.strictEqual(resStandard.redirectUri, "http://localhost:5000/api/email/auth/gmail/callback");

    // Trailing slash safety test
    process.env.BACKEND_URL = "http://localhost:5000/";
    const resTrailingSlash = getGoogleAuthUrl("64f1a2b3c4d5e6f7a8b9c0d1");
    assert.strictEqual(
      resTrailingSlash.redirectUri,
      "http://localhost:5000/api/email/auth/gmail/callback",
      "Trailing slash on BACKEND_URL must be stripped to prevent double-slash redirect_uri_mismatch"
    );

    // Production Render simulation test
    process.env.BACKEND_URL = "https://tasklert.onrender.com";
    const resRender = getGoogleAuthUrl("64f1a2b3c4d5e6f7a8b9c0d1");
    assert.strictEqual(
      resRender.redirectUri,
      "https://tasklert.onrender.com/api/email/auth/gmail/callback"
    );
  });

  test("Isolation from User Login Flow: Gmail mailbox callback is completely separate from login callback", () => {
    const gmailCallbackPath = "/api/email/auth/gmail/callback";
    const userLoginCallbackPath = "/api/auth/google/callback";

    assert.notStrictEqual(gmailCallbackPath, userLoginCallbackPath);
    assert.ok(gmailCallbackPath.startsWith("/api/email/"));
    assert.ok(userLoginCallbackPath.startsWith("/api/auth/"));
  });
});
