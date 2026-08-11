import { Page } from 'playwright';
import { config } from '../../config';

export interface SelectModelOptions {
  timeout?: number;
}

/**
 * Action: Selects target AI Model in Google AI Studio (e.g. 'Gemini 3.6 Flash', 'Gemini 1.5 Flash', 'Gemini 1.5 Pro').
 * Ensures switching away from restricted preview models that return 403 Permission Denied.
 */
export async function selectModelAction(
  page: Page,
  modelName: string = 'Gemini 3.6 Flash',
  options: SelectModelOptions = {}
): Promise<void> {
  const timeout = options.timeout || 10000;

  console.log(`[AI Studio Action] Selecting AI Model: "${modelName}"...`);

  try {
    // Locate model selector in run settings sidebar
    const modelDropdown = page.locator('ms-model-selector, mat-select, [aria-label*="model" i], button:has-text("Gemini")').first();

    if (await modelDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      await modelDropdown.click({ force: true });
      await page.waitForTimeout(500);

      // Select target model from menu options list
      const optionItem = page.locator('mat-option, [role="option"], .mat-mdc-option').filter({
        hasText: new RegExp(modelName.replace('Flash', '').replace('Preview', '').trim(), 'i')
      }).first();

      if (await optionItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await optionItem.click({ force: true });
        await page.waitForTimeout(500);
        console.log(`[AI Studio Action] ✅ Successfully selected model: "${modelName}".`);
      } else {
        console.warn(`[AI Studio Action] Model option containing "${modelName}" not found in dropdown list.`);
        await page.keyboard.press('Escape');
      }
    } else {
      console.warn('[AI Studio Action] Model dropdown selector not visible in right panel.');
    }
  } catch (err) {
    console.warn('[AI Studio Action] Notice selecting model:', err);
  }
}
