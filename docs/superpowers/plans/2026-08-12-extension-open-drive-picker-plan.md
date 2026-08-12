# Extension Open Drive Picker Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `openDrivePicker` action in the Chrome Extension, update `manifest.json` content script array, and create isolated test runner `test-action-open-drive-picker.ts`.

**Architecture:** The Chrome Extension content script (`"world": "MAIN"`) receives `window.postMessage` action request for `openDrivePicker`, clicks the Add Media (+) button, clicks the Drive popover menu option, and waits for the Google Drive Picker iframe to render. A Playwright test runner triggers the action and asserts that the picker iframe is open and visible.

**Tech Stack:** TypeScript, Playwright (launch & assertion bridge), Vanilla JavaScript (Chrome Extension Manifest V3).

## Global Constraints
- Zero Playwright DOM locators in action logic.
- 100% DOM operations encapsulated inside `playwright/extension/actions/open-drive-picker.js`.

---

### Task 1: Create `open-drive-picker.js` & Update Manifest

**Files:**
- Create: [playwright/extension/actions/open-drive-picker.js](file:///home/jovan/project/content-auto/playwright/extension/actions/open-drive-picker.js)
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)

**Interfaces:**
- Consumes: `window.postMessage` action request `{ type: 'EXECUTE_ACTION', action: 'openDrivePicker' }`
- Produces: `window.AIStudioActions.openDrivePicker`

- [ ] **Step 1: Create `playwright/extension/actions/open-drive-picker.js`**
  Implement `window.AIStudioActions.openDrivePicker` to locate and click Add Media (+), click Drive menu option, and verify `iframe[src*="picker"]` presence.

- [ ] **Step 2: Update `manifest.json`**
  Add `"actions/open-drive-picker.js"` to `manifest.json` content_scripts array.

---

### Task 2: Create Isolated Per-Action Test Runner (`test-action-open-drive-picker.ts`) & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-action-open-drive-picker.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-open-drive-picker.ts)

**Interfaces:**
- Consumes: Stealth Playwright browser with Chrome Extension loaded.
- Produces: Verification of `openDrivePicker` action.

- [ ] **Step 1: Create `test-action-open-drive-picker.ts`**
  Write test script that navigates to AI Studio, triggers `openDrivePicker`, polls `window.__ACTION_RESULT`, and checks for `iframe[src*="picker"]` in DOM.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-open-drive-picker.ts`**
  Run test script and verify PASS output.
