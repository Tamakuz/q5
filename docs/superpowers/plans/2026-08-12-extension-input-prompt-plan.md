# Extension Input Prompt Action & Per-Action Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Chrome Extension `input-prompt.js` action and `content.js` message router, along with an isolated per-action test runner (`test-action-input-prompt.ts`) to test pasting prompts into Google AI Studio.

**Architecture:** The Chrome Extension content script (`"world": "MAIN"`) receives action execution requests via `window.postMessage` and executes `inputPromptAction` directly inside the AI Studio page context. Playwright test runner launches the browser with the extension loaded, triggers the action, and asserts that the prompt text is properly inserted into the DOM editor.

**Tech Stack:** TypeScript, Playwright (launch & assertion bridge), Vanilla JavaScript (Chrome Extension Manifest V3).

## Global Constraints
- Zero Playwright DOM locator calls in action logic (`no locator.fill()`, `no locator.click()`).
- All DOM operations encapsulated inside `playwright/extension/actions/input-prompt.js`.
- Per-action testing via dedicated test runner `playwright/extension/tests/test-action-input-prompt.ts`.

---

### Task 1: Create Chrome Extension Action (`playwright/extension/actions/input-prompt.js`) & Content Script (`playwright/extension/content.js`)

**Files:**
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)
- Create: [playwright/extension/actions/input-prompt.js](file:///home/jovan/project/content-auto/playwright/extension/actions/input-prompt.js)
- Create: [playwright/extension/content.js](file:///home/jovan/project/content-auto/playwright/extension/content.js)

**Interfaces:**
- Consumes: Window postMessage `{ type: 'EXECUTE_ACTION', action: 'inputPrompt', payload: { promptText: string, clearFirst?: boolean } }`
- Produces: Window postMessage `{ type: 'ACTION_RESULT', action: 'inputPrompt', success: boolean, textLength: number }` and sets `window.__ACTION_RESULT`

- [ ] **Step 1: Update `manifest.json` to load content.js with "world": "MAIN"**

Ensure `manifest.json` includes `content.js` and `"world": "MAIN"`.

- [ ] **Step 2: Create `playwright/extension/actions/input-prompt.js`**

Implement `window.AIStudioActions.inputPrompt(promptText, options)` with multiple fallback selectors (`ms-prompt-editor [contenteditable="true"]`, `ms-prompt-editor textarea`, `textarea[placeholder*="prompt" i]`, `div[contenteditable="true"]`) and Angular/Lit event dispatching (`focus`, `input`, `change`, `blur`).

- [ ] **Step 3: Create `playwright/extension/content.js`**

Implement the window message listener that dispatches incoming action requests to `window.AIStudioActions[actionName]` and writes results to `window.__ACTION_RESULT`.

---

### Task 2: Create Per-Action Test Runner (`playwright/extension/tests/test-action-input-prompt.ts`)

**Files:**
- Create: [playwright/extension/tests/test-action-input-prompt.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-input-prompt.ts)

**Interfaces:**
- Consumes: `launchBrowser()` with stealth persistent context and Chrome Extension loaded.
- Produces: Execution output verifying `inputPrompt` action succeeds on AI Studio.

- [ ] **Step 1: Write `test-action-input-prompt.ts`**

Implement Playwright script that:
1. Calls `launchBrowser({ headed: true })`.
2. Navigates to `https://aistudio.google.com/prompts/new_chat`.
3. Dispatches `window.postMessage({ type: 'EXECUTE_ACTION', action: 'inputPrompt', payload: { promptText: 'Hello AI Studio Extension Test!' } })`.
4. Polls `window.__ACTION_RESULT` until finished.
5. Verifies editor DOM element content matches input text.
6. Prints structured `[TEST PASS]` log.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-input-prompt.ts`**

Run test command and verify clean PASS output.
