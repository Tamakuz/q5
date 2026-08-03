# UGC Character Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the UGC Character Profiles Manager feature allowing users to create, view, select, and delete multiple character profiles with photos stored in `input/ugc/profiles/`.

**Architecture:** Create path constants for `UGC_PROFILES_DIR`, implement IPC handlers in `ugcHandlers.cjs`, bind methods in `preload.cjs` and `electron-api.ts`, build `UGCProfilesManager.tsx` UI component, and render it in `UGCStudioStep.tsx`.

**Tech Stack:** React, TypeScript, Node.js fs/path, Electron IPC, Tailwind CSS (Cyan Theme).

## Global Constraints

- Storage directory: `input/ugc/profiles/{profile_id}/` containing `info.json` and photo file (`photo.png`/`photo.jpg`).
- Cyan visual theme accent (`cyan-500`, `cyan-400`, `cyan-950`).

---

### Task 1: Add UGC Path Constants & IPC Handlers in Electron Backend

**Files:**
- Modify: `dashboard/electron/shared/paths.cjs`
- Create: `dashboard/electron/ipc/ugcHandlers.cjs`
- Modify: `dashboard/electron/main.cjs`
- Modify: `dashboard/electron/preload.cjs`

- [ ] **Step 1: Define `UGC_PROFILES_DIR` in `dashboard/electron/shared/paths.cjs`**

Add `UGC_PROFILES_DIR = path.join(PROJECT_ROOT, 'input', 'ugc', 'profiles')` and ensure directory exists.

- [ ] **Step 2: Create `dashboard/electron/ipc/ugcHandlers.cjs`**

Implement handlers:
- `ugc:get-profiles`
- `ugc:create-profile`
- `ugc:delete-profile`
- `ugc:select-active-profile`
- `ugc:get-active-profile`
- `ugc:select-image-file`

- [ ] **Step 3: Register `ugcHandlers.cjs` in `dashboard/electron/main.cjs`**

- [ ] **Step 4: Expose IPC methods in `dashboard/electron/preload.cjs`**

---

### Task 2: Update Frontend Electron API Types and Bindings

**Files:**
- Modify: `dashboard/src/electron-api.ts`

- [ ] **Step 1: Add `UGCProfile` interface and window.electronAPI method signatures in `electron-api.ts`**

---

### Task 3: Create `UGCProfilesManager` UI Component & Integrate in `UGCStudioStep`

**Files:**
- Create: `dashboard/src/components/ugc/UGCProfilesManager.tsx`
- Modify: `dashboard/src/components/ugc/UGCStudioStep.tsx`

- [ ] **Step 1: Create `UGCProfilesManager.tsx` with card grid layout, active character indicator, create modal, and delete actions**

- [ ] **Step 2: Embed `UGCProfilesManager` into `UGCStudioStep.tsx`**

---

### Task 4: Verification

- [ ] **Step 1: Run TypeScript typecheck to verify zero compilation errors**
