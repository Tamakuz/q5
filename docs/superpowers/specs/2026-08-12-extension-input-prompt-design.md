# AI Studio Chrome Extension - Input Prompt Action & Per-Action Testing Architecture

## Goal
Implement a modular Chrome Extension action (`input-prompt.js`) that pastes/inputs prompt text into Google AI Studio without relying on Playwright DOM locators. Establish a dedicated per-action testing architecture starting with `input-prompt`, ensuring every extension action can be tested and verified independently.

## Problem Statement
Using Playwright DOM locators directly on Google AI Studio can be brittle or susceptible to bot detection. Offloading DOM actions to a Chrome Extension (`"world": "MAIN"`) running natively inside the web page context ensures actions are executed smoothly. To guarantee reliability, each action must be independently testable via its own test runner before being orchestrated in full pipelines.

## System Architecture

```
+------------------------------------------------------------+
| Playwright Per-Action Test Runner                          |
| (playwright/extension/tests/test-action-input-prompt.ts)  |
|  1. Launch Chromium with persistent profile & extension    |
|  2. Open https://aistudio.google.com/prompts/new_chat      |
|  3. Dispatch action request via window.postMessage:        |
|     { type: 'EXECUTE_ACTION', action: 'inputPrompt', ... } |
|  4. Poll window.__ACTION_RESULT / listen for response      |
|  5. Assert prompt text exists in AI Studio editor DOM      |
+-----------------------------+------------------------------+
                              | window.postMessage
                              v
+------------------------------------------------------------+
| Chrome Extension ("world": "MAIN")                          |
|  - manifest.json: injects content.js into AI Studio        |
|  - content.js: receives postMessage & routes to action     |
|  - actions/input-prompt.js:                                |
|      1. Inspects & locates prompt editor DOM elements      |
|         (ms-prompt-editor, textarea, [contenteditable])    |
|      2. Focuses and populates prompt text                  |
|      3. Dispatches native Angular/Lit events (focus,       |
|         input, change, keydown)                            |
|      4. Returns status payload to window.__ACTION_RESULT   |
+------------------------------------------------------------+
```

## Detailed Module Specs

### 1. Chrome Extension Action (`playwright/extension/actions/input-prompt.js`)
- **Module Interface**: `window.AIStudioActions.inputPrompt(promptText, options)`
- **DOM Selector Fallbacks**:
  1. `ms-prompt-editor [contenteditable="true"]`
  2. `ms-prompt-editor textarea`
  3. `textarea[placeholder*="prompt" i]`
  4. `div[contenteditable="true"]`
- **Event Dispatching**:
  - Focuses target element.
  - Sets `.value` (for `HTMLInputElement`/`HTMLTextAreaElement`) or `.innerText` / `.textContent` (for `contenteditable`).
  - Dispatches `focus`, `input`, `change`, and `blur` events with `bubbles: true` to trigger Angular/Lit reactivity.
- **Return Value**:
  - `{ success: true, action: 'inputPrompt', textLength: number, timestamp: number }`

### 2. Chrome Extension Content Router (`playwright/extension/content.js`)
- Runs in `"world": "MAIN"` at `document_end`.
- Exposes `window.__ACTION_RESULT = null`.
- Listens to `window.addEventListener('message', ...)`:
  - Validates `event.data.type === 'EXECUTE_ACTION'`.
  - Executes specified action (e.g. `inputPrompt`).
  - Writes result to `window.__ACTION_RESULT` and posts message `{ type: 'ACTION_RESULT', ... }`.

### 3. Per-Action Test Runner (`playwright/extension/tests/test-action-input-prompt.ts`)
- **Purpose**: Test only the `inputPrompt` action in isolation.
- **Flow**:
  1. Launch persistent browser with `--load-extension=playwright/extension`.
  2. Navigate to Google AI Studio prompt creation page.
  3. Evaluate `window.postMessage` with test prompt payload.
  4. Wait for `window.__ACTION_RESULT`.
  5. Verify editor DOM content match.
  6. Output structured log: `[TEST PASS] inputPrompt action successfully verified.`

## Verification Plan
1. Run `npx tsx playwright/extension/tests/test-action-input-prompt.ts`
2. Assert browser launches, loads extension, triggers `inputPrompt`, and successfully fills editor.
3. Confirm test output displays `[TEST PASS]`.
