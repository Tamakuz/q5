# Single High-Impact Shorts Per Longform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the Shorts production pipeline from generating multiple segments per longform video to generating **1 single, high-impact Shorts video per longform video** with dynamic storytelling hooks, flexi-duration, and 4:5 foreground over 9:16 blurred background.

**Architecture:** Update the Gemini prompt and IPC handlers to generate a single standalone Shorts script object (`main_shorts`). Adapt Steps 2–5 in the React dashboard UI to streamline the user flow around 1 unified Shorts workspace instead of multi-segment tabs, while preserving full bilingual support (ID & EN).

**Tech Stack:** TypeScript, React, TailwindCSS, Electron IPC, Node.js, FFmpeg CLI.

## Global Constraints
- Preserve bilingual script support (`id` & `en`).
- Preserve fast seek `-ss`, `nice -n 15` priority, and 4:5 foreground layer over 9:16 blurred background layer.
- Do not make git commits.

---

### Task 1: Update Gemini Script Generation Prompt & Schema (Step 2 Engine)

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsAnalyzeStep.tsx:50-130`

**Interfaces:**
- Consumes: Longform video title & URL from Step 1.
- Produces: Single Shorts script JSON structure (`segments: [ { id: "main_shorts", ... } ]`).

- [ ] **Step 1: Update Prompt Template for Single Shorts Generation**
  Update `DEFAULT_PROMPT_TEMPLATE` in `ShortsAnalyzeStep.tsx` so the prompt instructs Gemini AI to generate **1 single high-impact Shorts script** per longform video (with dynamic storytelling Hook like *"Ini dia cara unik orang Pakistan..."* and flexible duration 25s–55s).

- [ ] **Step 2: Verify JSON Output Parsing**
  Ensure parsing in `ShortsAnalyzeStep.tsx` correctly handles single segment response (`main_shorts`).

---

### Task 2: Streamline Step 3 (Audio VO) for Single Shorts

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsAudioStep.tsx`

**Interfaces:**
- Consumes: Single `main_shorts` script from Step 2.
- Produces: Audio file `seg_main_shorts_vo_id.mp3` & `seg_main_shorts_vo_en.mp3` and Whisper alignment JSON.

- [ ] **Step 1: Simplify Audio Workspace for Single Shorts**
  Update `ShortsAudioStep.tsx` so it defaults directly to `main_shorts` segment without needing segment tab switching.

---

### Task 3: Streamline Step 4 (Video Mapping) for Single Shorts

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsMappingStep.tsx`

**Interfaces:**
- Consumes: Audio alignment and video source.
- Produces: 8–15 highlight cuts spanning the longform video stored under `main_shorts`.

- [ ] **Step 1: Adapt Video Mapping Prompt & UI**
  Update `ShortsMappingStep.tsx` to generate 8–15 highlight cuts for `main_shorts` from across the entire longform video duration.

---

### Task 4: Streamline Step 5 (Render Studio UI & FFmpeg Integration)

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsRenderStep.tsx`
- Modify: `dashboard/electron/ipc/projectHandlers.cjs`

**Interfaces:**
- Consumes: `main_shorts` mapping & audio.
- Produces: `output/shorts/seg_main_shorts_id_final.mp4`.

- [ ] **Step 1: Update Render Studio UI**
  Update `ShortsRenderStep.tsx` to focus on 1 single main Shorts render workspace with a prominent **"🎬 Render Shorts Video (9:16)"** button.

- [ ] **Step 2: Verify IPC Handler Fallback in projectHandlers.cjs**
  Ensure `shorts:render-segment` defaults `segmentId` to `main_shorts` or the first segment item if not explicitly specified.

---

### Task 5: End-to-End Verification

- [ ] **Step 1: Run TypeScript Type Check**
  Run `npx tsc --noEmit` and confirm 0 compilation errors.

- [ ] **Step 2: Run Node Syntax Check**
  Run `node -c dashboard/electron/ipc/projectHandlers.cjs` and confirm clean syntax.

- [ ] **Step 3: Test Dashboard UI Load**
  Confirm all steps load cleanly in Electron dashboard.
