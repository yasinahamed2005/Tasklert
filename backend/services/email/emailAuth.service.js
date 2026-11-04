import nodemailer from "nodemailer";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import EmailAccount from "../../models/EmailAccount.js";
import { encryptCredential, decryptCredential } from "../../utils/crypto.js";
import { getJwtSecret } from "../../config/jwt.js";

// Minimum required scopes for genuine Gmail integration
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify", // Read, send, trash, star, mark read (excluding permanent delete)
  "https://www.googleapis.com/auth/userinfo.email", // Retrieve user's verified Gmail address
  "https://www.googleapis.com/auth/userinfo.profile", // Retrieve user's display name
];

/**
 * Generate PKCE pair: verifier and SHA256 challenge (base64url)
 */
export const generatePkcePair = () => {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

/**
 * Get all connected email accounts for a user
 */
export const getUserEmailAccounts = async (userId) => {
  if (!userId) return [];
  const accounts = await EmailAccount.find({
    owner: userId,
    status: { $ne: "disconnected" },
  }).sort({ isDefault: -1, createdAt: -1 });

  return accounts.map((acc) => acc.toSafeObject());
};

/**
 * Generate Google OAuth 2.0 URL with PKCE for user to authorize Gmail API
 */
export const getGoogleAuthUrl = (userId, hostUrl = "") => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const rawBase =
    process.env.BACKEND_URL || hostUrl || "http://localhost:5000";
  const backendBase = rawBase.trim().replace(/\/+$/, "");
  const redirectUri = `${backendBase}/api/email/auth/gmail/callback`;

  if (!clientId) {
    return {
      success: false,
      configured: false,
      message:
        "Google OAuth is not configured on this server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env, or use the App Password / SMTP option.",
    };
  }

  // Generate PKCE pair
  const { verifier, challenge } = generatePkcePair();

  // Cryptographically sign state token with 30-minute validity
  const state = jwt.sign(
    {
      userId: String(userId),
      verifier,
      redirectUri,
      purpose: "gmail_oauth_connect",
      createdAt: Date.now(),
    },
    getJwtSecret(),
    { expiresIn: "30m" }
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return { success: true, configured: true, url, redirectUri };
};

/**
 * Exchange Google OAuth 2.0 authorization code with PKCE verification and persist encrypted credentials
 */
export const exchangeGoogleAuthCode = async (code, state, hostUrl = "") => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const rawBase =
    process.env.BACKEND_URL || hostUrl || "http://localhost:5000";
  const backendBase = rawBase.trim().replace(/\/+$/, "");
  const fallbackRedirectUri = `${backendBase}/api/email/auth/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured on this server.");
  }

  // 1. Validate state JWT and extract PKCE verifier and redirectUri
  let decoded;
  try {
    decoded = jwt.verify(state, getJwtSecret());
  } catch (err) {
    console.error("[Gmail OAuth State Verification Error]", err.name, err.message);
    if (err.name === "TokenExpiredError") {
      throw new Error("Authorization session timed out. Please click 'Connect with Google' again.");
    }
    throw new Error(`OAuth state validation failed: ${err.message}. Please try connecting again.`);
  }

  if (decoded.purpose !== "gmail_oauth_connect" || !decoded.userId || !decoded.verifier) {
    throw new Error("Malformed OAuth state token.");
  }

  const userId = decoded.userId;
  const codeVerifier = decoded.verifier;
  const redirectUri = decoded.redirectUri || fallbackRedirectUri;

  // 2. Exchange authorization code + code_verifier for tokens
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok || tokens.error) {
    const errorDesc = tokens.error_description || tokens.error || "Token exchange failed.";
    throw new Error(`Google authorization exchange failed: ${errorDesc}`);
  }

  // 3. Fetch verified user identity from Google UserInfo
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    throw new Error("Failed to retrieve Google user profile information.");
  }

  const userInfo = await userInfoRes.json();
  const verifiedEmail = (userInfo.email || "").toLowerCase().trim();
  if (!verifiedEmail) {
    throw new Error("No verified email address returned from Google.");
  }

  // 4. Encrypt tokens with AES-256-GCM
  const encryptedAccessToken = encryptCredential(tokens.access_token);
  const tokenExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000);

  // 5. Look for existing account to preserve refresh token if Google didn't reissue one
  const existingAccount = await EmailAccount.findOne({
    owner: userId,
    email: verifiedEmail,
  });

  let encryptedRefreshToken = tokens.refresh_token
    ? encryptCredential(tokens.refresh_token)
    : existingAccount?.credentials?.refreshToken || "";

  if (!encryptedRefreshToken) {
    console.warn("[Gmail OAuth] Warning: No refresh token returned. Ensure prompt=consent is used.");
  }

  // 6. Upsert into EmailAccount for this user
  const account = await EmailAccount.findOneAndUpdate(
    { owner: userId, email: verifiedEmail },
    {
      owner: userId,
      email: verifiedEmail,
      displayName: userInfo.name || verifiedEmail,
      provider: "gmail",
      status: "connected",
      credentials: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        scope: tokens.scope || GMAIL_SCOPES.join(" "),
      },
      lastSyncAt: new Date(),
      lastError: null,
      isDefault: true,
    },
    { upsert: true, new: true }
  );

  return {
    success: true,
    email: verifiedEmail,
    displayName: userInfo.name || verifiedEmail,
    account: account.toSafeObject(),
  };
};

/**
 * Get a valid, fresh Gmail access token (auto-refreshes if close to expiration)
 */
export const getFreshGmailAccessToken = async (account) => {
  if (!account || account.provider !== "gmail") {
    throw new Error("Invalid Gmail account.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const expiresAt = account.credentials?.tokenExpiresAt
    ? new Date(account.credentials.tokenExpiresAt).getTime()
    : 0;

  // If token is valid for more than 2 minutes, return existing access token
  if (expiresAt - Date.now() > 2 * 60 * 1000 && account.credentials?.accessToken) {
    const token = decryptCredential(account.credentials.accessToken);
    if (token) return token;
  }

  // Need refresh: Decrypt refresh token
  const refreshToken = decryptCredential(account.credentials?.refreshToken);
  if (!refreshToken) {
    account.status = "expired";
    await account.save();
    throw new Error("Gmail authorization expired. Please reconnect your account.");
  }

  // Request new access token from Google
  const refreshParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });

  const refreshData = await refreshRes.json();

  if (!refreshRes.ok || refreshData.error) {
    // If revoked by user from Google account
    if (refreshData.error === "invalid_grant") {
      account.status = "revoked";
      account.lastError = "Google access revoked by user.";
      await account.save();
      throw new Error("Gmail access was revoked. Please reconnect your account.");
    }
    throw new Error(`Failed to refresh Gmail access token: ${refreshData.error_description || refreshData.error}`);
  }

  // Update account with fresh access token
  account.credentials.accessToken = encryptCredential(refreshData.access_token);
  account.credentials.tokenExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);
  account.status = "connected";
  account.lastError = null;
  await account.save();

  return refreshData.access_token;
};

/**
 * Generate Microsoft OAuth URL for user to authorize Outlook / Microsoft 365
 */
export const getMicrosoftAuthUrl = (userId, hostUrl = "") => {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const backendBase =
    process.env.BACKEND_URL || hostUrl || "http://localhost:5000";
  const redirectUri = `${backendBase}/api/email/auth/outlook/callback`;

  if (!clientId) {
    return {
      success: false,
      configured: false,
      message:
        "Microsoft OAuth is not configured on this server. Please add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to environment variables, or use IMAP/SMTP connection.",
    };
  }

  const scopes = [
    "openid",
    "profile",
    "offline_access",
    "Mail.ReadWrite",
    "Mail.Send",
    "User.Read",
  ].join(" ");

  const state = Buffer.from(
    JSON.stringify({ userId: String(userId), time: Date.now() })
  ).toString("base64");

  const url =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_mode=query&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=${encodeURIComponent(state)}`;

  return { success: true, configured: true, url };
};

