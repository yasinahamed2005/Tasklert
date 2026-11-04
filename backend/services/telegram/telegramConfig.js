import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();


export const getTelegramConfig = () => {
  const apiIdRaw = process.env.TELEGRAM_API_ID;
  const apiHash = (process.env.TELEGRAM_API_HASH || "").trim();

  const apiId = apiIdRaw ? parseInt(apiIdRaw, 10) : null;
  const isConfigured = Boolean(
    apiId && !isNaN(apiId) && apiId > 0 && apiHash && apiHash.length >= 10
  );

  return {
    apiId,
    apiHash,
    isConfigured,
  };
};

export const requireTelegramConfig = () => {
  const config = getTelegramConfig();
  if (!config.isConfigured) {
    throw new Error(
      "Telegram MTProto credentials missing. Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in your backend environment variables (Railway / .env)."
    );
  }
  return config;
};
