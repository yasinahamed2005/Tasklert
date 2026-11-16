import path from "path";

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
]);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
]);

export const sanitizeFilename = (originalName) => {
  if (!originalName || typeof originalName !== "string") return "file";
  const ext = path.extname(originalName).toLowerCase();
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
  return `${base || "file"}${ext}`;
};

export const fileFilterAllowlist = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  // Explicitly reject html, svg, and scripts
  if (
    ext === ".svg" ||
    ext === ".html" ||
    ext === ".htm" ||
    ext === ".xhtml" ||
    mime.includes("svg") ||
    mime.includes("html") ||
    mime.includes("javascript")
  ) {
    return cb(new Error("File type not allowed for security reasons."));
  }

  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext) || !ALLOWED_UPLOAD_MIME_TYPES.has(mime)) {
    return cb(
      new Error(
        "File type not allowed. Permitted formats: images (JPG, PNG, WEBP, GIF), PDF, TXT, Word, Excel, PowerPoint, and ZIP archives."
      )
    );
  }

  cb(null, true);
};

export default {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  sanitizeFilename,
  fileFilterAllowlist,
};
