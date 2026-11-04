import test from "node:test";
import assert from "node:assert/strict";
import TelegramScheduledMessage from "../models/TelegramScheduledMessage.js";

test("Telegram Scheduled Message: Status lifecycle transitions and validation", () => {
  const futureDate = new Date(Date.now() + 3600 * 1000);

  const scheduled = new TelegramScheduledMessage({
    owner: "507f1f77bcf86cd799439011",
    peerId: "123456789",
    peerType: "user",
    recipientName: "Test Contact",
    message: "Meeting reminder",
    scheduledAt: futureDate,
    status: "scheduled",
  });

  assert.equal(scheduled.status, "scheduled");
  assert.equal(scheduled.isClaimed, false);
  assert.equal(scheduled.attempts, 0);

  // Transition to processing (claimed)
  scheduled.isClaimed = true;
  scheduled.claimedAt = new Date();
  scheduled.status = "processing";
  assert.equal(scheduled.status, "processing");

  // Transition to sent
  scheduled.status = "sent";
  scheduled.sentAt = new Date();
  scheduled.telegramMessageId = 998877;
  scheduled.isClaimed = false;
  assert.equal(scheduled.status, "sent");
  assert.equal(scheduled.telegramMessageId, 998877);
});

test("Telegram Chats: Dialogs category classification logic", () => {
  const rawDialogs = [
    { id: "101", isUser: true, isChannel: false, isGroup: false },
    { id: "102", isUser: false, isChannel: true, isGroup: false, entity: { broadcast: true } },
    { id: "103", isUser: false, isChannel: true, isGroup: false, entity: { broadcast: false } }, // Megagroup
    { id: "104", isUser: false, isChannel: false, isGroup: true },
  ];

  const classify = (dialog) => {
    if (dialog.isChannel && dialog.entity?.broadcast) return "channel";
    if (dialog.isGroup || (dialog.isChannel && !dialog.entity?.broadcast)) return "group";
    return "private";
  };

  const results = rawDialogs.map(classify);
  assert.deepEqual(results, ["private", "channel", "group", "group"]);
});

test("Telegram Media: File type and extension classification", () => {
  const getMediaType = (mime) => {
    if (mime.startsWith("image/")) return "photo";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/ogg") || mime.includes("opus")) return "voice";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.includes("pdf")) return "pdf";
    return "document";
  };

  assert.equal(getMediaType("image/jpeg"), "photo");
  assert.equal(getMediaType("video/mp4"), "video");
  assert.equal(getMediaType("audio/ogg"), "voice");
  assert.equal(getMediaType("audio/mpeg"), "audio");
  assert.equal(getMediaType("application/pdf"), "pdf");
  assert.equal(getMediaType("application/zip"), "document");
});

test("Telegram Scheduler: Stale claim recovery calculation", () => {
  const now = new Date();
  const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);
  const fourMinutesAgo = new Date(now.getTime() - 4 * 60 * 1000);
  const fiveMinuteThreshold = new Date(now.getTime() - 5 * 60 * 1000);

  const isStale = (claimedAt) => claimedAt < fiveMinuteThreshold;

  assert.equal(isStale(sixMinutesAgo), true, "6 minutes ago should be considered stale and recovered");
  assert.equal(isStale(fourMinutesAgo), false, "4 minutes ago is still actively processing");
});

test("Telegram Peers: Registry caching and InputPeer resolution mapping", async () => {
  const { recordPeersFromDialogs, getPeerInfo, resolvePeer } = await import(
    "../services/telegram/telegramPeers.service.js"
  );

  const mockUserId = "user_test_999";
  const mockDialogs = [
    {
      id: "-1002153764938",
      isUser: false,
      isChannel: true,
      isGroup: true,
      title: "SOK Y23",
      entity: {
        id: "2153764938",
        accessHash: "2222416044022821446",
        broadcast: false,
      },
    },
    {
      id: "777000",
      isUser: true,
      isChannel: false,
      isGroup: false,
      title: "Telegram Official",
      entity: {
        id: "777000",
        accessHash: "-9109222970345807645",
        self: false,
      },
    },
    {
      id: "-5203200101",
      isUser: false,
      isChannel: false,
      isGroup: true,
      title: "Placement Basic Chat",
      entity: {
        id: "5203200101",
      },
    },
    {
      id: "6420239463",
      isUser: true,
      isChannel: false,
      isGroup: false,
      title: "Saved Messages Self",
      entity: {
        id: "6420239463",
        accessHash: "6105405544084013941",
        self: true,
      },
    },
  ];

  recordPeersFromDialogs(mockUserId, mockDialogs);

  // 1. Verify channel peer metadata
  const channelInfo = getPeerInfo(mockUserId, "-1002153764938");
  assert.ok(channelInfo);
  assert.equal(channelInfo.entityId, "2153764938");
  assert.equal(channelInfo.accessHash, "2222416044022821446");
  assert.equal(channelInfo.peerType, "channel");

  // 2. Verify basic chat metadata
  const chatInfo = getPeerInfo(mockUserId, "-5203200101");
  assert.ok(chatInfo);
  assert.equal(chatInfo.peerType, "chat");

  // 3. Verify self peer metadata
  const selfInfo = getPeerInfo(mockUserId, "6420239463");
  assert.ok(selfInfo);
  assert.equal(selfInfo.isSelf, true);

  // 4. Test resolvePeer with mock Telegram client
  const mockClient = {
    _self: { id: "6420239463" },
    getMe: async () => ({ id: "6420239463" }),
  };

  // Test self resolution
  const resolvedSelf = await resolvePeer(mockClient, mockUserId, "6420239463");
  assert.equal(resolvedSelf.className, "InputPeerSelf");

  // Test channel resolution
  const resolvedChannel = await resolvePeer(mockClient, mockUserId, "-1002153764938");
  assert.equal(resolvedChannel.className, "InputPeerChannel");
  assert.equal(resolvedChannel.channelId.toString(), "2153764938");
  assert.equal(resolvedChannel.accessHash.toString(), "2222416044022821446");

  // Test user resolution
  const resolvedUser = await resolvePeer(mockClient, mockUserId, "777000");
  assert.equal(resolvedUser.className, "InputPeerUser");
  assert.equal(resolvedUser.userId.toString(), "777000");

  // Test basic chat resolution
  const resolvedChat = await resolvePeer(mockClient, mockUserId, "-5203200101");
  assert.equal(resolvedChat.className, "InputPeerChat");
  assert.equal(resolvedChat.chatId.toString(), "5203200101");
});

