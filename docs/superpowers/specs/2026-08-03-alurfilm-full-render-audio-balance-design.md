# Alur Film Full Movie Render & Audio Volume Balancing - Design Specification

## Overview
This feature adds a full-movie render button ("🎬 Render Full Movie Recap") in **Step 6: Video Render (`AlurfilmRenderStep.tsx`)** that concatenates all video parts into one complete master movie recap video. It automatically injects the default Thomas Newman mystery BGM asset and balances audio levels so that the voiceover narration is boosted and clearly audible on phone speakers while the BGM provides an ideal background bed.

---

## 1. Full Movie Render Feature (`AlurfilmRenderStep.tsx`)
- **Part Preview vs Full Render**:
  - Per-part render button (`Start Preview Render Part #X`) remains for single-part chunk testing.
  - New prominent section: **"🎬 Full Movie Recap (All Parts)"** at the top of the render workspace.
- **Workflow**:
  - Detects all available split parts for current `contentId`.
  - Displays readiness status for all parts.
  - Automatically injects default BGM:
    `assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3`
  - Calls `api.concatAlurfilmFinalVideo(parts, { bgmPath, bgmVolume: 0.18 })`.
  - Displays real-time progress, completion toast, and renders a Full Movie Master Player with video playback and download/open file options.

---

## 2. Audio Level & Volume Balancing (`renderHandlers.cjs` & `render-alurfilm.ts`)
- **Voiceover Narration**:
  - Boost voiceover audio filter to **`volume=1.8`** (1.8x boost) in FFmpeg complex filters (`[vo]volume=1.8`).
  - Ensures crisp, loud narration on mobile/phone speakers without distorting.
- **Background Music (BGM)**:
  - Set default BGM volume factor to **`0.18`** (`volume=0.18`) when paired with 1.8x voiceover boost.
  - Ensures BGM fills background ambience without masking the voiceover narration.
- **Default BGM Resolution**:
  - If no custom BGM path is provided, automatically resolve to:
    `assets/bgm/05_santai_misteri/Piano music in style of Thomas Newman - sad mood - Royalty free music no copyright music.mp3`

---

## 3. Implementation Files
- **`dashboard/src/components/longform/AlurfilmRenderStep.tsx`**: Add Full Movie Render controls, BGM selector, progress monitor, and master video player.
- **`dashboard/electron/ipc/renderHandlers.cjs`**: Update `concat-alurfilm-final-video` and `render-alurfilm-video` to boost voiceover volume to `1.8` and set default BGM volume to `0.18` with default Thomas Newman BGM fallback.
- **`render-alurfilm.ts`**: Update audio filter pipeline to use `volume=1.8` for voiceover.

---

## 4. Verification Plan
1. Compile TypeScript with `npx tsc --noEmit`.
2. Verify BGM file exists on disk.
3. Test per-part render preview and Full Movie Recap render.
4. Verify output file `WV-FILM-[ID]-FULL-FINAL.mp4` is created and audio balance (VO 1.8x, BGM 0.18x) is crisp and audible.
