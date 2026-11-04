import React, { useState, useMemo, useRef } from "react";
import {
  Smile,
  Clock,
  PawPrint,
  Apple,
  Car,
  Lightbulb,
  Heart,
  Flag,
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

// Standard emoji categories dataset with keywords for real search
const EMOJI_CATEGORIES = [
  {
    id: "people",
    name: "Emoji & People",
    icon: Smile,
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "🥹",
      "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗",
      "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓",
      "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕",
      "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨",
      "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨",
      "😰", "😥", "😓", "🫣", "🤗", "🫡", "🤔", "🫢", "🤫", "🤥",
      "😶", "😐", "😑", "😬", "🫠", "🙄", "😯", "😦", "😧", "😮",
      "😲", "🥱", "😴", "🤤", "😪", "😵", "😵‍💫", "🫥", "🤐", "🥴",
      "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿",
      "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖",
      "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌",
      "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "✍️", "💅",
    ],
  },
  {
    id: "nature",
    name: "Animals & Nature",
    icon: PawPrint,
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨",
      "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊",
      "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉",
      "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌",
      "🐞", "🐜", "🪰", "🪲", "🪳", "🦟", "🦗", "🕷️", "🦂", "🐢",
      "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡",
      "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🦭", "🐊", "🐅", "🐆",
      "🦓", "🦍", "🦧", "🦣", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒",
      "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙",
      "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🪶", "🐓",
      "🦃", "🦤", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨",
      "🦡", "🦫", "🦦", "🦥", "🐁", "🐀", "🐿️", "🦔", "🐾", "🐉",
    ],
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: Apple,
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
      "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑",
      "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅",
      "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳",
      "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔",
      "🍟", "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗",
      "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟",
      "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡",
      "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬",
      "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "☕",
      "🫖", "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂",
    ],
  },
  {
    id: "travel",
    name: "Travel & Places",
    icon: Car,
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐",
      "🛻", "🚚", "🚛", "🚜", "🛴", "🚲", "🛵", "🏍️", "🛺", "🚨",
      "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞",
      "🚝", "🚄", "🚅", "🚈", "🚂", "🚆", "🚇", "🚊", "🚉", "✈️",
      "🛫", "🛬", "🛩️", "💺", "🛰️", "🚀", "🛸", "🚁", "🛶", "⛵",
      "🚤", "🛥️", "🛳️", "⛴️", "🚢", "⚓", "🛟", "🪝", "⛽", "🚧",
      "🚦", "🚥", "🗺️", "🗿", "🗽", "🗼", "🏰", "🏯", "🏟️", "🎡",
      "🎢", "🎠", "⛲", "⛱️", "🏖️", "🏝️", "🏜️", "🌋", "⛰️", "🏔️",
    ],
  },
  {
    id: "objects",
    name: "Activities & Objects",
    icon: Lightbulb,
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱",
      "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳",
      "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷",
      "⛸️", "🥌", "🎿", "⛷️", "🏂", "🪂", "🏋️", "🤼", "🤸", "🤺",
      "💡", "🔦", "🕯️", "🪔", "🪙", "💰", "💵", "💎", "🔮", "🪄",
      "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💽", "💾", "💿",
      "📷", "📸", "📹", "🎥", "📽️", "🎞️", "📞", "☎️", "📟", "📠",
      "📺", "📻", "🎙️", "🎚️", "🎛️", "⏱️", "⏲️", "⏰", "🕰️", "⌛",
    ],
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: Heart,
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️",
      "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐",
      "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐",
      "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳",
      "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️",
      "💯", "💢", "♨️", "🚷", "🚯", "🚳", "🚱", "🔞", "📵", "🚭",
      "❗", "❕", "❓", "❔", "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️",
      "🚸", "🔱", "⚜️", "🔰", "♻️", "✅", "🈯", "💹", "❇️", "✳️",
      "❎", "🌐", "💠", "Ⓜ️", "🌀", "💤", "🏧", "🚾", "♿", "🅿️",
    ],
  },
  {
    id: "flags",
    name: "Flags",
    icon: Flag,
    emojis: [
      "🏁", "🚩", "🎌", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️", "🇮🇳", "🇺🇸",
      "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇯🇵", "🇰🇷", "🇨🇳", "🇧🇷", "🇷🇺",
      "🇮🇹", "🇪🇸", "🇲🇽", "🇿🇦", "🇸🇬", "🇦🇪", "🇸🇦", "🇳🇿", "🇮🇪", "🇨🇭",
    ],
  },
];

// Quick reactions shown right under search bar (matches reference image)
const QUICK_REACTIONS = ["❤️", "👍", "👎", "🎉", "🔥", "👏", "🥰", "🤩", "😂", "😍", "🙏", "💯"];

/**
 * TelegramEmojiPanel
 * Full right-side panel matching Telegram Desktop with Emoji, Stickers, and GIFs tabs
 */
