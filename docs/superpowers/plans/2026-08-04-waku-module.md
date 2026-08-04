# Waku Module (Spensia Clone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `shortform` module with `waku`, an isolated 100% clone of the `spensia` video creation pipeline including prompt templates, IPC handlers, utilities, step UI components, and state management.

**Architecture:** Create dedicated `waku` directories (`prompts/waku`, `components/waku`, `electron/ipc/wakuHandlers.cjs`, `utils/waku*`), register `waku:*` IPC handlers in Electron main/preload, update `ContentMode` from `shortform` to `waku`, and delete legacy `shortform` component files.

**Tech Stack:** React (TypeScript), Electron, Node.js (CommonJS IPC), FFmpeg / Python scripts.

## Global Constraints
- `waku` must be fully isolated from `spensia` (separate IPC namespace `waku:*`, separate project state files, separate prompt directory).
- All 9 pipeline steps present in Spensia must be present and fully operational in Waku.

---

### Task 1: Prompts & Path Configuration

**Files:**
- Create: 11 files under `dashboard/prompts/waku/`
- Modify: `dashboard/electron/shared/paths.cjs`
- Modify: `dashboard/electron/shared/promptLoader.cjs`

- [ ] **Step 1: Create `dashboard/prompts/waku/` directory and copy 11 prompt templates from `spensia`**
- [ ] **Step 2: Add `wakuPromptsDir` and `wakuOutputDir` in `paths.cjs`**
- [ ] **Step 3: Add `getWakuPrompt` helper in `promptLoader.cjs`**
- [ ] **Step 4: Commit prompt and path configurations**

---

### Task 2: Electron Backend & IPC Handlers (`wakuHandlers.cjs`)

**Files:**
- Create: `dashboard/electron/ipc/wakuHandlers.cjs`
- Modify: `dashboard/electron/preload.cjs`
- Modify: `dashboard/electron/main.cjs`

- [ ] **Step 1: Create `wakuHandlers.cjs` cloned from `spensiaHandlers.cjs` and replace channel prefixes from `spensia:` to `waku:`**
- [ ] **Step 2: Update IPC handlers to use Waku paths and `getWakuPrompt`**
- [ ] **Step 3: Register `setupWakuHandlers` in `main.cjs` and expose `window.api.waku` methods in `preload.cjs`**
- [ ] **Step 4: Commit Electron backend IPC integration**

---

### Task 3: Waku Utility Files

**Files:**
- Create: `dashboard/src/utils/wakuValidation.ts`
- Create: `dashboard/src/utils/wakuAssGenerator.ts`
- Create: `dashboard/src/utils/wakuRenderConfig.ts`
- Create: `dashboard/src/utils/wakuTimelineGenerator.ts`
- Create: `dashboard/src/utils/wakuTheme.ts`

- [ ] **Step 1: Create `wakuTheme.ts` and `wakuRenderConfig.ts`**
- [ ] **Step 2: Create `wakuValidation.ts`, `wakuAssGenerator.ts`, and `wakuTimelineGenerator.ts`**
- [ ] **Step 3: Commit utility modules**

---

### Task 4: Frontend UI Components (`dashboard/src/components/waku/`)

**Files:**
- Create: `dashboard/src/components/waku/WakuTopicsStep.tsx`
- Create: `dashboard/src/components/waku/WakuScriptStep.tsx`
- Create: `dashboard/src/components/waku/WakuBreakdownStep.tsx`
- Create: `dashboard/src/components/waku/WakuImagePromptStep.tsx`
- Create: `dashboard/src/components/waku/WakuImageGeneratorStep.tsx`
- Create: `dashboard/src/components/waku/WakuVoiceOverStep.tsx`
- Create: `dashboard/src/components/waku/WakuTimelineMappingStep.tsx`
- Create: `dashboard/src/components/waku/WakuRenderStep.tsx`
- Create: `dashboard/src/components/waku/WakuThumbnailStep.tsx`

- [ ] **Step 1: Create 9 step components in `dashboard/src/components/waku/` cloned from `spensia` and updated to call `window.api.waku.*`**
- [ ] **Step 2: Commit Waku step components**

---

### Task 5: App Wiring & Legacy Cleanup

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/components/common/TopBar.tsx`
- Modify: `dashboard/src/components/common/WorkflowHeader.tsx`
- Modify: `dashboard/src/App.tsx`
- Delete: `dashboard/src/components/shortform/*` (5 files)

- [ ] **Step 1: Update `ContentMode` type in `Sidebar.tsx` to include `'waku'` instead of `'shortform'`**
- [ ] **Step 2: Update `WorkflowHeader.tsx` and `TopBar.tsx` to support Waku steps and labels**
- [ ] **Step 3: Update `App.tsx` to render Waku steps when `contentMode === 'waku'`**
- [ ] **Step 4: Delete legacy `dashboard/src/components/shortform/` directory**
- [ ] **Step 5: Commit App wiring and cleanup**

---

### Task 6: Verification & Testing

- [ ] **Step 1: Run TypeScript compiler / build check**
- [ ] **Step 2: Verify Electron app loads Waku mode cleanly without runtime errors**
