# Extension Full Script Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete end-to-end script generation pipeline using Chrome Extension actions (`inputPrompt` -> `openDrivePicker` -> `searchDriveFile` -> `selectDriveFile` / `uploadLocalFile` -> `submitPrompt` -> `extractOutput` -> validate JSON/text -> save to `input/alurfilm/`).

---

### Task 1: Create Validation & Saver Helper (`save-script-output.ts`)

**Files:**
- Create: [playwright/extension/utils/save-script-output.ts](file:///home/jovan/project/content-auto/playwright/extension/utils/save-script-output.ts)

- [ ] **Step 1: Implement `saveScriptOutput` helper**
  Extracts plain text narration and parses JSON structures from AI response, validates fields (`title`, `hook`, `narration`, etc.), and saves outputs to `input/alurfilm/`.

---

### Task 2: Create Full Pipeline Test Runner (`test-pipeline-full-script.ts`) & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-pipeline-full-script.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-pipeline-full-script.ts)

- [ ] **Step 1: Create `test-pipeline-full-script.ts`**
  Implement full 6-step pipeline workflow using Chrome Extension actions and `saveScriptOutput` helper.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-pipeline-full-script.ts`**
  Run end-to-end pipeline test and verify script generation, JSON validation, and file output in `input/alurfilm/`.
