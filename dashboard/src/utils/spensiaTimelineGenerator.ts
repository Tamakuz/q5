// dashboard/src/utils/spensiaTimelineGenerator.ts

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

export interface SpensiaTimelineStructure {
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
  part1Audio?: { filePath?: string; url?: string; duration?: number };
  part2Audio?: { filePath?: string; url?: string; duration?: number };
  part1Transcript?: { transcript_full?: string; words?: Array<{ word: string; start: number; end: number }> };
  part2Transcript?: { transcript_full?: string; words?: Array<{ word: string; start: number; end: number }> };
}

/**
 * Clean punctuation from word for matching
 */
const cleanWordForMatch = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/[.,:;!?\-"“”'’`()[\]{}]/g, '').trim();
};

/**
 * Core Algorithm to Generate Spensia Timeline Data (JSON Source of Truth)
 */
export function generateSpensiaTimeline(params: GenerateTimelineParams): SpensiaTimelineStructure {
  const fps = params.fps || 30;
  const width = params.resolutionWidth || 1920;
  const height = params.resolutionHeight || 1080;

  const p1Dur = params.part1Audio?.duration || 60;
  const p2Dur = params.part2Audio?.duration || 60;
  const totalDurationSec = p1Dur + p2Dur;

  // 1. Audio Tracks Assembly
  const audioTracks: TimelineAudioTrack[] = [
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

  // 2. Divide Segments into Part 1 vs Part 2
  const totalSegments = params.segments.length;
  const midIndex = Math.ceil(totalSegments / 2);

  const part1Segments = params.segments.slice(0, midIndex);
  const part2Segments = params.segments.slice(midIndex);

  // Helper to build video clips for a specific part using sequential transcript matching
  const buildClipsForPart = (
    segList: typeof params.segments,
    partId: number,
    partStartOffsetSec: number,
    partDurationSec: number,
    transcriptWords?: Array<{ word: string; start: number; end: number }>
  ): TimelineVideoClip[] => {
    if (segList.length === 0) return [];

    const clips: TimelineVideoClip[] = [];
    const totalChars = segList.reduce((acc, s) => acc + (s.text ? s.text.length : 10), 0);

    let currentOffsetSec = partStartOffsetSec;
    let wordSearchIdx = 0;

    segList.forEach((seg, idx) => {
      const segImg = params.images.find((img) => img.segment_id === seg.segment_id);
      let segStartSec = -1;
      let segEndSec = -1;

      // Mode A: Sequential Transcript word-level timestamp matching
      if (transcriptWords && transcriptWords.length > 0 && wordSearchIdx < transcriptWords.length) {
        const rawWords = (seg.text || '').split(/\s+/).map(cleanWordForMatch).filter(Boolean);
        if (rawWords.length > 0) {
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

      // Ensure last clip in part fills remaining part duration exactly
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
        quote: seg.text,
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

  const p1Clips = buildClipsForPart(part1Segments, 1, 0, p1Dur, params.part1Transcript?.words);
  const p2Clips = buildClipsForPart(part2Segments, 2, p1Dur, p2Dur, params.part2Transcript?.words);

  const videoClips = [...p1Clips, ...p2Clips];

  // 3. Captions List
  const captions: TimelineCaptionItem[] = [];
  const parseNum = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, ''));
    return NaN;
  };

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

  return {
    title: 'Spensia_Timeline_Data',
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
