# Extension Upload Local File Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local file fallback upload actions (`upload-local-file.js`), register in `manifest.json`, and create end-to-end fallback pipeline runner (`test-action-pipeline-drive-fallback.ts`) for target file `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_04.mp4`.

---

### Task 1: Create `upload-local-file.js` & Update Manifest

**Files:**
- Create: [playwright/extension/actions/upload-local-file.js](file:///home/jovan/project/content-auto/playwright/extension/actions/upload-local-file.js)
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)
- Modify: [playwright/extension/content.js](file:///home/jovan/project/content-auto/playwright/extension/content.js)

- [ ] **Step 1: Create `playwright/extension/actions/upload-local-file.js`**
  Implement `window.AIStudioActions.prepareLocalUpload` and `window.AIStudioActions.waitLocalUploadComplete`.

- [ ] **Step 2: Update `manifest.json` & `content.js`**
  Add `"actions/upload-local-file.js"` to `manifest.json` and add `prepareLocalUpload` / `waitLocalUploadComplete` to `content.js` frame forwarding list.

---

### Task 2: Create End-to-End Fallback Test Runner & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-action-pipeline-drive-fallback.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-pipeline-drive-fallback.ts)

- [ ] **Step 1: Create `test-action-pipeline-drive-fallback.ts`**
  Implement end-to-end pipeline:
  `openDrivePicker` ➔ `searchDriveFile` ➔ `selectDriveFile` ➔ (If `fileAttached === false`) ➔ `prepareLocalUpload` ➔ `setInputFiles` ➔ `waitLocalUploadComplete`.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-pipeline-drive-fallback.ts`**
  Run test script for `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_04.mp4` and verify PASS output.
