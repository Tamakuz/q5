# AI Studio Pure Chrome Extension Automation Design

## Goal
To eliminate all Playwright DOM manipulation from the Google AI Studio automation pipeline. Playwright serves solely as a browser process launcher (loading the Chrome Extension with persistent profile) and an event trigger/listener. 100% of DOM manipulation (typing prompts, handling drive media picker, double-clicking files, submitting prompts, and streaming output extraction) is executed autonomously inside the Chrome Extension content script running in the main page context (`"world": "MAIN"`).

## Problem Statement
Automating Google AI Studio via synthetic Playwright CDP/DOM automation events can trigger bot detection mechanisms or strict mode selector failures. By offloading all DOM operations to a Chrome Extension running natively inside the browser context, execution resembles native human user interactions on the page.

## System Architecture

```
+-------------------------------------------------------------+
| Playwright Test Runner (test-pure-extension.ts / aistudio.ts)|
|  1. Launch Chromium with --load-extension                     |
|  2. Open https://aistudio.google.com/prompts/new_chat       |
|  3. Send EXECUTE_AI_STUDIO_JOB via window.postMessage       |
|  4. Poll window.__AI_STUDIO_JOB_RESULT until complete        |
+------------------------------+------------------------------+
                               | postMessage / Window context
                               v
+-------------------------------------------------------------+
| Chrome Extension ("world": "MAIN")                           |
|  - manifest.json: injects content scripts into AI Studio    |
|  - content.js: listens for EXECUTE_AI_STUDIO_JOB            |
|  - pipelines/aistudio-pipeline.js (Orchestrator):            |
|      Step 1: dismissModals()                                |
|      Step 2: inputPrompt(prompt)                            |
|      Step 3: attachDriveFile(driveFileName)                 |
|      Step 4: submitAndExtract(timeoutMs)                    |
|  - actions/                                                 |
|      * dismiss-modals.js                                    |
|      * input-prompt.js                                      |
|      * attach-drive.js                                      |
|      * upload-file.js                                       |
|      * submit-and-extract.js                                |
+-------------------------------------------------------------+
```

## Detailed Component Design

### 1. Playwright Test Runner (`playwright/test-pure-extension.ts` & `playwright/aistudio.ts`)
- **Responsibilities**:
  - Launch Chromium using `chromium.launchPersistentContext()` with `--disable-extensions-except=playwright/extension` and `--load-extension=playwright/extension`.
  - Navigate to Google AI Studio URL.
  - Dispatch job payload via `page.evaluate()` sending `window.postMessage({ type: 'EXECUTE_AI_STUDIO_JOB', driveFileName, prompt, timeoutMs }, '*')`.
  - Poll `window.__AI_STUDIO_JOB_RESULT` until finished or timed out.
  - Log results to console.
- **Constraints**:
  - No `page.locator()`, `page.click()`, `page.fill()`, `page.getByRole()`, or any other direct Playwright DOM calls.

### 2. Extension Pipeline Orchestrator (`playwright/extension/pipelines/aistudio-pipeline.js`)
- Runs sequentially:
  1. `dismissModals()` to clear initial overlays/popups.
  2. `inputPrompt(prompt)` to set prompt text in `ms-prompt-editor` / `textarea`.
  3. `attachDriveFile(driveFileName)` to open Media Picker (+ button -> Drive), search `driveFileName`, select/double-click file item, or switch to upload tab fallback if missing.
  4. `submitAndExtract(timeoutMs)` to click Run button and stream-extract Gemini response text (filtering out thinking nodes).

### 3. Extension Action Modules (`playwright/extension/actions/`)
- **`dismiss-modals.js`**: Selects and clicks dismiss/close buttons on callout containers.
- **`input-prompt.js`**: Locates editor elements, populates text, dispatches `focus`, `input`, `change` events.
- **`attach-drive.js`**: Interacts with the `picker` iframe DOM natively to search and select Drive assets.
- **`upload-file.js`**: Switches tab inside picker iframe if upload fallback is needed.
- **`submit-and-extract.js`**: Clicks Run button and polls `ms-chat-turn` elements for response.

## Verification Plan
1. Run `npx tsx playwright/test-pure-extension.ts "WV-FILM-20260811-CTBB_part_01"` to verify full pipeline execution via Chrome Extension without any Playwright DOM calls.
2. Verify console logs indicate 100% Extension Action logs (`[Extension Action]`, `[Extension Pipeline]`) and zero Playwright DOM locator actions.
