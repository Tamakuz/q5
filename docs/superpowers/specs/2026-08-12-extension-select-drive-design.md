# AI Studio Extension - Select Drive File Action Design

## Goal
Implement a modular Chrome Extension action (`select-drive-file.js`) that double-clicks a found Drive file item in the Drive Picker modal (or clicks Select/Insert button) to attach it to Google AI Studio, or returns `fileAttached: false` if not found. Update `manifest.json` and create an isolated test runner (`test-action-select-drive.ts`).

## Architecture & Workflow

```
+-------------------------------------------------------------+
| Playwright Test Runner (test-action-select-drive.ts)         |
|  1. openDrivePicker                                         |
|  2. searchDriveFile                                         |
|  3. selectDriveFile                                         |
|      - If fileFound: double-clicks item & confirms insert   |
|      - If NOT fileFound: returns fileAttached: false        |
+------------------------------+------------------------------+
                               | window.postMessage
                               v
+-------------------------------------------------------------+
| Chrome Extension ("world": "MAIN", all_frames: true)         |
|  - actions/select-drive-file.js:                            |
|      1. Queries target file item in Drive Picker DOM        |
|      2. Dispatches click + dblclick + Select button click   |
|      3. Waits for picker iframe to close                    |
|      4. Returns result payload to window.__ACTION_RESULT     |
+-------------------------------------------------------------+
```

## Action Specs

### `selectDriveFile` (`playwright/extension/actions/select-drive-file.js`)
- **Module Interface**: `window.AIStudioActions.selectDriveFile(filePathOrName, options)`
- **Behavior**:
  - Extracts basename from input path (e.g., `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_01.mp4` -> `WV-FILM-20260811-CTBB_part_01`).
  - Finds matching file option item in Drive Picker DOM (`[role="option"].picker-grid-item`, `.picker-grid-item-title`, `[aria-label*="${cleanBasename}"]`).
  - **If Found**:
    - Dispatches click, pointerdown, mousedown, pointerup, mouseup, and `dblclick` events.
    - If Select/Insert button (`.picker-button-active`, `[aria-label="Select"]`, `div[role="button"]:has-text("Select")`) is present and enabled, clicks it.
    - Waits up to 10 seconds for the picker iframe modal to close (`iframe[src*="picker"]` hidden/removed).
    - Returns `{ success: true, action: 'selectDriveFile', fileAttached: true, fileName: cleanBasename, timestamp: number }`.
  - **If NOT Found**:
    - Returns `{ success: true, action: 'selectDriveFile', fileAttached: false, reason: 'FILE_NOT_FOUND', timestamp: number }`.
