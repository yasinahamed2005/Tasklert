import React, { useState } from "react";
import { MapPin, Navigation, X, Loader2, Send } from "lucide-react";

/**
 * TelegramLocationModal
 * Requests browser location permission explicitly upon user action and sends coordinates via Telegram MTProto
 */
export default function TelegramLocationModal({
  isOpen,
  onClose,
  onSubmitLocation,
  chatTitle = "conversation",
}) {
  const [coords, setCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        let msg = "Failed to obtain location.";
        if (err.code === 1) msg = "Location permission was denied.";
        else if (err.code === 2) msg = "Location is unavailable.";
        else if (err.code === 3) msg = "Location request timed out.";
        setError(msg);
        setLocating(false);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const handleSend = async () => {
    if (!coords) return;
    setSubmitting(true);
    setError("");

    try {
      await onSubmitLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyRadius: coords.accuracy || 0,
      });
      setCoords(null);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send location.");
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
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Send Location</h3>
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

        {!coords ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-slate-800 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <Navigation className="w-6 h-6 animate-pulse" />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Click below to detect your current GPS location and send it via Telegram.
            </p>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {locating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locating...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Find My Current Location</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-slate-800 border border-purple-100 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Latitude:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {coords.latitude.toFixed(6)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Longitude:</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  {coords.longitude.toFixed(6)}
                </span>
              </div>
              {coords.accuracy && (
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>Accuracy:</span>
                  <span>~{Math.round(coords.accuracy)}m</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCoords(null)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Location</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
