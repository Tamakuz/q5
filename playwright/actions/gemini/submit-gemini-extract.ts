import { Page, Response } from 'playwright';
import { dismissGeminiModalsAction } from './dismiss-gemini-modals';

export interface SubmitGeminiExtractOptions {
  timeout?: number;
}

export interface SubmitGeminiExtractResult {
  success: boolean;
  text: string;
  source: 'network_stream' | 'dom_extraction';
  error?: string;
}

/**
 * Action: Submits prompt on gemini.google.com/app, intercepts StreamGenerate RPC network responses,
 * monitors generation state, and falls back to DOM extraction if network stream is empty.
 */
export async function submitGeminiAndExtractAction(
  page: Page,
  options: SubmitGeminiExtractOptions = {}
): Promise<SubmitGeminiExtractResult> {
  const timeout = options.timeout || 180000;

  console.log(`[Gemini Action] Submitting prompt & attaching StreamGenerate network response listener...`);

  await dismissGeminiModalsAction(page);

  // Set up network response listener for StreamGenerate RPC stream
  let networkStreamText = '';
  const responseListener = async (response: Response) => {
    const url = response.url();
    if (url.includes('StreamGenerate') || url.includes('assistant.lamda.BardFrontendService')) {
      try {
        const bodyText = await response.text();
        const jsonMatch = bodyText.match(/\{[\s\S]*?"naskah_voiceover"[\s\S]*?\}/g);
        if (jsonMatch && jsonMatch.length > 0) {
          networkStreamText = jsonMatch[jsonMatch.length - 1];
          console.log(`[Gemini Action] ⚡ Intercepted JSON script output via StreamGenerate network response stream!`);
        }
      } catch {
        // Continue if response streaming or unparseable
      }
    }
  };

  page.on('response', responseListener);

  // Locate Send button
  const sendBtnSelectors = [
    'button[aria-label*="Send" i]',
    'button.send-button',
    '[data-test-id="send-button"]',
    'button:has-text("Send")',
    'button:has(mat-icon:has-text("send"))',
  ];

  let sendBtn = null;
  for (const selector of sendBtnSelectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
      sendBtn = loc;
      break;
    }
  }

  if (sendBtn) {
    await sendBtn.hover({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
    await sendBtn.click({ force: true });
  } else {
    // Fallback: Press Enter key in prompt editor
    await page.keyboard.press('Enter');
  }

  console.log(`[Gemini Action] Send button triggered. Monitoring generation state...`);

  // Wait for generation start (Stop response button)
  const stopBtn = page.locator('button[aria-label*="Stop" i], button:has-text("Stop response"), [aria-label*="Stop response" i]').first();
  try {
    await stopBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  } catch {
    // Continued if fast
  }

  // Wait for generation completion (Stop button disappears & Send button returns)
  try {
    await stopBtn.waitFor({ state: 'hidden', timeout });
    console.log(`[Gemini Action] Generation completed. Stop button hidden.`);
  } catch (err) {
    console.warn('[Gemini Action] Timeout waiting for generation completion:', err);
  }

  await page.waitForTimeout(2000);
  page.off('response', responseListener);

  // If network stream captured valid script JSON, use network stream text!
  if (networkStreamText && networkStreamText.includes('naskah_voiceover')) {
    console.log(`[Gemini Action] ✅ Returning response extracted via Network Stream Interception (${networkStreamText.length} chars).`);
    return {
      success: true,
      text: networkStreamText,
      source: 'network_stream',
    };
  }

  // Fallback to DOM evaluation (.message-content)
  console.log(`[Gemini Action] Falling back to DOM extraction (.message-content)...`);
  let domResponseText = '';

  try {
    domResponseText = await page.evaluate(() => {
      const responseNodes = Array.from(document.querySelectorAll('message-content, div.message-content, model-response, div.markdown, .model-response-text'));
      if (responseNodes.length > 0) {
        const lastNode = responseNodes[responseNodes.length - 1];
        let text = (lastNode.textContent || '').trim();
        text = text.replace(/^editmore_vert\s*/i, '').trim();
        return text;
      }
      return '';
    });
  } catch (extractError) {
    console.error('[Gemini Action] Error extracting Gemini response text from DOM:', extractError);
  }

  console.log(`[Gemini Action] ✅ Response extracted via DOM Evaluation (${domResponseText.length} chars).`);

  return {
    success: true,
    text: domResponseText || networkStreamText,
    source: 'dom_extraction',
  };
}
