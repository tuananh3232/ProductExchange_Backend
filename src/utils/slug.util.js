/**
 * Converts a name string into a URL-safe lowercase slug.
 * e.g. "Điện Tử & Máy Tính" → "in-t-my-tnh"
 */
export const normalizeSlug = (name = '') =>
  name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
