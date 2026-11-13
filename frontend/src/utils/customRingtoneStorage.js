/**
 * Tasklert Custom Audio & Ringtone Storage (v3 - Robust Slot & Multi-Mode Sync)
 * 
 * Safely persists custom user audio files (MP3, WAV, M4A, OGG) using browser IndexedDB.
 * Supports:
 * - Independent ringtones per mode ('focus', 'short_break', 'long_break')
 * - Unified mode: "Use the same ringtone for all sessions"
 * - Atomic propagation via "Apply this ringtone to all sessions"
 * - Stale cache purging & buffer invalidation
 * - Native Android bridge syncing via TasklertAlarmEngine.saveCustomRingtone
 */

import { soundManager } from "./soundManager";

const DB_NAME = "tasklert_audio_db";
const DB_VERSION = 1;
const STORE_NAME = "ringtones";
const UNIFIED_PREF_KEY = "tasklert_use_same_ringtone_for_all";

let dbInstance = null;
const memoryFallback = new Map();

const openDatabase = () => {
  return new Promise((resolve) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    if (typeof window === "undefined" || !window.indexedDB) {
      return resolve(null);
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn("IndexedDB audio store error, using memory fallback:", event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB unavailable:", err);
      resolve(null);
    }
  });
};

/**
 * ArrayBuffer to Base64 utility for native Android bridge
 */
