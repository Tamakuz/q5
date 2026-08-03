# UGC Isolated Render Studio & 3-Clip Pattern Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Step 4 (UGC Render Studio) featuring 3-clip pattern generation, deduplication, FFmpeg video concatenation, and rendered output gallery.

**Architecture:** Implement pattern computation & FFmpeg concat in `ugcHandlers.cjs`, expose methods in `preload.cjs` and `electron-api.ts`, create `UGCRenderStudioStep.tsx` UI, and update `Sidebar.tsx` and `App.tsx`.

**Tech Stack:** Node.js child_process FFmpeg, Electron IPC, React, TypeScript, Tailwind CSS (Cyan Theme).

---

### Task 1: Add Output Paths & Render IPC Handlers in Electron Backend

**Files:**
- Modify: `dashboard/electron/shared/paths.cjs`
- Modify: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Add `UGC_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'ugc')` to `paths.cjs`**
- [ ] **Step 2: Implement `ugc:get-render-patterns-stats`, `ugc:render-pattern`, `ugc:list-renders`, and `ugc:delete-render` handlers in `ugcHandlers.cjs`**
- [ ] **Step 3: Expose IPC methods in `preload.cjs`**

---

### Task 2: Update Types & Electron API Interfaces

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `UGCPatternStats` and `UGCRenderResult` interfaces and method signatures in `electron-api.ts`**

---

### Task 3: Build `UGCRenderStudioStep` Component (Step 4)

**Files:**
- Create: `dashboard/src/components/ugc/UGCRenderStudioStep.tsx`

- [ ] **Step 1: Build `UGCRenderStudioStep.tsx` with pattern stats cards, "Render Pola Baru" action, live render progress bar, and rendered video gallery grid**

---

### Task 4: Update Sidebar Steps & App Component Routing

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/App.tsx`

- [ ] **Step 1: Add Step 4: 🎬 4. UGC Render Studio to `UGC_STEPS` in `Sidebar.tsx`**
- [ ] **Step 2: Map `activeStep === 'render'` to `UGCRenderStudioStep` in `App.tsx`**

---

### Task 5: Verification

- [ ] **Step 1: Run TypeScript compiler check `npx tsc --noEmit -p dashboard/tsconfig.json`**
