import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Send,
  RefreshCw,
  LogOut,
  User,
  ShieldCheck,
  Smartphone,
  MessageSquare,
  Clock,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import TelegramConnectionCard from "./TelegramConnectionCard";
import TelegramLoginModal from "./TelegramLoginModal";
import TelegramChatList from "./TelegramChatList";
import TelegramChatWindow from "./TelegramChatWindow";
import TelegramScheduleDrawer from "./TelegramScheduleDrawer";
import TelegramContactsModal from "./TelegramContactsModal";
import TelegramScheduleModal from "./TelegramScheduleModal";
import TelegramAvatar from "./TelegramAvatar";
import TelegramContactInfoPanel from "./TelegramContactInfoPanel";
import {
  fetchTelegramAuthStatus,
  disconnectTelegram,
  fetchTelegramChats,
  createTelegramEventSource,
} from "../../services/telegramApi";
import { toast } from "react-toastify";

export default function TelegramWorkspace({ onActiveChatChange, onBackToQuickSend, onOpenSchedule }) {
  const [loading, setLoading] = useState(true);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isConfiguredOnServer, setIsConfiguredOnServer] = useState(true);

  // Chats & selection state
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatFilter, setChatFilter] = useState("all");
  const [chatSearch, setChatSearch] = useState("");
  const [showContactInfo, setShowContactInfo] = useState(false);

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [initialStep, setInitialStep] = useState("phone");
  const [pendingPhone, setPendingPhone] = useState("");
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalMessage, setScheduleModalMessage] = useState("");
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Triggers
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);

  const selectedChatRef = useRef(null);
  selectedChatRef.current = selectedChat;

  // Notify parent of active chat selection
  useEffect(() => {
    if (onActiveChatChange) {
      onActiveChatChange(selectedChat);
    }
  }, [selectedChat, onActiveChatChange]);

  // Check auth status
  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTelegramAuthStatus();
      setIsConfiguredOnServer(data.isConfiguredOnServer !== false);

      if (data.connected && data.profile) {
        setConnected(true);
        setProfile(data.profile);
      } else {
        setConnected(false);
        setProfile(null);
        setSelectedChat(null);

        if (data.status === "waiting_for_code") {
          setInitialStep("code");
          setPendingPhone(data.phoneNumber || "");
          setShowLoginModal(true);
        } else if (data.status === "waiting_for_password") {
          setInitialStep("password");
          setPendingPhone(data.phoneNumber || "");
          setShowLoginModal(true);
        }
      }
    } catch (err) {
      const isTimeout =
        err.code === "ECONNABORTED" ||
        err.message?.includes("timeout") ||
        err.message?.includes("Timeout");
      if (isTimeout) {
        console.warn("[TelegramWorkspace] Auth status check timed out — treating as not connected.");
      } else {
        console.warn("Failed to check Telegram auth status:", err.message);
      }
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Show "taking longer than expected" hint after 6 seconds if still loading
  useEffect(() => {
    if (!loading) {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTooLong(true), 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Load real Telegram chats (initial page 1)
  const loadChats = useCallback(async () => {
    if (!connected) return;
    setLoadingChats(true);
    try {
      const folderParam = chatFilter === "archived" ? 1 : null;
      const data = await fetchTelegramChats(chatFilter, chatSearch, folderParam, { limit: 100 });
      setChats(data);
      setHasMoreChats(Array.isArray(data) && data.length >= 100);

      // Preserve active chat selection with updated metadata, or auto-select first on initial desktop load
      if (Array.isArray(data) && data.length > 0) {
        if (selectedChatRef.current) {
          const currentId = String(selectedChatRef.current.id);
          const updated = data.find((c) => String(c.id) === currentId);
          if (updated) {
            setSelectedChat(updated);
          }
        } else if (window.innerWidth >= 768) {
          setSelectedChat(data[0]);
        }
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || "";
      console.warn("Failed to load chats:", errMsg);
      if (err.response?.status === 401 || errMsg.includes("not connected") || errMsg.includes("authenticate first")) {
        setConnected(false);
      }
    } finally {
      setLoadingChats(false);
    }
  }, [connected, chatFilter, chatSearch]);

  // Load more chats (lazy loading pagination)
  const loadMoreChats = async () => {
    if (loadingChats || loadingMoreChats || !hasMoreChats || chats.length === 0 || !connected) return;
    setLoadingMoreChats(true);

    const lastChat = chats[chats.length - 1];
    const offsetDate = lastChat?.lastMessage?.rawDate || (lastChat?.lastMessage?.date ? Math.floor(new Date(lastChat.lastMessage.date).getTime() / 1000) : null);
    const offsetId = lastChat?.lastMessage?.id || null;
    const folderParam = chatFilter === "archived" ? 1 : null;

    try {
      const moreData = await fetchTelegramChats(chatFilter, chatSearch, folderParam, {
        limit: 100,
        offsetDate,
        offsetId,
      });

      if (!moreData || moreData.length === 0) {
        setHasMoreChats(false);
      } else {
        setChats((prev) => {
          const existingIds = new Set(prev.map((c) => String(c.id)));
          const uniqueNewChats = moreData.filter((c) => !existingIds.has(String(c.id)));
          if (uniqueNewChats.length === 0) {
            setHasMoreChats(false);
            return prev;
          }
          return [...prev, ...uniqueNewChats];
        });
        setHasMoreChats(moreData.length >= 100);
      }
    } catch (err) {
      console.warn("Failed to load more chats:", err);
    } finally {
      setLoadingMoreChats(false);
    }
  };

  useEffect(() => {
    if (connected) {
      loadChats();
    }
  }, [connected, loadChats]);

  // Setup real-time incoming messages via SSE
  useEffect(() => {
    if (!connected) return;

    let eventSource;
    try {
      eventSource = createTelegramEventSource();

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "new_message" && payload.message) {
            // Dispatch custom window event for TelegramChatWindow to append
            window.dispatchEvent(
              new CustomEvent("telegram:new_message", { detail: payload.message })
            );

            // Update lastMessage preview in chats list, real unread count, and reorder to top
            setChats((prev) => {
              const chatIdx = prev.findIndex(
                (c) =>
                  String(c.id) === String(payload.message.chatId) ||
                  String(c.peerId) === String(payload.message.chatId)
              );

              if (chatIdx === -1) {
                // If this is a completely new conversation, reload chats
                loadChats();
                return prev;
              }

              const targetChat = prev[chatIdx];
              const isCurrentActive =
                String(selectedChatRef.current?.id) === String(payload.message.chatId) ||
                String(selectedChatRef.current?.peerId) === String(payload.message.chatId);

              const updatedChat = {
                ...targetChat,
                lastMessage: {
                  id: payload.message.id,
                  text: payload.message.text || "📎 [Attachment]",
                  date: payload.message.date,
                  out: payload.message.out,
                },
                unreadCount: payload.message.out
                  ? (targetChat.unreadCount || 0)
                  : isCurrentActive
                  ? (targetChat.unreadCount || 0)
                  : (targetChat.unreadCount || 0) + 1,
              };

              // Telegram conversation ordering: pinned chats stay at top, updated chat moves to top of its group
              const remaining = prev.filter((_, i) => i !== chatIdx);
              if (updatedChat.pinned) {
                return [updatedChat, ...remaining];
              }
              const firstUnpinnedIdx = remaining.findIndex((c) => !c.pinned);
              if (firstUnpinnedIdx === -1) {
                return [...remaining, updatedChat];
              }
              return [
                ...remaining.slice(0, firstUnpinnedIdx),
                updatedChat,
                ...remaining.slice(firstUnpinnedIdx),
              ];
            });
          } else if (payload.type === "chat_read") {
            // Real-time synchronization when read on Tasklert or normal Telegram
            setChats((prev) =>
              prev.map((c) => {
                const matches =
                  String(c.id) === String(payload.chatId) ||
                  String(c.peerId) === String(payload.chatId) ||
                  (payload.peerId && String(c.peerId) === String(payload.peerId));

                if (matches) {
                  return {
                    ...c,
                    unreadCount: Math.max(0, Number(payload.unreadCount) || 0),
                    readInboxMaxId: payload.maxId || c.readInboxMaxId,
                  };
                }
                return c;
              })
            );

            if (
              selectedChatRef.current &&
              (String(selectedChatRef.current.id) === String(payload.chatId) ||
                String(selectedChatRef.current.peerId) === String(payload.chatId))
            ) {
              setSelectedChat((prev) =>
                prev
                  ? {
                      ...prev,
                      unreadCount: Math.max(0, Number(payload.unreadCount) || 0),
                      readInboxMaxId: payload.maxId || prev.readInboxMaxId,
                    }
                  : null
              );
            }
          } else if (payload.type === "messages_read_outbox") {
            window.dispatchEvent(
              new CustomEvent("telegram:messages_read_outbox", { detail: payload })
            );
          } else if (payload.type === "message_edited" && payload.message) {
            window.dispatchEvent(
              new CustomEvent("telegram:message_edited", { detail: payload.message })
            );
            setChats((prev) =>
              prev.map((c) => {
                if (String(c.id) === String(payload.message.chatId) && c.lastMessage?.id === payload.message.id) {
                  return {
                    ...c,
                    lastMessage: {
                      ...c.lastMessage,
                      text: payload.message.text,
                    },
                  };
                }
                return c;
              })
            );
          } else if (payload.type === "messages_deleted") {
            window.dispatchEvent(
              new CustomEvent("telegram:messages_deleted", { detail: payload })
            );
          }
        } catch (_) {}
      };
    } catch (err) {
      console.warn("Failed to open SSE stream:", err);
    }

    return () => {
      eventSource?.close();
    };
  }, [connected]);

  // Handle conversation selection without prematurely zeroing unread count
  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
  };

  // Called when messages are actively read by user scrolling or jumping to unread
  const handleChatMarkedRead = useCallback((chatId, maxId, unreadCount) => {
    const finalCount = unreadCount !== undefined ? Math.max(0, Number(unreadCount) || 0) : 0;
    setChats((prev) =>
      prev.map((c) =>
        String(c.id) === String(chatId) || String(c.peerId) === String(chatId)
          ? { ...c, unreadCount: finalCount, readInboxMaxId: maxId || c.readInboxMaxId }
          : c
      )
    );
    if (
      selectedChatRef.current &&
      (String(selectedChatRef.current.id) === String(chatId) ||
        String(selectedChatRef.current.peerId) === String(chatId))
    ) {
      setSelectedChat((prev) =>
        prev
          ? {
              ...prev,
              unreadCount: finalCount,
              readInboxMaxId: maxId || prev.readInboxMaxId,
            }
          : null
      );
    }
  }, []);

  // Handle successful login
  const handleLoginSuccess = (userProfile) => {
    setConnected(true);
    setProfile(userProfile);
    setShowLoginModal(false);
    toast.success("Telegram account connected successfully!");
    loadChats();
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectTelegram();
      setConnected(false);
      setProfile(null);
      setSelectedChat(null);
      setChats([]);
      setShowDisconnectConfirm(false);
      toast.info("Telegram account disconnected.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to disconnect Telegram.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[500px] flex-1 flex flex-col items-center justify-center p-8 bg-white/60 rounded-3xl border border-purple-100/80 shadow-xs">
        <Loader2 className="w-9 h-9 text-purple-600 animate-spin mb-3" />
        <h3 className="text-sm font-bold text-gray-800">Checking Telegram Connection</h3>
        <p className="text-xs text-gray-500 mt-1">
          {loadingTooLong
            ? "Still connecting — this may take a moment on first load..."
            : "Verifying encrypted MTProto session..."}
        </p>
        {loadingTooLong && (
          <button
            type="button"
            onClick={() => { setLoading(false); setConnected(false); }}
            className="mt-5 px-4 py-2 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
          >
            Continue without reconnecting
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* ============================================================ */}
      {/* MAIN VIEWPORT: NOT CONNECTED VS FULL WORKSPACE               */}
      {/* ============================================================ */}
      {!connected ? (
        <TelegramConnectionCard
          onConnect={() => {
            setInitialStep("phone");
            setShowLoginModal(true);
          }}
          isConfiguredOnServer={isConfiguredOnServer}
        />
      ) : (
        <div className="flex-1 min-h-0 w-full bg-white rounded-none md:rounded-3xl border-0 md:border border-purple-100/90 shadow-none md:shadow-2xs overflow-hidden flex flex-row">
          {/* ========================================================== */}
          {/* PANEL 1: LEFT CHATS & CHANNELS NAVIGATOR                   */}
          {/* ========================================================== */}
          <div
            className={`w-full md:w-80 lg:w-[360px] shrink-0 h-full min-h-0 flex flex-col ${
              selectedChat ? "hidden md:flex" : "flex"
            }`}
          >
            <TelegramChatList
              chats={chats}
              selectedChatId={selectedChat?.id}
              onSelectChat={handleSelectChat}
              filter={chatFilter}
              onFilterChange={setChatFilter}
              search={chatSearch}
              onSearchChange={setChatSearch}
              onOpenContactsModal={() => setShowContactsModal(true)}
              loading={loadingChats}
              loadingMore={loadingMoreChats}
              hasMore={hasMoreChats}
              onLoadMore={loadMoreChats}
              onRefresh={loadChats}
              profile={profile}
              connected={connected}
              onDisconnect={() => setShowDisconnectConfirm(true)}
              onOpenSchedule={() => (onOpenSchedule ? onOpenSchedule({ channel: "telegram", activeChat: selectedChat }) : setShowScheduleModal(true))}
              onBackToQuickSend={onBackToQuickSend}
            />
          </div>

          {/* ========================================================== */}
          {/* PANEL 2: CENTER CONVERSATION & STREAM                      */}
          {/* ========================================================== */}
          <div
            className={`flex-1 min-w-0 h-full min-h-0 flex flex-col ${
              !selectedChat ? "hidden md:flex" : "flex"
            }`}
          >
            <TelegramChatWindow
              activeChat={selectedChat}
              onBack={() => setSelectedChat(null)}
              onOpenScheduleModal={(opts) => {
                if (onOpenSchedule) {
                  onOpenSchedule({ channel: "telegram", activeChat: selectedChat, ...opts });
                } else {
                  setScheduleModalMessage(opts?.message || "");
                  setShowScheduleModal(true);
                }
              }}
              onRefreshChats={loadChats}
              onChatMarkedRead={handleChatMarkedRead}
              onToggleContactInfo={() => setShowContactInfo((prev) => !prev)}
            />
          </div>

          {/* ========================================================== */}
          {/* PANEL 3: RIGHT CONTACT INFO PANEL (Optional Drawer)        */}
          {/* ========================================================== */}
          {showContactInfo && selectedChat && (
            <div className="hidden lg:flex w-72 xl:w-80 shrink-0 h-full min-h-0 flex-col border-l border-purple-100">
              <TelegramContactInfoPanel
                chat={selectedChat}
                onClose={() => setShowContactInfo(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS                                                       */}
      {/* ============================================================ */}

      {/* 1. Login Modal */}
      <TelegramLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        isConfiguredOnServer={isConfiguredOnServer}
        initialStep={initialStep}
        initialPhoneNumber={pendingPhone}
      />

      {/* 2. Contacts Modal */}
      <TelegramContactsModal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        onSelectContact={(contact) => {
          setSelectedChat(contact);
          setChats((prev) => {
            if (prev.some((c) => String(c.id) === String(contact.id))) return prev;
            return [contact, ...prev];
          });
        }}
      />

      {/* 3. Schedule Message Modal */}
      <TelegramScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setScheduleModalMessage("");
        }}
        activeChat={selectedChat}
        initialMessage={scheduleModalMessage}
        onScheduledSuccess={() => {
          setScheduleRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* 4. Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-purple-100 w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3.5">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              Disconnect Telegram?
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              This will log out your Telegram MTProto session and delete the encrypted key from Tasklert. Other users will not be affected.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={disconnecting}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
