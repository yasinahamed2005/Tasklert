import { Api } from "telegram";
import bigInt from "big-integer";

// Multi-user isolated in-memory peer cache: Map<userIdString, Map<chatIdString, PeerInfo>>
const userPeerCache = new Map();

/**
 * Get or create peer cache map for a specific Tasklert user.
 */
const getUserCache = (userId) => {
  const userKey = userId ? userId.toString() : "global";
  if (!userPeerCache.has(userKey)) {
    userPeerCache.set(userKey, new Map());
  }
  return userPeerCache.get(userKey);
};

/**
 * Record a peer's identity and access credentials into user's peer registry.
 */
export const recordPeer = (userId, peerInfo) => {
  if (!userId || !peerInfo) return;
  const cache = getUserCache(userId);

  const rawId = peerInfo.id ? peerInfo.id.toString() : "";
  const entityId = peerInfo.entityId ? peerInfo.entityId.toString() : rawId.replace(/^-100/, "").replace(/^-/, "");
  const normalized = {
    id: rawId,
    entityId,
    accessHash: peerInfo.accessHash ? peerInfo.accessHash.toString() : null,
    peerType: peerInfo.peerType || (peerInfo.isUser ? "user" : peerInfo.isChannel ? "channel" : "chat"),
    isUser: Boolean(peerInfo.isUser),
    isGroup: Boolean(peerInfo.isGroup),
    isChannel: Boolean(peerInfo.isChannel),
    isSelf: Boolean(peerInfo.isSelf),
    title: peerInfo.title || "",
    username: peerInfo.username || "",
    phone: peerInfo.phone || "",
    folderId: Number(peerInfo.folderId) || 0,
    pinned: Boolean(peerInfo.pinned),
  };

  // Key by both raw dialog ID and numeric entity ID for instant multi-format lookup
  if (rawId) cache.set(rawId, normalized);
  if (entityId) cache.set(entityId, normalized);
  if (normalized.username) cache.set(normalized.username.toLowerCase(), normalized);
};

/**
 * Record all peers retrieved from a Telegram getDialogs() call.
 */
export const recordPeersFromDialogs = (userId, dialogs = []) => {
  if (!userId || !Array.isArray(dialogs)) return;
  for (const dialog of dialogs) {
    if (!dialog) continue;
    const isUser = Boolean(dialog.isUser);
    const isChannel = Boolean(dialog.isChannel);
    const isGroup = Boolean(dialog.isGroup);
    const isBroadcast = isChannel && Boolean(dialog.entity?.broadcast);

    let peerType = "user";
    if (isBroadcast) {
      peerType = "channel";
    } else if (isGroup || (isChannel && !isBroadcast)) {
      peerType = "group";
    }

    const rawId = dialog.id ? dialog.id.toString() : "";
    const entityId = dialog.entity?.id ? dialog.entity.id.toString() : rawId.replace(/^-100/, "").replace(/^-/, "");
    const accessHash = dialog.entity?.accessHash ? dialog.entity.accessHash.toString() : null;
    const isSelf = Boolean(dialog.isUser && (dialog.entity?.self || dialog.entity?.isSelf));

    recordPeer(userId, {
      id: rawId,
      entityId,
      accessHash,
      peerType: isChannel ? "channel" : isGroup ? "chat" : "user",
      isUser,
      isGroup: peerType === "group",
      isChannel: peerType === "channel",
      isSelf,
      title: dialog.title || dialog.name || "",
      username: dialog.entity?.username || "",
      phone: dialog.entity?.phone || "",
      folderId: dialog.folderId || 0,
      pinned: Boolean(dialog.pinned),
    });
  }
};

/**
 * Retrieve cached peer metadata for a specific chat
 */
export const getPeerInfo = (userId, chatId) => {
  if (!userId || !chatId) return null;
  const cache = getUserCache(userId);
  const key = chatId.toString();
  return cache.get(key) || cache.get(key.replace(/^-100/, "").replace(/^-/, "")) || null;
};

/**
 * Robust peer resolver for GramJS:
 * Resolves any Telegram chat ID (channel, supergroup, basic chat, user, self)
 * to an authenticated GramJS InputPeer instance.
 */
