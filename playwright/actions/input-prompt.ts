// playwright/actions/input-prompt.ts
import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { configureModelAndThinking } from './select-model';

export interface InputPromptOptions {
  promptText?: string;
  promptFilePath?: string;
  modelName?: string;
  thinkingLevel?: 'High' | 'Medium' | 'Low' | 'Off';
}

/**
 * Action 1: Modular input text prompt into Google AI Studio prompt box.
 */
export async function inputTextPrompt(page: Page, options: InputPromptOptions = {}): Promise<void> {
  // Ensure Gemini 3.5 Flash and Thinking Level High are active
  await configureModelAndThinking(page, {
    modelName: options.modelName || 'gemini-3.1-pro-preview',
    thinkingLevel: options.thinkingLevel || 'High',
  });

  let promptText = options.promptText;

  if (!promptText && options.promptFilePath) {
    const resolvedPath = path.resolve(options.promptFilePath);
    if (fs.existsSync(resolvedPath)) {
      promptText = fs.readFileSync(resolvedPath, 'utf-8');
    }
  }

  if (!promptText) {
    // Default fallback to project analysis prompt
    const defaultPath = path.resolve(__dirname, '../../dashboard/prompts/analysis-prompt.md');
    if (fs.existsSync(defaultPath)) {
      promptText = fs.readFileSync(defaultPath, 'utf-8');
    }
  }

  if (!promptText) {
    throw new Error('No prompt text provided or found at default prompt path.');
  }

  console.log('📝 Inserting Analysis Text Prompt into Google AI Studio...');

  // Locate Google AI Studio prompt input area
  const inputSelectors = [
    'textarea',
    '[contenteditable="true"]',
    'ms-prompt-input textarea',
    'div[role="textbox"]',
  ];

  let promptInput = null;
  for (const selector of inputSelectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      promptInput = loc;
      break;
    }
  }

  if (!promptInput) {
    // Fallback: wait for generic textarea
    promptInput = page.locator('textarea, [contenteditable="true"]').first();
    await promptInput.waitFor({ state: 'visible', timeout: 15000 });
  }

  await promptInput.click();
  await promptInput.focus();

  // Clear existing input content if any
  try {
    await promptInput.fill('');
  } catch {
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
  }

  // Insert prompt text
  await promptInput.fill(promptText);

  console.log('✅ Analysis Text Prompt successfully inserted into AI Studio!');
}

// ─── Direct CLI Runner for testing ─────────────────────

if (require.main === module || process.argv[1]?.endsWith('input-prompt.ts')) {
  const program = new Command();
  program
    .name('aistudio:prompt')
    .description('Action 1: Insert Analysis Prompt text into open AI Studio session')
    .option('-f, --file <string>', 'Path to prompt md file', 'dashboard/prompts/analysis-prompt.md')
    .option('-t, --text <string>', 'Direct prompt text to insert')
    .option('-m, --model <string>', 'Model name', 'gemini-3.1-pro-preview')
    .option('-l, --level <string>', 'Thinking level (High|Medium|Low|Off)', 'High')
    .action(async (opts) => {
      const { launchAIStudioSession } = await import('../aistudio');
      const { page } = await launchAIStudioSession({ headless: false });
      await inputTextPrompt(page, {
        promptFilePath: opts.file,
        promptText: opts.text,
        modelName: opts.model,
        thinkingLevel: opts.level as any,
      });
      console.log('🎉 Action completed! You can check your AI Studio window.');
    });

  program.parse(process.argv);
}
