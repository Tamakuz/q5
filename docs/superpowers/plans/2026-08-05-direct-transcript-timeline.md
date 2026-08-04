# Direct 1:1 Transcript to Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify timeline building in both backend Electron IPC (`vannHandlers.cjs`) and frontend utility (`vannTimelineGenerator.ts`) to directly copy `transcript.segments` 1:1 into `timeline.video_clips` and pair each segment with its image from Step 5.

**Architecture:** Remove all word-matching and fallback ratio calculations. When `generateWakuTimeline` is called, read `merged_transcript_topic_X.json`'s `segments` array, map every segment's `start_sec`, `end_sec`, `duration_sec`, and `quote` directly into clip items, resolve `image_path` for each `segment_id`, and write `timeline.json`.

**Tech Stack:** JavaScript (Node.js CommonJS), TypeScript, Electron IPC.

## Global Constraints
- Do not modify `merged_transcript_topic_X.json` schema or file locations.
- Preserve image path resolution (`input/vann/images/topic_X/segment_N.png`).
- Ensure 100% type safety and clean TypeScript build (`npx tsc --noEmit`).

---

### Task 1: Simplify Backend IPC Handler `generate-waku-timeline` in `vannHandlers.cjs`

**Files:**
- Modify: `dashboard/electron/ipc/vannHandlers.cjs:1220-1340`

**Interfaces:**
- Consumes: `merged_transcript_topic_X.json` segments array
- Produces: `timeline_topic_X.json` containing `video_clips` copied 1:1 from transcript segments

- [ ] **Step 1: Replace `buildClips` in `vannHandlers.cjs` with direct 1:1 copy-paste mapping**

Replace the legacy word-matching algorithm in `vannHandlers.cjs` with a simple mapping over `mergedTranscript.segments` (or fallback `segments` if transcript segments array exists):

```javascript
      const buildClipsFromTranscriptSegments = (transcriptSegs, partId, partStartOffset, partDuration) => {
        const parseN = (v) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^0-9.]/g, '')));

        transcriptSegs.forEach((seg, idx) => {
          const segId = Number(seg.segment_id || seg.id || idx + 1);
          let sVal = parseN(seg.start_sec !== undefined ? seg.start_sec : seg.start);
          let eVal = parseN(seg.end_sec !== undefined ? seg.end_sec : seg.end);

          if (isNaN(sVal) || sVal < 0) sVal = idx * 4.0;
          if (isNaN(eVal) || eVal <= sVal) {
            if (idx < transcriptSegs.length - 1) {
              const nStart = parseN(transcriptSegs[idx + 1].start_sec !== undefined ? transcriptSegs[idx + 1].start_sec : transcriptSegs[idx + 1].start);
              eVal = !isNaN(nStart) && nStart > sVal ? nStart : sVal + 4.0;
            } else {
              eVal = partDuration;
            }
          }

          const startSec = Number((partStartOffset + sVal).toFixed(2));
          const endSec = Number((partStartOffset + eVal).toFixed(2));
          const segDurationSec = Number((endSec - startSec).toFixed(2));

          const img = images.find((i) => Number(i.segment_id) === segId);

          videoClips.push({
            clip_id: clipId++,
            segment_id: segId,
            part_id: partId,
            quote: seg.quote || seg.text || `Segmen #${segId}`,
            image_path: img?.filePath || '',
            image_url: img?.url || '',
            start_sec: startSec,
            end_sec: endSec,
            duration_sec: segDurationSec,
            start_frame: Math.round(startSec * fps),
            end_frame: Math.round(endSec * fps),
            transition: 'crossfade'
          });
        });
      };
```

---

### Task 2: Simplify Frontend Utility `generateWakuTimeline` in `vannTimelineGenerator.ts`

**Files:**
- Modify: `dashboard/src/utils/vannTimelineGenerator.ts:137-287`

**Interfaces:**
- Consumes: `params.mergedTranscript.segments`
- Produces: `TimelineVideoClip[]` directly mapped 1:1 from transcript segments

- [ ] **Step 1: Simplify `buildClipsForPart` in `vannTimelineGenerator.ts`**

Replace complex word search / character ratio logic with direct 1:1 copy-paste mapping of `mappedSegs`:

```typescript
  const buildClipsForPart = (
    segList: typeof params.segments,
    partId: number,
    partStartOffsetSec: number,
    partDurationSec: number
  ): TimelineVideoClip[] => {
    const mappedSegs = params.mergedTranscript?.segments || params.part1Transcript?.segments || params.part2Transcript?.segments || segList;
    if (!mappedSegs || mappedSegs.length === 0) return [];

    const fps = params.fps || 30;
    const parseN = (v: any) => (typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^0-9.]/g, '')));

    return mappedSegs.map((seg: any, idx: number) => {
      const segId = Number(seg.segment_id || seg.id || idx + 1);
      let sSec = parseN(seg.start_sec !== undefined ? seg.start_sec : seg.start);
      let eSec = parseN(seg.end_sec !== undefined ? seg.end_sec : seg.end);

      if (isNaN(sSec) || sSec < 0) sSec = idx * 4.0;
      if (isNaN(eSec) || eSec <= sSec) {
        if (idx < mappedSegs.length - 1) {
          const nStart = parseN((mappedSegs[idx + 1] as any).start_sec !== undefined ? (mappedSegs[idx + 1] as any).start_sec : (mappedSegs[idx + 1] as any).start);
          eSec = !isNaN(nStart) && nStart > sSec ? nStart : sSec + 4.0;
        } else {
          eSec = partDurationSec;
        }
      }

      const startSec = Number((partStartOffsetSec + sSec).toFixed(2));
      const endSec = Number((partStartOffsetSec + eSec).toFixed(2));
      const segDurationSec = Number((endSec - startSec).toFixed(2));
      const segImg = params.images.find((img) => Number(img.segment_id) === segId);

      const sFrame = Math.round(startSec * fps);
      const eFrame = Math.round(endSec * fps);

      return {
        clip_id: idx + 1,
        segment_id: segId,
        part_id: partId,
        quote: seg.quote || seg.text || `Segmen #${segId}`,
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
  };
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit` in `dashboard/`
Expected: PASS with 0 errors.

---

### Task 3: Integration Verification

- [ ] **Step 1: Test dev server compilation**

Run: `npm run dev -w dashboard`
Expected: Launches with 0 errors.