export const resolvePeer = async (client, userId, chatId, { accessHash = null, peerType = null } = {}) => {
  if (!client) {
    throw new Error("Telegram client is not connected.");
  }
  if (!chatId) {
    throw new Error("chatId is required for peer resolution.");
  }

  const rawChatId = chatId.toString().trim();

  // 1. Check if self / Saved Messages
  if (rawChatId === "me" || rawChatId === "self" || rawChatId === "this") {
    return new Api.InputPeerSelf();
  }

  // Check if self ID matches authenticated user's ID
  const me = client._self || (await client.getMe().catch(() => null));
  if (me && (rawChatId === me.id?.toString() || rawChatId === `+${me.phone}`)) {
    return new Api.InputPeerSelf();
  }

  // 2. Check local peer cache
  const cached = getPeerInfo(userId, rawChatId);
  if (cached?.isSelf) {
    return new Api.InputPeerSelf();
  }

  const effectiveAccessHash = accessHash || cached?.accessHash || null;
  const effectiveType = peerType || cached?.peerType || null;

  // 3. Channel or Supergroup resolution
  const isChannelId = rawChatId.startsWith("-100") || effectiveType === "channel";
  if (isChannelId && effectiveAccessHash) {
    const channelNumericId = rawChatId.startsWith("-100")
      ? rawChatId.slice(4)
      : (cached?.entityId || rawChatId);
    return new Api.InputPeerChannel({
      channelId: bigInt(channelNumericId),
      accessHash: bigInt(effectiveAccessHash),
    });
  }

  // 4. Basic group chat resolution (negative ID starting with '-', but not '-100')
  const isBasicChat = (rawChatId.startsWith("-") && !rawChatId.startsWith("-100")) || effectiveType === "chat";
  if (isBasicChat) {
    const basicChatId = rawChatId.startsWith("-") ? rawChatId.slice(1) : rawChatId;
    return new Api.InputPeerChat({
      chatId: bigInt(basicChatId),
    });
  }

  // 5. Direct User resolution
  const isDirectUser = !rawChatId.startsWith("-") || effectiveType === "user";
  if (isDirectUser && effectiveAccessHash) {
    const userNumericId = cached?.entityId || rawChatId;
    return new Api.InputPeerUser({
      userId: bigInt(userNumericId),
      accessHash: bigInt(effectiveAccessHash),
    });
  }

  // 6. Direct GramJS input entity resolution via client internal cache
  try {
    const entity = await client.getInputEntity(rawChatId);
    if (entity) return entity;
  } catch (err) {
    console.warn(`[TelegramPeers] Initial getInputEntity failed for ${rawChatId}:`, err.message);
  }

  // 7. Entity cache refresh fallback: fetch dialogs and retry
  try {
    const dialogs = await client.getDialogs({ limit: 100 });
    recordPeersFromDialogs(userId, dialogs);

    const refreshed = getPeerInfo(userId, rawChatId);
    if (refreshed?.isSelf) {
      return new Api.InputPeerSelf();
    }
    if (refreshed?.accessHash) {
      if (refreshed.isChannel || rawChatId.startsWith("-100")) {
        const chanId = rawChatId.startsWith("-100") ? rawChatId.slice(4) : refreshed.entityId;
        return new Api.InputPeerChannel({
          channelId: bigInt(chanId),
          accessHash: bigInt(refreshed.accessHash),
        });
      }
      if (refreshed.isUser || !rawChatId.startsWith("-")) {
        return new Api.InputPeerUser({
          userId: bigInt(refreshed.entityId),
          accessHash: bigInt(refreshed.accessHash),
        });
      }
    }

    // Try getInputEntity one more time now that dialogs have updated the cache
    return await client.getInputEntity(rawChatId);
  } catch (retryErr) {
    console.error(`[TelegramPeers] Peer resolution failed permanently for ${rawChatId}:`, retryErr.message);
    throw new Error(`Unable to resolve Telegram conversation for ${rawChatId}: ${retryErr.message}`);
  }
};
