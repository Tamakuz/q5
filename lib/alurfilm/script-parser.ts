// lib/alurfilm/script-parser.ts

export interface VisualOnlySegment {
  type: 'visual_only';
  durationSeconds: number;
  description: string;
  rawTag: string;
}

export interface NarrationSegment {
  type: 'narration';
  text: string;
}

export type ScriptSegment = NarrationSegment | VisualOnlySegment;

export interface ParsedScriptResult {
  segments: ScriptSegment[];
  totalVisualOnlyCount: number;
  totalVisualOnlyDuration: number;
  geminiTtsScript: string;
  cleanNarrationText: string;
}

/**
 * Regex pattern to match [VISUAL_ONLY: X.Xs | Description] tags
 */
export const VISUAL_ONLY_TAG_REGEX = /\[VISUAL_ONLY:\s*([\d.]+)\s*s?\s*(?:\|\s*([^\]]+))?\]/gi;

/**
 * Regex pattern to match [EXPRESSION: ...], [AUDIO: ...], [SFX: ...] direction tags and vocal tags [laugh], [chuckle], [sigh], [gasp], [whisper], [shout], [hyped], etc.
 */
export const EXPRESSION_TAG_REGEX = /\[(EXPRESSION|AUDIO|SFX|VOICE|laugh|chuckle|chuckles|sigh|gasp|whisper|excited|curious|pause|shout|shouting|screaming|hyped|yell|cheer)(?::\s*([^\]]*))?\]/gi;

/**
 * Converts script containing [VISUAL_ONLY: 5.0s | ...] into Gemini TTS SSML break tags.
 * Example: "Hello [VISUAL_ONLY: 5.0s | action] world" -> "Hello <break time="5.0s"/> world"
 */
export function convertToGeminiTtsScript(rawScript: string): string {
  if (!rawScript) return '';
  return rawScript
    .replace(
      VISUAL_ONLY_TAG_REGEX,
      (_match, secStr) => {
        const sec = parseFloat(secStr) || 5;
        return `<break time="${sec.toFixed(1)}s"/>`;
      }
    )
    .replace(EXPRESSION_TAG_REGEX, '');
}

/**
 * Strips all [VISUAL_ONLY: ...], [EXPRESSION: ...], [AUDIO: ...] tags from the script, leaving clean narration text.
 */
export function stripVisualOnlyTags(rawScript: string): string {
  if (!rawScript) return '';
  return rawScript
    .replace(VISUAL_ONLY_TAG_REGEX, '')
    .replace(EXPRESSION_TAG_REGEX, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Parses script text into structured segments of Narration and VisualOnly.
 */
export function parseScriptSegments(rawScript: string): ParsedScriptResult {
  if (!rawScript) {
    return {
      segments: [],
      totalVisualOnlyCount: 0,
      totalVisualOnlyDuration: 0,
      geminiTtsScript: '',
      cleanNarrationText: '',
    };
  }

  const segments: ScriptSegment[] = [];
  let totalVisualOnlyCount = 0;
  let totalVisualOnlyDuration = 0;

  const regex = new RegExp(VISUAL_ONLY_TAG_REGEX.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawScript)) !== null) {
    // Add text preceding the tag as narration segment
    const narrationText = rawScript.slice(lastIndex, match.index).trim();
    if (narrationText) {
      segments.push({
        type: 'narration',
        text: narrationText,
      });
    }

    const durationSeconds = parseFloat(match[1]) || 5.0;
    const description = match[2] ? match[2].trim() : 'Adegan visual tanpa voiceover';

    segments.push({
      type: 'visual_only',
      durationSeconds,
      description,
      rawTag: match[0],
    });

    totalVisualOnlyCount += 1;
    totalVisualOnlyDuration += durationSeconds;

    lastIndex = regex.lastIndex;
  }

  // Add remaining trailing text after the last match
  const remainingText = rawScript.slice(lastIndex).trim();
  if (remainingText) {
    segments.push({
      type: 'narration',
      text: remainingText,
    });
  }

  return {
    segments,
    totalVisualOnlyCount,
    totalVisualOnlyDuration,
    geminiTtsScript: convertToGeminiTtsScript(rawScript),
    cleanNarrationText: stripVisualOnlyTags(rawScript),
  };
}
