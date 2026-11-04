import { Api, helpers } from "telegram";
import { getClientForUser } from "./telegramClient.service.js";
import { resolvePeer } from "./telegramPeers.service.js";

/**
 * Determine high-level media type from GramJS message
 */
const detectMediaType = (msg) => {
  if (!msg.media) return null;
  const className = msg.media.className || "";

  if (className === "MessageMediaPhoto") return "photo";
  if (className === "MessageMediaPoll") return "poll";
  if (className === "MessageMediaGeo" || className === "MessageMediaGeoLive") return "location";
  if (className === "MessageMediaDocument") {
    const mime = msg.media.document?.mimeType || "";
    if (mime.startsWith("image/")) return "photo";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/ogg") || mime.includes("opus")) return "voice";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.includes("pdf")) return "pdf";
    return "document";
  }
  return "file";
};

/**
 * Retrieve chronological messages for a conversation
 */
export const getChatMessages = async (userId, chatId, { limit = 50, offsetId = 0, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });

    const rawMessages = await client.getMessages(peer, {
      limit: Number(limit) || 50,
      offsetId: offsetId ? Number(offsetId) : 0,
    });

    const messages = rawMessages.map((msg) => {
      const mediaType = detectMediaType(msg);
      let mediaInfo = null;

      if (mediaType) {
        let filename = "attachment";
        let size = 0;
        let mimeType = "";

        if (mediaType === "poll" && msg.media?.poll) {
          mediaInfo = {
            type: "poll",
            question: msg.media.poll.question || "",
            closed: Boolean(msg.media.poll.closed),
            publicVoters: Boolean(msg.media.poll.publicVoters),
            multipleChoice: Boolean(msg.media.poll.multipleChoice),
            quiz: Boolean(msg.media.poll.quiz),
            answers: msg.media.poll.answers?.map((a) => ({
              text: a.text || "",
              option: a.option ? a.option.toString("hex") : "",
            })) || [],
            results: msg.media.results?.results?.map((r) => ({
              option: r.option ? r.option.toString("hex") : "",
              voters: r.voters || 0,
              correct: Boolean(r.correct),
            })) || [],
            totalVoters: msg.media.results?.totalVoters || 0,
          };
        } else if (mediaType === "location" && msg.media?.geo) {
          mediaInfo = {
            type: "location",
            latitude: msg.media.geo.lat,
            longitude: msg.media.geo.long,
          };
        } else {
          if (msg.file) {
            filename = msg.file.name || filename;
            size = msg.file.size || 0;
            mimeType = msg.file.mimeType || "";
          } else if (msg.media?.document) {
            const doc = msg.media.document;
            size = doc.size ? Number(doc.size) : 0;
            mimeType = doc.mimeType || "";
            const nameAttr = doc.attributes?.find((a) => a.fileName);
            if (nameAttr?.fileName) filename = nameAttr.fileName;
          }

          mediaInfo = {
            type: mediaType,
            filename,
            size,
            mimeType,
            downloadUrl: `/api/telegram/media/${encodeURIComponent(chatId)}/${msg.id}`,
          };
        }
      }

      return {
        id: msg.id,
        chatId: String(chatId),
        text: msg.message || "",
        out: Boolean(msg.out),
        date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
        senderId: msg.senderId ? msg.senderId.toString() : "",
        replyToMsgId: msg.replyToMsgId || msg.replyTo?.replyToMsgId || null,
        media: mediaInfo,
      };
    });

    // Telegram returns newest first; reverse so frontend renders chronologically (oldest -> newest)
    return messages.reverse();
  } catch (err) {
    console.error(`[TelegramMessages] Fetch error for chat ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to fetch messages.");
  }
};

/**
 * Send text message or reply to a Telegram chat
 */
export const sendChatMessage = async (userId, chatId, { message = "", replyTo = null, file = null, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }

  if (!message && !file) {
    throw new Error("Message text or attachment is required.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });

    const options = {
      message: message || "",
    };

    if (replyTo) {
      options.replyTo = Number(replyTo);
    }

    if (file) {
      options.file = file;
    }

    const sent = await client.sendMessage(peer, options);

    return {
      success: true,
      message: {
        id: sent.id,
        chatId: String(chatId),
        text: sent.message || message,
        out: true,
        date: sent.date ? new Date(sent.date * 1000).toISOString() : new Date().toISOString(),
        senderId: sent.senderId ? sent.senderId.toString() : "",
        replyToMsgId: sent.replyToMsgId || null,
      },
    };
  } catch (err) {
    console.error(`[TelegramMessages] Send error to ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to send Telegram message.");
  }
};

/**
 * Delete a message from a Telegram chat (supporting 'delete for everyone' or 'delete for me')
 */
export const deleteChatMessage = async (userId, chatId, messageId, { accessHash = null, peerType = null, revoke = true } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });
    await client.deleteMessages(peer, [Number(messageId)], { revoke: Boolean(revoke) });
    return {
      success: true,
      messageId: Number(messageId),
      chatId: String(chatId),
      revoke: Boolean(revoke),
    };
  } catch (err) {
    console.error(`[TelegramMessages] Delete error:`, err.message);
    throw new Error(err.message || "Failed to delete Telegram message.");
  }
};

