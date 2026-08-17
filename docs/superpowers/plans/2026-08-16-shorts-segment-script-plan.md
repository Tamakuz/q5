# Shorts Step 2: Multi-Segment & AI Script Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Step 2 (Segment & Script Generator) for the Shorts module, featuring an AI Studio Prompt Hub, JSON import/parser for Shorts video segments, interactive timestamp preview player, and JSON state persistence.

**Architecture:** Frontend React component (`ShortsAnalyzeStep.tsx`) coupled with prompt template (`dashboard/prompts/shortform/shorts-segment-script.md`). Reads sources from `input/shorts/video-sources.json` and persists state to `input/shorts/script-segments.json`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Electron IPC.

## Global Constraints

- Storage manifest: `input/shorts/script-segments.json`
- Prompt file: `dashboard/prompts/shortform/shorts-segment-script.md`
- Media URL format: `window.electronAPI.getMediaUrl(path)`

---

### Task 1: Create Prompt Template & Update Sidebar/App Navigation

**Files:**
- Create: `dashboard/prompts/shortform/shorts-segment-script.md`
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Create `shorts-segment-script.md` prompt template**

Create `dashboard/prompts/shortform/shorts-segment-script.md` with instructions for AI Studio to extract 2-4 Shorts segments and write narration scripts targeting US audience.

- [ ] **Step 2: Update `SHORTS_STEPS` in `Sidebar.tsx`**

Add step 2 to `SHORTS_STEPS`:
```typescript
const SHORTS_STEPS: Step[] = [
  { id: 'source', icon: '📥', label: '1. Video Downloader', subText: 'Download & kompres raw video' },
  { id: 'analyze', icon: '⚡', label: '2. Segment & Script Generator', subText: 'Ekstrak segmen & naskah Shorts' },
];
```

- [ ] **Step 3: Update `App.tsx` to render `ShortsAnalyzeStep` for `activeStep === 'analyze'`**

Import `ShortsAnalyzeStep` and render it when `contentMode === 'shorts'` and `activeStep === 'analyze'`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/prompts/shortform/shorts-segment-script.md dashboard/src/components/common/Sidebar.tsx dashboard/src/App.tsx
git commit -m "feat(shorts): create step 2 prompt template and register analyze step in Sidebar & App"
```

---

### Task 2: Implement `ShortsAnalyzeStep.tsx` Component

**Files:**
- Modify: `dashboard/src/components/shorts/ShortsAnalyzeStep.tsx`

- [ ] **Step 1: Write `ShortsAnalyzeStep.tsx` UI & State**

Implement:
1. `ShortsSegment` interface:
   ```typescript
   export interface ShortsSegment {
     id: string;
     title: string;
     hook_text: string;
     formatted_start: string;
     formatted_end: string;
     start_time_sec: number;
     end_time_sec: number;
     narration_script: string;
     sentences: string[];
   }
   ```
2. Source Video dropdown selector (reads from `input/shorts/video-sources.json`).
3. Prompt Copy Box & Google AI Studio direct link.
4. JSON Paste Textarea + `📥 Import & Parse Data Segmen` button.
5. Interactive Video Player with `▶ Play Segmen` timestamp seeking (`videoRef.current.currentTime = seg.start_time_sec`).
6. Segment Card Editor (Start/End Time edit, Title edit, Script edit, Add segment, Delete segment).
7. Persistence: `input/shorts/script-segments.json`.

- [ ] **Step 2: Verify Build & Typecheck**

Run: `npm run build -w dashboard`
Expected: Build passes with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/shorts/ShortsAnalyzeStep.tsx
git commit -m "feat(shorts): implement step 2 ShortsAnalyzeStep with AI Studio prompt hub and segment script editor"
```
