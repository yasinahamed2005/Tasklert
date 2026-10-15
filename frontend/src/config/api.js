// frontend/src/config/api.js

/**
 * Standardized API base configuration for Tasklert.
 * - In local development: uses VITE_API_URL or defaults to http://localhost:5000.
 * - In production builds: uses VITE_API_URL or defaults to the production Railway backend
 *   (https://tasklert-production.up.railway.app), never silently falling back to localhost.
 */

const PRODUCTION_FALLBACK = "https://tasklert-production.up.railway.app";
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
 * Helper to resolve attachment URLs:
 * Handles legacy attachments stored with http://localhost:5000,
 * relative paths starting with /uploads/, or already valid absolute URLs.
 */
export const resolveAttachmentUrl = (url) => {
  if (!url || typeof url !== "string") return "";

  // If URL already points to an external link (http/https not localhost)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("localhost:5000")) {
      return url.replace(/http:\/\/localhost:5000/g, API_BASE_URL);
    }
    return url;
  }

  // Relative path
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export default API_BASE_URL;
