import React from "react";
import { TasklertIcon } from "./TasklertLogo";

/**
 * PageTransitionLoader
 * Lightweight, accessible, minimal page-transition loading component.
 *
 * Design features:
 * - Centered Tasklert T-and-bell vector logo with subtle brand pulse
 * - Tasklert brand typography in Manrope font
 * - Thin, animated theme-aware progress bar
 * - Minimal, distraction-free aesthetic respecting reduced-motion preferences
 */
export const PageTransitionLoader = ({
  message = "Loading page...",
  minHeight = "min-h-[50vh] sm:min-h-[60vh]",
  className = "",
  fullScreen = false,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={`${
        fullScreen
          ? "fixed inset-0 z-50 min-h-screen bg-gray-50/80 backdrop-blur-xs"
          : `${minHeight} w-full`
      } flex flex-col items-center justify-center p-4 transition-opacity duration-200 select-none ${className}`}
    >
      <div className="flex flex-col items-center gap-3">
        {/* Centered Tasklert T-and-bell logo */}
        <div className="transition-transform duration-300">
          <TasklertIcon
            size={52}
            idPrefix="ptl"
            className="animate-pulse motion-reduce:animate-none drop-shadow-xs"
          />
        </div>

        {/* Tasklert Brand Name */}
        <span
          className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900"
          style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}
        >
          Tasklert
        </span>

        {/* Thin Animated Purple Progress Indicator */}
        <div
          className="h-1 w-32 sm:w-40 rounded-full overflow-hidden relative mt-0.5"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary, #a855f7) 16%, #f3e8ff)" }}
        >
          <div
            className="h-full w-2/3 rounded-full animate-tasklert-progress"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--primary, #8b2cf5), color-mix(in srgb, var(--primary, #8b2cf5) 70%, #d946ef), transparent)",
            }}
          />
        </div>

        {/* Screen Reader status message */}
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
};

export default PageTransitionLoader;
