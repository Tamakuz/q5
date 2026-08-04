// dashboard/src/utils/wakuTimelineGenerator.ts

export interface TimelineAudioTrack {
  track: string;
  part_id: number;
  filePath?: string;
  url?: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
}

export interface TimelineVideoClip {
  clip_id: number;
  segment_id: number;
  part_id: number;
  quote: string;
  image_path?: string;
  image_url?: string;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  start_frame: number;
  end_frame: number;
  duration_frames: number;
  transition: string;
}

export interface TimelineCaptionItem {
  part_id: number;
  word: string;
  start_sec: number;
  end_sec: number;
}

export interface WakuTimelineStructure {
  title: string;
  fps: number;
  resolution: {
    width: number;
    height: number;
    aspect_ratio: string;
  };
  total_duration_sec: number;
  total_frames: number;
  audio_tracks: TimelineAudioTrack[];
  video_clips: TimelineVideoClip[];
  captions: TimelineCaptionItem[];
  generated_at: string;
}

export interface GenerateTimelineParams {
  fps?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  segments: Array<{ segment_id: number; text: string; image_prompt?: string }>;
  images: Array<{ segment_id: number; filePath?: string; url?: string }>;
  mergedAudio?: { filePath?: string; url?: string; duration?: number };
  mergedTranscript?: {
    transcript_full?: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ segment_id: number; quote?: string; start_sec: number; end_sec: number; duration_sec?: number }>;
  };
  part1Audio?: { filePath?: string; url?: string; duration?: number };
  part2Audio?: { filePath?: string; url?: string; duration?: number };
  part1Transcript?: {
    transcript_full?: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ segment_id: number; quote?: string; start_sec: number; end_sec: number; duration_sec?: number }>;
  };
  part2Transcript?: {
    transcript_full?: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ segment_id: number; quote?: string; start_sec: number; end_sec: number; duration_sec?: number }>;
  };
}

/**
 * Clean punctuation from word for matching
 */
const cleanWordForMatch = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
};

/**
 * Core Algorithm to Generate Waku Timeline Data (JSON Source of Truth)
 */
