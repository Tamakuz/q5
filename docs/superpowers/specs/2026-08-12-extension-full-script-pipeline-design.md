# AI Studio Extension - Full Script Generation Pipeline Design

## Goal
Construct an end-to-end full script generation pipeline using Chrome Extension actions that:
1. Inputs/pastes prompt into Google AI Studio editor.
2. Opens Google Drive media picker modal.
3. Searches for the target video file in Google Drive.
4. Attaches from Drive if found; falls back to uploading local file if not found.
5. Submits prompt to AI once attachment chip settles.
6. Waits for AI streaming response completion (excluding thinking text).
7. Validates response (plain text + JSON payload) and saves output to `input/alurfilm/`.

## Architectural Sequence

```
+---------------------------------------------------------------------------------+
| Full Script Generation Pipeline (test-pipeline-full-script.ts)                  |
|                                                                                 |
|  [Step 1: Input Prompt]                                                         |
|     └── execAction('inputPrompt', { text: promptContent })                     |
|                                                                                 |
|  [Step 2: Open Drive Picker]                                                    |
|     └── execAction('openDrivePicker')                                           |
|                                                                                 |
|  [Step 3: Search & Attach/Upload Video]                                         |
|     ├── execAction('searchDriveFile', { promptText: videoPath })                |
|     ├── execAction('selectDriveFile', { promptText: videoPath })                |
|     └── IF (fileAttached === false):                                            |
|            ├── execAction('prepareLocalUpload')                                 |
|            ├── setInputFiles(localVideoPath)                                    |
|            └── execAction('waitLocalUploadComplete')                            |
|                                                                                 |
|  [Step 4: Submit Prompt]                                                        |
|     └── execAction('submitPrompt')                                              |
|                                                                                 |
|  [Step 5: Extract AI Output]                                                    |
|     └── execAction('extractOutput', { timeout: 180000 })                        |
|                                                                                 |
|  [Step 6: Validate & Save Result]                                               |
|     ├── Extracts plain text narration & parses embedded JSON                    |
|     └── Writes output to input/alurfilm/<file_basename>_script.json             |
+---------------------------------------------------------------------------------+
```

## Detailed Component Specifications

### 1. Output Validation & Saving (`playwright/extension/utils/save-script-output.ts`)
- **Inputs**: Raw AI response string, target video filename.
- **Processing**:
  - Extracts markdown code blocks (````json ... ````) or raw JSON payloads.
  - Validates JSON structure containing required script fields (`title`, `hook`, `narration`, `scenes` / `dialogues`).
  - Writes output file to `input/alurfilm/<basename>_script.json` and `input/alurfilm/<basename>_script.txt`.
- **Outputs**: Path to generated script files, validation status (`validJson: boolean`).

### 2. Full Pipeline Test Runner (`playwright/extension/tests/test-pipeline-full-script.ts`)
- Executes the complete 6-step workflow.
- Verifies every action result payload.
- Confirms output file creation in `input/alurfilm/`.
