/* validate.js — upload guard rules.
   Pure functions, no DOM. Kept separate so they can be tested without a browser. */

const MAX_FILE_BYTES = 15 * 1024 * 1024;   // 15MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const HEIC_RE = /heic|heif/i;

/**
 * Returns an error message string, or null if the file is acceptable.
 * Size is checked first: a 50MB PDF should complain about size, not type,
 * because that's the thing the user can most easily act on.
 */
function validateFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    return `That photo is ${(file.size / 1048576).toFixed(1)}MB. Please choose one under 15MB.`;
  }

  // Browsers sometimes report an empty type, so check the filename too.
  const isHeic = HEIC_RE.test(file.type || '') || HEIC_RE.test(file.name || '');
  if (isHeic) {
    return 'iPhone HEIC photos aren\u2019t supported by browsers yet. In Settings \u203a Camera \u203a Formats, choose \u201cMost Compatible\u201d, or export the photo as JPEG.';
  }

  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return 'Please choose a JPG, PNG, WEBP or GIF image.';
  }

  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateFile, MAX_FILE_BYTES, ALLOWED_TYPES };
}