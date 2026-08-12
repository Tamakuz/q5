# AI Studio Extension - Submit Prompt & Extract Output Actions Design

## Goal
Implement two new Chrome Extension actions (`submit-prompt.js` and `extract-output.js`) and update `manifest.json` & `content.js` router. Create a collaboration test runner (`test-action-pipeline.ts`) to test the 3-action sequence (`inputPrompt` -> `submitPrompt` -> `extractOutput`) end-to-end inside the extension DOM context.

## Problem Statement
After inputting prompt text into Google AI Studio, the pipeline requires triggering the submit button (Run button when enabled) and waiting for/reading the generated output stream from the DOM without using Playwright DOM locators.

## System Architecture

```
+------------------------------------------------------------+
| Playwright Collaboration Test Runner                       |
| (playwright/extension/tests/test-action-pipeline.ts)       |
|                                                            |
| Step 1: Dispatch inputPrompt action                        |
| Step 2: Dispatch submitPrompt action                       |
| Step 3: Dispatch extractOutput action                      |
| Step 4: Verify extracted Gemini response text              |
+-----------------------------+------------------------------+
                              | window.postMessage
                              v
+------------------------------------------------------------+
| Chrome Extension ("world": "MAIN")                          |
|  - manifest.json: injects content scripts                  |
|  - content.js: receives postMessage & routes requests      |
|  - actions/input-prompt.js: inputs prompt text             |
|  - actions/submit-prompt.js: clicks active Run button      |
|  - actions/extract-output.js: waits & extracts output text |
+------------------------------------------------------------+
```

## Action Specs

### 1. `submitPrompt` (`playwright/extension/actions/submit-prompt.js`)
- **Interface**: `window.AIStudioActions.submitPrompt(options)`
- **Selector Fallbacks**:
  - `ms-run-button button:not([disabled])`
  - `button[aria-label*="Run" i]:not([disabled])`
  - `button:has-text("Run"):not([disabled])`
  - `button.run-button:not([disabled])`
- **Logic**:
  - Wait up to `options.timeout || 15000` ms for non-disabled Run button.
  - Hover, focus, and click button.
  - Return `{ success: true, action: 'submitPrompt', timestamp: Date.now() }`.

### 2. `extractOutput` (`playwright/extension/actions/extract-output.js`)
- **Interface**: `window.AIStudioActions.extractOutput(options)`
- **Logic**:
  - Wait up to `options.timeout || 180000` ms for generation to complete (Cancel/Stop button hidden, Run button active again).
  - Locate output elements (`ms-text-chunk`, `div.markdown`, `.chat-turn-content`, `ms-chat-turn`).
  - Clean text of header metadata (`more_vert`, `Model ...`, `Thinking ...`).
  - Return `{ success: true, action: 'extractOutput', text: responseText, length: responseText.length, timestamp: Date.now() }`.

### 3. Collaboration Test Runner (`playwright/extension/tests/test-action-pipeline.ts`)
- Launches stealth browser with Chrome Extension.
- Navigates to AI Studio.
- Executes `inputPrompt` -> `submitPrompt` -> `extractOutput`.
- Verifies output text length > 0 and prints `[TEST PASS]`.
