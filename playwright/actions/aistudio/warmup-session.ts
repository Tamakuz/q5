import { Page } from 'playwright';
import { inputPromptAction } from './input-prompt';
import { dismissAIStudioModalsAction } from './dismiss-modals';

/**
 * Action: Performs an initial quick warmup ping ("hi") to initialize Google AI Studio backend session token.
 * Guarantees that subsequent real prompts (Turn 2+) execute with 200 OK status code without permission errors.
 */
export async function warmupAIStudioSessionAction(page: Page): Promise<void> {
  console.log('[AI Studio Action] 🔄 Initializing session warmup ping ("hi")...');

  try {
    await dismissAIStudioModalsAction(page);
    await inputPromptAction(page, 'hi', { clearFirst: false });
    await page.waitForTimeout(300);

    const runBtn = page.getByRole('button', { name: /run/i })
      .or(page.locator('ms-run-button button, button:has-text("Run")'))
      .first();

    if (await runBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await runBtn.click({ force: true });
      console.log('[AI Studio Action] Warmup ping sent. Waiting 2.5s for Google session token to settle...');
      await page.waitForTimeout(2500);
      await dismissAIStudioModalsAction(page);
    }
  } catch (err) {
    console.warn('[AI Studio Action] Warmup ping notice (non-blocking):', err);
  }

  console.log('[AI Studio Action] ✅ Session warmup complete. AI Studio authenticated & ready for main prompt.');
}