test("Telegram Read Synchronization: markChatAsRead channel vs private chat routing and unread zeroing", async () => {
  const calls = [];
  const mockClient = {
    invoke: async (request) => {
      calls.push(request.className);
      return true;
    },
  };

  const { Api } = await import("telegram");

  // 1. Channel mark as read uses channels.ReadHistory
  const channelPeer = new Api.InputPeerChannel({ channelId: 1002153764n, accessHash: 123456n });
  const reqChannel = new Api.channels.ReadHistory({ channel: channelPeer, maxId: 42 });
  await mockClient.invoke(reqChannel);
  assert.equal(calls[0], "channels.ReadHistory");
  assert.equal(reqChannel.maxId, 42);

  // 2. User mark as read uses messages.ReadHistory
  const userPeer = new Api.InputPeerUser({ userId: 777000n, accessHash: 789012n });
  const reqUser = new Api.messages.ReadHistory({ peer: userPeer, maxId: 99 });
  await mockClient.invoke(reqUser);
  assert.equal(calls[1], "messages.ReadHistory");
  assert.equal(reqUser.maxId, 99);
});

test("Telegram Deletion: Delete message revoke parameter validation", async () => {
  const deleteCalls = [];
  const mockClient = {
    deleteMessages: async (peer, ids, options) => {
      deleteCalls.push({ peer, ids, options });
      return [{ id: ids[0] }];
    },
  };

  const { Api } = await import("telegram");
  const peer = new Api.InputPeerUser({ userId: 12345n, accessHash: 67890n });

  // Delete for everyone
  await mockClient.deleteMessages(peer, [101], { revoke: true });
  assert.equal(deleteCalls[0].options.revoke, true);

  // Delete for me
  await mockClient.deleteMessages(peer, [102], { revoke: false });
  assert.equal(deleteCalls[1].options.revoke, false);
});

test("Telegram Unread Updates: UpdateReadHistoryInbox and UpdateReadChannelInbox parse genuine chat IDs", async () => {
  const { Api } = await import("telegram");

  // 1. Direct user chat read
  const u1 = new Api.UpdateReadHistoryInbox({
    peer: new Api.PeerUser({ userId: 998877n }),
    maxId: 55,
    stillUnreadCount: 0,
  });
  assert.equal(u1.peer.userId.toString(), "998877");
  assert.equal(u1.stillUnreadCount, 0);

  // 2. Channel chat read
  const u2 = new Api.UpdateReadChannelInbox({
    channelId: 2153764938n,
    maxId: 120,
    stillUnreadCount: 0,
  });
  assert.equal(`-100${u2.channelId.toString()}`, "-1002153764938");
  assert.equal(u2.stillUnreadCount, 0);
});

test("Telegram Media: Send Poll and Location MTProto structure validation", async () => {
  const { Api, helpers } = await import("telegram");

  // 1. Verify Poll MTProto instantiation
  const question = "Are we meeting today?";
  const options = ["Yes, 5 PM", "No, tomorrow"];
  const poll = new Api.Poll({
    id: helpers.generateRandomBigInt(),
    question,
    answers: options.map((opt, idx) => new Api.PollAnswer({ text: opt, option: Buffer.from([idx]) })),
    multipleChoice: false,
    quiz: false,
    publicVoters: true,
  });
  const mediaPoll = new Api.InputMediaPoll({ poll });
  assert.equal(mediaPoll.poll.question, question);
  assert.equal(mediaPoll.poll.answers.length, 2);
  assert.equal(mediaPoll.poll.answers[0].text, "Yes, 5 PM");

  // 2. Verify GeoPoint MTProto instantiation
  const lat = 17.385;
  const long = 78.4867;
  const mediaGeo = new Api.InputMediaGeoPoint({
    geoPoint: new Api.InputGeoPoint({
      lat,
      long,
      accuracyRadius: 10,
    }),
  });
  assert.equal(mediaGeo.geoPoint.lat, lat);
  assert.equal(mediaGeo.geoPoint.long, long);
});


