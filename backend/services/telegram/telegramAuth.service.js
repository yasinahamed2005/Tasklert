import { Api } from "telegram";
import { computeCheck } from "telegram/Password.js";
import { requireTelegramConfig } from "./telegramConfig.js";
import {
  createTelegramClientInstance,
  getClientForUser,
  setPendingAuth,
  getPendingAuth,
  clearPendingAuth,
  registerActiveClient,
  removeClientForUser,
} from "./telegramClient.service.js";
import {
  saveUserConnection,
  getUserConnection,
  removeUserConnection,
} from "./telegramSession.service.js";

/**
 * Normalize and sanitize phone number (removes spaces, hyphens, parentheses).
 */
export const normalizePhoneNumber = (rawPhone) => {
  if (!rawPhone || typeof rawPhone !== "string") {
    throw new Error("Phone number is required");
  }

  // Preserve leading '+' if present, strip all other non-digits
  const trimmed = rawPhone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length < 7 || digitsOnly.length > 16) {
    throw new Error("Please enter a valid phone number with country code (e.g. +14155552671 or +919876543210).");
  }

  return hasPlus ? `+${digitsOnly}` : `+${digitsOnly}`;
};

/**
 * Parse Telegram RPC error to friendly, descriptive human message.
 */
const parseTelegramError = (err) => {
  const msg = err?.errorMessage || err?.message || String(err);

  if (msg.startsWith("FLOOD_WAIT_")) {
    const seconds = parseInt(msg.replace("FLOOD_WAIT_", ""), 10) || 60;
    return new Error(`Too many attempts. Telegram requires a waiting period of ${seconds} seconds. Please wait before retrying.`);
  }
  if (msg === "PHONE_CODE_INVALID") {
    return new Error("Invalid verification code. Please check the code and try again.");
  }
  if (msg === "PHONE_CODE_EXPIRED") {
    return new Error("Verification code has expired. Please request a new code.");
  }
  if (msg === "PHONE_NUMBER_INVALID") {
    return new Error("The phone number is invalid. Make sure to include your country code.");
  }
  if (msg === "PHONE_NUMBER_BANNED") {
    return new Error("This phone number is banned from Telegram.");
  }
  if (msg === "PASSWORD_HASH_INVALID") {
    return new Error("Incorrect 2-step verification password.");
  }
  if (msg === "SESSION_PASSWORD_NEEDED") {
    return new Error("Two-step verification password required.");
  }

  return new Error(msg);
};

/**
 * Step 1: Send authentication code to user's Telegram or SMS
 */
export const sendTelegramAuthCode = async (userId, rawPhoneNumber) => {
  if (!userId) throw new Error("Authenticated Tasklert user required.");

  const { apiId, apiHash } = requireTelegramConfig();
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

  // Initialize fresh, isolated GramJS client
  const client = createTelegramClientInstance("");

  try {
    await client.connect();

    const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
      {
        apiId: Number(apiId),
        apiHash: String(apiHash),
      },
      phoneNumber
    );

    if (!phoneCodeHash) {
      throw new Error("Failed to receive authentication code hash from Telegram.");
    }

    setPendingAuth(userId, {
      client,
      phoneNumber,
      phoneCodeHash,
      isCodeViaApp: Boolean(isCodeViaApp),
      step: "waiting_for_code",
    });

    return {
      success: true,
      status: "waiting_for_code",
      phoneNumber,
      isCodeViaApp: Boolean(isCodeViaApp),
      deliveryMethod: isCodeViaApp ? "Telegram App" : "SMS",
      message: isCodeViaApp
        ? "Telegram sent the login code to your active Telegram app on another device."
        : "Telegram sent the login code via SMS to your phone.",
    };
  } catch (err) {
    try { await client.disconnect(); } catch (_) {}
    clearPendingAuth(userId);
    throw parseTelegramError(err);
  }
};

/**
 * Step 2: Verify code received from Telegram
 */
export const verifyTelegramAuthCode = async (userId, code) => {
  if (!userId) throw new Error("Authenticated Tasklert user required.");
  const pending = getPendingAuth(userId);

  if (!pending || !pending.client || !pending.phoneCodeHash) {
    throw new Error("No pending Telegram authentication found or session has expired. Please start over.");
  }

  const cleanCode = String(code || "").trim().replace(/\s+/g, "");
  if (!cleanCode) {
    throw new Error("Please enter the verification code.");
  }

  const { client, phoneNumber, phoneCodeHash } = pending;

  try {
    if (!client.connected) {
      await client.connect();
    }
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: cleanCode,
      })
    );

    // Authentication succeeded!
    const sessionString = client.session.save();
    const me = await client.getMe();

    let photoUrl = "";
    try {
      const photoBuf = await client.downloadProfilePhoto("me");
      if (photoBuf && photoBuf.length > 0) {
        photoUrl = `data:image/jpeg;base64,${photoBuf.toString("base64")}`;
      }
    } catch (_) {}

    const connection = await saveUserConnection(userId, {
      sessionString,
      telegramId: me.id ? me.id.toString() : "",
      phoneNumber,
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      username: me.username || "",
      photoUrl,
      is2FA: false,
    });

    registerActiveClient(userId, client);
    clearPendingAuth(userId);

    return {
      success: true,
      status: "connected",
      profile: {
        id: me.id ? me.id.toString() : "",
        firstName: me.firstName || "",
        lastName: me.lastName || "",
        username: me.username || "",
        phoneNumber,
        photoUrl,
      },
      message: "Telegram account connected successfully!",
    };
  } catch (err) {
    if (err?.errorMessage === "SESSION_PASSWORD_NEEDED") {
      // 2FA required on this account
      let hint = "";
      try {
        const pwdInfo = await client.invoke(new Api.account.GetPassword());
        hint = pwdInfo.hint || "";
      } catch (_) {}

      // Update state to waiting_for_password
      setPendingAuth(userId, {
        ...pending,
        step: "waiting_for_password",
      });

      return {
        success: true,
        status: "waiting_for_password",
        hint,
        message: "Two-step verification is enabled on your Telegram account. Please enter your password.",
      };
    }

    throw parseTelegramError(err);
  }
};

