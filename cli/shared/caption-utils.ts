// cli/shared/caption-utils.ts
import fs from 'fs';

/**
 * Find an available system font for captions.
 * Returns a font path or 'Sans' as fallback.
 */
export function getCaptionFontPath(): string {
  const candidates = [
    '/usr/share/fonts/truetype/inter-zorin-os/Inter-ExtraBold.ttf',
    '/usr/share/fonts/truetype/inter-zorin-os/Inter-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];
  for (const font of candidates) {
    if (fs.existsSync(font)) return font;
  }
  return 'Sans';
}

/**
 * Remove punctuation from text for clean caption display.
 */
export function cleanPunctuation(text: string): string {
  return text
    .replace(/[.,?!:;""''`~–—\-\(\)\[\]\{\}\/\\«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CaptionChunk {
  text: string;
  start: number;
  end: number;
}

/**
 * Split raw text into timed caption chunks distributed evenly over totalDur.
 */
export function generateCaptionChunks(
  rawText: string,
  totalDur: number,
  maxWordsPerChunk: number = 3,
): CaptionChunk[] {
  const text = cleanPunctuation(rawText);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWordsPerChunk) {
    chunks.push(words.slice(i, i + maxWordsPerChunk).join(' '));
  }

  const totalWords = words.length;
  let currentStart = 0;
  const result: CaptionChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkWords = chunks[i].split(/\s+/).length;
    const chunkDur = (chunkWords / totalWords) * totalDur;
    const end = (i === chunks.length - 1) ? totalDur : Math.min(totalDur, currentStart + chunkDur);

    result.push({
      text: chunks[i],
      start: Number(currentStart.toFixed(3)),
      end: Number(end.toFixed(3)),
    });
    currentStart = end;
  }
  return result;
}

/**
 * Wrap text to a maximum line width for subtitle rendering.
 */
export function wrapText(text: string, maxLen: number = 34): string {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxLen) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}
