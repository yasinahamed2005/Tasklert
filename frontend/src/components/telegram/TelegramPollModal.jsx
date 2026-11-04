import React, { useState } from "react";
import { BarChart2, Plus, Trash2, X, Loader2, Check } from "lucide-react";

/**
 * TelegramPollModal
 * Telegram Poll Creator supporting multi-choice, quiz, and anonymous voting
 */
export default function TelegramPollModal({
  isOpen,
  onClose,
  onSubmitPoll,
  chatTitle = "conversation",
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [publicVoters, setPublicVoters] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, ""]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!question.trim()) {
      setError("Please enter a poll question.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Please provide at least 2 non-empty options.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitPoll({
        question: question.trim(),
        options: cleanOptions,
        multipleChoice,
        quiz,
        publicVoters,
      });
      // Reset & close
      setQuestion("");
      setOptions(["", ""]);
      setMultipleChoice(false);
      setQuiz(false);
      setPublicVoters(true);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to create poll.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-purple-100 dark:border-slate-800 max-w-md w-full space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">New Poll</h3>
              <p className="text-[11px] text-gray-500 truncate max-w-[240px]">
                Send to {chatTitle}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Question */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Poll Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              maxLength={255}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Poll Options (2 - 10)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 w-4 text-center">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={100}
                    className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-purple-600 focus:outline-none transition shadow-2xs"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg cursor-pointer transition"
                      title="Remove option"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline pt-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add an option</span>
              </button>
            )}
          </div>

          {/* Poll Settings */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 space-y-2">
            <label className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <span>Multiple Answers</span>
              <input
                type="checkbox"
                checked={multipleChoice}
                onChange={(e) => setMultipleChoice(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              <span>Public Votes</span>
              <input
                type="checkbox"
                checked={publicVoters}
                onChange={(e) => setPublicVoters(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
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
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Send Poll</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
