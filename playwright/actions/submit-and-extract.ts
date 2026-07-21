// playwright/actions/submit-and-extract.ts
import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { loadProjectState, updateStateResource } from '../../lib/state';
import { dismissPopups } from '../aistudio';

export interface SubmitOptions {
  timeoutMs?: number;
  outputFilePath?: string;
}

/**
 * Action 3: Wait for token calculation to complete -> Click enabled "Run" button -> Extract AI response JSON
 */
export async function submitAndExtract(
  page: Page,
  options: SubmitOptions = {}
): Promise<string> {
  const state = loadProjectState();
  const maxTimeout = options.timeoutMs || 180000; // 3 minutes max for token calc + generation

  console.log('\n🚀 [Action 3] Preparing to Submit Prompt to AI Studio...');

  // Check & click dynamic popups ("Continue", etc.) before checking Run button
  await dismissPopups(page);

  // 1. Locate Run Button inside prompt bar area
  const runButtonSelectors = [
    'button:has-text("Run Ctrl")',
    'ms-prompt-input button:has-text("Run")',
    'button:has-text("Run")',
    'button[aria-label*="Run"]',
    'ms-run-button button',
  ];

  let runBtn = null;
  for (const sel of runButtonSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
      runBtn = loc;
      console.log(`🔍 Found "Run" button using selector: ${sel}`);
      break;
    }
  }

  if (!runBtn) {
    runBtn = page.locator('button').filter({ hasText: /Run/i }).first();
  }

  if (!(await runBtn.isVisible({ timeout: 10000 }).catch(() => false))) {
    throw new Error('Could not locate "Run" button in AI Studio prompt area.');
  }

  // 2. Wait for "Run" button to become ENABLED (token calculation complete)
  console.log('⏳ Waiting for Google AI Studio token calculation to finish...');
  console.log('⏳ Waiting for "Run Ctrl ↵" button to become ENABLED (not disabled)...');

  const startTime = Date.now();
  let isEnabled = false;

  while (Date.now() - startTime < maxTimeout) {
    await dismissPopups(page).catch(() => { });

    const isDisabledAttr = await runBtn.getAttribute('disabled').catch(() => null);
    const ariaDisabled = await runBtn.getAttribute('aria-disabled').catch(() => null);
    const hasDisabledClass = await runBtn.evaluate((el: HTMLElement) => el.classList.contains('disabled')).catch(() => false);
    const nativeDisabled = await runBtn.isDisabled().catch(() => true);

    if (isDisabledAttr === null && ariaDisabled !== 'true' && !hasDisabledClass && !nativeDisabled) {
      isEnabled = true;
      break;
    }

    await page.waitForTimeout(1500);
  }

  if (!isEnabled) {
    throw new Error('Timed out waiting for "Run" button to become enabled after video token calculation.');
  }

  console.log('✅ Token calculation complete! "Run" button is now ENABLED.');
  await page.waitForTimeout(1000);

  // 3. Click the "Run" button & press Ctrl+Enter
  console.log('🔘 Triggering Run (Clicking "Run Ctrl ↵" button)...');

  // Focus prompt input textarea first
  const textarea = page.locator('textarea, [contenteditable="true"]').first();
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.focus().catch(() => { });
  }

  let clicked = false;
  for (const sel of runButtonSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      try {
        await loc.click({ force: true });
        clicked = true;
        console.log(`✅ Clicked Run button using selector: ${sel}`);
        break;
      } catch { }
    }
  }

  if (!clicked) {
    console.log('ℹ️ Triggering keyboard shortcut fallback: Ctrl+Enter...');
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('Control+Return');
  }

  console.log('⏳ Waiting for Gemini AI model response generation...');
  await page.waitForTimeout(5000);

  // 4. Wait for generation to complete (Wait until Stop/Cancel button disappears)
  const generationStartTime = Date.now();
  let generationFinished = false;

  while (Date.now() - generationStartTime < maxTimeout) {
    await dismissPopups(page).catch(() => { });

    // Check if error toast banner appeared
    const toastError = page.locator('text=/Failed to generate content|permission denied|Quota exceeded/i').first();
    if (await toastError.isVisible().catch(() => false)) {
      const errorMsg = await toastError.innerText().catch(() => 'Failed to generate content');
      throw new Error(`GOOGLE_AI_STUDIO_QUOTA_ERROR: ${errorMsg}`);
    }

    const stopBtn = page.locator('button:has-text("Stop"), button[aria-label*="Stop"]').first();
    const isStopVisible = await stopBtn.isVisible().catch(() => false);

    if (!isStopVisible) {
      generationFinished = true;
      break;
    }

    await page.waitForTimeout(2500);
  }

  console.log('✅ AI Model generation completed!');
  await page.waitForTimeout(2000);

  // 5. Extract Model response content
  console.log('📥 Extracting response content from AI Studio chat...');

  let rawResponse = '';
  const modelTurn = page.locator('ms-chat-turn').filter({ hasText: /Model/i }).last();

  if (await modelTurn.isVisible({ timeout: 3000 }).catch(() => false)) {
    rawResponse = await modelTurn.innerText().catch(() => '');
  }

  if (!rawResponse.trim()) {
    const responseSelectors = [
      'ms-chat-turn:last-child .model-response',
      'ms-response-bubble:last-child',
      '.model-response-text',
    ];

    for (const sel of responseSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        rawResponse = await loc.innerText().catch(() => '');
        if (rawResponse.trim().length > 0) {
          console.log(`🎯 Extracted response using selector: ${sel}`);
          break;
        }
      }
    }
  }

  if (!rawResponse.trim()) {
    rawResponse = await page.evaluate(() => document.body.innerText).catch(() => '');
  }

  // Check if response contains Google AI Studio error
  if (/an internal error has occurred|permission denied|failed to generate content/i.test(rawResponse)) {
    throw new Error('GOOGLE_AI_STUDIO_QUOTA_ERROR: An internal error has occurred in Google AI Studio response.');
  }

  // Parse out JSON content between ```json ... ``` or { ... }
  let cleanedOutput = rawResponse.trim();
  const jsonBlockMatch = cleanedOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    cleanedOutput = jsonBlockMatch[1].trim();
  } else {
    const objectMatch = cleanedOutput.match(/(\{[\s\S]*\})/);
    if (objectMatch && objectMatch[1]) {
      cleanedOutput = objectMatch[1].trim();
    }
  }

  // Determine output file path
  const defaultOutputPath = path.resolve('input/assets', `${state.content_id}_analysis_result.json`);
  const outputPath = options.outputFilePath || defaultOutputPath;

  // Save analysis output file
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, cleanedOutput, 'utf-8');

  console.log(`🎉 AI Response saved to: ${outputPath}`);

  // Update state.json
  updateStateResource('analysis_result', outputPath);

  return cleanedOutput;
}

// ─── Direct CLI Runner for testing ─────────────────────

if (require.main === module || process.argv[1]?.endsWith('submit-and-extract.ts')) {
  const program = new Command();
  program
    .name('aistudio:submit')
    .description('Action 3: Submit prompt, wait for token calculation, and extract response')
    .option('-o, --output <string>', 'Path to save output JSON')
    .action(async (opts) => {
      const { launchAIStudioSession } = await import('../aistudio');
      const { page } = await launchAIStudioSession({ headless: false });
      try {
        await submitAndExtract(page, { outputFilePath: opts.output });
        console.log('🎉 Action 3 completed!');
      } catch (err: any) {
        console.error(`❌ Submit Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
