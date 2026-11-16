/**
 * Centralized JWT configuration and secret validator.
 * Enforces production security: aborts startup if JWT_SECRET is missing or insecure.
 */

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (
      !secret ||
      secret.trim() === '' ||
      secret.length < 32 ||
      secret.toLowerCase().includes('change') ||
      secret.toLowerCase().includes('your_jwt_secret')
    ) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing, shorter than 32 characters, or contains an insecure placeholder ("change" / "your_jwt_secret"). In production, a secure, strong JWT_SECRET must be configured.'
      );
    }
    return secret;
  }

  // Non-production fallback for local development and test runs
  if (!secret || secret.trim() === '') {
    return 'dev_insecure_fallback_secret_32_characters_minimum!';
  }
  return secret;
};

export default {
  getJwtSecret,
};
