import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { requireTelegramConfig, getTelegramConfig } from "./telegramConfig.js";
import {
  getUserConnection,
  decryptSession,
  updateConnectionStatus,
} from "./telegramSession.service.js";

// Multi-user isolated in-memory client registry: Map<userIdString, TelegramClient>
const activeClients = new Map();

// Pending authentication flows: Map<userIdString, { client, phoneNumber, phoneCodeHash, isCodeViaApp, expiresAt }>
const pendingAuthSessions = new Map();

// Clean expired pending authentication sessions every 5 minutes
const AUTH_TTL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of pendingAuthSessions.entries()) {
    if (session.expiresAt && session.expiresAt < now) {
      try {
        session.client?.disconnect();
      } catch (_) {}
      pendingAuthSessions.delete(userId);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Creates a raw TelegramClient with a given session string.
 */
export const createTelegramClientInstance = (sessionString = "") => {
  const { apiId, apiHash } = requireTelegramConfig();
  const session = new StringSession(sessionString || "");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
    autoReconnect: true,
  });
  return client;
};

/**
 * Get or restore active TelegramClient for a specific authenticated Tasklert user.
 * Multi-user isolation guaranteed: strictly scoped by Tasklert userId.
 */
export const getClientForUser = async (userId) => {
  if (!userId) return null;
  const userKey = userId.toString();

  // 1. Check in-memory registry
  if (activeClients.has(userKey)) {
    const existingClient = activeClients.get(userKey);
    try {
      if (!existingClient.connected) {
        await existingClient.connect();
      }
      return existingClient;
    } catch (err) {
      console.warn(`[TelegramClient] In-memory reconnect failed for user ${userKey}:`, err.message);
      activeClients.delete(userKey);
    }
  }

  // 2. Not in memory: Attempt to restore from MongoDB encrypted session
  const config = getTelegramConfig();
  if (!config.isConfigured) {
    return null;
  }

  const connection = await getUserConnection(userId);
  if (!connection || !connection.encryptedSession || connection.status === "disconnected") {
    return null;
  }

  // Timeout helper: reject if session restore takes longer than 10 seconds
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[TelegramClient] Timeout after ${ms}ms: ${label}`)), ms)
      ),
    ]);

  try {
    const plainSession = decryptSession(connection.encryptedSession);
    if (!plainSession) {
      await updateConnectionStatus(userId, "error", "Failed to decrypt stored Telegram session");
      return null;
    }

    const client = createTelegramClientInstance(plainSession);

    await withTimeout(client.connect(), 10_000, "connect()");

    const isAuthorized = await withTimeout(
      client.checkAuthorization(),
      8_000,
      "checkAuthorization()"
    );

    if (!isAuthorized) {
      console.warn(`[TelegramClient] Session for user ${userKey} is no longer authorized.`);
      await updateConnectionStatus(userId, "disconnected", "Session revoked or expired");
      try { await client.disconnect(); } catch (_) {}
      return null;
    }

    // Cache active connected client
    activeClients.set(userKey, client);
    await updateConnectionStatus(userId, "connected", null);
    return client;
  } catch (err) {
    console.error(`[TelegramClient] Restore error for user ${userKey}:`, err.message);
    await updateConnectionStatus(userId, "error", err.message);
    return null;
  }
};

/**
 * Register a newly authenticated client into active in-memory registry.
 */
export const registerActiveClient = (userId, client) => {
  if (!userId || !client) return;
  activeClients.set(userId.toString(), client);
};

/**
 * Disconnect and remove active client for a user.
 */
export const removeClientForUser = async (userId) => {
  if (!userId) return;
  const userKey = userId.toString();

  if (activeClients.has(userKey)) {
    const client = activeClients.get(userKey);
    try {
      await client.disconnect();
    } catch (_) {}
    activeClients.delete(userKey);
  }

  if (pendingAuthSessions.has(userKey)) {
    const pending = pendingAuthSessions.get(userKey);
    try {
      await pending.client?.disconnect();
    } catch (_) {}
    pendingAuthSessions.delete(userKey);
  }
};

/**
 * Store pending authorization session during two-step phone/code/password login.
 */
export const setPendingAuth = (userId, authData) => {
  if (!userId) return;
  const userKey = userId.toString();

  // Clear any previous client ONLY if it is a different instance
  if (pendingAuthSessions.has(userKey)) {
    const existing = pendingAuthSessions.get(userKey);
    if (existing?.client && existing.client !== authData?.client) {
      try {
        existing.client.disconnect();
      } catch (_) {}
    }
  }

  pendingAuthSessions.set(userKey, {
    ...authData,
    expiresAt: Date.now() + AUTH_TTL_MS,
  });
};

/**
 * Retrieve pending authorization session for user.
 */
export const getPendingAuth = (userId) => {
  if (!userId) return null;
  const userKey = userId.toString();
  const session = pendingAuthSessions.get(userKey);
  if (!session) return null;

  if (session.expiresAt && session.expiresAt < Date.now()) {
    try { session.client?.disconnect(); } catch (_) {}
    pendingAuthSessions.delete(userKey);
    return null;
  }

  return session;
};

/**
 * Clear pending authorization session for user.
 */
export const clearPendingAuth = (userId) => {
  if (!userId) return;
  const userKey = userId.toString();
  if (pendingAuthSessions.has(userKey)) {
    const session = pendingAuthSessions.get(userKey);
    try { session.client?.disconnect(); } catch (_) {}
    pendingAuthSessions.delete(userKey);
  }
};

/**
 * Graceful shutdown for Render backend restarts.
 */
export const closeAllTelegramClients = async () => {
  console.log("[TelegramClient] Gracefully disconnecting all active user clients...");
  for (const [userId, client] of activeClients.entries()) {
    try {
      await client.disconnect();
    } catch (_) {}
  }
  activeClients.clear();

  for (const [userId, pending] of pendingAuthSessions.entries()) {
    try {
      await pending.client?.disconnect();
    } catch (_) {}
  }
  pendingAuthSessions.clear();
};
