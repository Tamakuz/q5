# Design Specification: Waku Module (Cloned & Isolated from Spensia)

**Date**: 2026-08-04  
**Status**: Approved  

## 1. Overview
The `short` / `shortform` module in the Content Auto dashboard is being completely replaced by a new module named **Waku** (`waku`).
Waku is a 100% feature-identical clone of the **Spensia** shortform creation pipeline, but with complete physical and code-level isolation: separate prompt templates, separate IPC handlers, separate utility files, separate UI components, and separate project state storage.

## 2. Architecture & File Structure

### 2.1 Prompt Templates (`dashboard/prompts/waku/`)
Cloned from `dashboard/prompts/spensia/`:
- `analyze-metadata-prompt.md`
- `analyze-thumbnails-vision-prompt.md`
- `audio-mapping-prompt.md`
- `breakdown-prompt.md`
- `demand-keyphrases-prompt.md`
- `fix-metadata-prompt.md`
- `image-prompt-generator-prompt.md`
- `script-prompt.md`
- `thumbnail-prompts-generator-prompt.md`
- `topics-prompt.md`
- `upload-metadata-prompt.md`

### 2.2 IPC Handlers & Electron Core
- File: `dashboard/electron/ipc/wakuHandlers.cjs` (cloned from `spensiaHandlers.cjs` and namespace-switched to `waku:*`).
- Config in `paths.cjs`: Add `wakuPromptsDir` and `wakuOutputDir` / `wakuProjectsDir`.
- Config in `promptLoader.cjs`: Add helper for loading Waku prompts (`getWakuPrompt`).
- Wiring in `main.cjs`: Register `setupWakuHandlers(ipcMain, win)`.
- Exposure in `preload.cjs`: Expose `window.api.waku` methods matching `window.api.spensia`.

### 2.3 Frontend Utilities (`dashboard/src/utils/`)
Cloned from `spensia*` files with `waku` naming:
- `wakuValidation.ts`
- `wakuAssGenerator.ts`
- `wakuRenderConfig.ts`
- `wakuTimelineGenerator.ts`
- `wakuTheme.ts`

### 2.4 UI Components (`dashboard/src/components/waku/`)
Cloned from `dashboard/src/components/spensia/`:
- `WakuTopicsStep.tsx`
- `WakuScriptStep.tsx`
- `WakuBreakdownStep.tsx`
- `WakuImagePromptStep.tsx`
- `WakuImageGeneratorStep.tsx`
- `WakuVoiceOverStep.tsx`
- `WakuTimelineMappingStep.tsx`
- `WakuRenderStep.tsx`
- `WakuThumbnailStep.tsx`

### 2.5 Navigation & App State Integration
- `Sidebar.tsx`: Change `'shortform'` mode to `'waku'`, labeled "Waku", icon 📱/⚡.
- `TopBar.tsx`: Display "Waku Mode", reset project for Waku.
- `WorkflowHeader.tsx`: Render Waku steps matching Spensia's workflow steps.
- `App.tsx`: Map `contentMode === 'waku'` to Waku step components.

### 2.6 Removal of Legacy Shortform
- Remove `dashboard/src/components/shortform/` directory and remove references to `Shortform*` components.

## 3. Data Storage & Isolation
- Waku project state files stored under `input/waku/` or `input/projects/waku/` (or `.tmp/waku_*`), keeping it isolated from `spensia` and `alurfilm`.

## 4. Verification Plan
- Verify IPC handlers register properly without errors.
- Verify TypeScript types build cleanly (`npm run build -w dashboard` or `npx tsc --noEmit`).
- Verify dev server runs and navigation to Waku mode renders all 9 steps seamlessly.
