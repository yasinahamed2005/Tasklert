import axios from "axios";
import { API_BASE_URL } from "../config/api";

const getHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

/**
 * Fetch scheduled deliveries with optional channel, status, and search filters
 */
export const fetchScheduledDeliveries = async ({ channel = "all", status = "all", search = "", limit = 50 } = {}) => {
  try {
    const params = new URLSearchParams();
    if (channel && channel !== "all") params.append("channel", channel);
    if (status && status !== "all") params.append("status", status);
    if (search) params.append("search", search);
    if (limit) params.append("limit", limit);

    const res = await axios.get(`${API_BASE_URL}/api/scheduled?${params.toString()}`, getHeaders());
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn("[unifiedScheduleApi] /api/scheduled endpoint returned 404. Backend server must be restarted.");
      return {
        success: false,
        items: [],
        total: 0,
        message: "Endpoint not found (404). Please restart your backend server (npm run dev in /backend).",
      };
    }
    throw err;
  }
};

/**
 * Fetch unified schedule overview statistics
 */
export const fetchScheduledStats = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/scheduled/stats`, getHeaders());
    return res.data.stats;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn("[unifiedScheduleApi] /api/scheduled/stats returned 404. Backend server must be restarted.");
      return {
        total: 0,
        tasklert_mail: 0,
        google_mail: 0,
        telegram: 0,
        upcoming: 0,
        sent: 0,
        failed: 0,
      };
    }
    throw err;
  }
};

/**
 * Create a new scheduled delivery
 */
export const createScheduledDelivery = async (deliveryData) => {
  try {
    const res = await axios.post(`${API_BASE_URL}/api/scheduled`, deliveryData, getHeaders());
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error("Backend server needs to be restarted to activate the /api/scheduled route. Please restart your backend (Ctrl+C then npm run dev in /backend).");
    }
    const message = err.response?.data?.message || err.message || "Failed to schedule delivery.";
    throw new Error(message);
  }
};

/**
 * Get details of a single scheduled delivery
 */
export const fetchScheduledDeliveryById = async (id) => {
  const res = await axios.get(`${API_BASE_URL}/api/scheduled/${id}`, getHeaders());
  return res.data.delivery;
};

/**
 * Update / reschedule an existing scheduled delivery
 */
export const updateScheduledDelivery = async (id, updates) => {
  const res = await axios.put(`${API_BASE_URL}/api/scheduled/${id}`, updates, getHeaders());
  return res.data;
};

/**
 * Cancel a scheduled delivery
 */
export const cancelScheduledDelivery = async (id) => {
  const res = await axios.delete(`${API_BASE_URL}/api/scheduled/${id}`, getHeaders());
  return res.data;
};

/**
 * Duplicate an existing delivery with a new scheduled time
 */
export const duplicateScheduledDelivery = async (id, scheduledAt) => {
  const res = await axios.post(`${API_BASE_URL}/api/scheduled/${id}/duplicate`, { scheduledAt }, getHeaders());
  return res.data;
};

/**
 * Fetch unified QuickSend overview data (stats, recent messages across all channels, upcoming scheduled items)
 */
export const fetchQuicksendOverview = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/scheduled/overview`, getHeaders());
    return res.data;
  } catch (err) {
    console.warn("[unifiedScheduleApi] Failed to load QuickSend overview:", err.message);
    return {
      success: false,
      stats: {
        messagesSent: 0,
        emailsSent: 0,
        scheduled: 0,
        pending: 0,
      },
      recentMessages: [],
      scheduledItems: [],
    };
  }
};

/**
 * Dispatch an existing scheduled delivery immediately
 */
export const sendNowScheduledDelivery = async (id) => {
  const res = await axios.post(`${API_BASE_URL}/api/scheduled/${id}/send-now`, {}, getHeaders());
  return res.data;
};
