# Extension Select Drive File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `selectDriveFile` action in the Chrome Extension, update `manifest.json`, and create a 3-step test runner `test-action-select-drive.ts` (`openDrivePicker` -> `searchDriveFile` -> `selectDriveFile`).

**Architecture:** The extension action (`select-drive-file.js`) locates the search result item in the Drive Picker iframe DOM, double-clicks it, clicks the "Select" button as fallback, and returns `fileAttached: true` when attached or `fileAttached: false` if not found.

---

### Task 1: Create `select-drive-file.js` & Update Manifest

**Files:**
- Create: [playwright/extension/actions/select-drive-file.js](file:///home/jovan/project/content-auto/playwright/extension/actions/select-drive-file.js)
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)

- [ ] **Step 1: Create `playwright/extension/actions/select-drive-file.js`**
  Implement `window.AIStudioActions.selectDriveFile` to query matching file option in Drive Picker DOM, double-click it, click Select button if active, and wait for picker modal to close.

- [ ] **Step 2: Update `manifest.json`**
  Add `"actions/select-drive-file.js"` to `manifest.json` content_scripts array.

---

### Task 2: Create Test Runner (`test-action-select-drive.ts`) & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-action-select-drive.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-select-drive.ts)

- [ ] **Step 1: Create `test-action-select-drive.ts`**
  Write test script that opens AI Studio, calls `openDrivePicker`, calls `searchDriveFile`, then calls `selectDriveFile`. Verifies attached chip in prompt editor for existing file, and verifies `fileAttached: false` for non-existent file.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-select-drive.ts`**
  Run test script and verify PASS output.
