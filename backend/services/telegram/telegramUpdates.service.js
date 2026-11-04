import { NewMessage, Raw } from "telegram/events/index.js";
import { Api } from "telegram";
import { getClientForUser } from "./telegramClient.service.js";

// Active SSE client connections: Map<userIdString, Set<httpResponse>>
const sseSubscribers = new Map();

// Track if event listener has already been registered on a TelegramClient instance
const registeredClientSet = new WeakSet();

/**
 * Broadcast an event payload to all active SSE subscribers for a user
 */
export const broadcastUserEvent = (userId, payload) => {
  const userKey = userId.toString();
  const listeners = sseSubscribers.get(userKey);
  if (listeners && listeners.size > 0) {
    const dataStr = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of listeners) {
      try {
        res.write(dataStr);
      } catch (_) {}
    }
  }
};

/**
 * Register real-time MTProto event listener on user's TelegramClient
 */
export const ensureUpdatesListener = (userId, client) => {
  if (!client || registeredClientSet.has(client)) return;
  registeredClientSet.add(client);

  const userKey = userId.toString();

  // 1. New Message handler
  client.addEventHandler((event) => {
    try {
      const msg = event.message;
      if (!msg) return;

      const payload = {
        type: "new_message",
        message: {
          id: msg.id,
          chatId: msg.chatId ? msg.chatId.toString() : "",
          text: msg.message || "",
          out: Boolean(msg.out),
          date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
          senderId: msg.senderId ? msg.senderId.toString() : "",
          replyToMsgId: msg.replyToMsgId || null,
        },
      };

      broadcastUserEvent(userKey, payload);
    } catch (err) {
      console.warn(`[TelegramUpdates] Error processing new_message:`, err.message);
    }
  }, new NewMessage({}));

  // 2. Raw MTProto Updates (Message edits, deletions, read receipts)
  client.addEventHandler((update) => {
    try {
      if (!update) return;

      // Handle message edits
      if (update instanceof Api.UpdateEditMessage || update instanceof Api.UpdateEditChannelMessage) {
        const msg = update.message;
        if (msg) {
          broadcastUserEvent(userKey, {
            type: "message_edited",
            message: {
              id: msg.id,
              chatId: msg.chatId ? msg.chatId.toString() : "",
              text: msg.message || "",
              date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
              editDate: msg.editDate ? new Date(msg.editDate * 1000).toISOString() : new Date().toISOString(),
            },
          });
        }
      }

      // Handle message deletions
      if (update instanceof Api.UpdateDeleteMessages) {
        broadcastUserEvent(userKey, {
          type: "messages_deleted",
          messageIds: update.messages || [],
        });
      } else if (update instanceof Api.UpdateDeleteChannelMessages) {
        broadcastUserEvent(userKey, {
          type: "messages_deleted",
          channelId: update.channelId?.toString() || "",
          messageIds: update.messages || [],
        });
      }

      // Handle Read Inbox updates (user read incoming messages from phone or desktop)
      if (update instanceof Api.UpdateReadHistoryInbox) {
        let chatId = "";
        if (update.peer?.userId) chatId = update.peer.userId.toString();
        else if (update.peer?.chatId) chatId = (-Number(update.peer.chatId)).toString();
        else if (update.peer?.channelId) chatId = `-100${update.peer.channelId}`;

        broadcastUserEvent(userKey, {
          type: "chat_read",
          chatId,
          maxId: update.maxId,
          unreadCount: update.stillUnreadCount || 0,
        });
      } else if (update instanceof Api.UpdateReadChannelInbox) {
        const rawChannelId = update.channelId ? update.channelId.toString() : "";
        const fullChannelId = `-100${rawChannelId}`;
        broadcastUserEvent(userKey, {
          type: "chat_read",
          chatId: fullChannelId,
          peerId: rawChannelId,
          maxId: update.maxId,
          unreadCount: update.stillUnreadCount || 0,
        });
      } else if (update instanceof Api.UpdateDialogUnreadMark) {
        let chatId = "";
        const p = update.peer?.peer;
        if (p?.userId) chatId = p.userId.toString();
        else if (p?.chatId) chatId = (-Number(p.chatId)).toString();
        else if (p?.channelId) chatId = `-100${p.channelId}`;

        broadcastUserEvent(userKey, {
          type: "chat_read",
          chatId,
          unreadCount: update.unread ? 1 : 0,
        });
      }

      // Handle Read Outbox updates (recipient read our sent message)
      if (update instanceof Api.UpdateReadHistoryOutbox || update instanceof Api.UpdateReadChannelOutbox) {
        let chatId = "";
        if (update.peer?.userId) chatId = update.peer.userId.toString();
        else if (update.peer?.chatId) chatId = (-Number(update.peer.chatId)).toString();
        else if (update.peer?.channelId) chatId = `-100${update.peer.channelId}`;
        else if (update.channelId) chatId = `-100${update.channelId}`;

        broadcastUserEvent(userKey, {
          type: "messages_read_outbox",
          chatId,
          maxId: update.maxId,
        });
      }
    } catch (err) {
      // Non-critical background MTProto event parsing
    }
  }, new Raw({}));
};

/**
 * Server-Sent Events (SSE) connection handler
 */
export const handleTelegramSSE = async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).end();
  }

  const userKey = userId.toString();

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Register response into active subscriber set
  if (!sseSubscribers.has(userKey)) {
    sseSubscribers.set(userKey, new Set());
  }
  sseSubscribers.get(userKey).add(res);

  // Send initial connected ping
  res.write(`data: ${JSON.stringify({ type: "connected", userId: userKey })}\n\n`);

  // Hook event listener on Telegram client
  try {
    const client = await getClientForUser(userId);
    if (client) {
      ensureUpdatesListener(userId, client);
    }
  } catch (_) {}

  // Periodic heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 25000);

  // Clean up when client disconnects
  req.on("close", () => {
    clearInterval(heartbeat);
    const listeners = sseSubscribers.get(userKey);
    if (listeners) {
      listeners.delete(res);
      if (listeners.size === 0) {
        sseSubscribers.delete(userKey);
      }
    }
  });
};
