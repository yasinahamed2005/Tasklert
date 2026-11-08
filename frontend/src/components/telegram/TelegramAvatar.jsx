import React, { useState, useEffect } from "react";
import { Users, Radio, Bookmark } from "lucide-react";
import { getTelegramAvatarUrl } from "../../services/telegramApi";

// Vibrant, deterministic Telegram color palettes (guaranteed non-white and immune to CSS class purging)
export const TELEGRAM_PALETTES = [
  { bg: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)", text: "#ffffff" }, // Rose / Crimson
  { bg: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", text: "#ffffff" }, // Vibrant Orange
  { bg: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", text: "#ffffff" }, // Warm Amber
  { bg: "linear-gradient(135deg, #059669 0%, #047857 100%)", text: "#ffffff" }, // Emerald Green
  { bg: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", text: "#ffffff" }, // Sky Blue
  { bg: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", text: "#ffffff" }, // Telegram Royal Blue
  { bg: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", text: "#ffffff" }, // Indigo
  { bg: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", text: "#ffffff" }, // Deep Purple
  { bg: "linear-gradient(135deg, #c026d3 0%, #a21caf 100%)", text: "#ffffff" }, // Fuchsia
  { bg: "linear-gradient(135deg, #db2777 0%, #be185d 100%)", text: "#ffffff" }, // Pink
];

export const getDeterministicPalette = (str = "") => {
  if (!str) return TELEGRAM_PALETTES[5];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TELEGRAM_PALETTES.length;
  return TELEGRAM_PALETTES[index];
};

/**
 * Generate 1 or 2 appropriate initials from contact/group name:
 * Examples:
 * - "Ananya Reddy" → "AR"
 * - "Sai Kumar" → "SK"
 * - "Phoenix Group" → "PG"
 * - "8701 SPOC Placement" → "87"
 * - "Pheonix" → "PH"
 */
export const getInitials = (title = "") => {
  if (!title || typeof title !== "string") return "TG";
  const clean = title.trim();
  if (!clean) return "TG";

  // If starts with 2+ consecutive digits (e.g. "8701 SPOC Placement"), return first 2 digits ("87")
  const leadingDigits = clean.match(/^\d{2,}/);
  if (leadingDigits) {
    return leadingDigits[0].slice(0, 2);
  }

  // Split into clean words ignoring emojis/symbols
  const words = clean.split(/[\s_\-–—]+/).filter((w) => w && /[a-zA-Z0-9]/.test(w));
  if (words.length >= 2) {
    const firstChar = words[0].replace(/^[^a-zA-Z0-9]+/, "")[0] || "";
    const secondChar = words[1].replace(/^[^a-zA-Z0-9]+/, "")[0] || "";
    if (firstChar && secondChar) {
      return (firstChar + secondChar).toUpperCase();
    }
  }

  // Single word: use first 2 characters if available
  const cleanWord = clean.replace(/^[^a-zA-Z0-9]+/, "");
  if (cleanWord.length >= 2) {
    return cleanWord.slice(0, 2).toUpperCase();
  }
  return (cleanWord[0] || "TG").toUpperCase();
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
    container: "w-11 h-11 text-xs",
    badge: "w-4 h-4 -bottom-1 -right-1 p-0.5",
    iconSize: 12,
  },
  lg: {
    container: "w-14 h-14 text-sm",
    badge: "w-5 h-5 -bottom-1.5 -right-1.5 p-1",
    iconSize: 14,
  },
  xl: {
    container: "w-20 h-20 text-xl",
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
  const [imgLoaded, setImgLoaded] = useState(false);

  const sizeConfig = SIZES[size] || SIZES.md;
  const chatId = chat?.id ? String(chat.id) : (chat?.peerId ? String(chat.peerId) : "");
  const title = chat?.title || chat?.name || "Telegram";
  const isSelf = Boolean(chat?.isSelf);
  const isGroup = chat?.type === "group" || Boolean(chat?.isGroup);
  const isChannel = chat?.type === "channel" || Boolean(chat?.isChannel);

  // Direct photoUrl or proxy avatar endpoint
  const avatarSrc = chat?.photoUrl || (chatId ? getTelegramAvatarUrl(chatId) : null);

  // Reset image status whenever chat or avatar source changes
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [chatId, avatarSrc]);

  const initials = getInitials(title);
  const palette = isSelf
    ? { bg: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", text: "#ffffff" }
    : getDeterministicPalette(title + chatId);

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {/* Outer circular container: style={{ background: palette.bg }} guarantees it is NEVER a blank white circle */}
      <div
        className={`${sizeConfig.container} rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-2xs aspect-square transition-transform relative`}
        style={{ background: palette.bg }}
      >
        {isSelf ? (
          <div className="w-full h-full flex items-center justify-center text-white">
            <Bookmark className="w-1/2 h-1/2 fill-white" />
          </div>
        ) : (
          <>
            {/* Always visible colored initials layer: guarantees no white circle while loading or on error */}
            <div
              className="w-full h-full flex items-center justify-center font-black tracking-wider select-none text-white drop-shadow-2xs"
              style={{ color: palette.text }}
            >
              {initials}
            </div>

            {/* Overlaid real Telegram profile image with smooth crossfade */}
            {avatarSrc && !imgError && (
              <img
                src={avatarSrc}
                alt={title}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`absolute inset-0 w-full h-full object-cover object-center rounded-full aspect-square transition-opacity duration-200 ${
                  imgLoaded ? "opacity-100" : "opacity-0"
                }`}
                loading="lazy"
              />
            )}
          </>
        )}
      </div>

      {/* Group / Channel Indicator Badge */}
      {showBadge && (
        <>
          {isGroup && !isSelf && (
            <span
              className={`absolute ${sizeConfig.badge} rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs border-2 border-white`}
              title="Group Conversation"
            >
              <Users className="w-full h-full" />
            </span>
          )}
          {isChannel && !isSelf && (
            <span
              className={`absolute ${sizeConfig.badge} rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs border-2 border-white`}
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
