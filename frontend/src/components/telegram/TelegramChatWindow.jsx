import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  Clock,
  MoreVertical,
  Check,
  CheckCheck,
  Loader2,
  Trash2,
  FileText,
  Download,
  Image as ImageIcon,
  Smile,
  X,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";
import {
  fetchTelegramMessages,
  sendTelegramMessage,
  sendTelegramMedia,
  sendTelegramPoll,
  sendTelegramLocation,
  sendTelegramVoice,
  deleteTelegramMessage,
  markTelegramChatAsRead,
  getTelegramMediaUrl,
} from "../../services/telegramApi";
import TelegramAvatar from "./TelegramAvatar";
import TelegramMessageBubble from "./TelegramMessageBubble";
import TelegramMessageComposer from "./TelegramMessageComposer";
import TelegramEmojiPanel from "./TelegramEmojiPanel";
import TelegramScheduledMenuModal from "./TelegramScheduledMenuModal";
import { fetchScheduledDeliveries } from "../../services/unifiedScheduleApi";
import { toast } from "react-toastify";

const scheduledTargetMatches = (item, chat) => {
  if (!item || !chat) return false;
  const chatId = String(chat.id || "");
  const chatUsername = String(chat.username || "").replace(/^@/, "").toLowerCase();
  const chatTitle = String(chat.title || "").toLowerCase();

  const itemRec = String(item.recipient || "").replace(/^@/, "").toLowerCase();
  const itemHandle = String(item.recipientHandle || "").replace(/^@/, "").toLowerCase();
  const itemName = String(item.recipientName || "").toLowerCase();

  return (
    itemRec === chatId ||
    itemHandle === chatId ||
    (chatUsername && (itemRec === chatUsername || itemHandle === chatUsername)) ||
    (chatTitle && itemName === chatTitle)
  );
};

