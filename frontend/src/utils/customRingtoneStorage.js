/**
 * Tasklert Custom Audio & Ringtone Storage
 * 
 * Safely persists custom user audio files (MP3, WAV, M4A, OGG) using browser IndexedDB.
 * Ensures custom music and ringtones survive browser restarts, tab closures, and PWA updates
 * without uploading private audio files to the cloud.
 */

const DB_NAME = "tasklert_audio_db";
const DB_VERSION = 1;
const STORE_NAME = "ringtones";

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
        console.warn("IndexedDB audio store error, using fallback:", event.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB unavailable:", err);
      resolve(null);
    }
  });
};

export const customRingtoneStorage = {
  /**
   * Save a user audio file for a specific mode/slot ('focus', 'short_break', 'long_break')
   * If applyToAll is true, saves the file across focus, short_break, and long_break.
   */
  async saveRingtone(key, file, applyToAll = false) {
    if (!file) return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const slots = applyToAll ? ["focus", "short_break", "long_break"] : [String(key)];

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
      }

      return memoryFallback.get(String(key)) || null;
    } catch (err) {
      console.error("Failed to save custom ringtone:", err);
      return null;
    }
  },

  /**
   * Save an audio file to all slots (focus, short_break, long_break)
   */
  async saveRingtoneToAll(file) {
    return this.saveRingtone("focus", file, true);
  },

  /**
   * Retrieve a stored ringtone with raw ArrayBuffer data and blob URL
   */
  async getRingtone(key) {
    const k = String(key || "focus");

    try {
      let record = memoryFallback.get(k);

      if (!record) {
        const db = await openDatabase();
        if (db) {
          record = await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, "readonly");
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(k);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      }

      // If slot specific audio not found, check 'focus' as general custom fallback
      if ((!record || !record.data) && k !== "focus") {
        return this.getRingtone("focus");
      }

      if (!record || !record.data) return null;

      const blob = new Blob([record.data], { type: record.type || "audio/mpeg" });
      const objectUrl = URL.createObjectURL(blob);

      return {
        key: record.key,
        name: record.name,
        type: record.type,
        size: record.size,
        data: record.data, // Raw persistent ArrayBuffer for Web Audio decoding
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
    const k = String(key || "focus");
    try {
      let record = memoryFallback.get(k);
      if (!record) {
        const db = await openDatabase();
        if (db) {
          record = await new Promise((resolve) => {
            try {
              const tx = db.transaction(STORE_NAME, "readonly");
              const store = tx.objectStore(STORE_NAME);
              const req = store.get(k);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          });
        }
      }

      if (!record && k !== "focus") {
        return this.getRingtoneMetadata("focus");
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
   * Delete a custom ringtone
   */
  async deleteRingtone(key) {
    const k = String(key || "focus");
    memoryFallback.delete(k);

    const db = await openDatabase();
    if (!db) return true;

    return new Promise((resolve) => {
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
    if (!db) return true;

    return new Promise((resolve) => {
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
  },
};

export default customRingtoneStorage;
