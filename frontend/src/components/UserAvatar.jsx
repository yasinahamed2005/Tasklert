import React, { useState, useEffect } from "react";
import { resolveAttachmentUrl } from "../config/api";

const SIZE_MAP = {
  xs: {
    container: "w-6 h-6 text-[10px]",
    badge: "w-2 h-2 -bottom-0.5 -right-0.5 border",
  },
  sm: {
    container: "w-8 h-8 sm:w-9 sm:h-9 text-xs sm:text-sm",
    badge: "w-2.5 h-2.5 bottom-0 right-0 border-2",
  },
  md: {
    container: "w-10 h-10 text-sm font-bold",
    badge: "w-3 h-3 bottom-0 right-0 border-2",
  },
  lg: {
    container: "w-14 h-14 sm:w-16 sm:h-16 text-lg sm:text-xl font-extrabold",
    badge: "w-4 h-4 bottom-0 right-0 border-2",
  },
  xl: {
    container: "w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl font-black",
    badge: "w-5 h-5 bottom-0.5 right-0.5 border-2",
  },
};

/**
 * Universal, theme-aware User Avatar component for Tasklert.
 * Renders uploaded photo with graceful fallback to high-contrast theme initials.
 */
export const UserAvatar = ({
  user,
  size = "md",
  className = "",
  showStatus = false,
  statusColor = "bg-emerald-500",
  alt,
}) => {
  const [imageError, setImageError] = useState(false);
  const avatarUrl = user?.avatar ? resolveAttachmentUrl(user.avatar) : "";

  // Reset image error state whenever avatar URL changes
  useEffect(() => {
    setImageError(false);
  }, [user?.avatar]);

  const displayName = user?.name || "User";
  const initial = (displayName.trim().charAt(0) || "U").toUpperCase();
  const config = SIZE_MAP[size] || SIZE_MAP.md;
  const imageAlt = alt || `${displayName}'s profile avatar`;

  const hasValidImage = Boolean(avatarUrl && !imageError);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none ${config.container} ${className}`}
    >
      {hasValidImage ? (
        <img
          src={avatarUrl}
          alt={imageAlt}
          onError={() => setImageError(true)}
          className="w-full h-full rounded-full object-cover shadow-xs border border-black/10 ring-1 ring-black/5"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full rounded-full initial-avatar flex items-center justify-center shadow-xs transition-colors"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute rounded-full border-white ${statusColor} ${config.badge} shadow-xs`}
          title="Active Account"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default UserAvatar;
