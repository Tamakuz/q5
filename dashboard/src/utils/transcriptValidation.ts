// dashboard/src/utils/transcriptValidation.ts

export interface TranscriptEntry {
  id: number;
  start_seconds: number;
  end_seconds: number;
  timestamp_minute: string;
  text: string;
  speaker?: string;
}

export type IssueType =
  | 'TAIL_GAP'
  | 'OVERFLOW'
  | 'OVERLAP'
  | 'GAP'
  | 'INVALID_RANGE'
  | 'SPEECH_RATE'
  | 'FORMAT_MISMATCH'
  | 'EMPTY_TEXT';

export interface ValidationIssue {
  id: string;
  type: IssueType;
  severity: 'error' | 'warning';
  itemIndex: number | null; // 1-indexed line index, or null if global issue
  message: string;
  details?: string;
  fixable: boolean;
}

export interface ValidationReport {
  isValid: boolean;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  entryCount: number;
  totalTranscriptDuration: number; // end_seconds of last entry
  audioDuration: number | null;
  tailGapSeconds: number | null; // audioDuration - totalTranscriptDuration
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  summaryText: string;
}

export function formatMinute(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatMinuteRange(startSec: number, endSec: number): string {
  return `${formatMinute(startSec)} - ${formatMinute(endSec)}`;
}

/**
 * Validates array of transcript entries against continuity rules & audio duration metadata
 */
export function validateTranscript(
  entries: TranscriptEntry[] | null | undefined,
  audioDuration: number | null | undefined = null
): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    issues.push({
      id: 'empty-transcript',
      type: 'EMPTY_TEXT',
      severity: 'error',
      itemIndex: null,
      message: 'Belum ada data transkrip audio (JSON array kosong)',
      fixable: false,
    });

    return {
      isValid: false,
      status: 'ERROR',
      entryCount: 0,
      totalTranscriptDuration: 0,
      audioDuration: audioDuration || null,
      tailGapSeconds: null,
      issues,
      errorCount: 1,
      warningCount: 0,
      summaryText: 'Belum ada data transkrip',
    };
  }

  const entryCount = entries.length;
  const lastEntry = entries[entryCount - 1];
  const totalTranscriptDuration = typeof lastEntry.end_seconds === 'number' ? lastEntry.end_seconds : 0;

  // 1. Check individual entries
  entries.forEach((entry, idx) => {
    const itemNum = idx + 1;
    const start = entry.start_seconds;
    const end = entry.end_seconds;
    const duration = end - start;

    // Check invalid start/end range
    if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
      issues.push({
        id: `invalid-type-${itemNum}`,
        type: 'INVALID_RANGE',
        severity: 'error',
        itemIndex: itemNum,
        message: `Baris #${itemNum}: Timestamp start/end bukan angka desimal valid.`,
        fixable: true,
      });
    } else if (start >= end) {
      issues.push({
        id: `invalid-range-${itemNum}`,
        type: 'INVALID_RANGE',
        severity: 'error',
        itemIndex: itemNum,
        message: `Baris #${itemNum}: start_seconds (${start.toFixed(1)}s) tidak boleh >= end_seconds (${end.toFixed(1)}s).`,
        fixable: true,
      });
    }

    // Check empty text
    if (!entry.text || !entry.text.trim()) {
      issues.push({
        id: `empty-text-${itemNum}`,
        type: 'EMPTY_TEXT',
        severity: 'warning',
        itemIndex: itemNum,
        message: `Baris #${itemNum}: Teks ucapan narasi kosong.`,
        fixable: false,
      });
    } else if (duration > 0.5) {
      // Check speech rate (Words per second)
      const wordCount = entry.text.trim().split(/\s+/).length;
      const wps = wordCount / duration;
      if (wps > 8.5) {
        issues.push({
          id: `speech-rate-fast-${itemNum}`,
          type: 'SPEECH_RATE',
          severity: 'warning',
          itemIndex: itemNum,
          message: `Baris #${itemNum}: Kecepatan narasi sangat tinggi (${wps.toFixed(1)} kata/detik). Kemungkinan timestamp terlalu pendek.`,
          details: `Teks (${wordCount} kata) durasi ${duration.toFixed(1)}s`,
          fixable: false,
        });
      } else if (wps < 0.25 && duration > 10.0) {
        issues.push({
          id: `speech-rate-slow-${itemNum}`,
          type: 'SPEECH_RATE',
          severity: 'warning',
          itemIndex: itemNum,
          message: `Baris #${itemNum}: Durasi terlalu panjang (${duration.toFixed(1)}s) untuk ucapan yang sedikit (${wordCount} kata).`,
          details: `Teks (${wordCount} kata) durasi ${duration.toFixed(1)}s`,
          fixable: false,
        });
      }
    }

    // Check timestamp_minute string matching
    if (typeof start === 'number' && typeof end === 'number' && start < end) {
      const expectedTsStr = formatMinuteRange(start, end);
      if (!entry.timestamp_minute || entry.timestamp_minute.trim() !== expectedTsStr) {
        issues.push({
          id: `format-mismatch-${itemNum}`,
          type: 'FORMAT_MISMATCH',
          severity: 'warning',
          itemIndex: itemNum,
          message: `Baris #${itemNum}: Format timestamp_minute "${entry.timestamp_minute || ''}" tidak sinkron dengan detik (${expectedTsStr}).`,
          fixable: true,
        });
      }
    }
  });

  // 2. Check inter-entry continuity (overlaps and gaps)
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const itemNum = i + 1;

    if (
      typeof curr.start_seconds === 'number' &&
      typeof prev.end_seconds === 'number' &&
      !isNaN(curr.start_seconds) &&
      !isNaN(prev.end_seconds)
    ) {
      const overlap = prev.end_seconds - curr.start_seconds;
      if (overlap > 0.1) {
        issues.push({
          id: `overlap-${itemNum}`,
          type: 'OVERLAP',
          severity: 'error',
          itemIndex: itemNum,
          message: `Baris #${itemNum}: Overlap ${overlap.toFixed(1)}s dengan baris #${i} (start: ${curr.start_seconds.toFixed(1)}s < prev end: ${prev.end_seconds.toFixed(1)}s).`,
          fixable: true,
        });
      }

      const gap = curr.start_seconds - prev.end_seconds;
      if (gap > 1.2) {
        issues.push({
          id: `gap-${itemNum}`,
          type: 'GAP',
          severity: 'warning',
          itemIndex: itemNum,
          message: `Baris #${itemNum}: Terdapat jeda audio ${gap.toFixed(1)}s setelah baris #${i}.`,
          fixable: true,
        });
      }
    }
  }

  // 3. Audio duration matching & tail gap check
  let tailGapSeconds: number | null = null;
  if (typeof audioDuration === 'number' && audioDuration > 0) {
    tailGapSeconds = Number((audioDuration - totalTranscriptDuration).toFixed(1));

    if (tailGapSeconds > 0.8) {
      issues.push({
        id: 'tail-gap-missing',
        type: 'TAIL_GAP',
        severity: 'warning',
        itemIndex: entryCount,
        message: `Tail Gap terdeteksi: Transkrip berakhir di ${totalTranscriptDuration.toFixed(1)}s, tetapi audio berdurasi ${audioDuration.toFixed(1)}s (kurang ${tailGapSeconds.toFixed(1)}s).`,
        details: `Item #${entryCount} perlu diperpanjang hingga ${audioDuration.toFixed(1)}s agar rendering video tidak terpotong di akhir.`,
        fixable: true,
      });
    } else if (tailGapSeconds < -1.0) {
      issues.push({
        id: 'tail-gap-overflow',
        type: 'OVERFLOW',
        severity: 'warning',
        itemIndex: entryCount,
        message: `Transkrip melebihi durasi audio sebesar ${Math.abs(tailGapSeconds).toFixed(1)}s (Transkrip: ${totalTranscriptDuration.toFixed(1)}s, Audio: ${audioDuration.toFixed(1)}s).`,
        fixable: true,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  let status: 'SUCCESS' | 'WARNING' | 'ERROR' = 'SUCCESS';
  if (errorCount > 0) {
    status = 'ERROR';
  } else if (warningCount > 0) {
    status = 'WARNING';
  }

  let summaryText = '✅ Transkrip valid & sinkron';
  if (status === 'ERROR') {
    summaryText = `🔴 Terdeteksi ${errorCount} Error & ${warningCount} Warning`;
  } else if (status === 'WARNING') {
    summaryText = `⚠️ Terdeteksi ${warningCount} Peringatan Validasi`;
  }

  return {
    isValid: status === 'SUCCESS',
    status,
    entryCount,
    totalTranscriptDuration,
    audioDuration: audioDuration || null,
    tailGapSeconds,
    issues,
    errorCount,
    warningCount,
    summaryText,
  };
}

/**
 * Automatically repairs transcript timing issues (overlaps, gaps, minute strings, tail gap)
 */
export function autoFixTranscript(
  entries: TranscriptEntry[],
  audioDuration: number | null | undefined = null
): TranscriptEntry[] {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  let fixed: TranscriptEntry[] = entries.map((entry, i) => ({
    ...entry,
    id: i + 1,
    speaker: entry.speaker || '',
  }));

  const lastEntry = fixed[fixed.length - 1];
  const originalMaxEnd = typeof lastEntry.end_seconds === 'number' ? lastEntry.end_seconds : 0;

  // Step 0: Proportional Linear Rescaling if transcript duration overflown/underflown > 1.5s
  if (
    typeof audioDuration === 'number' &&
    audioDuration > 0 &&
    originalMaxEnd > 0 &&
    Math.abs(originalMaxEnd - audioDuration) > 1.5
  ) {
    const scale = audioDuration / originalMaxEnd;
    fixed = fixed.map((entry) => {
      const newStart = Number((entry.start_seconds * scale).toFixed(1));
      const newEnd = Number((entry.end_seconds * scale).toFixed(1));
      return {
        ...entry,
        start_seconds: newStart,
        end_seconds: newEnd,
      };
    });
  }

  // Step 1: Ensure monotonically increasing non-overlapping timing
  let currentStart = 0;
  for (let i = 0; i < fixed.length; i++) {
    fixed[i].id = i + 1;

    let start = typeof fixed[i].start_seconds === 'number' ? fixed[i].start_seconds : currentStart;
    let end = typeof fixed[i].end_seconds === 'number' ? fixed[i].end_seconds : start + 3;

    // Ensure start is at least equal to current cursor (prev end)
    if (i > 0) {
      const prevEnd = fixed[i - 1].end_seconds;
      // If gap is small (< 1.5s) or overlap, snap start to prevEnd
      if (start < prevEnd || Math.abs(start - prevEnd) <= 1.5) {
        start = prevEnd;
      }
    } else {
      // First item starts at 0.0 unless audio delay
      if (start < 0.5) start = 0.0;
    }

    if (end <= start) {
      end = Number((start + 3.0).toFixed(1));
    }

    fixed[i].start_seconds = Number(start.toFixed(1));
    fixed[i].end_seconds = Number(end.toFixed(1));
    fixed[i].timestamp_minute = formatMinuteRange(fixed[i].start_seconds, fixed[i].end_seconds);

    currentStart = fixed[i].end_seconds;
  }

  // Step 2: Fix tail gap if audioDuration is available
  if (typeof audioDuration === 'number' && audioDuration > 0 && fixed.length > 0) {
    const lastIdx = fixed.length - 1;
    const targetEnd = Number(audioDuration.toFixed(1));
    if (fixed[lastIdx].end_seconds !== targetEnd) {
      fixed[lastIdx].end_seconds = targetEnd;
      fixed[lastIdx].timestamp_minute = formatMinuteRange(
        fixed[lastIdx].start_seconds,
        fixed[lastIdx].end_seconds
      );
    }
  }

  return fixed;
}
