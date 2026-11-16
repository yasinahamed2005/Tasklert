// frontend/src/config/api.js
import axios from "axios";
import { notify } from "../utils/toastManager";

/**
 * Standardized API base configuration for Tasklert.
 * - In local development: uses VITE_API_URL or defaults to http://localhost:5000.
 * - In production builds: uses VITE_API_URL or defaults to the production Render backend
 *   (https://tasklert.onrender.com), never silently falling back to localhost.
 */

const PRODUCTION_FALLBACK = "https://tasklert.onrender.com";
const DEVELOPMENT_FALLBACK = "http://localhost:5000";

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }

  if (import.meta.env.PROD) {
    return PRODUCTION_FALLBACK;
  }

  return DEVELOPMENT_FALLBACK;
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Cold-Start Detector:
 * If an initial API request takes > 3s on first load (e.g. Render free tier spin-up),
 * inform the user with a friendly, reassuring message.
 */
let coldStartTimer = null;
let hasShownColdStartNotice = false;

axios.interceptors.request.use((config) => {
  if (!hasShownColdStartNotice && !coldStartTimer) {
    coldStartTimer = setTimeout(() => {
      if (!hasShownColdStartNotice) {
        hasShownColdStartNotice = true;
        notify.info("Waking up the server, thanks for your patience! This only happens after inactivity.", { autoClose: 6000 });
      }
    }, 3000);
  }
  return config;
});

axios.interceptors.response.use(
  (response) => {
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      coldStartTimer = null;
    }
    return response;
  },
  (error) => {
    if (coldStartTimer) {
      clearTimeout(coldStartTimer);
      coldStartTimer = null;
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to resolve attachment URLs:
 * Handles legacy attachments stored with http://localhost:5000,
 * old Railway URLs (tasklert-production.up.railway.app),
 * relative paths starting with /uploads/, or already valid absolute URLs.
 */
export const resolveAttachmentUrl = (url) => {
  if (!url || typeof url !== "string") return "";

  // If URL already points to an external link (http/https)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (
      url.includes("localhost:5000") ||
      url.includes("tasklert-production.up.railway.app") ||
      url.includes("railway.app")
    ) {
      return url
        .replace(/https?:\/\/localhost:5000/g, API_BASE_URL)
        .replace(/https?:\/\/[a-zA-Z0-9-]+\.up\.railway\.app/g, API_BASE_URL)
        .replace(/https?:\/\/[a-zA-Z0-9-]+\.railway\.app/g, API_BASE_URL);
    }
    return url;
  }

  // Relative path
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export default API_BASE_URL;
