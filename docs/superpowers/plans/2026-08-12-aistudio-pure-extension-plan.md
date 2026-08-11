# Pure Chrome Extension AI Studio Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure 100% of Google AI Studio DOM manipulation is executed by the Chrome Extension content script, leaving Playwright strictly as a browser launcher and event listener.

**Architecture:** Playwright launches Chromium with `--load-extension`, navigates to Google AI Studio, sends `EXECUTE_AI_STUDIO_JOB` via `window.postMessage`, and waits for `window.__AI_STUDIO_JOB_RESULT`. The Chrome Extension content script (`"world": "MAIN"`) executes the modular actions and pipeline entirely inside the browser page DOM context.

**Tech Stack:** TypeScript, Playwright (launch & message bridge only), Vanilla JavaScript (Chrome Extension Content Scripts Manifest V3).

## Global Constraints
- Zero Playwright DOM locator/interaction calls in AI Studio scripts (`no locator.click()`, `no locator.fill()`, `no getByRole()`).
- 100% DOM operations encapsulated inside `playwright/extension/actions/` and `playwright/extension/pipelines/`.
- Single dispatch job mechanism using `window.postMessage`.

---

### Task 1: Refactor `playwright/test-pure-extension.ts` to be a 100% Pure Extension Runner

**Files:**
- Modify: [playwright/test-pure-extension.ts](file:///home/jovan/project/content-auto/playwright/test-pure-extension.ts)

**Interfaces:**
- Consumes: Chrome Extension injected `window.postMessage({ type: 'EXECUTE_AI_STUDIO_JOB', ... })` and `window.__AI_STUDIO_JOB_RESULT`
- Produces: Clean execution logs without any Playwright DOM interaction.

- [ ] **Step 1: Inspect `test-pure-extension.ts` and strip Playwright DOM actions**
  Remove imports of `attachDriveFileAction` from `./actions/aistudio/attach-drive-file`.
  Replace multi-step Playwright page operations with single Extension job dispatch via `window.postMessage`.

- [ ] **Step 2: Implement postMessage trigger and result polling in `test-pure-extension.ts`**
  ```typescript
  console.log(`🚀 Triggering Extension Pipeline...`);
  await page.evaluate(({ driveFileName, promptText }) => {
    window.postMessage({
      type: 'EXECUTE_AI_STUDIO_JOB',
      driveFileName,
      prompt: promptText,
      timeoutMs: 90000
    }, '*');
  }, { driveFileName, promptText });

  const startTime = Date.now();
  let result: any = null;
  while (Date.now() - startTime < 120000) {
    await new Promise(r => setTimeout(r, 1000));
    if (page.isClosed()) break;
    result = await page.evaluate(() => (window as any).__AI_STUDIO_JOB_RESULT).catch(() => null);
    if (result && (result.success || result.error)) break;
  }
  ```

- [ ] **Step 3: Run `npx tsx playwright/test-pure-extension.ts` to test clean execution**
  Verify it runs without Playwright DOM errors.

---

### Task 2: Refactor `playwright/aistudio.ts` to delegate all operations to Extension

**Files:**
- Modify: [playwright/aistudio.ts](file:///home/jovan/project/content-auto/playwright/aistudio.ts)

**Interfaces:**
- Consumes: Playwright browser launcher with Extension loaded
- Produces: Main AI Studio entry point delegates to Chrome Extension.

- [ ] **Step 1: Replace Playwright action calls in `aistudio.ts` with Extension trigger**
  Remove `warmupAIStudioSessionAction`, `inputPromptAction`, `attachDriveFileAction`, `uploadLocalFileAction`, `submitAndExtractAction` calls.
  Replace with Extension launch & dispatch flow.

- [ ] **Step 2: Verify `npx tsx playwright/aistudio.ts --hello`**
  Ensure main entry point executes through Chrome Extension.

---

### Task 3: Verify & Refine Extension Actions for Edge Cases

**Files:**
- Modify: [playwright/extension/actions/attach-drive.js](file:///home/jovan/project/content-auto/playwright/extension/actions/attach-drive.js)
- Modify: [playwright/extension/actions/input-prompt.js](file:///home/jovan/project/content-auto/playwright/extension/actions/input-prompt.js)
- Modify: [playwright/extension/pipelines/aistudio-pipeline.js](file:///home/jovan/project/content-auto/playwright/extension/pipelines/aistudio-pipeline.js)

**Interfaces:**
- Consumes: DOM elements in Google AI Studio page & Google Drive picker iframe
- Produces: `window.AIStudioActions` and `window.AIStudioPipelines`

- [ ] **Step 1: Ensure `input-prompt.js` handles both `contenteditable` and `textarea` Angular events**
- [ ] **Step 2: Ensure `attach-drive.js` robustly queries picker iframe and performs native double click**
- [ ] **Step 3: Test full end-to-end flow with `npx tsx playwright/test-pure-extension.ts`**
