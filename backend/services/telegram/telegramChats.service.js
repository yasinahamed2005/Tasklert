import { Api, utils } from "telegram";
import bigInt from "big-integer";
import { getClientForUser } from "./telegramClient.service.js";
import { recordPeersFromDialogs, recordPeer } from "./telegramPeers.service.js";

/**
 * Safely parse a raw MTProto dialog into the standard Tasklert Telegram chat format.
 */
function parseRawDialog(d, entitiesMap, messagesMap, myIdStr) {
  if (!d || d instanceof Api.DialogFolder) return null;

  try {
    const peerIdStr = utils.getPeerId(d.peer);
    const rawId = String(peerIdStr || "");
    const cleanId = rawId.replace(/^-100/, "").replace(/^-/, "");

    const entity = entitiesMap.get(rawId) || entitiesMap.get(cleanId) || null;

    const isUser = Boolean(d.peer instanceof Api.PeerUser || entity instanceof Api.User);
    const isChannel = Boolean(d.peer instanceof Api.PeerChannel || entity instanceof Api.Channel);
    const isChat = Boolean(d.peer instanceof Api.PeerChat || entity instanceof Api.Chat);
    const isBroadcast = Boolean(isChannel && entity?.broadcast);

    let chatType = "private";
    if (isBroadcast) {
      chatType = "channel";
    } else if (isChat || (isChannel && !isBroadcast)) {
      chatType = "group";
    }

    const accessHash = entity?.accessHash ? entity.accessHash.toString() : null;

    const isSelf = Boolean(
      (isUser && (entity?.self || entity?.isSelf)) ||
      (myIdStr && (rawId === myIdStr || cleanId === myIdStr))
    );

    let title = "";
    if (entity) {
      title = utils.getDisplayName(entity);
    }
    if (!title) {
      title = isSelf
        ? "Saved Messages"
        : chatType === "channel"
        ? "Telegram Channel"
        : chatType === "group"
        ? "Telegram Group"
        : "Telegram Conversation";
    }

    // Top message details
    let lastMessageText = "";
    let lastMessageDate = null;
    let lastMessageRawDate = null;
    let lastMessageOut = false;
    let lastMessageId = null;

    const msg = d.topMessage ? messagesMap.get(String(d.topMessage)) : null;
    if (msg) {
      lastMessageText = msg.message || "";
      if (!lastMessageText && msg.media) {
        lastMessageText = "📎 [Attachment]";
      }
      if (msg.date) {
        lastMessageRawDate = msg.date;
        lastMessageDate = new Date(msg.date * 1000).toISOString();
      }
      lastMessageOut = Boolean(msg.out);
      lastMessageId = msg.id || null;
    }

    return {
      id: rawId,
      peerId: cleanId,
      accessHash,
      peerType: isChannel ? "channel" : isChat ? "chat" : "user",
      title,
      type: chatType,
      isUser,
      isGroup: chatType === "group",
      isChannel: chatType === "channel",
      isSelf,
      folderId: Number(d.folderId) || 0,
      pinned: Boolean(d.pinned),
      unreadCount: Math.max(0, Number(d.unreadCount) || 0),
      unreadMentionsCount: Math.max(0, Number(d.unreadMentionsCount) || 0),
      readInboxMaxId: Number(d.readInboxMaxId) || 0,
      lastMessage: {
        id: lastMessageId,
        text: lastMessageText,
        date: lastMessageDate,
        rawDate: lastMessageRawDate,
        out: lastMessageOut,
      },
      username: entity?.username || "",
      phone: entity?.phone ? `+${entity.phone}` : "",
      verified: Boolean(entity?.verified),
      participantsCount: entity?.participantsCount || null,
    };
  } catch (err) {
    console.warn("[TelegramChats] Failed to parse raw dialog:", err.message);
    return null;
  }
}

/**
 * Fetch real Telegram dialogs (conversations, groups, channels) for authenticated user.
 * Supports pagination via offsetDate and offsetId, and folder-specific fetching (0 for main, 1 for archive).
 */
