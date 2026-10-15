import React, { useRef } from "react";
import { X, Palette } from "lucide-react";
import { useModalAccessibility } from "../utils/scrollLock";

const themes = [
  { name: "theme-blue", label: "Ocean Blue", color: "#1e88e5" },
  { name: "theme-peach", label: "Warm Peach", color: "#d4a373" },
  { name: "theme-green", label: "Emerald Green", color: "#a3d977" },
  { name: "theme-lavender", label: "Lavender Purple", color: "#a78bfa" },
  { name: "theme-dark", label: "Charcoal Dark", color: "#1f2937" },
  { name: "theme-pink", label: "Vibrant Fuchsia", color: "#c026d3" },
];

const ThemeSettings = ({ isOpen = true, onClose }) => {
  const modalRef = useRef(null);

  useModalAccessibility({
    isOpen,
    onClose,
    modalRef,
  });

  if (!isOpen) return null;

  const applyTheme = (theme) => {
    document.documentElement.classList.remove(
      "theme-blue",
      "theme-peach",
      "theme-green",
      "theme-lavender",
      "theme-dark",
      "theme-pink"
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[75] overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        className="bg-white rounded-2xl w-80 shadow-2xl border border-purple-100 overflow-hidden animate-fadeIn flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3.5 bg-[var(--primary)] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <h3 id="theme-modal-title" className="text-sm font-bold tracking-wide">
              THEME SETTINGS
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Choose Accent Theme
          </p>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTheme(t.name)}
                title={t.label}
                aria-label={`Select ${t.label} theme`}
                className="h-12 rounded-xl cursor-pointer border-2 border-transparent hover:border-purple-300 hover:scale-105 active:scale-95 transition-all shadow-xs flex items-center justify-center"
                style={{ backgroundColor: t.color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
