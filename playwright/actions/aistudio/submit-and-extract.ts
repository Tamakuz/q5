import { Page } from 'playwright';
import { config } from '../../config';
import { dismissAIStudioModalsAction } from './dismiss-modals';
import { inputPromptAction } from './input-prompt';

export interface SubmitAndExtractOptions {
  timeout?: number;
  promptText?: string;
  isRetry?: boolean;
}

export interface SubmitAndExtractResult {
  success: boolean;
  text: string;
  error?: string;
}

/**
 * Action: Submits prompt in Google AI Studio, monitors generation state,
 * handles double-send retries on initial 403 permission errors, and extracts clean model output text.
 */
export async function submitAndExtractAction(
  page: Page,
  options: SubmitAndExtractOptions = {}
): Promise<SubmitAndExtractResult> {
  const timeout = options.timeout || 180000;

  console.log(`[AI Studio Action] Submitting prompt & waiting for model response...`);

  await dismissAIStudioModalsAction(page);

  // Locate Run button
  const runBtn = page.getByRole('button', { name: /run/i })
    .or(page.locator('ms-run-button button, button:has-text("Run")'))
    .first();

  await runBtn.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(400);

  // Hover first to trigger pointer events before click
  await runBtn.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  await runBtn.click({ force: true });

  console.log(`[AI Studio Action] Run button clicked. Monitoring generation progress...`);

  // Monitor generation start (Stop / Cancel button)
  const stopBtn = page.locator('button:has-text("Cancel"), button:has-text("Stop"), ms-run-button button:has-text("Cancel")').first();
  try {
    await stopBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  } catch {
    // Continued if instant
  }

  // Wait for generation to finish (Stop button disappears & Run button becomes active)
  try {
    await runBtn.waitFor({ state: 'visible', timeout });
    console.log(`[AI Studio Action] Generation finished. Run button active.`);
  } catch (err) {
    console.warn('[AI Studio Action] Timeout/Warning waiting for generation finish:', err);
  }

  await page.waitForTimeout(2000);

  // Check if Google returned a 403 Permission Denied / Internal Error card
  const isPermissionError = await page.evaluate(() => {
    const bodyText = document.body.innerText || '';
    return bodyText.includes('An internal error has occurred') || 
           bodyText.includes('permission denied') ||
           bodyText.includes('Failed to generate content');
  });

  if (isPermissionError && !options.isRetry) {
    console.warn('[AI Studio Action] ⚠️ Detected Google session permission error (403). Performing double-send / retry...');
    await page.waitForTimeout(1500);

    if (options.promptText) {
      await inputPromptAction(page, options.promptText);
      await page.waitForTimeout(500);
    } else {
      const retryBtn = page.locator('button:has-text("Please try again"), a:has-text("Please try again")').first();
      if (await retryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await retryBtn.click({ force: true }).catch(() => {});
      } else {
        await runBtn.click({ force: true }).catch(() => {});
      }
    }

    return submitAndExtractAction(page, { ...options, isRetry: true });
  }

  // Extract output text clean of header metadata using DOM evaluation
  let responseText = '';

  try {
    responseText = await page.evaluate(() => {
      // Find all markdown / text chunk elements inside response turns
      const markdowns = Array.from(document.querySelectorAll('ms-text-chunk, div.markdown, .chat-turn-content, [data-test-id="text-chunk"]'));
      if (markdowns.length > 0) {
        const lastMd = markdowns[markdowns.length - 1];
        let text = (lastMd.textContent || '').trim();
        // Strip UI header artifacts
        text = text.replace(/^more_vert\s*/i, '')
                   .replace(/^Model\s*\d+:\d+\s*(?:AM|PM)?(?:\s*Thinking\s*[\d.]+s)?/i, '')
                   .trim();
        if (text.length > 0 && !text.includes('An internal error')) {
          return text;
        }
      }

      // Fallback: search ms-chat-turn
      const turns = Array.from(document.querySelectorAll('ms-chat-turn, div.model-turn'));
      if (turns.length > 0) {
        for (let i = turns.length - 1; i >= 0; i--) {
          let txt = (turns[i].textContent || '').trim();
          txt = txt.replace(/^more_vert\s*/i, '')
                   .replace(/^Model\s*\d+:\d+\s*(?:AM|PM)?(?:\s*Thinking\s*[\d.]+s)?/i, '')
                   .trim();
          if (txt.length > 0 && !txt.startsWith('User') && !txt.includes('An internal error')) {
            return txt;
          }
        }
      }

      return '';
    });
  } catch (extractError) {
    console.error('[AI Studio Action] Error extracting response text:', extractError);
  }

  console.log(`[AI Studio Action] ✅ Response extracted successfully (${responseText.length} chars).`);

  return {
    success: true,
    text: responseText,
  };
}
