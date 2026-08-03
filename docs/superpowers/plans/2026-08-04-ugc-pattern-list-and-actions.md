# UGC Pattern List Table & Enhanced Render Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform UGC Render Studio into a Pattern List Table with individual pattern rendering, checkbox multi-selection batch rendering, "Mark as Uploaded" toggling, and video deletion.

**Architecture:** Implement pattern list querying and status management in `ugcHandlers.cjs`, update `preload.cjs` and `electron-api.ts`, and replace `UGCRenderStudioStep.tsx` UI with the interactive pattern table layout.

**Tech Stack:** Node.js fs/path/child_process, Electron IPC, React, TypeScript, Tailwind CSS (Cyan Theme).

---

### Task 1: Update IPC Handlers in Electron Backend

**Files:**
- Modify: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Implement `ugc:get-render-patterns-list`, `ugc:toggle-upload-status`, and `ugc:delete-render-pattern` in `ugcHandlers.cjs`**
- [ ] **Step 2: Expose methods in `preload.cjs`**

---

### Task 2: Update Frontend Types & Electron API

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `UGCPatternItem` interface and method signatures in `electron-api.ts`**

---

### Task 3: Build Pattern List Table UI in `UGCRenderStudioStep.tsx`

**Files:**
- Modify: `dashboard/src/components/ugc/UGCRenderStudioStep.tsx`

- [ ] **Step 1: Build Pattern Table with checkbox column, individual Render button, Mark Uploaded toggle, Delete button, and Batch Selected Render action**

---

### Task 4: Verification

- [ ] **Step 1: Run TypeScript compiler check `npx tsc --noEmit -p dashboard/tsconfig.json`**
