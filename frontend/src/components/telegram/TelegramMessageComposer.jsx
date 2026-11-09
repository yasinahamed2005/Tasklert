import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Music,
  Calendar,
} from "lucide-react";
import TelegramAttachmentMenu from "./TelegramAttachmentMenu";
import TelegramPollModal from "./TelegramPollModal";
import TelegramLocationModal from "./TelegramLocationModal";
import TelegramArticleModal from "./TelegramArticleModal";

/**
 * TelegramMessageComposer
 * Telegram Desktop-style composer with floating attachment menu, emoji panel trigger,
 * microphone button, and circular send action matching the reference design.
 */
export default function TelegramMessageComposer({
  activeChat,
  inputText,
  setInputText,
  onSendMessage,
  onSendFile,
  onSendPoll,
  onSendLocation,
  onStartVoiceRecording,
  isRecordingVoice = false,
  voiceRecordingDuration = 0,
  onCancelVoiceRecording,
  onSendVoiceRecording,
  onToggleEmojiPanel,
  isEmojiPanelOpen = false,
  sending = false,
  inputRef,
  onOpenSchedule,
}) {
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const photoVideoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const musicInputRef = useRef(null);
  const internalInputRef = useRef(null);
  const actualInputRef = inputRef || internalInputRef;

  // File size formatter
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = "";
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (sending) return;

    if (selectedFile) {
      onSendFile(selectedFile, inputText);
      setSelectedFile(null);
      setInputText("");
      return;
    }

    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = Boolean(inputText.trim() || selectedFile);

  return (
    <div className="shrink-0 p-2.5 sm:p-3 bg-white border-t border-purple-100 relative z-20">
      {/* Hidden file pickers */}
      <input
        type="file"
        ref={photoVideoInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={documentInputRef}
        onChange={handleFileChange}
        accept="*/*"
        className="hidden"
      />
      <input
        type="file"
        ref={musicInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        className="hidden"
      />

      {/* Floating Attachment Menu */}
      <TelegramAttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onSelectPhotoVideo={() => photoVideoInputRef.current?.click()}
        onSelectDocument={() => documentInputRef.current?.click()}
        onSelectPoll={() => setShowPollModal(true)}
        onSelectArticle={() => setShowArticleModal(true)}
        onSelectLocation={() => setShowLocationModal(true)}
        onSelectMusic={() => musicInputRef.current?.click()}
      />

      {/* Attachment Preview Bar */}
      {selectedFile && (
        <div className="mb-2 px-3 py-2 bg-purple-50/80 dark:bg-slate-800/80 border border-purple-100 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3 animate-fade-in shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-200/70 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
              {selectedFile.type?.startsWith("image/") ? (
                <ImageIcon className="w-4 h-4" />
              ) : selectedFile.type?.startsWith("audio/") ? (
                <Music className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-gray-500">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            className="p-1 text-gray-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Recording Active Bar */}
      {isRecordingVoice ? (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-full animate-pulse shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
              Recording Voice...
            </span>
            <span className="font-mono text-xs font-semibold text-rose-800 dark:text-rose-300">
              {Math.floor(voiceRecordingDuration / 60)}:
              {String(voiceRecordingDuration % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelVoiceRecording}
              className="px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-rose-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSendVoiceRecording}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Composer Bar matching reference screenshot */
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* Attachment Paperclip Button */}
          <button
            type="button"
            onClick={() => setShowAttachmentMenu((prev) => !prev)}
            className={`p-2 sm:p-2.5 rounded-xl transition cursor-pointer shrink-0 ${
              showAttachmentMenu
                ? "bg-purple-100 text-purple-700"
                : "text-gray-400 hover:text-purple-700 hover:bg-purple-50"
            }`}
            title="Attach file, photo, poll, or location"
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Central Rounded Pill Container */}
          <div className="flex-1 flex items-center bg-gray-50/80 hover:bg-gray-100/70 focus-within:bg-white border border-purple-100 focus-within:border-purple-400 rounded-2xl px-3.5 py-1.5 transition shadow-2xs">
            <input
              ref={actualInputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1 py-1 bg-transparent text-xs sm:text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />

            {/* Emoji Panel Toggle Button */}
            <button
              type="button"
              onClick={onToggleEmojiPanel}
              className={`p-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                isEmojiPanelOpen
                  ? "text-purple-600 bg-purple-100/60"
                  : "text-gray-400 hover:text-purple-600"
              }`}
              title="Emoji, Stickers & GIFs"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Microphone Voice Button */}
          <button
            type="button"
            onClick={onStartVoiceRecording}
            className="p-2 sm:p-2.5 rounded-xl text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer shrink-0"
            title="Record Voice Message"
          >
            <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Schedule Calendar Button (matching reference screenshot icon button) */}
          {onOpenSchedule && (
            <button
              type="button"
              onClick={() => onOpenSchedule({ message: inputText, activeChat })}
              className="p-2 sm:p-2.5 rounded-xl text-gray-400 hover:text-purple-700 hover:bg-purple-50 transition active:scale-95 cursor-pointer shrink-0"
              title="Schedule message for future delivery"
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Circular Purple Send Button with paper plane pointing top-right */}
          <button
            type="submit"
            disabled={sending || !canSend}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-600/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
            style={{ backgroundColor: "var(--tg-bubble-out-bg, #7c3aed)" }}
            title="Send Message"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4 fill-white text-white -mr-0.5 mt-0.5" />
            )}
          </button>
        </form>
      )}

      {/* Modals */}
      <TelegramPollModal
        isOpen={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSubmitPoll={onSendPoll}
        chatTitle={activeChat?.title || "conversation"}
      />

      <TelegramLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSubmitLocation={onSendLocation}
        chatTitle={activeChat?.title || "conversation"}
      />

      <TelegramArticleModal
        isOpen={showArticleModal}
        onClose={() => setShowArticleModal(false)}
        onSubmitArticle={(msg) => onSendMessage(msg)}
        chatTitle={activeChat?.title || "conversation"}
      />
    </div>
  );
}
