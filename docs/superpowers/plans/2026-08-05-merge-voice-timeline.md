# Merge Voice & Timeline Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine Step 6 (Voice Over Generator) and Step 7 (Timeline & Mapping Studio) into a single unified step "Voice & Timeline Studio" (Step 6) in Vann/Spensia workflows, reducing total steps from 9 to 8.

**Architecture:** Integrate the automatic timeline mapping generator and visual timeline studio preview directly into `VannVoiceOverStep.tsx`. When audio transcription (Faster-Whisper or Gemini Audio Mapping) completes, the engine instantly generates and persists `timeline.json` alongside `transcript.json`. Update `Sidebar.tsx` and `App.tsx` navigation mapping to reflect the 8-step pipeline.

**Tech Stack:** React, TypeScript, Electron IPC, Tailwind CSS.

## Global Constraints
- Do not break existing IPC communication or topic folder structures (`transcript.json`, `timeline.json`).
- Ensure type safety across all React components and Electron handlers.
- Maintain existing audio playback synchronization and transcript word alignment capabilities.

---

### Task 1: Update Sidebar & App Navigation Routing to 8-Step Pipeline

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx:15-48`
- Modify: `dashboard/src/App.tsx:128-135`

**Interfaces:**
- Consumes: `StepId` type from `Sidebar.tsx`
- Produces: Updated 8-step `VANN_STEPS` and `SPENSIA_STEPS` arrays

- [ ] **Step 1: Update `Sidebar.tsx` step definitions**

Update `VANN_STEPS` and `SPENSIA_STEPS` to 8 steps by combining `publish` (Voice Over Generator) and `transcript` (Timeline Studio) into Step 6 (`publish`), shifting Render Studio to Step 7 (`upload`), and Publish Hub to Step 8 (`thumbnail`).

```tsx
const VANN_STEPS: Step[] = [
  { id: 'source', icon: '💡', label: '1. Topics Generator', subText: 'Ide topik & fakta kontraintuitif' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'Naskah voiceover Style DNA Vann' },
  { id: 'audio', icon: '✂️', label: '3. Scene Splitter', subText: 'Breakdown segmen visual adegan' },
  { id: 'mapping', icon: '🎨', label: '4. Image Prompt Generator', subText: 'Visual Style DNA Vann prompts' },
  { id: 'render', icon: '🖼️', label: '5. Image Generator', subText: 'Generate ilustrasi adegan Google Flow' },
  { id: 'publish', icon: '🎙️', label: '6. Voice & Timeline Studio', subText: 'Transkrip, auto timeline & visual sync' },
  { id: 'upload', icon: '🎬', label: '7. Render Studio (16:9)', subText: 'Watermark, caption, BGM & export' },
  { id: 'thumbnail', icon: '🚀', label: '8. Publish Hub & Thumbnail', subText: 'AI SEO Title, Tags, Description & 3x Thumbnail' },
];

const SPENSIA_STEPS: Step[] = [
  { id: 'source', icon: '💡', label: '1. Topics Generator', subText: 'Ide topik & fakta kontraintuitif' },
  { id: 'analyze', icon: '⚡', label: '2. Script Generator', subText: 'Naskah voiceover Style DNA Spensia' },
  { id: 'audio', icon: '✂️', label: '3. Scene Splitter', subText: 'Breakdown segmen visual adegan' },
  { id: 'mapping', icon: '🎨', label: '4. Image Prompt Generator', subText: 'Visual Style DNA Spensia prompts' },
  { id: 'render', icon: '🖼️', label: '5. Image Generator', subText: 'Generate ilustrasi adegan Google Flow' },
  { id: 'publish', icon: '🎙️', label: '6. Voice & Timeline Studio', subText: 'Transkrip, auto timeline & visual sync' },
  { id: 'upload', icon: '🎬', label: '7. Render Studio (16:9)', subText: 'Watermark, caption, BGM & export' },
  { id: 'thumbnail', icon: '🚀', label: '8. Publish Hub & Thumbnail', subText: 'AI SEO Title, Tags, Description & 3x Thumbnail' },
];
```

- [ ] **Step 2: Update step routing in `App.tsx`**

Remove the `transcript` step condition in `App.tsx` for Vann and Spensia modes, ensuring `activeStep === 'publish'` renders `VannVoiceOverStep`, `upload` renders `VannRenderStep`, and `thumbnail` renders `VannThumbnailStep`.

- [ ] **Step 3: Verify TypeScript compilation of navigation components**

Run: `npx tsc --noEmit` in `dashboard/`
Expected: PASS with 0 errors in Sidebar.tsx and App.tsx.

---

### Task 2: Integrate Auto Timeline Generator & Interactive Studio into `VannVoiceOverStep.tsx`

**Files:**
- Modify: `dashboard/src/components/vann/VannVoiceOverStep.tsx`

**Interfaces:**
- Consumes: `WakuTranscriptData` from `vannValidation.ts`, `breakdownSegments`, `images` from topic directory
- Produces: Saved `timeline.json` and interactive Timeline Studio UI inside Step 6

- [ ] **Step 1: Add Timeline Data State & Auto-Generation logic**

In `VannVoiceOverStep.tsx`, import `TimelineClipItem` and `FullTimelineData` interfaces. Add state for `timelineData`, `isGeneratingTimeline`, and `breakdownSegments`.
Implement `generateAndSaveTimeline(transcript: WakuTranscriptData)`:
- Maps `breakdownSegments` to `transcript.sentences` / `words`.
- Assigns corresponding image paths from `images/` directory.
- Creates `FullTimelineData` structure and saves it to `timeline.json` via IPC `saveProjectFile`.
- Updates `topic_config.json` status `hasTimeline: true`.

- [ ] **Step 2: Trigger `generateAndSaveTimeline` automatically upon successful transcript validation / Faster-Whisper run**

In `handleRunFasterWhisper` and Gemini JSON mapping handler, invoke `generateAndSaveTimeline(transcriptData)` as soon as transcript alignment succeeds.

- [ ] **Step 3: Render Visual Timeline & Clips Studio section in `VannVoiceOverStep.tsx`**

Add the Timeline Studio UI section below the Transcript section in `VannVoiceOverStep.tsx`:
- Header: `Visual Timeline & Subtitle Sync Studio (Auto-Generated)` with badge `✓ Timeline JSON Ready`.
- Active clip highlight indicator synced to `audioRef` current time.
- Clip list grid/rows showing segment quote, image preview, timestamp bounds (`start_sec` - `end_sec`), and duration.
- Button: `"Lanjut ke Step 7: Render Studio 🎬"` calling `onStepChange?.('upload')`.

- [ ] **Step 4: Verify component build and zero syntax/type errors**

Run: `npm run build -w dashboard` or `npx tsc --noEmit`
Expected: PASS with 0 build errors.

---

### Task 3: Final Verification & Workflow Testing

**Files:**
- Test UI flow across steps 1-8 in `dashboard` app.

- [ ] **Step 1: Run dashboard app in development mode**

Run: `npm run dev -w dashboard`
Expected: App launches, Sidebar displays updated 8-step Vann workflow.

- [ ] **Step 2: Verify Step 6 (Voice & Timeline Studio) functionality**

Select an active topic, run transcription or validate audio mapping, verify that both `transcript.json` and `timeline.json` are generated and that the visual timeline preview displays correctly.

- [ ] **Step 3: Verify transition to Step 7 (Render Studio)**

Click "Lanjut ke Step 7: Render Studio", verify Render Studio loads `timeline.json` without errors.
