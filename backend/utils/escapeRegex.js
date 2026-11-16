/**
 * Escapes characters with special meaning in regular expressions
 * to prevent ReDoS (Regular Expression Denial of Service) and regex injection.
 * Truncates search input to a maximum of 100 characters.
 */
export const escapeRegex = (s) => {
  if (s === null || s === undefined) return "";
  const str = String(s).slice(0, 100);
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export default {
  escapeRegex,
};
