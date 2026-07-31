// dashboard/electron/shared/subtitle-utils.cjs
// Canonical ASS subtitle utility functions shared between Electron backend
// and TypeScript frontend (via bundler CJS interop + subtitle-utils.d.ts).

/**
 * Convert Hex color string (#RRGGBB) to ASS color format (&H00BBGGRR&).
 * @param {string} hexStr - e.g. "#FDE047"
 * @param {string} [alphaHex="00"] - alpha byte in hex
 * @returns {string} ASS color string
 */
function hexToAssColor(hexStr, alphaHex = '00') {
  let clean = hexStr.replace('#', '').trim();
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (clean.length !== 6) clean = 'FFFFFF';
  const rr = clean.substring(0, 2);
  const gg = clean.substring(2, 4);
  const bb = clean.substring(4, 6);
  return `&H${alphaHex}${bb}${gg}${rr}&`;
}

/**
 * Format seconds to ASS timecode format (H:MM:SS.cs).
 * @param {number} sec
 * @returns {string}
 */
function assTime(sec) {
  const safeSec = Math.max(0, sec);
  const totalMs = Math.floor(safeSec * 1000);
  const hrs = Math.floor(totalMs / 3600000);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const cs = Math.floor((totalMs % 1000) / 10); // centiseconds
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${hrs}:${pad(mins)}:${pad(secs)}.${pad(cs)}`;
}

/**
 * Clean all punctuation marks from a word string for subtitle display.
 * Uses the more comprehensive regex from the TypeScript version.
 * @param {string} word
 * @returns {string}
 */
function cleanPunct(word) {
  if (!word) return '';
  return word.replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
}

module.exports = { hexToAssColor, assTime, cleanPunct };