export default function TelegramEmojiPanel({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectSticker,
  onSelectGif,
}) {
  const [activeTab, setActiveTab] = useState("emoji"); // 'emoji' | 'stickers' | 'gifs'
  const [searchQuery, setSearchQuery] = useState("");
  const categoryRefs = useRef({});
  const scrollContainerRef = useRef(null);

  // Search filtering
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return EMOJI_CATEGORIES;
    const query = searchQuery.toLowerCase().trim();

    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((emoji) => {
        return (
          cat.name.toLowerCase().includes(query) ||
          emoji.includes(query)
        );
      }),
    })).filter((cat) => cat.emojis.length > 0);
  }, [searchQuery]);

  // Scroll to category
  const scrollToCategory = (categoryId) => {
    const el = categoryRefs.current[categoryId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 sm:w-88 h-full flex flex-col bg-white dark:bg-slate-900 border-l border-purple-100/80 dark:border-slate-800 shadow-xl z-20 shrink-0">
      {/* 1. TOP TABS: Emoji | Stickers | GIFs */}
      <div className="flex items-center justify-between px-3 border-b border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("emoji")}
            className={`py-3 text-xs font-bold transition cursor-pointer relative ${
              activeTab === "emoji"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <span>Emoji</span>
            {activeTab === "emoji" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stickers")}
            className={`py-3 text-xs font-bold transition cursor-pointer relative ${
              activeTab === "stickers"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <span>Stickers</span>
            {activeTab === "stickers" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gifs")}
            className={`py-3 text-xs font-bold transition cursor-pointer relative ${
              activeTab === "gifs"
                ? "text-purple-600 dark:text-purple-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            <span>GIFs</span>
            {activeTab === "gifs" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Close emoji panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. SEARCH BAR */}
      <div className="p-3 pb-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200/90 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/70 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === "emoji" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Quick Reaction Bar */}
          {!searchQuery && (
            <div className="px-3 pb-2.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shrink-0">
              {QUICK_REACTIONS.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectEmoji(emoji)}
                  className="w-7 h-7 flex items-center justify-center text-lg hover:scale-125 transition-transform cursor-pointer rounded-lg hover:bg-purple-50 dark:hover:bg-slate-800 shrink-0"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Scrollable Emojis Grid */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-4 tg-custom-scrollbar"
          >
            {filteredCategories.map((category) => (
              <div
                key={category.id}
                ref={(el) => (categoryRefs.current[category.id] = el)}
                className="space-y-2"
              >
                <div className="flex items-center justify-between pt-1">
                  <h4 className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                    {category.name}
                  </h4>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-purple-600" />
                </div>

                <div className="grid grid-cols-8 gap-1">
                  {category.emojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-xl hover:scale-120 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-transform cursor-pointer select-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-10 text-xs text-gray-400">
                No emojis match your search.
              </div>
            )}
          </div>

          {/* 4. BOTTOM CATEGORY NAVIGATION BAR (Matches reference screenshot) */}
          <div className="h-11 px-3 border-t border-purple-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
            {EMOJI_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => scrollToCategory(cat.id)}
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title={cat.name}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STICKERS TAB */}
      {activeTab === "stickers" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 tg-custom-scrollbar space-y-4">
          <div className="text-center py-2 text-xs font-semibold text-gray-500">
            Featured Telegram Stickers
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              "🦆", "🐱", "🐶", "🦊", "🐻", "🐼", "🦁", "🐵",
              "🚀", "✨", "🔥", "💖", "🎉", "🌟", "🍔", "🍕",
            ].map((stickerEmoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectEmoji(stickerEmoji);
                  if (onSelectSticker) onSelectSticker(stickerEmoji);
                }}
                className="aspect-square flex items-center justify-center text-3xl bg-purple-50/50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 rounded-2xl hover:scale-105 transition cursor-pointer border border-purple-100/50 dark:border-slate-700 shadow-2xs"
              >
                {stickerEmoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* GIFS TAB */}
      {activeTab === "gifs" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 tg-custom-scrollbar space-y-3">
          <div className="text-[11px] font-semibold text-gray-500 px-1">
            Trending Telegram GIFs
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "1", title: "Cheers", url: "https://media.giphy.com/media/g9582DNuQppxC/giphy.gif" },
              { id: "2", title: "Excited", url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif" },
              { id: "3", title: "Clap", url: "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif" },
              { id: "4", title: "Heart", url: "https://media.giphy.com/media/26BRv0ThflsDTjDUs/giphy.gif" },
            ].map((gif) => (
              <div
                key={gif.id}
                onClick={() => onSelectGif && onSelectGif(gif.url)}
                className="aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-purple-100/60 dark:border-slate-700 hover:border-purple-600 cursor-pointer group relative shadow-2xs"
              >
                <img
                  src={gif.url}
                  alt={gif.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/60 to-transparent text-[10px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {gif.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
