import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from environment secret
 */
const getEncryptionKey = (customSecret = null) => {
  const secret =
    customSecret ||
    process.env.TELEGRAM_SESSION_ENCRYPTION_KEY ||
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "fallback_default_encryption_key_change_in_production";
  return crypto.createHash("sha256").update(String(secret)).digest();
};

/**
 * Encrypt a plain text string using AES-256-GCM
 * Format: enc:iv_hex:tag_hex:cipher_hex
 */
export const encryptCredential = (plainText) => {
  if (!plainText || typeof plainText !== "string") return plainText;
  if (plainText.startsWith("enc:")) return plainText; // already encrypted

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `enc:${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (err) {
    // If encryption fails, fallback safely without crashing
    return plainText;
  }
};

/**
 * Decrypt a string formatted as enc:iv_hex:tag_hex:cipher_hex
 */
export const decryptCredential = (cipherText) => {
  if (!cipherText || typeof cipherText !== "string") return cipherText;
  if (!cipherText.startsWith("enc:")) return cipherText; // not encrypted (plain text legacy)

  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return cipherText;

    const [, ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    // Decryption failed or tampered; return empty string for security
    return "";
  }
};

/**
 * Encrypt credentials object before storing in MongoDB
 */
export const encryptCredentialsObject = (credentials = {}) => {
  if (!credentials || typeof credentials !== "object") return credentials;
  const result = { ...credentials };

  const sensitiveFields = [
    "accessToken",
    "refreshToken",
    "authToken",
    "botToken",
    "sessionString",
    "smtpPass",
    "apiHash",
  ];

  for (const field of sensitiveFields) {
    if (result[field]) {
      result[field] = encryptCredential(result[field]);
    }
  }

  return result;
};

/**
 * Decrypt credentials object for internal backend service usage
 */
export const decryptCredentialsObject = (credentials = {}) => {
  if (!credentials || typeof credentials !== "object") return credentials;
  const result = { ...credentials };

  const sensitiveFields = [
    "accessToken",
    "refreshToken",
    "authToken",
    "botToken",
    "sessionString",
    "smtpPass",
    "apiHash",
  ];

  for (const field of sensitiveFields) {
    if (result[field]) {
      result[field] = decryptCredential(result[field]);
    }
  }

  return result;
};
