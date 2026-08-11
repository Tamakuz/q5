import { Page } from 'playwright';

/**
 * Action: Automatically detects and dismisses Google AI Studio terms of service,
 * welcome popups, onboarding dialogs, and modal backdrops.
 */
export async function dismissAIStudioModalsAction(page: Page): Promise<boolean> {
  let dismissedAny = false;

  try {
    // Selectors for common AI Studio dialog buttons (e.g. "Continue", "Get started", "Accept", "I agree")
    const buttonSelectors = [
      '[role="dialog"] button:has-text("Continue")',
      '.cdk-overlay-container button:has-text("Continue")',
      'button:has-text("Continue")',
      'button:has-text("Get started")',
      'button:has-text("I agree")',
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("Dismiss")',
      '[role="dialog"] button[aria-label*="close" i]',
    ];

    for (const selector of buttonSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`[AI Studio Action] 🛑 Overlay modal detected. Dismissing popup via: "${selector}"...`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        dismissedAny = true;
      }
    }
  } catch {
    // Ignore errors if no modal is present
  }

  return dismissedAny;
}
