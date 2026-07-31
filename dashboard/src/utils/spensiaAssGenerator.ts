// dashboard/src/utils/spensiaAssGenerator.ts
import { TimelineCaptionItem } from './spensiaTimelineGenerator';
import { hexToAssColor, assTime, cleanPunct } from '../../electron/shared/subtitle-utils.cjs';
import { SPENSIA_CAPTION_COLORS } from './spensiaTheme';

export interface CaptionStyleOptions {
  fontName?: string;
  fontSize?: number;
  activeColorHex?: string;    // Highlight active word (green-500 #22C55E)
  inactiveColorHex?: string;  // Normal text (e.g. white '#FFFFFF')
  outlineColorHex?: string;   // Outline (e.g. black '#000000')
  outlineWidth?: number;
  shadowDistance?: number;
  positionY?: number;         // Vertical margin from bottom
  positionX?: number;         // Horizontal margin offset from edge
  alignment?: number;         // ASS alignment code (2=bottom-center, 1=bottom-left, 3=bottom-right, 5=middle)
  timeOffsetSec?: number;     // Sync offset shift in seconds
  captionDisplayMode?: 'single-word' | 'phrase'; // 'single-word' (CapCut 1-word pop-up) vs 'phrase' (2-3 words line)
}

// Thin wrappers for API compatibility — canonical implementations live in
// electron/shared/subtitle-utils.cjs (shared between Electron CJS and TS frontend).
export { hexToAssColor, assTime, cleanPunct };

/**
 * Clean all punctuation marks from word string (strip .,:;!?-"“”'’`()[]{})
 * @deprecated Use cleanPunct from 'electron/shared/subtitle-utils.cjs' directly.
 */
export function cleanPunctuation(word: string): string {
  return cleanPunct(word);
}

/**
 * Convert Hex color string (#RRGGBB) to ASS color format (&H00BBGGRR&)
 * @deprecated Use hexToAssColor from 'electron/shared/subtitle-utils.cjs' directly.
 */

/**
 * Format seconds to ASS timecode format (H:MM:SS.cs)
 * @deprecated Use assTime from 'electron/shared/subtitle-utils.cjs' directly.
 */
export function formatAssTime(sec: number): string {
  return assTime(sec);
}

/**
 * Generate ASS Subtitle File Content from Timeline Captions (CapCut 100% Word-Level Sync Engine)
 */
export function generateAssSubtitles(
  captions: TimelineCaptionItem[],
  options?: CaptionStyleOptions
): string {
  const fontName = options?.fontName || 'Montserrat';
  const fontSize = options?.fontSize || 48;
  const activeAssColor = hexToAssColor(options?.activeColorHex || SPENSIA_CAPTION_COLORS.activeColorHex);
  const inactiveAssColor = hexToAssColor(options?.inactiveColorHex || SPENSIA_CAPTION_COLORS.inactiveColorHex);
  const outlineAssColor = hexToAssColor(options?.outlineColorHex || SPENSIA_CAPTION_COLORS.outlineColorHex);
  const outlineWidth = options?.outlineWidth !== undefined ? options.outlineWidth : 3;
  const shadowDist = options?.shadowDistance !== undefined ? options.shadowDistance : 2;
  const posMarginV = options?.positionY !== undefined ? options.positionY : 90;
  const posMarginH = options?.positionX !== undefined ? options.positionX : 40;
  const alignment = options?.alignment !== undefined ? options.alignment : 2; // 2 = bottom-center
  const timeOffset = options?.timeOffsetSec !== undefined ? options.timeOffsetSec : 0.0; // 1-to-1 sync default
  const displayMode = options?.captionDisplayMode || 'single-word';

  // WrapStyle: 2 enforces single-line display
  const header = `[Script Info]
Title: Spensia CapCut Word-Level Sync Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${activeAssColor},${inactiveAssColor},${outlineAssColor},&H80000000,-1,0,0,0,100,100,1,0,1,${outlineWidth},${shadowDist},${alignment},${posMarginH},${posMarginH},${posMarginV},1
`;

  const lines: string[] = [header];

  if (!captions || captions.length === 0) {
    return lines.join('\n');
  }

  // Filter out empty/punctuation-only words and clean punctuation from text
  const cleanCaptions: TimelineCaptionItem[] = [];
  captions.forEach((item) => {
    const cleaned = cleanPunctuation(item.word);
    if (cleaned) {
      cleanCaptions.push({
        ...item,
        word: cleaned,
      });
    }
  });

  if (cleanCaptions.length === 0) {
    return lines.join('\n');
  }

  // Sort captions by start_sec to ensure strict chronological order
  const sortedCaptions = [...cleanCaptions].sort((a, b) => a.start_sec - b.start_sec);

  // MODE A: SINGLE WORD POP-UP (100% Direct Transcript JSON Timestamp Mapping)
  if (displayMode === 'single-word') {
    sortedCaptions.forEach((w, idx) => {
      const nextW = sortedCaptions[idx + 1];

      const startSec = Math.max(0, w.start_sec + timeOffset);
      let endSec = w.end_sec + timeOffset;

      // Ensure seamless handoff to next word's start time if continuous speech
      if (nextW) {
        const nextStart = Math.max(0, nextW.start_sec + timeOffset);
        if (nextStart > startSec && nextStart <= endSec + 0.2) {
          endSec = nextStart;
        }
      }

      if (endSec <= startSec) {
        endSec = startSec + 0.25;
      }

      const startT = formatAssTime(startSec);
      const endT = formatAssTime(endSec);

      // Render single active word in bright yellow with bold & 15% scale boost
      const wordText = '{\\c' + activeAssColor + '\\fscx115\\fscy115\\b1}' + w.word;
      lines.push('Dialogue: 0,' + startT + ',' + endT + ',Default,,0,0,0,,' + wordText);
    });

    return lines.join('\n');
  }

  // MODE B: 2-3 WORD PHRASE HIGHLIGHT
  const MAX_WORDS_PER_LINE = 3;
  const phraseGroups: TimelineCaptionItem[][] = [];

  for (let i = 0; i < sortedCaptions.length; i += MAX_WORDS_PER_LINE) {
    phraseGroups.push(sortedCaptions.slice(i, i + MAX_WORDS_PER_LINE));
  }

  phraseGroups.forEach((group, groupIdx) => {
    if (group.length === 0) return;

    const nextGroup = phraseGroups[groupIdx + 1];

    group.forEach((targetWord, idx) => {
      const wordStartSec = Math.max(0, targetWord.start_sec + timeOffset);
      const startT = formatAssTime(wordStartSec);

      let wordEndSec = targetWord.end_sec + timeOffset;
      if (idx < group.length - 1) {
        wordEndSec = Math.max(wordStartSec + 0.15, group[idx + 1].start_sec + timeOffset);
      } else if (nextGroup && nextGroup.length > 0) {
        wordEndSec = Math.max(wordStartSec + 0.15, nextGroup[0].start_sec + timeOffset);
      } else {
        wordEndSec = wordStartSec + 0.5;
      }

      if (wordEndSec <= wordStartSec) {
        wordEndSec = wordStartSec + 0.25;
      }

      const endT = formatAssTime(wordEndSec);

      const phraseText = group
        .map((w) => {
          if (w === targetWord) {
            return '{\\c' + activeAssColor + '\\fscx112\\fscy112\\b1}' + w.word + '{\\r}';
          } else {
            return w.word;
          }
        })
        .join(' ');

      lines.push('Dialogue: 0,' + startT + ',' + endT + ',Default,,0,0,0,,' + phraseText);
    });
  });

  return lines.join('\n');
}
