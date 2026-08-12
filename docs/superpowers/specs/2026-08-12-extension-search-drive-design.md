# AI Studio Extension - Search Drive File Action Design

## Goal
Implement a modular Chrome Extension action (`search-drive-file.js`) that inputs a file search query into the Google Drive Picker modal search box and submits the query with Enter, update `manifest.json` & `content.js`, and create an isolated test runner (`test-action-search-drive.ts`).

## Problem Statement
After opening the Google Drive Picker modal via `openDrivePicker`, the pipeline requires searching for a target video/audio file by name or path without performing selection/double-clicking yet.

## System Architecture

```
+------------------------------------------------------------+
| Playwright Collaboration / Search Test Runner             |
| (playwright/extension/tests/test-action-search-drive.ts)  |
|  1. Launch Chromium with stealth profile & extension       |
|  2. Open https://aistudio.google.com/prompts/new_chat      |
|  3. Step 1: Dispatch openDrivePicker action                |
|  4. Step 2: Dispatch searchDriveFile action with filename  |
|  5. Verify search query input DOM state                    |
+-----------------------------+------------------------------+
                              | window.postMessage
                              v
+------------------------------------------------------------+
| Chrome Extension ("world": "MAIN", all_frames: true)        |
|  - manifest.json: injects search-drive-file.js             |
|  - actions/search-drive-file.js:                           |
|      1. Extracts file basename from input path             |
|      2. Locates search input in Drive Picker iframe DOM    |
|      3. Fills search term and dispatches Enter key event   |
|      4. Returns status payload to window.__ACTION_RESULT   |
+------------------------------------------------------------+
```

## Action Specs

### 1. `searchDriveFile` (`playwright/extension/actions/search-drive-file.js`)
- **Module Interface**: `window.AIStudioActions.searchDriveFile(filePathOrName, options)`
- **Path Processing**:
  - Extracts basename if given path (e.g. `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_01.mp4` -> `WV-FILM-20260811-CTBB_part_01.mp4`).
- **Input Search Selectors**:
  - `input[aria-label*="Search" i]`
  - `input[placeholder*="Search" i]`
  - `input[role="combobox"]`
  - `input[type="text"]`
- **Logic**:
  - Locates search input in the page or iframe document.
  - Sets value and dispatches native events (`focus`, `input`, `change`, `keydown` Enter).
  - Returns `{ success: true, action: 'searchDriveFile', query: searchTerm, timestamp: number }`.

### 2. Test Runner (`playwright/extension/tests/test-action-search-drive.ts`)
- Launches stealth browser with Chrome Extension.
- Navigates to AI Studio.
- Step 1: `openDrivePicker`
- Step 2: `searchDriveFile` with query `WV-FILM-20260811-CTBB_part_01.mp4`.
- Verifies search input is populated.
- Outputs `[TEST PASS] searchDriveFile action verified successfully!`.
