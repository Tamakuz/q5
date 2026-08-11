import { Page } from 'playwright';

/**
 * Action: Auto-dismisses welcome popups, onboarding dialogs, or "Got it" buttons on gemini.google.com.
 */
export async function dismissGeminiModalsAction(page: Page): Promise<void> {
  const modalButtonTextPatterns = [
    /got it/i,
    /i agree/i,
    /accept/i,
    /continue/i,
    /mengerti/i,
    /setuju/i,
    /lanjutkan/i,
    /dismiss/i,
  ];

  try {
    for (const pattern of modalButtonTextPatterns) {
      const btn = page.getByRole('button', { name: pattern }).first();
      if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
        console.log(`[Gemini Action] Auto-dismissing modal dialog button: "${pattern}"...`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  } catch (err) {
    // Non-blocking popup check
  }
}