export function generateWakuTimeline(params: GenerateTimelineParams): WakuTimelineStructure {
  const fps = params.fps || 30;
  const width = params.resolutionWidth || 1920;
  const height = params.resolutionHeight || 1080;

  const hasMerged = Boolean(params.mergedAudio?.filePath || params.mergedTranscript?.words?.length);

  const p1Dur = params.part1Audio?.duration || 60;
  const p2Dur = params.part2Audio?.duration || 60;
  const totalDurationSec = hasMerged && params.mergedAudio?.duration
    ? params.mergedAudio.duration
    : p1Dur + p2Dur;

  // 1. Audio Tracks Assembly
  const audioTracks: TimelineAudioTrack[] = hasMerged && params.mergedAudio?.filePath
    ? [
        {
          track: 'A1',
          part_id: 1,
          filePath: params.mergedAudio.filePath,
          url: params.mergedAudio.url,
          start_sec: 0,
          end_sec: totalDurationSec,
          duration_sec: totalDurationSec,
        },
      ]
    : [
        {
          track: 'A1',
          part_id: 1,
          filePath: params.part1Audio?.filePath,
          url: params.part1Audio?.url,
          start_sec: 0,
          end_sec: p1Dur,
          duration_sec: p1Dur,
        },
        {
          track: 'A2',
          part_id: 2,
          filePath: params.part2Audio?.filePath,
          url: params.part2Audio?.url,
          start_sec: p1Dur,
          end_sec: totalDurationSec,
          duration_sec: p2Dur,
        },
      ];

  // Helper to build video clips for a specific segment set using sequential transcript matching
  const buildClipsForPart = (
    segList: typeof params.segments,
    partId: number,
    partStartOffsetSec: number,
    partDurationSec: number,
    transcriptWords?: Array<{ word: string; start: number; end: number }>
  ): TimelineVideoClip[] => {
    if (segList.length === 0) return [];

    const rawTx = params.mergedTranscript || params.part1Transcript || params.part2Transcript;
    let mappedSegs = rawTx?.segments;

    const txAny = rawTx as any;
    if ((!mappedSegs || mappedSegs.length === 0) && txAny?.sentences && txAny.sentences.length > 0) {
      mappedSegs = txAny.sentences.map((s: any, idx: number) => ({
        segment_id: s.sentence_id || idx + 1,
        quote: s.text,
        start_sec: typeof s.start === 'number' ? s.start : parseFloat(s.start || 0),
        end_sec: typeof s.end === 'number' ? s.end : parseFloat(s.end || 0),
        duration_sec: Math.max(0.1, (s.end || 0) - (s.start || 0)),
      }));
    }

    // Direct 1:1 Copy-Paste from Transcript Segments Output
    if (Array.isArray(mappedSegs) && mappedSegs.length > 0) {
      const fps = params.fps || 30;

      return mappedSegs.map((txSeg: any, idx: number) => {
        const segId = Number(txSeg.segment_id || txSeg.id || idx + 1);
        const parseN = (v: any) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^0-9.]/g, '')));

        let sSec = parseN(txSeg.start_sec !== undefined ? txSeg.start_sec : txSeg.start);
        let eSec = parseN(txSeg.end_sec !== undefined ? txSeg.end_sec : txSeg.end);

        if (isNaN(sSec) || sSec < 0) sSec = idx * 4.0;
        if (isNaN(eSec) || eSec <= sSec) {
          if (idx < mappedSegs.length - 1) {
            const nextVal = parseN((mappedSegs[idx + 1] as any).start_sec !== undefined ? (mappedSegs[idx + 1] as any).start_sec : (mappedSegs[idx + 1] as any).start);
            eSec = !isNaN(nextVal) && nextVal > sSec ? nextVal : sSec + 4.0;
          } else {
            eSec = partDurationSec;
          }
        }

        const startSec = Number((partStartOffsetSec + sSec).toFixed(2));
        const endSec = Number((partStartOffsetSec + eSec).toFixed(2));
        const segDurationSec = Number((endSec - startSec).toFixed(2));

        const segImg = params.images.find((img) => Number(img.segment_id) === segId);
        const breakdownMatch = segList ? segList.find((b: any) => Number(b.segment_id || b.id) === segId) : null;
        const quoteText = txSeg.quote || txSeg.text || (breakdownMatch as any)?.quote || (breakdownMatch as any)?.text || `Segmen #${segId}`;

        const sFrame = Math.round(startSec * fps);
        const eFrame = Math.round(endSec * fps);

        return {
          clip_id: idx + 1,
          segment_id: segId,
          part_id: partId,
          quote: quoteText,
          image_path: segImg?.filePath || '',
          image_url: segImg?.url || '',
          start_sec: startSec,
          end_sec: endSec,
          duration_sec: segDurationSec,
          start_frame: sFrame,
          end_frame: eFrame,
          duration_frames: Math.max(1, eFrame - sFrame),
          transition: 'crossfade'
        };
      });
    }

    const clips: TimelineVideoClip[] = [];
    const totalChars = segList.reduce((acc, s) => acc + (s.text ? s.text.length : 10), 0);
    let currentOffsetSec = partStartOffsetSec;
    let wordSearchIdx = 0;

    segList.forEach((seg, idx) => {
      const segImg = params.images.find((img) => img.segment_id === seg.segment_id);
      let segStartSec = -1;
      let segEndSec = -1;
      const rawWords = (seg.text || (seg as any).quote || '').split(/\s+/).map(cleanWordForMatch).filter(Boolean);
      if (transcriptWords && transcriptWords.length > 0 && wordSearchIdx < transcriptWords.length && rawWords.length > 0) {
        const firstWord = rawWords[0];
        const lastWord = rawWords[rawWords.length - 1];

        // Find first word occurrence after wordSearchIdx
        let matchStartIdx = -1;
        for (let i = wordSearchIdx; i < transcriptWords.length; i++) {
          const tw = cleanWordForMatch(transcriptWords[i].word);
          if (tw && (tw.includes(firstWord) || firstWord.includes(tw))) {
            matchStartIdx = i;
            break;
          }
        }

        // Find last word occurrence after matchStartIdx
        let matchEndIdx = -1;
        const searchFrom = matchStartIdx >= 0 ? matchStartIdx : wordSearchIdx;
        for (let i = Math.min(transcriptWords.length - 1, searchFrom + rawWords.length + 5); i >= searchFrom; i--) {
          const tw = cleanWordForMatch(transcriptWords[i].word);
          if (tw && (tw.includes(lastWord) || lastWord.includes(tw))) {
            matchEndIdx = i;
            break;
          }
        }

        if (matchStartIdx >= 0) {
          const parseN = (v: any) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.]/g, '')));
          const startVal = parseN(transcriptWords[matchStartIdx].start);
          const endVal = matchEndIdx >= 0 ? parseN(transcriptWords[matchEndIdx].end) : parseN(transcriptWords[matchStartIdx].end) + 2.0;

          if (!isNaN(startVal) && !isNaN(endVal) && endVal > startVal) {
            segStartSec = partStartOffsetSec + startVal;
            segEndSec = partStartOffsetSec + endVal;
            wordSearchIdx = (matchEndIdx >= 0 ? matchEndIdx : matchStartIdx) + 1;
          }
        }
      }

      let segDurationSec = 0;
      if (segStartSec >= 0 && segEndSec > segStartSec) {
        segDurationSec = segEndSec - segStartSec;
        currentOffsetSec = segStartSec;
      } else {
        // Mode B: Proportional duration by character length fallback
        const textLen = seg.text ? seg.text.length : 10;
        const ratio = textLen / Math.max(1, totalChars);
        segDurationSec = ratio * partDurationSec;
      }

      // Ensure last clip fills remaining duration exactly
      if (idx === segList.length - 1) {
        segDurationSec = Math.max(1.0, partStartOffsetSec + partDurationSec - currentOffsetSec);
      } else {
        segDurationSec = Math.max(1.0, segDurationSec);
      }

      const startSec = currentOffsetSec;
      const endSec = startSec + segDurationSec;
      currentOffsetSec = endSec;

      const startFrame = Math.round(startSec * fps);
      const endFrame = Math.round(endSec * fps);

      clips.push({
        clip_id: seg.segment_id,
        segment_id: seg.segment_id,
        part_id: partId,
        quote: seg.text || (seg as any).quote || '',
        image_path: segImg?.filePath,
        image_url: segImg?.url,
        start_sec: Number(startSec.toFixed(2)),
        end_sec: Number(endSec.toFixed(2)),
        duration_sec: Number(segDurationSec.toFixed(2)),
        start_frame: startFrame,
        end_frame: endFrame,
        duration_frames: endFrame - startFrame,
        transition: 'crossfade',
      });
    });

    return clips;
  };

  let videoClips: TimelineVideoClip[] = [];

  if (hasMerged && (params.mergedTranscript?.words?.length || params.mergedTranscript?.segments?.length)) {
    videoClips = buildClipsForPart(params.segments, 1, 0, totalDurationSec, params.mergedTranscript.words);
  } else {
    const totalSegments = params.segments.length;
    const midIndex = Math.ceil(totalSegments / 2);
    const part1Segments = params.segments.slice(0, midIndex);
    const part2Segments = params.segments.slice(midIndex);

    const p1Clips = buildClipsForPart(part1Segments, 1, 0, p1Dur, params.part1Transcript?.words);
    const p2Clips = buildClipsForPart(part2Segments, 2, p1Dur, p2Dur, params.part2Transcript?.words);
    videoClips = [...p1Clips, ...p2Clips];
  }

  // 3. Captions List
  const captions: TimelineCaptionItem[] = [];
  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, ''));
    return NaN;
  };

  const activeWords = hasMerged && params.mergedTranscript?.words?.length
    ? params.mergedTranscript.words
    : null;

  if (activeWords) {
    activeWords.forEach((w) => {
      const s = parseNum(w.start);
      const e = parseNum(w.end);
      if (!isNaN(s)) {
        captions.push({
          part_id: 1,
          word: w.word,
          start_sec: Number(s.toFixed(2)),
          end_sec: Number((!isNaN(e) && e > s ? e : s + 0.3).toFixed(2)),
        });
      }
    });
  } else {
    if (params.part1Transcript?.words) {
      params.part1Transcript.words.forEach((w) => {
        const s = parseNum(w.start);
        const e = parseNum(w.end);
        if (!isNaN(s)) {
          captions.push({
            part_id: 1,
            word: w.word,
            start_sec: Number(s.toFixed(2)),
            end_sec: Number((!isNaN(e) && e > s ? e : s + 0.3).toFixed(2)),
          });
        }
      });
    }

    if (params.part2Transcript?.words) {
      params.part2Transcript.words.forEach((w) => {
        const s = parseNum(w.start);
        const e = parseNum(w.end);
        if (!isNaN(s)) {
          captions.push({
            part_id: 2,
            word: w.word,
            start_sec: Number((p1Dur + s).toFixed(2)),
            end_sec: Number((p1Dur + (!isNaN(e) && e > s ? e : s + 0.3)).toFixed(2)),
          });
        }
      });
    }
  }

  return {
    title: 'Vann Longform Video',
    fps,
    resolution: {
      width,
      height,
      aspect_ratio: '16:9',
    },
    total_duration_sec: Number(totalDurationSec.toFixed(2)),
    total_frames: Math.round(totalDurationSec * fps),
    audio_tracks: audioTracks,
    video_clips: videoClips,
    captions,
    generated_at: new Date().toISOString(),
  };
}

export const generateVannTimeline = generateWakuTimeline;
export type GenerateVannTimelineParams = GenerateTimelineParams;
export type VannTimelineParams = GenerateTimelineParams;
export type WakuTimelineParams = GenerateTimelineParams;
