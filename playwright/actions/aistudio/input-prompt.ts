import { Page, Locator } from 'playwright';
import { config } from '../../config';
import { dismissAIStudioModalsAction } from './dismiss-modals';

export interface InputPromptOptions {
  timeout?: number;
  clearFirst?: boolean;
}

/**
 * Action: Finds the prompt input textbox in Google AI Studio and fills it with prompt text.
 * Dispatches Angular form control events to guarantee input state registration.
 */
export async function inputPromptAction(
  page: Page,
  promptText: string,
  options: InputPromptOptions = {}
): Promise<void> {
  const timeout = options.timeout || config.defaultTimeout;

  console.log(`[AI Studio Action] Inputting prompt text (${promptText.length} characters)...`);

  // Dismiss any blocking dialogs/modals first
  await dismissAIStudioModalsAction(page);

  // Primary locator recorded via Playwright codegen
  const primaryLocator = page.getByRole('textbox', { name: /enter a prompt/i });

  // Fallback selector strategy for dynamic UI / Web Components
  const fallbackLocator = page.locator([
    'ms-prompt-editor textarea',
    'ms-prompt-editor [contenteditable="true"]',
    'textarea[placeholder*="prompt" i]',
    'div[contenteditable="true"]',
    'textarea'
  ].join(', ')).first();

  let targetInput: Locator = primaryLocator;

  try {
    await primaryLocator.waitFor({ state: 'visible', timeout: 5000 });
  } catch {
    console.warn('[AI Studio Action] Primary textbox locator not found within 5s, switching to fallback locator...');
    targetInput = fallbackLocator;
    await targetInput.waitFor({ state: 'visible', timeout });
  }

  await dismissAIStudioModalsAction(page);

  await targetInput.click({ force: true });
  await page.waitForTimeout(300);

  if (options.clearFirst) {
    try {
      await targetInput.fill('');
    } catch {
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
    }
  }

  // Fill text and dispatch input/change/focus events for Angular form control bindings
  try {
    await targetInput.fill(promptText);
    await page.evaluate((el) => {
      if (el instanceof HTMLElement) {
        el.focus();
        el.dispatchEvent(new Event('focus', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, await targetInput.elementHandle().catch(() => null));
  } catch (fillError) {
    console.warn('[AI Studio Action] fill() method failed, fallback to element property injection:', fillError);
    await page.evaluate(({ element, text }) => {
      if (element instanceof HTMLElement) {
        element.focus();
        if ('value' in element) {
          (element as HTMLInputElement).value = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.innerText = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, { element: await targetInput.elementHandle(), text: promptText });
  }

  await page.waitForTimeout(800);

  console.log(`[AI Studio Action] ✅ Prompt text successfully input into AI Studio editor.`);
}