const arrayBufferToBase64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const customRingtoneStorage = {
  /**
   * Check preference: "Use the same ringtone for all sessions"
   * Defaults to true for unified user experience.
   */
  getUseSameRingtoneForAll() {
    if (typeof window === "undefined") return true;
    const pref = localStorage.getItem(UNIFIED_PREF_KEY);
    return pref === null ? true : pref !== "false";
  },

  /**
   * Set preference: "Use the same ringtone for all sessions"
   */
  setUseSameRingtoneForAll(enabled) {
    if (typeof window !== "undefined") {
      localStorage.setItem(UNIFIED_PREF_KEY, enabled ? "true" : "false");
    }
  },

  /**
   * Sync custom audio bytes to native Android storage if running in Capacitor
   */
  async syncToNativeAndroid(slot, fileName, arrayBuffer) {
    try {
      if (
        typeof window !== "undefined" &&
        window.Capacitor?.isNativePlatform?.() &&
        window.Capacitor?.Plugins?.TasklertAlarmEngine
      ) {
        const base64Data = arrayBufferToBase64(arrayBuffer);
        // Phase 4: Save as authoritative ONE GLOBAL TASKLERT RINGTONE
        if (window.Capacitor.Plugins.TasklertAlarmEngine.saveGlobalRingtone) {
          await window.Capacitor.Plugins.TasklertAlarmEngine.saveGlobalRingtone({
            fileName: String(fileName),
            base64Data,
          });
        }
        if (window.Capacitor.Plugins.TasklertAlarmEngine.saveCustomRingtone) {
          await window.Capacitor.Plugins.TasklertAlarmEngine.saveCustomRingtone({
            slot: String(slot),
            fileName: String(fileName),
            base64Data,
          });
        }
        console.log(`[customRingtoneStorage] Synced ringtone "${fileName}" to native Android global storage`);
      }
    } catch (nativeErr) {
      console.warn("[customRingtoneStorage] Native Android ringtone sync failed:", nativeErr);
    }
  },

  /**
   * Save a user audio file for a mode ('global_ringtone', 'focus', etc.)
   * In unified mode, writes to 'global_ringtone', 'focus', 'short_break', 'long_break' simultaneously.
   */
  async saveRingtone(key, file, applyToAll = null) {
    if (!file) return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const shouldApplyToAll =
        applyToAll === true || (applyToAll === null && this.getUseSameRingtoneForAll());

      const slots = shouldApplyToAll
        ? ["global_ringtone", "focus", "short_break", "long_break"]
        : [String(key || "global_ringtone")];

      const db = await openDatabase();

      for (const slot of slots) {
        const record = {
          key: slot,
          name: file.name || "Custom Ringtone.mp3",
          type: file.type || "audio/mpeg",
          size: file.size || arrayBuffer.byteLength,
          data: arrayBuffer.slice(0),
          updatedAt: Date.now(),
        };

        memoryFallback.set(slot, record);

        if (db) {
          await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, "readwrite");
              const store = tx.objectStore(STORE_NAME);
              store.put(record);
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
            } catch {
              resolve(false);
            }
          });
        }

        // Mirror to native Android private filesystem
        await this.syncToNativeAndroid(slot, record.name, record.data);
      }

      // Invalidate in-memory audio buffers in soundManager so new file plays immediately
      soundManager.clearBuffers();

      return memoryFallback.get(String(key || "focus")) || null;
    } catch (err) {
      console.error("Failed to save custom ringtone:", err);
      return null;
    }
  },

  /**
   * Save an audio file to all slots (focus, short_break, long_break) explicitly
   */
  async saveRingtoneToAll(file) {
    return this.saveRingtone("focus", file, true);
  },

  /**
   * Retrieve a stored ringtone with raw ArrayBuffer data and blob URL
   */
  async getRingtone(key) {
    const isUnified = this.getUseSameRingtoneForAll();
    const primaryKey = key === "global_ringtone" || isUnified ? "global_ringtone" : String(key || "global_ringtone");

    try {
      let record = memoryFallback.get(primaryKey);

      if (!record && (primaryKey === "global_ringtone" || isUnified)) {
        // Fallback to legacy 'focus' key
        record = memoryFallback.get("focus");
      }

      if (!record) {
        const db = await openDatabase();
        if (db) {
          record = await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, "readonly");
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(primaryKey);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          });

          if (!record && (primaryKey === "global_ringtone" || isUnified)) {
            record = await new Promise((resolve) => {
              try {
                const tx = db.transaction(STORE_NAME, "readonly");
                const store = tx.objectStore(STORE_NAME);
                const req = store.get("focus");
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
              } catch {
                resolve(null);
              }
            });
          }
        }
      }

      // If in unified mode and focus record is present in memory/IDB, ensure it's returned
      if (isUnified && record && record.data) {
        // Return unified focus record
      } else if (!isUnified && (!record || !record.data)) {
        // In separate mode, if no file uploaded for this mode, return null (DO NOT silently substitute!)
        return null;
      }

      if (!record || !record.data) return null;

      const blob = new Blob([record.data], { type: record.type || "audio/mpeg" });
      const objectUrl = URL.createObjectURL(blob);

      return {
        key: record.key,
        name: record.name,
        type: record.type,
        size: record.size,
        data: record.data,
        blob,
        url: objectUrl,
      };
    } catch (err) {
      console.warn("Could not retrieve custom ringtone:", err);
      return null;
    }
  },

  /**
   * Get metadata only without allocating blob URLs
   */
  async getRingtoneMetadata(key) {
    const isUnified = this.getUseSameRingtoneForAll();
    const targetKey = isUnified ? "focus" : String(key || "focus");

    try {
      let record = memoryFallback.get(targetKey);
      if (!record) {
        const db = await openDatabase();
        if (db) {
          record = await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, "readonly");
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(targetKey);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      }

      if (!record) return null;
      return {
        key: record.key,
        name: record.name,
        type: record.type,
        size: record.size,
      };
    } catch {
      return null;
    }
  },

  /**
   * Delete a custom ringtone for a specific slot
   */
  async deleteRingtone(key) {
    const k = String(key || "focus");
    memoryFallback.delete(k);

    const db = await openDatabase();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.delete(k);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(true);
        }
      });
    }

    soundManager.clearBuffers();
    return true;
  },

  /**
   * Get metadata for all three slots without falling back between them
   */
  async getAllSlotsMetadata() {
    const slots = ["focus", "short_break", "long_break"];
    const result = {};

    const db = await openDatabase();

    for (const slot of slots) {
      let rec = memoryFallback.get(slot);
      if (!rec && db) {
        rec = await new Promise((resolve) => {
          try {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(slot);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
      }

      if (rec) {
        result[slot] = {
          key: slot,
          name: rec.name,
          size: rec.size,
          updatedAt: rec.updatedAt,
        };
      } else {
        result[slot] = null;
      }
    }

    return result;
  },

  /**
   * Clear all ringtones across all slots
   */
  async clearAllRingtones() {
    memoryFallback.clear();
    const db = await openDatabase();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch {
          resolve(true);
        }
      });
    }

    soundManager.clearBuffers();
    return true;
  },
};

export default customRingtoneStorage;
