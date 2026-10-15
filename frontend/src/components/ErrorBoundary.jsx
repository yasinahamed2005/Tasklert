import React from "react";
import { TasklertIcon } from "./TasklertLogo";
import { RotateCw, Home } from "lucide-react";

/**
 * Tasklert Production Error Boundary
 * Catches uncaught runtime exceptions, stale deployment chunks, and rendering failures.
 * Displays a clean, branded Tasklert recovery screen with one-tap retry instead of a white page.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Tasklert ErrorBoundary caught:", error, errorInfo);

    // Auto-recover from stale Vite deployment chunks (Vite chunk load failures)
    const errorMsg = String(error?.message || "");
    const isChunkError =
      errorMsg.includes("Failed to fetch dynamically imported module") ||
      errorMsg.includes("Loading chunk") ||
      errorMsg.includes("Unexpected token '<'") ||
      error?.name === "ChunkLoadError";

    if (isChunkError) {
      const reloadKey = "tasklert_chunk_recovery_" + window.location.pathname;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        console.warn("Stale deployment chunk detected. Refreshing application cache...");
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        window.location.reload();
      }
    }
  }

  handleRetry = () => {
    // Clear chunk reload flags
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("chunk_retry_") || key.startsWith("tasklert_chunk_")) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleHardReset = async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
    } catch (_) {}
    window.location.href = "/?refresh=" + Date.now();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleRetry,
        });
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50/90 p-4 sm:p-6 text-center select-none"
        >
          <div className="max-w-md w-full bg-white rounded-3xl border border-purple-100 p-6 sm:p-8 shadow-sm flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TasklertIcon size={42} idPrefix="eb" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">
                Something went wrong
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Tasklert encountered an unexpected issue while loading this page. You can retry or return to your dashboard safely.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs sm:text-sm rounded-xl border border-purple-200/80 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleHardReset}
                className="text-[11px] font-semibold text-gray-400 hover:text-purple-600 transition mt-2 cursor-pointer"
              >
                Update to Latest Version
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
