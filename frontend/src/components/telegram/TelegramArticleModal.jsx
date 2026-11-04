import React, { useState } from "react";
import { BookOpen, Send, X, ExternalLink, Globe } from "lucide-react";

/**
 * TelegramArticleModal
 * Allows sharing articles, webpages, or markdown notes with live preview
 */
export default function TelegramArticleModal({
  isOpen,
  onClose,
  onSubmitArticle,
  chatTitle = "conversation",
}) {
  const [url, setUrl] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Please enter a valid URL or article link.");
      return;
    }

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }

    setSubmitting(true);
    setError("");

    try {
      const fullMessage = comment.trim()
        ? `${comment.trim()}\n\n${formattedUrl}`
        : formattedUrl;

      await onSubmitArticle(fullMessage);
      setUrl("");
      setComment("");
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to share article.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-purple-100 dark:border-slate-800 max-w-sm w-full space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Share Article / Link</h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[200px]">
                To {chatTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Article or Web URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                required
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-purple-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
              />
              <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Optional Comment
            </label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your thoughts or summary..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
