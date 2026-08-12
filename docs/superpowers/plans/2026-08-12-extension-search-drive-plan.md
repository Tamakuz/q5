# Extension Search Drive File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `searchDriveFile` action in the Chrome Extension, update `manifest.json`, and create a 2-step test runner `test-action-search-drive.ts` (`openDrivePicker` -> `searchDriveFile`).

**Architecture:** The extension content script (`"world": "MAIN"`, `"all_frames": true`) receives `window.postMessage` action request for `searchDriveFile`, parses the file name from input path, locates the Drive Picker search input, types the search term, and dispatches Enter.

**Tech Stack:** TypeScript, Playwright (launch & assertion bridge), Vanilla JavaScript (Chrome Extension Manifest V3).

## Global Constraints
- Zero Playwright DOM locators in action logic.
- 100% DOM operations encapsulated inside `playwright/extension/actions/search-drive-file.js`.
- ONLY search (no file selection/double-clicking yet).

---

### Task 1: Create `search-drive-file.js` & Update Manifest

**Files:**
- Create: [playwright/extension/actions/search-drive-file.js](file:///home/jovan/project/content-auto/playwright/extension/actions/search-drive-file.js)
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)

**Interfaces:**
- Consumes: `window.postMessage` action request `{ type: 'EXECUTE_ACTION', action: 'searchDriveFile', payload: { promptText: string } }`
- Produces: `window.AIStudioActions.searchDriveFile`

- [ ] **Step 1: Create `playwright/extension/actions/search-drive-file.js`**
  Implement `window.AIStudioActions.searchDriveFile` to parse filename, locate search input in main/iframe DOM, fill text, and press Enter.

- [ ] **Step 2: Update `manifest.json`**
  Add `"actions/search-drive-file.js"` to `manifest.json` content_scripts array.

---

### Task 2: Create Test Runner (`test-action-search-drive.ts`) & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-action-search-drive.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-search-drive.ts)

**Interfaces:**
- Consumes: Stealth Playwright browser with Chrome Extension loaded.
- Produces: Verification of `openDrivePicker` -> `searchDriveFile` pipeline.

- [ ] **Step 1: Create `test-action-search-drive.ts`**
  Write test script that opens AI Studio, calls `openDrivePicker`, then calls `searchDriveFile` with `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_01.mp4`.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-search-drive.ts`**
  Run test script and verify PASS output.
