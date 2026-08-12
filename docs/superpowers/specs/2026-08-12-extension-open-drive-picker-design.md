# AI Studio Chrome Extension - Open Drive Picker Action Design

## Goal
Implement a modular Chrome Extension action (`open-drive-picker.js`) that opens the Google Drive Picker modal iframe inside Google AI Studio, update `manifest.json` & `content.js` router, and create an isolated per-action test runner (`test-action-open-drive-picker.ts`).

## Problem Statement
Attaching Google Drive files requires first opening the Google Drive Picker modal. This must be performed natively by the Chrome Extension content script (`"world": "MAIN"`) without any Playwright DOM locators.

## System Architecture

```
+------------------------------------------------------------+
| Playwright Per-Action Test Runner                          |
| (playwright/extension/tests/test-action-open-drive-picker.ts)|
|  1. Launch Chromium with stealth profile & extension       |
|  2. Open https://aistudio.google.com/prompts/new_chat      |
|  3. Dispatch postMessage: { type: 'EXECUTE_ACTION',        |
|     action: 'openDrivePicker', payload: {} }               |
|  4. Poll window.__ACTION_RESULT and verify picker iframe   |
+-----------------------------+------------------------------+
                              | window.postMessage
                              v
+------------------------------------------------------------+
| Chrome Extension ("world": "MAIN")                          |
|  - manifest.json: injects open-drive-picker.js             |
|  - actions/open-drive-picker.js:                           |
|      1. Locates and clicks Add Media (+) button            |
|      2. Locates and clicks "Drive" menu item               |
|      3. Waits for iframe[src*="picker"] to be visible      |
|      4. Returns success payload to window.__ACTION_RESULT  |
+------------------------------------------------------------+
```

## Action Specs

### 1. `openDrivePicker` (`playwright/extension/actions/open-drive-picker.js`)
- **Module Interface**: `window.AIStudioActions.openDrivePicker(dummyText, options)`
- **Add Media (+) Selectors**:
  - `[data-test-id="add-media-button"]`
  - `button[aria-label*="add" i]`
  - `button[aria-label*="insert" i]`
  - `button[aria-label*="media" i]`
- **Drive Menu Item Selectors**:
  - `[role="menuitem"]:has-text("Drive")`
  - `button:has-text("Drive")`
  - `div:has-text("Drive")`
- **Iframe Modal Selectors**:
  - `iframe[src*="picker"]`
  - `iframe[name^="I0_"]`
- **Return Value**:
  - `{ success: true, action: 'openDrivePicker', iframeFound: true, timestamp: number }`

### 2. Isolated Per-Action Test Runner (`playwright/extension/tests/test-action-open-drive-picker.ts`)
- Launches stealth browser with Chrome Extension.
- Navigates to AI Studio.
- Executes `openDrivePicker` via `postMessage`.
- Verifies `iframe[src*="picker"]` exists in DOM and is visible.
- Outputs `[TEST PASS] openDrivePicker action verified successfully!`.
