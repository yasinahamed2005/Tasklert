import React, { useEffect, useRef } from "react";
import {
  Image as ImageIcon,
  FileText,
  BarChart2,
  BookOpen,
  MapPin,
  Music,
} from "lucide-react";

/**
 * TelegramAttachmentMenu
 * Floating Telegram Desktop-style popup menu anchored above the paperclip icon
 */
export default function TelegramAttachmentMenu({
  isOpen,
  onClose,
  onSelectPhotoVideo,
  onSelectDocument,
  onSelectPoll,
  onSelectArticle,
  onSelectLocation,
  onSelectMusic,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: "photo-video",
      label: "Photo or video",
      icon: ImageIcon,
      onClick: () => {
        onClose();
        onSelectPhotoVideo();
      },
    },
    {
      id: "document",
      label: "Document",
      icon: FileText,
      onClick: () => {
        onClose();
        onSelectDocument();
      },
    },
    {
      id: "poll",
      label: "Poll",
      icon: BarChart2,
      onClick: () => {
        onClose();
        onSelectPoll();
      },
    },
    {
      id: "article",
      label: "Article",
      icon: BookOpen,
      onClick: () => {
        onClose();
        onSelectArticle();
      },
    },
    {
      id: "location",
      label: "Location",
      icon: MapPin,
      onClick: () => {
        onClose();
        onSelectLocation();
      },
    },
    {
      id: "music",
      label: "Music",
      icon: Music,
      onClick: () => {
        onClose();
        onSelectMusic();
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-2 mb-3 z-30 w-52 bg-white rounded-2xl shadow-xl border border-purple-100 p-1.5 animate-in fade-in zoom-in-95 duration-150"
      style={{
        boxShadow:
          "0 12px 30px -4px rgba(124, 58, 237, 0.15), 0 8px 16px -4px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div className="flex flex-col py-0.5 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer group text-left"
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-400 group-hover:text-purple-600 transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
