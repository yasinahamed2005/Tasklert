import { getClientForUser } from "./telegramClient.service.js";
import { recordPeersFromDialogs } from "./telegramPeers.service.js";

/**
 * Fetch real Telegram dialogs (conversations, groups, channels) for authenticated user.
 */
export const getTelegramChats = async (userId, { filter = "all", search = "", limit = 100, folder = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected. Please authenticate first.");
  }

  try {
    const dialogOptions = { limit: Number(limit) || 100 };
    if (folder !== null && folder !== undefined && folder !== "") {
      dialogOptions.folder = Number(folder);
    }

    const dialogs = await client.getDialogs(dialogOptions);

    // Register all dialog peers in user-isolated in-memory registry
    recordPeersFromDialogs(userId, dialogs);

    const me = client._self || (await client.getMe().catch(() => null));
    const myIdStr = me?.id ? me.id.toString() : "";

    let chats = dialogs.map((dialog) => {
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
      let lastMessageOut = false;
      let lastMessageId = null;

      if (dialog.message) {
        lastMessageText = dialog.message.message || "";
        if (!lastMessageText && dialog.message.media) {
          lastMessageText = "📎 [Attachment]";
        }
        if (dialog.message.date) {
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
        unreadCount: Math.max(0, Number(dialog.unreadCount) || 0),
        unreadMentionsCount: Math.max(0, Number(dialog.unreadMentionsCount) || 0),
        readInboxMaxId: dialog.dialog?.readInboxMaxId || 0,
        lastMessage: {
          id: lastMessageId,
          text: lastMessageText,
          date: lastMessageDate,
          out: lastMessageOut,
        },
        username: dialog.entity?.username || "",
        phone: dialog.entity?.phone ? `+${dialog.entity.phone}` : "",
        verified: Boolean(dialog.entity?.verified),
        participantsCount: dialog.entity?.participantsCount || null,
      };
    });

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
  } catch (err) {
    console.error(`[TelegramChats] Error for user ${userId}:`, err.message);
    throw new Error(err.message || "Failed to retrieve Telegram chats.");
  }
};
