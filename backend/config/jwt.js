/**
 * Centralized JWT configuration and secret validator.
 * Enforces production security: aborts startup if JWT_SECRET is missing or insecure.
 */

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '' || secret === 'your_jwt_secret_here') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing or set to the insecure placeholder "your_jwt_secret_here". In production, a secure, strong JWT_SECRET must be configured.'
      );
    }
    return 'your_jwt_secret_here';
  }
  return secret;
};

export default {
  getJwtSecret,
};
