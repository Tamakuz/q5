# Extension Submit Prompt & Extract Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `submitPrompt` and `extractOutput` actions in the Chrome Extension, update `manifest.json` & `content.js` router, and create a 3-action collaboration test runner `test-action-pipeline.ts`.

**Architecture:** The extension content script (`"world": "MAIN"`) receives `window.postMessage` action requests and executes `submitPrompt` and `extractOutput` directly inside the AI Studio web page context. A Playwright test runner triggers the full sequence and asserts that the response text is retrieved.

**Tech Stack:** TypeScript, Playwright (launch & verification bridge), Vanilla JavaScript (Chrome Extension Manifest V3).

## Global Constraints
- Zero Playwright DOM locators in action logic.
- 100% DOM manipulation encapsulated inside Chrome Extension action scripts (`playwright/extension/actions/`).

---

### Task 1: Create Extension Actions (`submit-prompt.js` & `extract-output.js`) and Update Manifest & Router

**Files:**
- Create: [playwright/extension/actions/submit-prompt.js](file:///home/jovan/project/content-auto/playwright/extension/actions/submit-prompt.js)
- Create: [playwright/extension/actions/extract-output.js](file:///home/jovan/project/content-auto/playwright/extension/actions/extract-output.js)
- Modify: [playwright/extension/manifest.json](file:///home/jovan/project/content-auto/playwright/extension/manifest.json)
- Modify: [playwright/extension/content.js](file:///home/jovan/project/content-auto/playwright/extension/content.js)

**Interfaces:**
- Consumes: `window.postMessage` action requests for `submitPrompt` and `extractOutput`.
- Produces: `window.AIStudioActions.submitPrompt` and `window.AIStudioActions.extractOutput`.

- [ ] **Step 1: Create `playwright/extension/actions/submit-prompt.js`**
  Implement `window.AIStudioActions.submitPrompt` with non-disabled Run button polling and click dispatching.

- [ ] **Step 2: Create `playwright/extension/actions/extract-output.js`**
  Implement `window.AIStudioActions.extractOutput` with generation completion polling and text extraction.

- [ ] **Step 3: Update `manifest.json` and `content.js`**
  Add `submit-prompt.js` and `extract-output.js` to `manifest.json` content script array. Ensure `content.js` router routes options properly.

---

### Task 2: Create Collaboration Test Runner (`playwright/extension/tests/test-action-pipeline.ts`) & Execute Verification

**Files:**
- Create: [playwright/extension/tests/test-action-pipeline.ts](file:///home/jovan/project/content-auto/playwright/extension/tests/test-action-pipeline.ts)

**Interfaces:**
- Consumes: Stealth Playwright browser with Chrome Extension loaded.
- Produces: Full 3-action sequence execution and verification.

- [ ] **Step 1: Create `test-action-pipeline.ts`**
  Write script that executes `inputPrompt` -> `submitPrompt` -> `extractOutput` sequentially via `postMessage`.

- [ ] **Step 2: Execute `npx tsx playwright/extension/tests/test-action-pipeline.ts`**
  Run test script and verify output text is successfully extracted from AI Studio.