export const getTelegramChats = async (
  userId,
  { filter = "all", search = "", limit = 100, folder = null, offsetDate = null, offsetId = null } = {}
) => {
  const client = await getClientForUser(userId);
  if (!client) {
    console.warn(`[TelegramChats] Telegram account not connected for user ${userId}. Returning empty list.`);
    return [];
  }

  const me = client._self || (await client.getMe().catch(() => null));
  const myIdStr = me?.id ? me.id.toString() : "";

  let chats = [];
  let dialogs = null;

  // 1. Attempt high-level client.getDialogs() with safe fallbacks
  try {
    const dialogOptions = { limit: Number(limit) || 100 };
    if (folder !== null && folder !== undefined && folder !== "") {
      dialogOptions.folder = Number(folder);
    }
    if (offsetDate) {
      dialogOptions.offsetDate = Number(offsetDate);
    }
    if (offsetId) {
      dialogOptions.offsetId = Number(offsetId);
    }

    dialogs = await client.getDialogs(dialogOptions);
  } catch (dialogErr) {
    console.warn("[TelegramChats] client.getDialogs with options encountered error:", dialogErr.message);

    // If FOLDER_ID_INVALID, Telegram user has no archived folder/chats
    if (dialogErr.message?.includes("FOLDER_ID_INVALID")) {
      return [];
    }

    // If folder was requested and failed, try standard getDialogs without folder
    if (folder !== null && folder !== undefined && folder !== "") {
      try {
        dialogs = await client.getDialogs({ limit: Number(limit) || 100 });
      } catch (innerErr) {
        console.warn("[TelegramChats] Fallback getDialogs without folder also failed:", innerErr.message);
      }
    }
  }

  // 2. If client.getDialogs returned an array, map each dialog safely
  if (Array.isArray(dialogs)) {
    try {
      recordPeersFromDialogs(userId, dialogs);
    } catch (_) {}

    chats = dialogs
      .map((dialog) => {
        try {
          const isUser = Boolean(dialog.isUser);
          const isChannel = Boolean(dialog.isChannel);
          const isGroup = Boolean(dialog.isGroup);
          const isBroadcast = isChannel && Boolean(dialog.entity?.broadcast);

          let chatType = "private";
          if (isBroadcast) {
            chatType = "channel";
          } else if (isGroup || (isChannel && !isBroadcast)) {
            chatType = "group";
          }

          const rawId = dialog.id ? dialog.id.toString() : "";
          const entityId = dialog.entity?.id ? dialog.entity.id.toString() : rawId.replace(/^-100/, "").replace(/^-/, "");
          const accessHash = dialog.entity?.accessHash ? dialog.entity.accessHash.toString() : null;

          const isSelf = Boolean(
            (isUser && dialog.entity?.self) ||
            (isUser && dialog.entity?.isSelf) ||
            (myIdStr && rawId === myIdStr)
          );

          let title = dialog.title || dialog.name || "Telegram Conversation";
          if (isSelf && (!title || title === "Telegram Conversation")) {
            title = "Saved Messages";
          }

          let lastMessageText = "";
          let lastMessageDate = null;
          let lastMessageRawDate = null;
          let lastMessageOut = false;
          let lastMessageId = null;

          if (dialog.message) {
            lastMessageText = dialog.message.message || "";
            if (!lastMessageText && dialog.message.media) {
              lastMessageText = "📎 [Attachment]";
            }
            if (dialog.message.date) {
              lastMessageRawDate = dialog.message.date;
              lastMessageDate = new Date(dialog.message.date * 1000).toISOString();
            }
            lastMessageOut = Boolean(dialog.message.out);
            lastMessageId = dialog.message.id || null;
          }

          return {
            id: rawId,
            peerId: entityId,
            accessHash,
            peerType: isChannel ? "channel" : isGroup ? "chat" : "user",
            title,
            type: chatType,
            isUser,
            isGroup: chatType === "group",
            isChannel: chatType === "channel",
            isSelf,
            folderId: Number(dialog.folderId) || 0,
            pinned: Boolean(dialog.pinned),
            unreadCount: Math.max(0, Number(dialog.unreadCount) || 0),
            unreadMentionsCount: Math.max(0, Number(dialog.unreadMentionsCount) || 0),
            readInboxMaxId: dialog.dialog?.readInboxMaxId || 0,
            lastMessage: {
              id: lastMessageId,
              text: lastMessageText,
              date: lastMessageDate,
              rawDate: lastMessageRawDate,
              out: lastMessageOut,
            },
            username: dialog.entity?.username || "",
            phone: dialog.entity?.phone ? `+${dialog.entity.phone}` : "",
            verified: Boolean(dialog.entity?.verified),
            participantsCount: dialog.entity?.participantsCount || null,
          };
        } catch (mapErr) {
          console.warn("[TelegramChats] Error mapping single dialog:", mapErr.message);
          return null;
        }
      })
      .filter(Boolean);
  } else {
    // 3. Fallback: Raw low-level MTProto Api.messages.GetDialogs
    try {
      const folderIdVal = (folder !== null && folder !== undefined && folder !== "") ? Number(folder) : undefined;
      const rawRes = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate: offsetDate ? Number(offsetDate) : 0,
          offsetId: offsetId ? Number(offsetId) : 0,
          offsetPeer: new Api.InputPeerEmpty(),
          limit: Number(limit) || 100,
          hash: bigInt.zero,
          folderId: folderIdVal,
        })
      );

      const entitiesMap = new Map();
      for (const u of (rawRes.users || [])) {
        if (u && !(u instanceof Api.UserEmpty)) {
          entitiesMap.set(String(utils.getPeerId(u)), u);
          entitiesMap.set(String(u.id), u);
        }
      }
      for (const c of (rawRes.chats || [])) {
        if (c && !(c instanceof Api.ChatEmpty)) {
          entitiesMap.set(String(utils.getPeerId(c)), c);
          entitiesMap.set(String(c.id), c);
        }
      }

      const messagesMap = new Map();
      for (const m of (rawRes.messages || [])) {
        if (m && m.id) {
          messagesMap.set(String(m.id), m);
        }
      }

      chats = (rawRes.dialogs || [])
        .map((d) => parseRawDialog(d, entitiesMap, messagesMap, myIdStr))
        .filter(Boolean);

      // Record peers into peer registry
      for (const c of chats) {
        recordPeer(userId, c);
      }
    } catch (rawErr) {
      if (rawErr.message?.includes("FOLDER_ID_INVALID")) {
        return [];
      }
      console.error("[TelegramChats] Raw MTProto GetDialogs failed:", rawErr.message);
    }
  }

  // Apply category filter
  if (filter && filter !== "all" && filter !== "archived") {
    chats = chats.filter((c) => c.type === filter);
  } else if (filter === "archived") {
    chats = chats.filter((c) => c.folderId === 1);
  }

  // Apply search filter
  if (search && typeof search === "string" && search.trim()) {
    const q = search.toLowerCase().trim();
    chats = chats.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.lastMessage.text.toLowerCase().includes(q)
    );
  }

  return chats;
};
