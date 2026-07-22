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
    'ms-run-button button',
    'button.ctrl-enter-submits',
    'button:has-text("Run Ctrl")',
    'ms-prompt-input button:has-text("Run")',
    'button:has-text("Run")',
    'button[aria-label*="Run"]',
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

    // Check for immediate errors during token calc
    const earlyError = page.locator('text=/An internal error has occurred|Error querying Drive|Failed to generate content|permission denied|Quota exceeded/i').first();
    if (await earlyError.isVisible().catch(() => false)) {
      const errTxt = await earlyError.innerText().catch(() => 'Error in Google AI Studio');
      throw new Error(`GOOGLE_AI_STUDIO_QUOTA_ERROR: ${errTxt}`);
    }

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

  console.log('⏳ Polling AI Model response dynamically until `"status": "Done"` is rendered...\n');
  await page.waitForTimeout(3000);

  // 4. Wait dynamically for AI model generation completion (Polling specifically for "status": "Done")
  const generationStartTime = Date.now();
  let rawResponse = '';

  while (Date.now() - generationStartTime < maxTimeout) {
    await dismissPopups(page).catch(() => { });

    // Check if error toast banner or inline model error appeared
    const internalError = page.locator('text=/An internal error has occurred|Error querying Drive|Failed to generate content|permission denied|Quota exceeded/i').first();
    if (await internalError.isVisible().catch(() => false)) {
      const errTxt = await internalError.innerText().catch(() => 'An internal error has occurred in Google AI Studio.');
      throw new Error(`GOOGLE_AI_STUDIO_QUOTA_ERROR: AI Studio Error Detected ("${errTxt}").`);
    }

    // Inspect Model turn output
    let modelText = '';
    const modelTurn = page.locator('ms-chat-turn').filter({ hasText: /Model/i }).last();

    if (await modelTurn.isVisible().catch(() => false)) {
      modelText = await modelTurn.innerText().catch(() => '');
    }

    if (!modelText) {
      const responseBubbles = page.locator('.model-response, ms-response-bubble, code, pre');
      const count = await responseBubbles.count().catch(() => 0);
      if (count > 0) {
        modelText = await responseBubbles.last().innerText().catch(() => '');
      }
    }

    const elapsed = Math.round((Date.now() - generationStartTime) / 1000);
    const hasDoneStatus = /"status"\s*:\s*"(?:Done|done)"/i.test(modelText);

    if (hasDoneStatus) {
      rawResponse = modelText;
      console.log(`\n✅ AI Model generation completed! Detected "status": "Done" in ${elapsed} seconds.`);
      break;
    }

    // Fallback: If stop button disappeared and model text has valid content
    const stopBtn = page.locator('button:has-text("Stop"), button[aria-label*="Stop"]').first();
    const isStopVisible = await stopBtn.isVisible().catch(() => false);

    if (!isStopVisible && elapsed > 8 && modelText.trim().length > 100) {
      rawResponse = modelText;
      console.log(`\n✅ AI Model generation completed (Stop button disappeared after ${elapsed}s).`);
      break;
    }

    await page.waitForTimeout(1500);
  }

  if (!rawResponse.trim()) {
    rawResponse = await page.evaluate(() => document.body.innerText).catch(() => '');
  }

  // Check if response contains Google AI Studio error
  if (/an internal error has occurred|error querying drive|permission denied|failed to generate content/i.test(rawResponse)) {
    throw new Error('GOOGLE_AI_STUDIO_QUOTA_ERROR: An internal error has occurred in Google AI Studio response.');
  }

  // 5. Clean & Extract Raw JSON string
  let cleanedOutput = rawResponse.trim();
  const jsonBlockMatch = cleanedOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    cleanedOutput = jsonBlockMatch[1].trim();
  } else {
    const objectMatch = cleanedOutput.match(/(\{[\s\S]*"status"\s*:\s*"(?:Done|done)"[\s\S]*?\})/i) ||
                        cleanedOutput.match(/(\{[\s\S]*\})/);
    if (objectMatch && objectMatch[1]) {
      cleanedOutput = objectMatch[1].trim();
    }
  }

  // 6. Convert to JSON object & Validate against UI Schema Rules
  console.log('🔄 Converting raw output to JSON object & validating schema (UI Rules)...');
  let parsedObject: any = null;

  try {
    parsedObject = JSON.parse(cleanedOutput);
  } catch (err: any) {
    throw new Error(`Failed to parse extracted AI output as JSON: ${err.message}`);
  }

  if (!parsedObject.script_blocks || !Array.isArray(parsedObject.script_blocks)) {
    throw new Error('Analysis JSON Validation Error: Missing or invalid "script_blocks" array.');
  }

  if (parsedObject.script_blocks.length === 0) {
    throw new Error('Analysis JSON Validation Error: "script_blocks" array must have at least 1 entry.');
  }

  for (let i = 0; i < parsedObject.script_blocks.length; i++) {
    const block = parsedObject.script_blocks[i];
    if (block.id === undefined || block.id === null) {
      throw new Error(`Analysis JSON Validation Error: Block index #${i} is missing an "id".`);
    }
    if (!block.narration || typeof block.narration !== 'string' || !block.narration.trim()) {
      throw new Error(`Analysis JSON Validation Error: Block #${block.id} is missing a valid "narration" string.`);
    }
  }

  console.log(`✅ JSON successfully parsed and validated against UI rules!`);
  console.log(`   └─ Script Blocks: ${parsedObject.script_blocks.length}`);
  console.log(`   └─ Estimated Words: ${parsedObject.total_estimated_words || 'N/A'}`);
  console.log(`   └─ Status: ${parsedObject.status || 'Done'}`);

  // Format clean JSON string for saving
  const formattedJsonString = JSON.stringify(parsedObject, null, 2);

  // 7. Determine output file path & save
  const defaultOutputPath = path.resolve('input/assets', `${state.content_id}_analysis_result.json`);
  const outputPath = options.outputFilePath || defaultOutputPath;

  // Save analysis output file
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, formattedJsonString, 'utf-8');

  // Also save to input/analysis.json for UI auto-sync
  const uiAnalysisPath = path.resolve('input/analysis.json');
  fs.writeFileSync(uiAnalysisPath, formattedJsonString, 'utf-8');

  console.log(`🎉 Validated Analysis JSON saved to: ${outputPath}`);
  console.log(`📌 Synced with UI at: ${uiAnalysisPath}`);

  // Update state.json
  updateStateResource('analysis_result', outputPath);

  return formattedJsonString;
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
