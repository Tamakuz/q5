# Spensia Workflow & Feature Parity with Vann Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize Spensia's workflow, UI components, prompts, and utility files to be 100% identical in steps and features with Vann.

**Architecture:** Align navigation to a 7-step sequence (removing standalone Scene Splitter and embedding auto-breakdown into Step 3 `SpensiaVoiceOverStep`). Update components, prompts, and utils to match Vann's current code, adapting paths and identifiers to Spensia.

**Tech Stack:** React, TypeScript, Vite, Electron IPC, Tailwind CSS.

## Global Constraints
- Target 7 steps in `Sidebar.tsx` and `WorkflowHeader.tsx` for Spensia.
- Maintain type-safety and ensure clean Vite compilation with no broken imports or missing properties.
- Retain Spensia workspace directories and branding/paths in utils (`spensia_workspace`, `spensia_timeline.json`, etc.).

---

### Task 1: Update Prompt Files in `dashboard/prompts/spensia/`

**Files:**
- Modify: `dashboard/prompts/spensia/image-prompt-generator-prompt.md`
- Modify: `dashboard/prompts/spensia/script-prompt.md`
- Modify: `dashboard/prompts/spensia/thumbnail-prompts-generator-prompt.md`
- Modify: `dashboard/prompts/spensia/topics-prompt.md`
- Modify: `dashboard/prompts/spensia/breakdown-prompt.md`
- Modify: `dashboard/prompts/spensia/fix-metadata-prompt.md`
- Modify: `dashboard/prompts/spensia/upload-metadata-prompt.md`

**Interfaces:**
- Consumes: Vann prompt files in `dashboard/prompts/vann/`
- Produces: Updated Spensia prompt templates matching Vann structure and instruction set.

- [ ] **Step 1: Copy and adapt Vann prompt markdown files into Spensia prompt folder**
- [ ] **Step 2: Verify prompt contents contain Spensia-appropriate channel/context defaults**

---

### Task 2: Update Utilities in `dashboard/src/utils/`

**Files:**
- Modify: `dashboard/src/utils/spensiaTimelineGenerator.ts`
- Modify: `dashboard/src/utils/spensiaValidation.ts`
- Modify: `dashboard/src/utils/spensiaAssGenerator.ts`
- Modify: `dashboard/src/utils/spensiaRenderConfig.ts`

**Interfaces:**
- Consumes: `vannTimelineGenerator.ts`, `vannValidation.ts`, `vannAssGenerator.ts`, `vannRenderConfig.ts`
- Produces: Updated Spensia utility functions maintaining full feature parity.

- [ ] **Step 1: Update `spensiaValidation.ts` to match `vannValidation.ts` (with Spensia interface names)**
- [ ] **Step 2: Update `spensiaTimelineGenerator.ts` to match `vannTimelineGenerator.ts`**
- [ ] **Step 3: Update `spensiaAssGenerator.ts` and `spensiaRenderConfig.ts` to match Vann counterparts**

---

### Task 3: Update 7-Step Navigation and Header Component

**Files:**
- Modify: `dashboard/src/components/common/Sidebar.tsx`
- Modify: `dashboard/src/components/common/WorkflowHeader.tsx`
- Modify: `dashboard/src/App.tsx`

**Interfaces:**
- Consumes: StepId `'source' | 'analyze' | 'publish' | 'mapping' | 'render' | 'upload' | 'thumbnail'`
- Produces: 7-step menu for Spensia identical to Vann's step order.

- [ ] **Step 1: Update `SPENSIA_STEPS` in `Sidebar.tsx` to 7 steps**
- [ ] **Step 2: Update `SPENSIA_STEPS` in `WorkflowHeader.tsx` to 7 steps**
- [ ] **Step 3: Update `App.tsx` activeStep routing for `contentMode === 'spensia'` to render Step 3 (`SpensiaVoiceOverStep`) on `publish`**

---

### Task 4: Update Spensia Components for Parity

**Files:**
- Modify: `dashboard/src/components/spensia/SpensiaVoiceOverStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaImagePromptStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaTopicsStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaScriptStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaImageGeneratorStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaRenderStep.tsx`
- Modify: `dashboard/src/components/spensia/SpensiaThumbnailStep.tsx`

**Interfaces:**
- Consumes: Electron API, `spensiaValidation`, `spensiaTimelineGenerator`, `spensiaRenderConfig`
- Produces: Fully functional Spensia components matching Vann feature set.

- [ ] **Step 1: Update `SpensiaVoiceOverStep.tsx` with auto-breakdown and timeline generation matching `VannVoiceOverStep.tsx`**
- [ ] **Step 2: Update `SpensiaImagePromptStep.tsx` with concurrency controls and continuity settings matching `VannImagePromptStep.tsx`**
- [ ] **Step 3: Synchronize `SpensiaTopicsStep.tsx`, `SpensiaScriptStep.tsx`, `SpensiaImageGeneratorStep.tsx`, `SpensiaRenderStep.tsx`, and `SpensiaThumbnailStep.tsx` with their Vann counterparts**

---

### Task 5: Build & Verification

**Files:**
- Workspace root / dashboard

- [ ] **Step 1: Run TypeScript type check / build verification**
- [ ] **Step 2: Verify dev server builds cleanly without warnings or errors**