/**
 * Mark a conversation's history as read up to a specified maxId through Telegram MTProto
 */
export const markChatAsRead = async (userId, chatId, { maxId = 0, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });
    const resolvedMaxId = Math.max(0, Number(maxId) || 0);

    const isChannel = peerType === "channel" || peer?.className === "InputPeerChannel";

    if (isChannel) {
      await client.invoke(
        new Api.channels.ReadHistory({
          channel: peer,
          maxId: resolvedMaxId,
        })
      );
    } else {
      await client.invoke(
        new Api.messages.ReadHistory({
          peer,
          maxId: resolvedMaxId,
        })
      );
    }

    return {
      success: true,
      chatId: String(chatId),
      maxId: resolvedMaxId,
      unreadCount: 0,
    };
  } catch (err) {
    console.error(`[TelegramMessages] Mark as read error for ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to mark Telegram chat as read.");
  }
};

/**
 * Send a genuine MTProto Poll to a Telegram chat
 */
export const sendPollMessage = async (userId, chatId, { question, options = [], multipleChoice = false, quiz = false, publicVoters = true, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }
  if (!question || !question.trim()) {
    throw new Error("Poll question is required.");
  }

  const cleanOptions = Array.isArray(options) ? options.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean) : [];
  if (cleanOptions.length < 2) {
    throw new Error("A poll requires at least 2 options.");
  }
  if (cleanOptions.length > 10) {
    throw new Error("A poll supports at most 10 options.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });

    const poll = new Api.Poll({
      id: helpers.generateRandomBigInt(),
      question: question.trim(),
      answers: cleanOptions.map((opt, idx) => new Api.PollAnswer({
        text: opt,
        option: Buffer.from([idx]),
      })),
      multipleChoice: Boolean(multipleChoice),
      quiz: Boolean(quiz),
      publicVoters: Boolean(publicVoters),
      closed: false,
    });

    const media = new Api.InputMediaPoll({ poll });

    await client.invoke(
      new Api.messages.SendMedia({
        peer,
        media,
        message: "",
        randomId: helpers.generateRandomBigInt(),
      })
    );

    return {
      success: true,
      chatId: String(chatId),
      poll: {
        question: question.trim(),
        options: cleanOptions,
        multipleChoice: Boolean(multipleChoice),
        quiz: Boolean(quiz),
      },
    };
  } catch (err) {
    console.error(`[TelegramMessages] Send poll error for ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to create and send Telegram poll.");
  }
};

/**
 * Send a genuine MTProto Location (GeoPoint) to a Telegram chat
 */
export const sendLocationMessage = async (userId, chatId, { latitude, longitude, accuracyRadius = 0, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }
  if (latitude === undefined || longitude === undefined || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
    throw new Error("Valid latitude and longitude are required.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });

    const media = new Api.InputMediaGeoPoint({
      geoPoint: new Api.InputGeoPoint({
        lat: Number(latitude),
        long: Number(longitude),
        accuracyRadius: Number(accuracyRadius) || 0,
      }),
    });

    await client.invoke(
      new Api.messages.SendMedia({
        peer,
        media,
        message: "",
        randomId: helpers.generateRandomBigInt(),
      })
    );

    return {
      success: true,
      chatId: String(chatId),
      location: {
        latitude: Number(latitude),
        longitude: Number(longitude),
      },
    };
  } catch (err) {
    console.error(`[TelegramMessages] Send location error for ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to send location message.");
  }
};

/**
 * Send a genuine MTProto Voice Note recording to a Telegram chat
 */
export const sendVoiceMessage = async (userId, chatId, { filePath, duration = 0, accessHash = null, peerType = null } = {}) => {
  const client = await getClientForUser(userId);
  if (!client) {
    throw new Error("Telegram account is not connected.");
  }
  if (!filePath) {
    throw new Error("Voice audio recording file is required.");
  }

  try {
    const peer = await resolvePeer(client, userId, chatId, { accessHash, peerType });

    const sent = await client.sendFile(peer, {
      file: filePath,
      voiceNote: true,
      attributes: [
        new Api.DocumentAttributeAudio({
          voice: true,
          duration: Math.round(Number(duration) || 0),
        }),
      ],
    });

    return {
      success: true,
      message: {
        id: sent.id,
        chatId: String(chatId),
        text: "",
        out: true,
        date: sent.date ? new Date(sent.date * 1000).toISOString() : new Date().toISOString(),
        media: {
          type: "voice",
          downloadUrl: `/api/telegram/media/${encodeURIComponent(chatId)}/${sent.id}`,
        },
      },
    };
  } catch (err) {
    console.error(`[TelegramMessages] Send voice message error for ${chatId}:`, err.message);
    throw new Error(err.message || "Failed to send voice message.");
  }
};

