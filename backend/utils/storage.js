import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import stream from "stream";

// Configure Cloudinary if credentials exist in environment
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Upload a buffer or stream to cloud storage (Cloudinary) with graceful local fallback.
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - { folder: string, filename?: string, resourceType?: "auto"|"image"|"raw"|"video" }
 * @returns {Promise<{ url: string, public_id: string, size?: number }>}
 */
export async function upload(buffer, options = {}) {
  const folder = options.folder || "general";
  const resourceType = options.resourceType || "auto";

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `tasklert/${folder}`,
          resource_type: resourceType,
          public_id: options.filename
            ? path.parse(options.filename).name.replace(/[^a-zA-Z0-9_-]/g, "_")
            : undefined,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url || result.url,
            public_id: result.public_id,
            size: result.bytes,
            format: result.format,
          });
        }
      );

      const bufferStream = new stream.PassThrough();
      bufferStream.end(buffer);
      bufferStream.pipe(uploadStream);
    });
  }

  // Graceful local fallback for development, testing, and offline environments
  const localDir = path.join(process.cwd(), "uploads", folder);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
  const ext = options.filename ? path.extname(options.filename).toLowerCase() : "";
  const safeBase = options.filename
    ? path.parse(options.filename).name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50)
    : "file";
  const finalFilename = `${safeBase}_${uniqueSuffix}${ext}`;
  const filePath = path.join(localDir, finalFilename);

  await fs.promises.writeFile(filePath, buffer);

  const backendBase = (
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://tasklert.onrender.com"
      : `http://localhost:${process.env.PORT || 5000}`)
  ).replace(/\/$/, "");

  const url = `${backendBase}/uploads/${folder}/${finalFilename}`;

  return {
    url,
    public_id: `local:${folder}/${finalFilename}`,
    size: buffer.length,
    filename: finalFilename,
  };
}

/**
 * Remove a file from cloud storage or local fallback by public ID.
 * @param {string} publicId
 * @returns {Promise<boolean>}
 */
export async function remove(publicId) {
  if (!publicId) return false;

  if (isCloudinaryConfigured && !publicId.startsWith("local:")) {
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (err) {
      console.warn("[Storage] Cloudinary delete failed:", err.message);
      return false;
    }
  }

  // Local fallback removal
  try {
    const relative = publicId.replace(/^local:/, "").replace(/^\/+/, "");
    const localPath = path.join(process.cwd(), "uploads", relative);
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      return true;
    }
  } catch (err) {
    console.warn("[Storage] Local file unlink failed:", err.message);
  }
  return false;
}

export default {
  upload,
  remove,
};