/**
 * Test and connect a custom SMTP / IMAP email account
 */
export const connectSmtpAccount = async (userId, config) => {
  if (!userId) throw new Error("Authenticated user required.");

  const {
    host,
    port = 587,
    user,
    pass,
    from,
    imapHost = "",
    imapPort = 993,
  } = config;

  if (!host || !user || !pass) {
    throw new Error("SMTP host, username, and password are required.");
  }

  const cleanUser = user.trim().toLowerCase();
  const numPort = Number(port) || 587;
  const isSecure = numPort === 465;

  // 1. Verify SMTP connection directly with provider
  const transporter = nodemailer.createTransport({
    host: host.trim(),
    port: numPort,
    secure: isSecure,
    auth: {
      user: cleanUser,
      pass: pass.trim(),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.verify();
  } catch (err) {
    throw new Error(`SMTP authentication failed: ${err.message}`);
  }

  // 2. Encrypt sensitive credentials with AES-256-GCM
  const encryptedPass = encryptCredential(pass.trim());

  // 3. Upsert into database
  const account = await EmailAccount.findOneAndUpdate(
    { owner: userId, email: cleanUser },
    {
      owner: userId,
      email: cleanUser,
      displayName: from?.trim() || cleanUser,
      provider: "smtp",
      status: "connected",
      credentials: {
        smtpHost: host.trim(),
        smtpPort: numPort,
        smtpUser: cleanUser,
        smtpPass: encryptedPass,
        smtpFrom: from?.trim() || cleanUser,
        imapHost: imapHost?.trim() || "",
        imapPort: Number(imapPort) || 993,
      },
      lastSyncAt: new Date(),
      lastError: null,
      isDefault: true,
    },
    { upsert: true, new: true }
  );

  return account.toSafeObject();
};

/**
 * Disconnect an email account and revoke Google OAuth tokens where applicable
 */
export const disconnectEmailAccount = async (userId, accountId) => {
  if (!userId) throw new Error("Authenticated user required.");

  const account = await EmailAccount.findOne({ _id: accountId, owner: userId });

  if (!account) {
    throw new Error("Email account not found or unauthorized.");
  }

  // If Gmail account, attempt to revoke token with Google
  if (account.provider === "gmail" && account.credentials?.refreshToken) {
    try {
      const rawRefreshToken = decryptCredential(account.credentials.refreshToken);
      if (rawRefreshToken) {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rawRefreshToken)}`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );
      }
    } catch (revokeErr) {
      console.warn("[Gmail Revoke] Token revocation notice:", revokeErr.message);
    }
  }

  account.status = "disconnected";
  account.credentials.accessToken = "";
  account.credentials.refreshToken = "";
  account.isDefault = false;
  await account.save();

  return { success: true, message: "Account disconnected and access revoked successfully." };
};

