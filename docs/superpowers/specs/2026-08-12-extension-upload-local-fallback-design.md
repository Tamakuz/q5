# AI Studio Extension - Upload Local File Fallback Design

## Goal
Implement a modular Chrome Extension action (`upload-local-file.js`) and Playwright test runner (`test-action-pipeline-drive-fallback.ts`) that handles uploading a local file (e.g. `input/alurfilm/compress/WV-FILM-20260811-CTBB_part_04.mp4`) via the Drive Picker modal 'Upload' tab when the file is not found in Google Drive.

## System Architecture

```
+--------------------------------------------------------------------------+
| Playwright Test Runner (test-action-pipeline-drive-fallback.ts)          |
|  1. openDrivePicker                                                      |
|  2. searchDriveFile ("WV-FILM-20260811-CTBB_part_04.mp4")                 |
|  3. selectDriveFile                                                      |
|      - If fileFound: double-clicks item & attaches (DONE)               |
|      - If NOT fileFound: returns fileAttached: false                    |
|  4. IF fileAttached === false:                                           |
|      a. Dispatch prepareLocalUpload action (switches to Upload tab)      |
|      b. Playwright injects local file into pickerFrame input[type="file"]|
|      c. Dispatch waitLocalUploadComplete action (waits for upload & attach)|
+------------------------------------+-------------------------------------+
                                     | window.postMessage
                                     v
+--------------------------------------------------------------------------+
| Chrome Extension ("world": "MAIN", all_frames: true)                      |
|  - actions/upload-local-file.js:                                         |
|      1. Clicks 'Back' button if in search mode                            |
|      2. Clicks 'Upload' tab button                                       |
|      3. Verifies input[type="file"] readiness                            |
|      4. Monitors progress dialog/bar until upload completes               |
|      5. Confirms Insert/Select button and modal closing                  |
+--------------------------------------------------------------------------+
```

## Detailed Workflow Specifications

### 1. `prepareLocalUpload` (`upload-local-file.js`)
- **Module Interface**: `window.AIStudioActions.prepareLocalUpload(filePath, options)`
- **Behavior**:
  - Clicks 'Back' button if currently in search mode (`[aria-label*="Back" i]`, `button:has-text("Back")`).
  - Clicks 'Upload' tab button (`button[role="tab"]` containing text "Upload").
  - Verifies `<input type="file">` is present in DOM.
  - Returns `{ success: true, action: 'prepareLocalUpload', readyForFiles: true, timestamp: number }`.

### 2. `waitLocalUploadComplete` (`upload-local-file.js`)
- **Module Interface**: `window.AIStudioActions.waitLocalUploadComplete(filePath, options)`
- **Behavior**:
  - Monitors upload progress bar (`[role="progressbar"]`, `.picker-upload-progress`) until hidden or done.
  - Clicks "Insert" / "Select" button if active in Drive Picker modal.
  - Waits up to 30 seconds for picker modal iframe to close / disappear and media chip to settle in prompt editor.
  - Returns `{ success: true, action: 'waitLocalUploadComplete', fileAttached: true, fileName: basename, timestamp: number }`.
