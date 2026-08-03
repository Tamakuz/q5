// dashboard/electron/shared/subtitle-utils.cjs
// Canonical ASS & SRT subtitle utility functions shared between Electron backend
// and TypeScript frontend.

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
 * @param {string} word
 * @returns {string}
 */
function cleanPunct(word) {
  if (!word) return '';
  return word.replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
}

/**
 * Parse an SRT timestamp string (e.g. "00:01:23,456" or "01:23.456") to seconds float.
 * @param {string} tsStr
 * @returns {number}
 */
function parseSrtTimestampToSeconds(tsStr) {
  if (!tsStr) return 0;
  const clean = tsStr.replace(',', '.').trim();
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(clean) || 0;
}

/**
 * Parse SRT text string into standardized transcript entry objects array.
 * @param {string} srtContent
 * @returns {Array<{ id: number, start_seconds: number, end_seconds: number, timestamp_minute: string, text: string, speaker: string }>}
 */
function parseSrtToEntries(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') return [];
  const normalized = srtContent
    .replace(/^```(?:srt)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  const blocks = normalized.split(/\n\s*\n/);
  const entries = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const parts = timeLine.split('-->');
    if (parts.length < 2) continue;

    const startSec = parseSrtTimestampToSeconds(parts[0]);
    const endSec = parseSrtTimestampToSeconds(parts[1]);

    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join(' ').trim();
    if (!text) continue;

    const m1 = Math.floor(startSec / 60);
    const s1 = Math.floor(startSec % 60);
    const m2 = Math.floor(endSec / 60);
    const s2 = Math.floor(endSec % 60);
    const pad = (n) => String(n).padStart(2, '0');
    const tsMin = `${pad(m1)}:${pad(s1)} - ${pad(m2)}:${pad(s2)}`;

    entries.push({
      id: entries.length + 1,
      start_seconds: Number(startSec.toFixed(3)),
      end_seconds: Number(endSec.toFixed(3)),
      timestamp_minute: tsMin,
      text: text,
      speaker: 'Narator',
    });
  }

  return entries;
}

module.exports = { hexToAssColor, assTime, cleanPunct, parseSrtTimestampToSeconds, parseSrtToEntries };