export default function TelegramChatWindow({
  activeChat,
  onBack,
  onOpenScheduleModal,
  onRefreshChats,
  onChatMarkedRead,
  onToggleContactInfo,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [failedMediaIds, setFailedMediaIds] = useState(new Set());

  // Floating jump-to-bottom & unread message badge state
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [newMessagesWhileAway, setNewMessagesWhileAway] = useState(0);
  const [liveUnreadCount, setLiveUnreadCount] = useState(0);

  // Optimistic deletion modal target: null | message object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Scheduled message action menu target
  const [selectedScheduledItem, setSelectedScheduledItem] = useState(null);

  // Emoji Panel & Voice Recording state
  const [isEmojiPanelOpen, setIsEmojiPanelOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);

  const fileInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const unreadDividerRef = useRef(null);
  const lastMarkedReadIdRef = useRef(null);
  const highestReadInboxIdRef = useRef(0);
  const debouncedSyncTimerRef = useRef(null);
  const unreadIncomingIdsRef = useRef([]);
  const messageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Strictly container-scoped scroll to bottom (NEVER touches window or document)
  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = scrollContainerRef.current;
    if (el) {
      if (behavior === "smooth") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, []);

  // Multi-pass scroll-to-bottom to guarantee view lands on latest messages
  // even as avatars, media previews, and layouts asynchronously render
  const settleScrollAtBottom = useCallback(() => {
    scrollToBottom("auto");
    requestAnimationFrame(() => scrollToBottom("auto"));
    setTimeout(() => scrollToBottom("auto"), 50);
    setTimeout(() => scrollToBottom("auto"), 150);
  }, [scrollToBottom]);

  // Check if user is already near the bottom of their message view
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // Synchronize mark-as-read with Telegram MTProto for opened conversation
  const triggerMarkAsRead = useCallback(
    async (chatId, maxMsgId, peerInfo, remainingUnread = 0) => {
      if (!chatId) return;
      const key = `${chatId}_${maxMsgId}_${remainingUnread}`;
      if (lastMarkedReadIdRef.current === key) return;
      lastMarkedReadIdRef.current = key;

      try {
        await markTelegramChatAsRead(chatId, {
          maxId: maxMsgId,
          unreadCount: remainingUnread,
          accessHash: peerInfo?.accessHash,
          peerType: peerInfo?.peerType,
        });
      } catch (err) {
        console.warn("[TelegramChatWindow] markAsRead sync notice:", err.message);
      }
    },
    []
  );

  // Load chat messages when activeChat changes
  const loadMessages = useCallback(async () => {
    if (!activeChat?.id) return;
    setLoading(true);
    setLoadError("");
    setHasMoreOlder(true);
    setShowJumpBottom(false);
    setNewMessagesWhileAway(0);

    const initialUnread = Number(activeChat.unreadCount) || 0;
    const initialReadInbox = Number(activeChat.readInboxMaxId) || 0;
    highestReadInboxIdRef.current = initialReadInbox;
    setLiveUnreadCount(initialUnread);

    try {
      const data = await fetchTelegramMessages(activeChat.id, {
        limit: 50,
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });

      // Merge pending/processing scheduled messages for this active chat
      let mergedMessages = Array.isArray(data) ? [...data] : [];
      try {
        const scheduledData = await fetchScheduledDeliveries({ channel: "telegram", limit: 50 });
        if (scheduledData?.items && Array.isArray(scheduledData.items)) {
          const matchingScheduled = scheduledData.items.filter(
            (item) =>
              scheduledTargetMatches(item, activeChat) &&
              ["scheduled", "processing", "failed"].includes(item.status)
          );

          const scheduledBubbleObjects = matchingScheduled.map((item) => ({
            id: `sched_${item._id}`,
            scheduledId: item._id,
            text: item.message,
            date: item.createdAt || item.scheduledAt,
            out: true,
            isScheduled: true,
            scheduledAt: item.scheduledAt,
            timeZone: item.timeZone,
            status: item.status,
            scheduledItem: item,
          }));

          const existingIds = new Set(mergedMessages.map((m) => m.id));
          for (const sMsg of scheduledBubbleObjects) {
            if (!existingIds.has(sMsg.id)) {
              mergedMessages.push(sMsg);
            }
          }
          mergedMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }
      } catch (schedErr) {
        console.warn("[TelegramChatWindow] Scheduled deliveries fetch notice:", schedErr.message);
      }

      setMessages(mergedMessages);

      const unreadCount = Number(activeChat.unreadCount) || 0;
      const readInboxMaxId = Number(activeChat.readInboxMaxId) || 0;
      highestReadInboxIdRef.current = readInboxMaxId;
      setLiveUnreadCount(unreadCount);

      const incoming = Array.isArray(data) ? data.filter((m) => !m.out) : [];
      let boundaryIdx = -1;
      if (unreadCount > 0 && incoming.length > 0) {
        if (readInboxMaxId > 0) {
          boundaryIdx = data.findIndex((m) => !m.out && Number(m.id) > readInboxMaxId);
        }
        if (boundaryIdx === -1 && data.length >= unreadCount) {
          boundaryIdx = data.length - unreadCount;
        }

        // Store unread incoming IDs to accurately calculate decrementing count
        if (readInboxMaxId > 0) {
          unreadIncomingIdsRef.current = incoming.filter((m) => Number(m.id) > readInboxMaxId).map((m) => m.id);
        } else {
          unreadIncomingIdsRef.current = incoming.slice(-unreadCount).map((m) => m.id);
        }
      } else {
        unreadIncomingIdsRef.current = [];
      }

      if (boundaryIdx >= 0) {
        // Chat has unread messages: scroll directly to the unread divider and show jump button
        setShowJumpBottom(true);
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (unreadDividerRef.current) {
              unreadDividerRef.current.scrollIntoView({ behavior: "auto", block: "center" });
            }
          }, 80);
        });
      } else {
        // Multi-pass scroll ensures we settle at the bottom with latest messages
        requestAnimationFrame(() => {
          settleScrollAtBottom();
        });
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      const errMsg = err.response?.data?.message || err.message || "Failed to load conversation history.";
      setLoadError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [activeChat?.id, activeChat?.accessHash, activeChat?.peerType, activeChat?.unreadCount, activeChat?.readInboxMaxId, settleScrollAtBottom]);

  // Pagination: load older messages when user scrolls near top
  const loadOlderMessages = async () => {
    if (loading || loadingOlder || !hasMoreOlder || messages.length === 0 || !activeChat?.id) return;
    const oldestMsg = messages[0];
    if (!oldestMsg?.id) return;

    setLoadingOlder(true);
    const container = scrollContainerRef.current;
    const oldScrollHeight = container?.scrollHeight || 0;
    const oldScrollTop = container?.scrollTop || 0;

    try {
      const olderData = await fetchTelegramMessages(activeChat.id, {
        limit: 40,
        offsetId: oldestMsg.id,
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });

      if (!olderData || olderData.length === 0) {
        setHasMoreOlder(false);
      } else {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = olderData.filter((m) => !existingIds.has(m.id));
          if (uniqueOlder.length === 0) {
            setHasMoreOlder(false);
            return prev;
          }
          return [...uniqueOlder, ...prev];
        });

        // Strictly preserve scroll position without jumping
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
          }
        });
      }
    } catch (err) {
      console.warn("Failed to load older messages:", err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // =========================================================================
  // REAL-TIME SYNCHRONIZATION: Listen for newly scheduled Telegram messages
  // =========================================================================
  useEffect(() => {
    const handleNewScheduled = (e) => {
      const delivery = e.detail?.delivery;
      if (!delivery || delivery.channel !== "telegram") return;
      if (scheduledTargetMatches(delivery, activeChat)) {
        const newBubble = {
          id: `sched_${delivery._id}`,
          scheduledId: delivery._id,
          text: delivery.message,
          date: delivery.createdAt || new Date().toISOString(),
          out: true,
          isScheduled: true,
          scheduledAt: delivery.scheduledAt,
          timeZone: delivery.timeZone,
          status: delivery.status || "scheduled",
          scheduledItem: delivery,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newBubble.id || m.scheduledId === delivery._id)) return prev;
          return [...prev, newBubble];
        });
        setInputText("");
        requestAnimationFrame(() => {
          settleScrollAtBottom();
        });
      }
    };

    window.addEventListener("tasklert:telegram-scheduled", handleNewScheduled);
    return () => window.removeEventListener("tasklert:telegram-scheduled", handleNewScheduled);
  }, [activeChat, settleScrollAtBottom]);

  // =========================================================================
  // AUTOMATIC TRANSFORMATION: Poll pending scheduled messages for delivery status
  // When delivered by backend worker, automatically converts bubble to normal sent state!
  // =========================================================================
  useEffect(() => {
    if (!activeChat?.id) return;

    const interval = setInterval(async () => {
      const hasScheduled = messages.some((m) => m.isScheduled);
      if (!hasScheduled) return;

      try {
        const data = await fetchScheduledDeliveries({ channel: "telegram", limit: 40 });
        if (data?.items && Array.isArray(data.items)) {
          let deliveredCount = 0;
          setMessages((prev) =>
            prev.map((m) => {
              if (!m.isScheduled) return m;
              const found = data.items.find((item) => item._id === m.scheduledId);
              if (found && found.status === "sent") {
                deliveredCount++;
                return {
                  ...m,
                  isScheduled: false,
                  status: "sent",
                  date: found.sentAt || new Date().toISOString(),
                };
              }
              if (found && found.status === "failed") {
                return { ...m, status: "failed" };
              }
              return m;
            })
          );

          if (deliveredCount > 0) {
            toast.success("Scheduled message delivered to Telegram!");
            setTimeout(() => {
              loadMessages();
            }, 2000);
          }
        }
      } catch (_) {}
    }, 8000);

    return () => clearInterval(interval);
  }, [activeChat?.id, messages, loadMessages]);

  useEffect(() => {
    setInputText("");
    setSelectedFile(null);
    setFailedMediaIds(new Set());
    setDeleteTarget(null);
    loadMessages();
  }, [loadMessages]);

  // Handle incoming real-time message appended from SSE
  const appendIncomingMessage = useCallback((newMsg) => {
    if (String(newMsg.chatId) === String(activeChat?.id)) {
      const wasNearBottom = isNearBottom();
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      if (!newMsg.out) {
        unreadIncomingIdsRef.current.push(newMsg.id);
      }

      if (wasNearBottom) {
        requestAnimationFrame(() => {
          scrollToBottom("smooth");
        });
        if (!newMsg.out && activeChat?.id) {
          triggerMarkAsRead(activeChat.id, newMsg.id, activeChat, 0);
          highestReadInboxIdRef.current = Math.max(highestReadInboxIdRef.current, newMsg.id);
          setLiveUnreadCount(0);
          if (onChatMarkedRead) {
            onChatMarkedRead(activeChat.id, newMsg.id, 0);
          }
        }
      } else {
        // User is currently reading older messages: DO NOT force scroll!
        // Increment the floating unread counter instead
        setNewMessagesWhileAway((prev) => prev + 1);
        if (!newMsg.out) {
          setLiveUnreadCount((prev) => prev + 1);
        }
        setShowJumpBottom(true);
      }
    }
  }, [activeChat?.id, activeChat, isNearBottom, scrollToBottom, triggerMarkAsRead, onChatMarkedRead]);

  // Expose append, edit, and delete handlers to window events
  useEffect(() => {
    const handleCustomNewMessage = (e) => {
      if (e.detail) appendIncomingMessage(e.detail);
    };

    const handleCustomEditedMessage = (e) => {
      const edited = e.detail;
      if (!edited) return;
      if (String(edited.chatId) === String(activeChat?.id)) {
        setMessages((prev) =>
          prev.map((m) => (m.id === edited.id ? { ...m, text: edited.text, isEdited: true } : m))
        );
      }
    };

    const handleCustomDeletedMessages = (e) => {
      const { messageIds } = e.detail || {};
      if (Array.isArray(messageIds) && messageIds.length > 0) {
        setMessages((prev) => prev.filter((m) => !messageIds.includes(m.id)));
      }
    };

    window.addEventListener("telegram:new_message", handleCustomNewMessage);
    window.addEventListener("telegram:message_edited", handleCustomEditedMessage);
    window.addEventListener("telegram:messages_deleted", handleCustomDeletedMessages);

    return () => {
      window.removeEventListener("telegram:new_message", handleCustomNewMessage);
      window.removeEventListener("telegram:message_edited", handleCustomEditedMessage);
      window.removeEventListener("telegram:messages_deleted", handleCustomDeletedMessages);
    };
  }, [activeChat?.id, appendIncomingMessage]);

  // Send text message
  const handleSendText = async (textToSend) => {
    if (!activeChat?.id || !textToSend?.trim()) return;
    setSending(true);
    try {
      const res = await sendTelegramMessage(activeChat.id, textToSend.trim(), {
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
      if (onRefreshChats) onRefreshChats();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // Send file/attachment
  const handleSendFile = async (file, caption = "") => {
    if (!activeChat?.id || !file) return;
    setSending(true);
    try {
      const res = await sendTelegramMedia(activeChat.id, file, caption?.trim() || "", {
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });
      if (res.message) {
        setMessages((prev) => [...prev, res.message]);
      }
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
      if (onRefreshChats) onRefreshChats();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to send file.");
    } finally {
      setSending(false);
    }
  };

  // Send Poll
  const handleSendPoll = async (pollData) => {
    if (!activeChat?.id) return;
    setSending(true);
    try {
      await sendTelegramPoll(activeChat.id, pollData, {
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });
      toast.success("Poll created on Telegram!");
      loadMessages();
      if (onRefreshChats) onRefreshChats();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to create poll.");
      throw err;
    } finally {
      setSending(false);
    }
  };

  // Send Location
  const handleSendLocation = async (locationData) => {
    if (!activeChat?.id) return;
    setSending(true);
    try {
      await sendTelegramLocation(activeChat.id, locationData, {
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
      });
      toast.success("Location sent on Telegram!");
      loadMessages();
      if (onRefreshChats) onRefreshChats();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to send location.");
      throw err;
    } finally {
      setSending(false);
    }
  };

  // Insert emoji at cursor position in text input
  const handleInsertEmoji = (emoji) => {
    const input = messageInputRef.current;
    if (!input) {
      setInputText((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? inputText.length;
    const end = input.selectionEnd ?? inputText.length;
    const updated = inputText.substring(0, start) + emoji + inputText.substring(end);
    setInputText(updated);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // Real Browser Microphone Voice Recording
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecordingVoice(true);
      setVoiceRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setVoiceRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      toast.error("Microphone permission was denied or unavailable.");
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
    }
    setIsRecordingVoice(false);
    setVoiceRecordingDuration(0);
    audioChunksRef.current = [];
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const duration = voiceRecordingDuration;
    recorder.onstop = async () => {
      recorder.stream?.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
      audioChunksRef.current = [];
      setIsRecordingVoice(false);
      setVoiceRecordingDuration(0);

      if (audioBlob.size > 0 && activeChat?.id) {
        try {
          setSending(true);
          const res = await sendTelegramVoice(activeChat.id, audioBlob, duration, {
            accessHash: activeChat.accessHash,
            peerType: activeChat.peerType,
          });
          if (res.message) {
            setMessages((prev) => [...prev, res.message]);
            requestAnimationFrame(() => scrollToBottom("smooth"));
          }
          toast.success("Voice message sent!");
        } catch (err) {
          toast.error(err.response?.data?.message || err.message || "Failed to send voice message.");
        } finally {
          setSending(false);
        }
      }
    };

    recorder.stop();
  };

  // Instant Optimistic Message Deletion
  const executeOptimisticDelete = async (messageId, revoke) => {
    if (!messageId || !activeChat?.id) return;
    setDeleteTarget(null);

    // 1. Instant optimistic removal from UI (0ms delay)
    const backupMessage = messages.find((m) => m.id === messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      setIsDeleting(true);
      // 2. Real Telegram MTProto deletion
      await deleteTelegramMessage(activeChat.id, messageId, {
        accessHash: activeChat.accessHash,
        peerType: activeChat.peerType,
        revoke,
      });

      toast.success(revoke ? "Message deleted for everyone." : "Message deleted for you.", {
        autoClose: 2000,
        toastId: `del-${messageId}`,
      });

      if (onRefreshChats) onRefreshChats();
    } catch (err) {
      // 3. Rollback UI if Telegram deletion fails
      if (backupMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === messageId)) return prev;
          return [...prev, backupMessage].sort((a, b) => (a.id || 0) - (b.id || 0));
        });
      }
      toast.error(err.response?.data?.message || err.message || "Failed to delete message on Telegram.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date separators
  const formatSeparatorDate = (isoString) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) return "Today";
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch (_) {
      return "";
    }
  };

  const formatUnreadCount = (count) => {
    const n = Number(count) || 0;
    if (n <= 0) return null;
    if (n >= 10000) return `${Math.floor(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  // Calculate unread boundary index for displaying "Unread Messages" separator
  const initialUnreadCount = Number(activeChat?.unreadCount) || 0;
  const readInboxMaxId = Number(activeChat?.readInboxMaxId) || 0;
  let unreadBoundaryIndex = -1;
  if (initialUnreadCount > 0 && Array.isArray(messages) && messages.length > 0) {
    if (readInboxMaxId > 0) {
      unreadBoundaryIndex = messages.findIndex((m) => !m.out && Number(m.id) > readInboxMaxId);
    }
    if (unreadBoundaryIndex === -1 && messages.length >= initialUnreadCount) {
      unreadBoundaryIndex = messages.length - initialUnreadCount;
    }
  }

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-purple-50/20 via-white to-purple-50/30">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-sky-500/25">
          <Send className="w-8 h-8 sm:w-10 sm:h-10 -ml-1 mt-1 fill-white" />
        </div>
        <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">Your Telegram Workspace</h3>
        <p className="text-xs text-gray-500 mt-1.5 max-w-sm leading-relaxed">
          Select a conversation from the left panel to start messaging, schedule communications, or view media.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 max-w-md">
          <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] font-bold text-purple-700">
            🔒 MTProto Encrypted
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] font-bold text-purple-700">
            ⚡ Real-time Sync
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[11px] font-bold text-purple-700">
            📅 Smart Scheduling
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col h-full overflow-hidden relative"
      style={{ backgroundColor: "var(--tg-chat-bg)" }}
    >
      {/* ============================================================ */}
      {/* 1. FIXED CONVERSATION HEADER                                 */}
      {/* ============================================================ */}
      <div className="shrink-0 px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-purple-100 bg-white flex items-center justify-between shadow-2xs z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Mobile Back Button to return to Chat List */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 cursor-pointer transition active:scale-95"
              title="Back to conversation list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Avatar (with guaranteed non-white initials fallback) */}
          <TelegramAvatar chat={activeChat} size="md" />

          {/* Title & Subtitle */}
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-tight">
              {activeChat.isSelf ? "Saved Messages" : activeChat.title}
            </h3>
            <div className="text-[10px] sm:text-[11px] text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
              {activeChat.isSelf ? (
                <span className="text-purple-600 font-semibold">Cloud Storage</span>
              ) : activeChat.type === "group" ? (
                <span>Group • {activeChat.participantsCount ? `${activeChat.participantsCount} members` : "Chat"}</span>
              ) : activeChat.username ? (
                <span className="text-purple-600 font-mono">@{activeChat.username}</span>
              ) : activeChat.phone ? (
                <span>{activeChat.phone}</span>
              ) : (
                <span className="capitalize">{activeChat.type || "conversation"}</span>
              )}
              {activeChat.isUser && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  online
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Schedule Message CTA */}
          <button
            type="button"
            onClick={onOpenScheduleModal}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-purple-100 bg-purple-50/70 hover:bg-purple-100 text-purple-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
            title="Schedule message"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Schedule</span>
          </button>

          {/* Refresh Messages */}
          <button
            type="button"
            onClick={loadMessages}
            disabled={loading}
            className="p-1.5 rounded-xl text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            title="Refresh Messages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
          </button>

          {/* View Details / Shared Media Toggle */}
          <button
            type="button"
            onClick={onToggleContactInfo}
            className="p-1.5 rounded-xl text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. CHAT BODY: MESSAGES + (OPTIONAL) RIGHT EMOJI/STICKER/GIF  */}
      {/* ============================================================ */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Column: Messages List + Composer */}
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden relative">
          <div
            ref={scrollContainerRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop < 60 && hasMoreOlder && !loadingOlder) {
                loadOlderMessages();
              }
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;

              // Detect incoming message elements that have entered the visible reading viewport
              const containerRect = el.getBoundingClientRect();
              const msgNodes = el.querySelectorAll("[data-msg-id]");
              let maxVisibleIncomingId = highestReadInboxIdRef.current;

              msgNodes.forEach((node) => {
                const isIncoming = node.getAttribute("data-msg-incoming") === "1";
                const msgId = Number(node.getAttribute("data-msg-id"));
                if (isIncoming && msgId) {
                  const rect = node.getBoundingClientRect();
                  // Has entered reading area
                  if (rect.top < containerRect.bottom - 40) {
                    if (msgId > maxVisibleIncomingId) {
                      maxVisibleIncomingId = msgId;
                    }
                  }
                }
              });

              if (nearBottom) {
                setNewMessagesWhileAway(0);
                const allIncoming = messages.filter((m) => !m.out);
                const maxLoadedIncomingId = allIncoming.length > 0 ? Math.max(...allIncoming.map((m) => m.id || 0)) : 0;
                if (maxLoadedIncomingId > maxVisibleIncomingId) {
                  maxVisibleIncomingId = maxLoadedIncomingId;
                }
              }

              if (maxVisibleIncomingId > highestReadInboxIdRef.current) {
                highestReadInboxIdRef.current = maxVisibleIncomingId;

                const remaining = nearBottom
                  ? 0
                  : unreadIncomingIdsRef.current.filter((id) => id > maxVisibleIncomingId).length;

                setLiveUnreadCount(remaining);

                if (onChatMarkedRead && activeChat?.id) {
                  onChatMarkedRead(activeChat.id, maxVisibleIncomingId, remaining);
                }

                if (debouncedSyncTimerRef.current) clearTimeout(debouncedSyncTimerRef.current);
                debouncedSyncTimerRef.current = setTimeout(() => {
                  if (activeChat?.id) {
                    triggerMarkAsRead(activeChat.id, maxVisibleIncomingId, activeChat, remaining);
                  }
                }, nearBottom ? 50 : 350);
              }

              setShowJumpBottom(!nearBottom || liveUnreadCount > 0);
            }}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3.5 tg-custom-scrollbar tg-chat-doodle-bg relative"
          >
            {/* Older Messages Loading Indicator */}
            {loadingOlder && (
              <div className="py-2 flex justify-center items-center gap-1.5 text-purple-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[11px] text-gray-500 font-medium">Loading older messages...</span>
              </div>
            )}

            {loading && messages.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-2" />
                <span className="text-xs text-gray-500 font-medium">Loading conversation messages...</span>
              </div>
            ) : loadError ? (
              <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">Unable to open conversation</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mb-4">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={loadMessages}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Loading Chat
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <Send className="w-6 h-6 fill-purple-600" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">No message history</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Be the first to send a message to <strong>{activeChat.isSelf ? "Saved Messages" : activeChat.title}</strong>!
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const msgDateStr = formatSeparatorDate(msg.date);
                const prevMsgDateStr = idx > 0 ? formatSeparatorDate(messages[idx - 1].date) : null;
                const showDateSeparator = msgDateStr && msgDateStr !== prevMsgDateStr;
                const showUnreadDivider = idx === unreadBoundaryIndex;

                return (
                  <React.Fragment key={msg.id || `msg-${idx}`}>
                    {/* Date Separator Pill */}
                    {showDateSeparator && (
                      <div className="flex justify-center my-3 select-none">
                        <span
                          className="px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs"
                          style={{
                            backgroundColor: "var(--tg-date-badge-bg)",
                            borderColor: "var(--tg-date-badge-border)",
                            color: "var(--tg-date-badge-text)",
                          }}
                        >
                          {msgDateStr}
                        </span>
                      </div>
                    )}

                    {/* Telegram-style Unread Messages Divider */}
                    {showUnreadDivider && (
                      <div
                        ref={unreadDividerRef}
                        className="flex items-center justify-center my-3 select-none"
                      >
                        <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-extrabold border border-purple-200/80 shadow-2xs">
                          <span>Unread Messages</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                        </div>
                      </div>
                    )}

                    {/* Message Bubble with tracking attributes */}
                    <div
                      data-msg-id={msg.id}
                      data-msg-incoming={!msg.out ? "1" : "0"}
                      className="w-full"
                    >
                      <TelegramMessageBubble
                        msg={msg}
                        activeChat={activeChat}
                        onDeleteRequest={(target) => setDeleteTarget(target)}
                        onScheduledClick={(target) => setSelectedScheduledItem(target)}
                        isFailedMedia={failedMediaIds.has(msg.id)}
                        onMediaError={(id) => setFailedMediaIds((prev) => new Set(prev).add(id))}
                      />
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Floating Jump-to-Unread / Jump-to-Bottom Button */}
          {showJumpBottom && (
            <button
              type="button"
              onClick={() => {
                if (liveUnreadCount > 0) {
                  // Navigate smoothly to the first unread message
                  const container = scrollContainerRef.current;
                  const firstUnreadId = unreadIncomingIdsRef.current.find((id) => id > highestReadInboxIdRef.current);
                  const firstUnreadNode = firstUnreadId
                    ? container?.querySelector(`[data-msg-id="${firstUnreadId}"]`)
                    : null;
                  if (firstUnreadNode) {
                    firstUnreadNode.scrollIntoView({ behavior: "smooth", block: "center" });
                  } else if (unreadDividerRef.current) {
                    unreadDividerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                  } else {
                    scrollToBottom("smooth");
                  }
                } else {
                  scrollToBottom("smooth");
                  const allIncoming = messages.filter((m) => !m.out);
                  const maxMsgId = allIncoming.length > 0 ? Math.max(...allIncoming.map((m) => m.id || 0)) : 0;
                  if (maxMsgId > 0 && activeChat?.id) {
                    triggerMarkAsRead(activeChat.id, maxMsgId, activeChat, 0);
                    if (onChatMarkedRead) {
                      onChatMarkedRead(activeChat.id, maxMsgId, 0);
                    }
                  }
                  setNewMessagesWhileAway(0);
                  setShowJumpBottom(false);
                }
              }}
              className="absolute right-4 bottom-20 z-20 w-10 h-10 rounded-full bg-white/95 border border-purple-200 shadow-lg hover:shadow-xl hover:bg-purple-50 text-purple-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer group"
              title={liveUnreadCount > 0 ? "Jump to first unread message" : "Jump to latest messages"}
            >
              <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              {(liveUnreadCount > 0 || newMessagesWhileAway > 0) && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                  {formatUnreadCount(liveUnreadCount > 0 ? liveUnreadCount : newMessagesWhileAway)}
                </span>
              )}
            </button>
          )}

          {/* Telegram Desktop & Mobile Message Composer */}
          <TelegramMessageComposer
            activeChat={activeChat}
            inputText={inputText}
            setInputText={setInputText}
            onSendMessage={handleSendText}
            onSendFile={handleSendFile}
            onSendPoll={handleSendPoll}
            onSendLocation={handleSendLocation}
            onStartVoiceRecording={startVoiceRecording}
            isRecordingVoice={isRecordingVoice}
            voiceRecordingDuration={voiceRecordingDuration}
            onCancelVoiceRecording={cancelVoiceRecording}
            onSendVoiceRecording={stopAndSendVoiceRecording}
            onToggleEmojiPanel={() => setIsEmojiPanelOpen((prev) => !prev)}
            isEmojiPanelOpen={isEmojiPanelOpen}
            sending={sending}
            inputRef={messageInputRef}
            onOpenSchedule={onOpenScheduleModal}
          />
        </div>

        {/* Right Column: Full Emoji, Stickers & GIFs Panel */}
        {isEmojiPanelOpen && (
          <TelegramEmojiPanel
            isOpen={isEmojiPanelOpen}
            onClose={() => setIsEmojiPanelOpen(false)}
            onSelectEmoji={handleInsertEmoji}
            onSelectSticker={(s) => handleSendText(s)}
            onSelectGif={(url) => handleSendText(url)}
          />
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. TELEGRAM DELETION SCOPE MODAL (Fast Optimistic UI)         */}
      {/* ============================================================ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-page-enter">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-purple-100 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Delete Message</h3>
                <p className="text-xs text-gray-500">
                  Select deletion scope for this Telegram message.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* Option 1: Delete for everyone (if outgoing or allowed) */}
              {deleteTarget.out && (
                <button
                  type="button"
                  onClick={() => executeOptimisticDelete(deleteTarget.id, true)}
                  disabled={isDeleting}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete for Everyone</span>
                </button>
              )}

              {/* Option 2: Delete for me */}
              <button
                type="button"
                onClick={() => executeOptimisticDelete(deleteTarget.id, false)}
                disabled={isDeleting}
                className="w-full py-2.5 px-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>Delete for Me Only</span>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. TELEGRAM SCHEDULED MESSAGE ACTION MENU MODAL               */}
      {/* ============================================================ */}
      <TelegramScheduledMenuModal
        isOpen={Boolean(selectedScheduledItem)}
        onClose={() => setSelectedScheduledItem(null)}
        scheduledItem={selectedScheduledItem}
        onUpdated={(updated) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === `sched_${updated._id}` || m.scheduledId === updated._id
                ? { ...m, text: updated.message, scheduledAt: updated.scheduledAt }
                : m
            )
          );
        }}
        onCancelled={(cancelledId) => {
          setMessages((prev) =>
            prev.filter((m) => m.id !== `sched_${cancelledId}` && m.scheduledId !== cancelledId)
          );
        }}
        onSentNow={(sentItem) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === `sched_${sentItem._id}` || m.scheduledId === sentItem._id
                ? {
                    ...m,
                    isScheduled: false,
                    status: "sent",
                    date: sentItem.sentAt || new Date().toISOString(),
                  }
                : m
            )
          );
          setTimeout(() => {
            loadMessages();
          }, 1500);
        }}
      />
    </div>
  );
}
