import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { getClientForUser } from "./telegramClient.service.js";
import { resolvePeer } from "./telegramPeers.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "telegram");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const MEDIA_CACHE_DIR = path.join(UPLOAD_DIR, "media_cache");
if (!fs.existsSync(MEDIA_CACHE_DIR)) {
  fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
}

// In-memory cache for peers confirmed to have no profile photo: Map<key, timestamp>
const noAvatarCache = new Map();
const NO_AVATAR_TTL = 30 * 60 * 1000; // 30 minutes

// Multer storage for uploaded attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || "";
    cb(null, `tg-${uniqueSuffix}${ext}`);
  },
});

export const telegramUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per attachment
});

/**
 * Download and stream media from a Telegram message with disk caching
 */
export const downloadMessageMedia = async (userId, chatId, messageId, res) => {
  const cleanChatId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanMsgId = String(messageId).replace(/[^0-9]/g, "");
  const cacheKey = `${userId}_${cleanChatId}_${cleanMsgId}`;
  const binPath = path.join(MEDIA_CACHE_DIR, `${cacheKey}.bin`);
  const metaPath = path.join(MEDIA_CACHE_DIR, `${cacheKey}.meta.json`);

  // 1. Fast path: check disk cache
  if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
    try {
      const stats = fs.statSync(binPath);
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (stats.size > 0 && meta?.mimeType) {
        res.setHeader("Content-Type", meta.mimeType);
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(meta.filename || `media-${cleanMsgId}`)}"`);
        res.setHeader("Content-Length", stats.size);
        res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
        return fs.createReadStream(binPath).pipe(res);
      }
    } catch (_) {}
  }

  const client = await getClientForUser(userId);
  if (!client) {
    return res.status(401).json({ success: false, message: "Telegram account not connected." });
  }

  try {
    const peer = await resolvePeer(client, userId, chatId);
    const messages = await client.getMessages(peer, { ids: [Number(messageId)] });
    const msg = messages?.[0];

    if (!msg || !msg.media) {
      return res.status(404).json({ success: false, message: "Media not found." });
    }

    const buffer = await client.downloadMedia(msg.media);
    if (!buffer || buffer.length === 0) {
      return res.status(404).json({ success: false, message: "Failed to download media." });
    }

    let mimeType = "application/octet-stream";
    let filename = `media-${messageId}`;

    if (msg.file) {
      mimeType = msg.file.mimeType || mimeType;
      filename = msg.file.name || filename;
    } else if (msg.media?.document) {
      mimeType = msg.media.document.mimeType || mimeType;
      const attr = msg.media.document.attributes?.find((a) => a.fileName);
      if (attr?.fileName) filename = attr.fileName;
    } else if (msg.media.className === "MessageMediaPhoto") {
      mimeType = "image/jpeg";
      filename = `photo-${messageId}.jpg`;
    }

    // Save to disk cache asynchronously
    try {
      fs.writeFile(binPath, buffer, () => {});
      fs.writeFile(metaPath, JSON.stringify({ mimeType, filename }), () => {});
    } catch (_) {}

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");

    return res.end(buffer);
  } catch (err) {
    console.error(`[TelegramMedia] Download error for ${chatId}/${messageId}:`, err.message);
    return res.status(500).json({ success: false, message: "Error downloading media." });
  }
};

/**
 * Download and stream cached avatar for any Telegram peer (user, group, channel, self).
 * Uses disk cache to prevent repetitive network roundtrips to MTProto.
 */
export const downloadProfileAvatar = async (userId, chatId, res) => {
  const cleanId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, "");
  const cacheKey = `${userId}_${cleanId}`;
  const avatarPath = path.join(AVATAR_DIR, `${cacheKey}.jpg`);

  // 1. Fast path: check disk cache
  if (fs.existsSync(avatarPath)) {
    try {
      const stats = fs.statSync(avatarPath);
      const ageMs = Date.now() - stats.mtimeMs;
      // Serve cached image if less than 24 hours old
      if (ageMs < 24 * 60 * 60 * 1000 && stats.size > 0) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Content-Length", stats.size);
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        return fs.createReadStream(avatarPath).pipe(res);
      }
    } catch (_) {}
  }

  // 2. Check negative cache (known to have no photo)
  if (noAvatarCache.has(cacheKey)) {
    const cachedTime = noAvatarCache.get(cacheKey);
    if (Date.now() - cachedTime < NO_AVATAR_TTL) {
      res.setHeader("Cache-Control", "public, max-age=1800");
      return res.status(404).json({ success: false, message: "No profile photo" });
    }
    noAvatarCache.delete(cacheKey);
  }

  // 3. Connect to Telegram client & resolve peer
  const client = await getClientForUser(userId);
  if (!client) {
    return res.status(401).json({ success: false, message: "Telegram account not connected." });
  }

  try {
    const peer = await resolvePeer(client, userId, chatId);
    const photoBuffer = await client.downloadProfilePhoto(peer, { isBig: false });

    if (!photoBuffer || photoBuffer.length === 0) {
      noAvatarCache.set(cacheKey, Date.now());
      res.setHeader("Cache-Control", "public, max-age=1800");
      return res.status(404).json({ success: false, message: "No profile photo" });
    }

    // Save to disk cache asynchronously
    fs.promises.writeFile(avatarPath, photoBuffer).catch((err) => {
      console.warn(`[TelegramAvatar] Failed to write cache for ${cleanId}:`, err.message);
    });

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", photoBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.end(photoBuffer);
  } catch (err) {
    console.warn(`[TelegramAvatar] Avatar download failed for ${cleanId}:`, err.message);
    noAvatarCache.set(cacheKey, Date.now());
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(404).json({ success: false, message: "Profile photo not available." });
  }
};
