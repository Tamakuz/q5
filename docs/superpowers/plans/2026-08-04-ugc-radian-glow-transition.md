# CapCut Radian Glow Transition Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CapCut-style Radian Glow transitions between concatenated 3-clip videos in UGC Render Studio using `ffprobe` duration calculation and FFmpeg `xfade` / `acrossfade` filtergraph.

**Architecture:** Probe video durations in `ugcHandlers.cjs`, calculate offsets, construct `xfade` filtergraph, update `preload.cjs` & `electron-api.ts`, and add transition style selector to `UGCRenderStudioStep.tsx`.

**Tech Stack:** Node.js child_process (ffmpeg, ffprobe), Electron IPC, React, TypeScript.

---

### Task 1: Update Electron Backend Handlers (`ugcHandlers.cjs`)

**Files:**
- Modify: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Implement `getVideoDuration` helper via `ffprobePath` in `ugcHandlers.cjs`**
- [ ] **Step 2: Update `ugc:render-pattern` to accept `transitionStyle` ('radian_glow' | 'dissolve' | 'none') and build dynamic `xfade` filtergraph**
- [ ] **Step 3: Update `preload.cjs` to pass `transitionStyle` in `renderUGCPattern`**

---

### Task 2: Update Types & Electron API Interfaces

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `transitionStyle` parameter to `renderUGCPattern` signature in `electron-api.ts`**

---

### Task 3: Add Transition Style Selector to `UGCRenderStudioStep.tsx`

**Files:**
- Modify: `dashboard/src/components/ugc/UGCRenderStudioStep.tsx`

- [ ] **Step 1: Add Transition Selector UI state & dropdown (Default: `radian_glow`), and pass `transitionStyle` to render calls**

---

### Task 4: Verification

- [ ] **Step 1: Run TypeScript compiler check `npx tsc --noEmit -p dashboard/tsconfig.json`**
