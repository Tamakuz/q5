import { Page } from 'playwright';
import { dismissGeminiModalsAction } from './dismiss-gemini-modals';

export interface InputGeminiPromptOptions {
  timeout?: number;
  clearFirst?: boolean;
}

/**
 * Action: Fills prompt text into Gemini prompt editor on gemini.google.com/app.
 */
export async function inputGeminiPromptAction(
  page: Page,
  promptText: string,
  options: InputGeminiPromptOptions = {}
): Promise<void> {
  const timeout = options.timeout || 15000;
  const clearFirst = options.clearFirst ?? true;

  console.log(`[Gemini Action] Inputting prompt text (${promptText.length} characters)...`);

  await dismissGeminiModalsAction(page);

  const primarySelectors = [
    'rich-textarea p',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="Enter a prompt" i]',
    'div[contenteditable="true"][aria-label*="Ask Gemini" i]',
    'div[contenteditable="true"]',
    'textarea',
  ];

  let targetInput = null;

  for (const selector of primarySelectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
      targetInput = loc;
      break;
    }
  }

  if (!targetInput) {
    targetInput = page.locator('rich-textarea, div[contenteditable="true"], textarea').first();
    await targetInput.waitFor({ state: 'visible', timeout });
  }

  await targetInput.hover().catch(() => {});
  await page.waitForTimeout(200);
  await targetInput.click({ force: true });
  await page.waitForTimeout(300);

  if (clearFirst) {
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
  }

  // Type prompt text
  await targetInput.fill(promptText).catch(async () => {
    await page.keyboard.insertText(promptText);
  });

  await page.waitForTimeout(300);

  // Dispatch events to ensure Angular / ProseMirror model updates
  await targetInput.evaluate((el) => {
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }).catch(() => {});

  console.log(`[Gemini Action] ✅ Prompt text successfully input into Gemini editor.`);
}
