# UGC Video URL Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement URL video downloading capability in UGC Video Assets Manager (Step 3), saving files into `input/ugc/products/{product_id}/assets/videos/`.

**Architecture:** Add `ugc:download-video-asset` IPC handler with streaming download and progress events in `ugcHandlers.cjs`, expose methods in `preload.cjs` and `electron-api.ts`, and update `UGCVideoAssetsManager.tsx` UI with "Import via URL" modal dialog and progress bar.

**Tech Stack:** Node.js http/https/fs, Electron IPC, React, TypeScript, Tailwind CSS (Cyan Theme).

---

### Task 1: Implement `ugc:download-video-asset` IPC Handler

**Files:**
- Modify: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Implement `ugc:download-video-asset` streaming downloader in `ugcHandlers.cjs`**
- [ ] **Step 2: Expose `downloadUGCVideoAsset` and `onUGCVideoDownloadProgress` in `preload.cjs`**

---

### Task 2: Update Frontend Types & Electron API

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add method signatures to `ElectronAPI` interface**

---

### Task 3: Update `UGCVideoAssetsManager.tsx` UI

**Files:**
- Modify: `dashboard/src/components/ugc/UGCVideoAssetsManager.tsx`

- [ ] **Step 1: Add "🔗 Import via URL" button, download modal dialog, live progress bar, and automatic video list refresh**

---

### Task 4: Verification

- [ ] **Step 1: Verify TypeScript compilation with `npx tsc --noEmit -p dashboard/tsconfig.json`**
