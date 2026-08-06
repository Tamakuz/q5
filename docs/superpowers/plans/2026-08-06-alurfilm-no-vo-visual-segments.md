# Alur Film No-VO Visual Segments & Audio Silence Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a testing playground (`AlurfilmVisualOnlyTestStep`) in `AlurfilmTestingHub` that enables AI scriptwriters to insert `[VISUAL_ONLY: X.Xs]` pause tags into scripts, synthesizes TTS audio with inserted FFmpeg silence gaps, and previews pure `video_cut` action clips without narration.

**Architecture:** 
1. Prompt update (`alurfilm-singlepass-prompt.md` & `alurfilm-mapping-prompt.md`) to guide AI scriptwriter on inserting `[VISUAL_ONLY]` tags (4.0s - 8.0s) and enforcing 100% `video_cut` visual mapping rules.
2. Electron IPC handler (`generate-alurfilm-test-tts-with-silence` in `alurfilmHandlers.cjs`) to parse script tags, generate audio TTS for text segments, generate silent PCM/WAV buffers for visual-only tags, and concatenate them into a single audio track.
3. React test studio component (`AlurfilmVisualOnlyTestStep.tsx`) integrated as a new sub-tab inside `AlurfilmTestingHub.tsx`.

**Tech Stack:** React, TypeScript, TailwindCSS, Electron IPC, FFmpeg, Node.js `fs`/`child_process`.

## Global Constraints

- Isolated testing first inside `AlurfilmTestingHub.tsx`; do not alter main production workflow pages.
- Preserved existing prompt structures; append `[VISUAL_ONLY]` rules clearly.
- Visual-only segments MUST use 100% `video_cut` (no slow motion, freeze frame, mirror, or pan-zoom).

---

### Task 1: Update Prompts for Script & Visual Mapping

**Files:**
- Modify: `dashboard/prompts/longform/alurfilm-singlepass-prompt.md`
- Modify: `dashboard/prompts/longform/alurfilm-mapping-prompt.md`

**Interfaces:**
- Consumes: Script & mapping prompt structures
- Produces: Updated markdown prompts supporting `[VISUAL_ONLY]` tags and `video_cut` mapping rules

- [ ] **Step 1: Add [VISUAL_ONLY] rules to singlepass prompt**
Add rules to `alurfilm-singlepass-prompt.md` instructing the AI scriptwriter to identify 2-4 climax/action scenes per part and insert `[VISUAL_ONLY: X.Xs | Adegan...]` tags with 4.0s - 8.0s durations.

- [ ] **Step 2: Add strict video_cut rule to mapping prompt**
Add rules to `alurfilm-mapping-prompt.md` specifying that any segment tagged `[VISUAL_ONLY]` or mapping a silence gap MUST use 100% `video_cut` type visual clips.

- [ ] **Step 3: Commit prompt updates**
```bash
git add dashboard/prompts/longform/alurfilm-singlepass-prompt.md dashboard/prompts/longform/alurfilm-mapping-prompt.md
git commit -m "feat(alurfilm): update prompts with visual-only tags and video-cut rules"
```

---

### Task 2: Implement Electron IPC Handler for TTS Silence Gap Generation

**Files:**
- Modify: `dashboard/electron/ipc/alurfilmHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/src/electron-api.ts`

**Interfaces:**
- Consumes: `scriptText` containing text and `[VISUAL_ONLY: X.Xs | ...]` tags
- Produces: IPC handler `generate-alurfilm-test-tts-with-silence` returning generated audio file path, duration, and parsed timeline segments

- [ ] **Step 1: Write helper function to parse [VISUAL_ONLY] script tags**
Add `parseScriptVisualTags(scriptText)` in `alurfilmHandlers.cjs` to split text into an array of narration chunks and silence gap objects `{ type: 'narration' | 'visual_only', text?, durationSec?, description? }`.

- [ ] **Step 2: Implement IPC handler `generate-alurfilm-test-tts-with-silence`**
In `alurfilmHandlers.cjs`, implement the handler that:
1. Parses the script text into segments.
2. For `narration` segments, calls TTS (or creates clean dummy speech WAV audio for offline testing).
3. For `visual_only` segments, generates a silent WAV audio file of length `durationSec` using FFmpeg (`anullsrc`).
4. Concatenates all audio segments using FFmpeg `concat` protocol into a single clean WAV audio file.
5. Returns `{ audioPath, totalDurationSec, segments }`.

- [ ] **Step 3: Expose IPC in preload.cjs & electron-api.ts**
Add `generateAlurfilmTestTtsWithSilence` to `preload.cjs` and `electron-api.ts`.

- [ ] **Step 4: Commit IPC handler changes**
```bash
git add dashboard/electron/ipc/alurfilmHandlers.cjs dashboard/electron/preload.cjs dashboard/src/electron-api.ts
git commit -m "feat(alurfilm): add IPC handler for TTS silence gap generation"
```

---

### Task 3: Build `AlurfilmVisualOnlyTestStep` UI & Integrate into `AlurfilmTestingHub`

**Files:**
- Create: `dashboard/src/components/longform/testing/AlurfilmVisualOnlyTestStep.tsx`
- Modify: `dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx`

**Interfaces:**
- Consumes: `window.electronAPI.generateAlurfilmTestTtsWithSilence`
- Produces: Interactive React testing studio for No-VO visual segments and audio preview

- [ ] **Step 1: Create `AlurfilmVisualOnlyTestStep.tsx` component**
Build the UI featuring:
- Static script editor pre-loaded with a sample recap script containing `[VISUAL_ONLY: 5.0s | Adegan pertarungan sengit...]`.
- Button to trigger TTS Silence Gap Generation.
- Audio Player & Timeline Visualizer displaying Narration segments (blue) vs. Visual-Only segments (amber/gold).
- Fallback Visual Preview showing active text/visual card during audio playback.

- [ ] **Step 2: Update `AlurfilmTestingHub.tsx` sub-tabs**
Modify `AlurfilmTestingHub.tsx` to replace `feature_slot_2` placeholder with sub-tab `visual_only` rendering `<AlurfilmVisualOnlyTestStep />`.

- [ ] **Step 3: Commit UI components**
```bash
git add dashboard/src/components/longform/testing/AlurfilmVisualOnlyTestStep.tsx dashboard/src/components/longform/testing/AlurfilmTestingHub.tsx
git commit -m "feat(alurfilm): build AlurfilmVisualOnlyTestStep studio UI in testing hub"
```

---

### Task 4: End-to-End Verification & Testing

**Files:**
- None (Verification step)

- [ ] **Step 1: Test script parsing and silence audio concatenation**
Execute test script or run in app to generate audio with silence gaps. Confirm FFmpeg generates accurate audio file and pauses naturally at visual-only positions.

- [ ] **Step 2: Verify UI sub-tab in AlurfilmTestingHub**
Check dashboard UI under Alur Film -> Testing Hub -> Visual Only Studio. Ensure interactive play, timeline highlights, and TTS gap generation function smoothly.

- [ ] **Step 3: Final Commit & Clean Up**
```bash
git commit --allow-empty -m "chore(alurfilm): complete no-vo visual segments testing studio implementation"
```
