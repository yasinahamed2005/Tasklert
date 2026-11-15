import { db, generateUUID } from "../db/tasklertDb.js";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const API_BASE = API_BASE_URL;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

// Disallowed dangerous executable file extensions
const DISALLOWED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".vbs",
  ".msi",
  ".dll",
  ".scr",
  ".pif",
  ".application",
  ".gadget",
  ".com",
  ".jar",
];

export const attachmentService = {
  /**
   * Validate file size and safe file extension
   */
  validateFile(file) {
    if (!file) return { valid: false, error: "No file selected." };

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: "File size exceeds 10MB limit. Please choose a smaller file.",
      };
    }

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (DISALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Executable and script files (${ext}) are not allowed for security reasons.`,
      };
    }

    return { valid: true };
  },

  /**
   * Store attachment locally in IndexedDB when offline
   */
  async queueOfflineAttachment(file, localTaskId = null) {
    const val = this.validateFile(file);
    if (!val.valid) throw new Error(val.error);

    const attachmentId = generateUUID();
    const blobUrl = URL.createObjectURL(file);

    const record = {
      id: attachmentId,
      localId: attachmentId,
      taskId: localTaskId,
      name: file.name,
      fileType: file.type || "document",
      size: file.size,
      blob: file,
      blobUrl,
      createdAt: new Date().toISOString(),
      status: "pending_upload",
    };

    try {
      await db.attachments.put(record);
    } catch (_) {}

    return {
      name: file.name,
      url: blobUrl,
      fileType: file.type || "document",
      size: file.size,
      localAttachmentId: attachmentId,
      isOfflineQueued: true,
    };
  },

  /**
   * Upload attachment (handles online upload with automatic offline fallback)
   */
  async uploadAttachment(file, token) {
    const val = this.validateFile(file);
    if (!val.valid) throw new Error(val.error);

    // If offline, queue immediately
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return await this.queueOfflineAttachment(file);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      if (data.success && data.file) {
        return data.file;
      }
      throw new Error(data.message || "Upload failed");
    } catch (err) {
      // If network dropped mid-flight, fall back to offline queue
      if (!navigator.onLine || err.code === "ERR_NETWORK") {
        return await this.queueOfflineAttachment(file);
      }
      throw err;
    }
  },

  /**
   * Upload all pending attachments in IndexedDB once online
   */
  async uploadPendingAttachments(token) {
    if (!token || (typeof navigator !== "undefined" && !navigator.onLine)) {
      return 0;
    }

    try {
      const pending = await db.attachments
        .where("status")
        .equals("pending_upload")
        .toArray();

      let uploaded = 0;
      for (const item of pending) {
        if (!item.blob) continue;
        try {
          const formData = new FormData();
          formData.append("file", item.blob, item.name);

          const { data } = await axios.post(`${API_BASE}/upload`, formData, {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          });

          if (data.success && data.file) {
            await db.attachments.update(item.id, {
              status: "uploaded",
              serverUrl: data.file.url,
            });
            uploaded++;
          }
        } catch (_) {}
      }
      return uploaded;
    } catch (_) {
      return 0;
    }
  },
};

export default attachmentService;
