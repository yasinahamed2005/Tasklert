import React, { useState } from "react";
import { Users, Radio, Bookmark } from "lucide-react";
import { getTelegramAvatarUrl } from "../../services/telegramApi";

const PALETTES = [
  "from-rose-500 to-orange-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-cyan-500 to-blue-600",
  "from-purple-500 via-indigo-600 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-violet-500 to-purple-600",
];

const getDeterministicGradient = (str = "") => {
  if (!str) return PALETTES[4];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
};

const SIZES = {
  xs: {
    container: "w-6 h-6 text-[10px]",
    badge: "w-2.5 h-2.5 -bottom-0.5 -right-0.5 p-0.5",
    iconSize: 8,
  },
  sm: {
    container: "w-8 h-8 text-xs",
    badge: "w-3.5 h-3.5 -bottom-1 -right-1 p-0.5",
    iconSize: 10,
  },
  md: {
    container: "w-11 h-11 text-sm",
    badge: "w-4 h-4 -bottom-1 -right-1 p-0.5",
    iconSize: 12,
  },
  lg: {
    container: "w-14 h-14 text-base",
    badge: "w-5 h-5 -bottom-1.5 -right-1.5 p-1",
    iconSize: 14,
  },
  xl: {
    container: "w-20 h-20 text-2xl",
    badge: "w-6 h-6 -bottom-1.5 -right-1.5 p-1",
    iconSize: 16,
  },
};

export default function TelegramAvatar({
  chat,
  size = "md",
  showBadge = true,
  className = "",
}) {
  const [imgError, setImgError] = useState(false);

  const sizeConfig = SIZES[size] || SIZES.md;
  const chatId = chat?.id ? String(chat.id) : "";
  const title = chat?.title || chat?.name || "Telegram";
  const isSelf = Boolean(chat?.isSelf);
  const isGroup = chat?.type === "group" || Boolean(chat?.isGroup);
  const isChannel = chat?.type === "channel" || Boolean(chat?.isChannel);

  // Initial letter fallback
  const initial = title ? title.trim().charAt(0).toUpperCase() : "T";
  const gradient = isSelf
    ? "from-blue-500 to-cyan-500"
    : getDeterministicGradient(title + chatId);

  // If explicit photoUrl is provided, or load from telegram avatar endpoint
  const avatarSrc = chat?.photoUrl || (chatId ? getTelegramAvatarUrl(chatId) : null);

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {/* Avatar Image or Initial Fallback */}
      <div
        className={`${sizeConfig.container} rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-xs aspect-square transition-transform`}
      >
        {isSelf ? (
          <div className="w-full h-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white">
            <Bookmark className="w-1/2 h-1/2 fill-white" />
          </div>
        ) : avatarSrc && !imgError ? (
          <img
            src={avatarSrc}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-full aspect-square"
            loading="lazy"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-tr ${gradient} flex items-center justify-center font-extrabold text-white`}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Group / Channel / Saved Badge */}
      {showBadge && (
        <>
          {isGroup && !isSelf && (
            <span
              className={`absolute ${sizeConfig.badge} rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs border border-white`}
              title="Group Conversation"
            >
              <Users className="w-full h-full" />
            </span>
          )}
          {isChannel && !isSelf && (
            <span
              className={`absolute ${sizeConfig.badge} rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs border border-white`}
              title="Broadcast Channel"
            >
              <Radio className="w-full h-full" />
            </span>
          )}
        </>
      )}
    </div>
  );
}