/**
 * Step 3: Verify 2FA Password if enabled
 */
export const verifyTelegramPassword = async (userId, password) => {
  if (!userId) throw new Error("Authenticated Tasklert user required.");
  const pending = getPendingAuth(userId);

  if (!pending || !pending.client) {
    throw new Error("No pending Telegram authentication found or session has expired. Please start over.");
  }

  if (!password || typeof password !== "string") {
    throw new Error("Please enter your Telegram two-step verification password.");
  }

  const { client, phoneNumber } = pending;

  try {
    if (!client.connected) {
      await client.connect();
    }
    const passwordSrpResult = await client.invoke(new Api.account.GetPassword());
    const passwordSrpCheck = await computeCheck(passwordSrpResult, password);

    await client.invoke(
      new Api.auth.CheckPassword({
        password: passwordSrpCheck,
      })
    );

    // Authentication succeeded!
    // NEVER store the password. Store only the resulting session string.
    const sessionString = client.session.save();
    const me = await client.getMe();

    let photoUrl = "";
    try {
      const photoBuf = await client.downloadProfilePhoto("me");
      if (photoBuf && photoBuf.length > 0) {
        photoUrl = `data:image/jpeg;base64,${photoBuf.toString("base64")}`;
      }
    } catch (_) {}

    await saveUserConnection(userId, {
      sessionString,
      telegramId: me.id ? me.id.toString() : "",
      phoneNumber,
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      username: me.username || "",
      photoUrl,
      is2FA: true,
    });

    registerActiveClient(userId, client);
    clearPendingAuth(userId);

    return {
      success: true,
      status: "connected",
      profile: {
        id: me.id ? me.id.toString() : "",
        firstName: me.firstName || "",
        lastName: me.lastName || "",
        username: me.username || "",
        phoneNumber,
        photoUrl,
      },
      message: "Telegram account verified and connected successfully!",
    };
  } catch (err) {
    throw parseTelegramError(err);
  }
};

/**
 * Cancel pending authentication
 */
export const cancelTelegramAuth = async (userId) => {
  clearPendingAuth(userId);
  return {
    success: true,
    status: "not_connected",
    message: "Telegram authentication cancelled.",
  };
};

/**
 * Get current Telegram connection status for the user
 */
export const getTelegramAuthStatus = async (userId) => {
  if (!userId) return { success: false, connected: false, status: "not_connected" };

  // 1. Check if user already has an active or restorable client
  const client = await getClientForUser(userId);
  if (client) {
    const connection = await getUserConnection(userId);
    try {
      const me = await client.getMe();
      return {
        success: true,
        connected: true,
        status: "connected",
        profile: {
          id: me.id ? me.id.toString() : connection?.telegramId || "",
          firstName: me.firstName || connection?.firstName || "",
          lastName: me.lastName || connection?.lastName || "",
          username: me.username || connection?.username || "",
          phoneNumber: me.phone ? `+${me.phone}` : connection?.phoneNumber || "",
          photoUrl: connection?.photoUrl || "",
        },
      };
    } catch (err) {
      console.warn(`[TelegramAuth] Failed to getMe for user ${userId}:`, err.message);
    }
  }

  // 2. Check pending authentication flow
  const pending = getPendingAuth(userId);
  if (pending) {
    return {
      success: true,
      connected: false,
      status: pending.step || "waiting_for_code",
      phoneNumber: pending.phoneNumber,
      isCodeViaApp: pending.isCodeViaApp,
    };
  }

  // 3. Fallback to DB connection status if disconnected
  const connection = await getUserConnection(userId);
  if (connection && connection.status === "connected") {
    return {
      success: true,
      connected: true,
      status: "connected",
      profile: connection.toSafeObject(),
    };
  }

  return {
    success: true,
    connected: false,
    status: "not_connected",
  };
};

/**
 * Retrieve user's live Telegram profile
 */
export const getTelegramUserProfile = async (userId) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }

  const me = await client.getMe();
  const connection = await getUserConnection(userId);

  let photoUrl = connection?.photoUrl || "";
  if (!photoUrl) {
    try {
      const photoBuf = await client.downloadProfilePhoto("me");
      if (photoBuf && photoBuf.length > 0) {
        photoUrl = `data:image/jpeg;base64,${photoBuf.toString("base64")}`;
      }
    } catch (_) {}
  }

  return {
    id: me.id ? me.id.toString() : "",
    firstName: me.firstName || "",
    lastName: me.lastName || "",
    username: me.username || "",
    phoneNumber: me.phone ? `+${me.phone}` : connection?.phoneNumber || "",
    photoUrl,
    status: "connected",
  };
};

/**
 * Disconnect user's Telegram account and terminate session cleanly.
 */
export const disconnectTelegramUser = async (userId) => {
  if (!userId) throw new Error("Authenticated Tasklert user required.");

  const client = await getClientForUser(userId);
  if (client) {
    try {
      await client.invoke(new Api.auth.LogOut());
    } catch (err) {
      console.warn(`[TelegramAuth] Logout RPC warning for user ${userId}:`, err.message);
    }
  }

  await removeClientForUser(userId);
  await removeUserConnection(userId);

  return {
    success: true,
    status: "not_connected",
    message: "Telegram account disconnected successfully.",
  };
};
