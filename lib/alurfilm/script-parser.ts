// lib/alurfilm/script-parser.ts

export interface VisualOnlySegment {
  type: 'visual_only';
  durationSeconds: number;
  description: string;
  rawTag: string;
  sourceRange?: string;
  sourceStartSeconds?: number;
  sourceEndSeconds?: number;
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
 * Robust Regex pattern to match [VISUAL_ONLY...] tags with optional duration/timestamp range and description.
 * Matches:
 * - [VISUAL_ONLY: 5.0s | Deskripsi]
 * - [VISUAL_ONLY: 00:06.000 - 00:29.000 | Deskripsi adegan]
 * - [VISUAL_ONLY: 4.5s]
 * - [VISUAL_ONLY]
 */
export const VISUAL_ONLY_TAG_REGEX = /\[VISUAL_ONLY[^\]]*\]/gi;

/**
 * Regex pattern to match direction tags [EXPRESSION: ...], [AUDIO: ...], [SFX: ...]
 * and vocal tags [laugh], [chuckle], [sigh], [gasp], [whisper], etc.
 */
export const EXPRESSION_TAG_REGEX = /\[(EXPRESSION|AUDIO|SFX|VOICE|laugh|chuckle|chuckles|sigh|gasp|whisper|excited|curious|pause|shout|shouting|screaming|hyped|yell|cheer)(?::\s*([^\]]*))?\]/gi;

/**
 * Parses timestamp string (e.g., "00:06.000", "01:23", "5.0s") into total seconds.
 */
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const cleaned = ts.trim().replace(/s$/i, '');
  const parts = cleaned.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseFloat(cleaned) || 0;
}

/**
 * Parses duration in seconds and range details from any VISUAL_ONLY tag.
 * Supports:
 * - [VISUAL_ONLY (Range: 00:00 - 00:35, Duration: 8s): Deskripsi]
 * - [VISUAL_ONLY: 8.0s | Deskripsi]
 * - [VISUAL_ONLY: Range 00:00-00:35, Output 8s | Deskripsi]
 * - [VISUAL_ONLY]
 */
export function parseVisualOnlyTag(tagStr: string) {
  const body = tagStr.replace(/^\[VISUAL_ONLY\s*/i, '').replace(/\]$/, '').trim();

  let sourceRange = '00:00 - 00:35';
  let sourceStartSeconds = 0;
  let sourceEndSeconds = 35;
  let outputDuration = 8.0;
  let description = 'Adegan Visual Murni Action';

  const rangeMatch = body.match(/Range:\s*([\d:\.]+)\s*-\s*([\d:\.]+)/i) || body.match(/([\d:\.]+)\s*-\s*([\d:\.]+)/);
  if (rangeMatch) {
    const sStr = rangeMatch[1];
    const eStr = rangeMatch[2];
    sourceRange = `${sStr} - ${eStr}`;
    sourceStartSeconds = parseTimestampToSeconds(sStr);
    sourceEndSeconds = parseTimestampToSeconds(eStr);
  }

  const durMatch = body.match(/(?:Output|Duration):\s*([\d\.]+)\s*s?/i) || body.match(/\|\s*([\d\.]+)\s*s/i) || body.match(/^:?\s*([\d\.]+)\s*s\b/i);
  if (durMatch) {
    outputDuration = Math.max(1.0, Math.min(30.0, parseFloat(durMatch[1]) || 8.0));
  } else if (rangeMatch && sourceEndSeconds > sourceStartSeconds) {
    outputDuration = Math.min(10.0, Math.max(3.0, Math.round((sourceEndSeconds - sourceStartSeconds) * 0.25) || 8.0));
  }

  if (body.includes(':')) {
    const parts = body.split(':');
    description = parts[parts.length - 1].trim();
  } else if (body.includes('|')) {
    const parts = body.split('|');
    description = parts[parts.length - 1].trim();
  } else {
    description = body.replace(/Range:[^,)]*/gi, '').replace(/Duration:[^,)]*/gi, '').replace(/Output:[^,)]*/gi, '').trim() || description;
  }

  return {
    sourceRange,
    sourceStartSeconds,
    sourceEndSeconds,
    outputDuration,
    description,
  };
}

export function parseDurationFromTagStr(durStr?: any): number {
  if (!durStr) return 8.0;
  const str = typeof durStr === 'string' ? durStr : String(durStr);
  const parsed = parseVisualOnlyTag(str.startsWith('[') ? str : `[VISUAL_ONLY: ${str}]`);
  return parsed.outputDuration;
}

/**
 * Converts script containing [VISUAL_ONLY: 5.0s | ...] into Gemini TTS SSML break tags.
 * Example: "Hello [VISUAL_ONLY: 5.0s | action] world" -> "Hello <break time="5.0s"/> world"
 */
export function convertToGeminiTtsScript(rawScript: string): string {
  if (!rawScript || typeof rawScript !== 'string') return '';
  let result = rawScript.replace(
    new RegExp(VISUAL_ONLY_TAG_REGEX.source, 'gi'),
    (match) => {
      const sec = parseDurationFromTagStr(match);
      return `<break time="${sec.toFixed(1)}s"/>`;
    }
  );
  // Fallback clean any malformed VISUAL_ONLY tags
  result = result.replace(/\[VISUAL_ONLY[^\]]*\]/gi, '');
  return result.replace(EXPRESSION_TAG_REGEX, '').trim();
}

/**
 * Strips all [VISUAL_ONLY...] tags from the script, leaving clean voiceover narration for ElevenLabs TTS.
 * Preserves expression tags like [pause], [excited], [chuckles], [gasp], [sigh] for ElevenLabs TTS voice modulation.
 */
export function convertToElevenLabsTtsScript(rawScript: string): string {
  if (!rawScript || typeof rawScript !== 'string') return '';
  return rawScript
    .replace(/\[VISUAL_ONLY[^\]]*\]/gi, '') // Remove all VISUAL_ONLY tags completely
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Strips all [VISUAL_ONLY...], [EXPRESSION: ...], [AUDIO: ...] tags from the script, leaving 100% clean plain text narration.
 */
export function stripVisualOnlyTags(rawScript: string): string {
  if (!rawScript || typeof rawScript !== 'string') return '';
  return rawScript
    .replace(/\[VISUAL_ONLY[^\]]*\]/gi, '')
    .replace(EXPRESSION_TAG_REGEX, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Parses script text into structured segments of Narration and VisualOnly.
 */
export function parseScriptSegments(rawScript: string): ParsedScriptResult {
  if (!rawScript || typeof rawScript !== 'string') {
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

    const parsedTag = parseVisualOnlyTag(match[0]);
    const durationSeconds = parsedTag.outputDuration;
    const description = parsedTag.description;

    segments.push({
      type: 'visual_only',
      durationSeconds,
      sourceRange: parsedTag.sourceRange,
      sourceStartSeconds: parsedTag.sourceStartSeconds,
      sourceEndSeconds: parsedTag.sourceEndSeconds,
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
