import { Page, Response } from 'playwright';
import { config } from '../../config';

export interface GenerateUiOptions {
  projectId: string;
  promptText: string;
  modelName?: string; // default: 'Nano Banana Pro'
  timeoutMs?: number;
  ensureSingleImage?: boolean;
}

export interface UiImageResult {
  success: boolean;
  images: Array<{
    url?: string;
    mediaId?: string;
    dimensions?: { width: number; height: number };
    prompt?: string;
  }>;
  rawResponse?: any;
  error?: string;
}

/**
 * Dismisses any Google Flow onboarding popups, welcome modals, or cookie banners.
 */
export async function dismissOverlayModals(page: Page): Promise<void> {
  try {
    const modalButtons = [
      'button:has-text("Got it")',
      'button:has-text("Mengerti")',
      'button:has-text("Tutup")',
      'button:has-text("Dismiss")',
      'button:has-text("Lanjutkan")',
      'button:has-text("Accept")',
    ];

    for (const selector of modalButtons) {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        console.log(`[Playwright Action] Dismissing overlay popup: "${selector}"`);
        await btn.click();
        await page.waitForTimeout(400);
      }
    }
  } catch { }
}

/**
 * Ensures the 'Agen' / 'Agent' button is DEACTIVATED (toggled OFF).
 */
export async function ensureAgentModeDisabled(page: Page): Promise<void> {
  console.log('[Playwright Action] Checking "Agen" (Agent) button state...');

  try {
    const agentBtnSelectors = [
      'button:has-text("Agen")',
      'button:has-text("Agent")',
      'div:has-text("Agen")',
      '[aria-label*="Agen"]',
    ];

    for (const selector of agentBtnSelectors) {
      const btn = await page.$(selector);
      if (btn && (await btn.isVisible())) {
        const isActive = await btn.evaluate((el) => {
          const bg = window.getComputedStyle(el).backgroundColor;
          const ariaPressed = el.getAttribute('aria-pressed');
          const isWhiteBg = bg.includes('255, 255, 255') || bg.includes('rgb(255') || bg.includes('#fff') || bg === 'white';
          return ariaPressed === 'true' || isWhiteBg || el.classList.contains('active') || el.classList.contains('selected');
        });

        if (isActive) {
          console.log(`[Playwright Action] "Agen" button is active. Clicking to turn it OFF...`);
          await btn.click();
          await page.waitForTimeout(400);
        } else {
          console.log('[Playwright Action] "Agen" button is already OFF.');
        }
        break;
      }
    }
  } catch (err) {
    console.warn('[Playwright Action] Warning checking Agent button state:', err);
  }
}

/**
 * Ensures Google Flow UI settings (Model: Nano Banana Pro, Count: x1).
 */
export async function ensureModelAndSettings(
  page: Page,
  options: { modelName?: string; ensureSingleImage?: boolean } = {}
): Promise<void> {
  const targetModel = options.modelName || 'Nano Banana Pro';
  console.log(`[Playwright Action] Ensuring UI generation settings (Model: "${targetModel}", Count: "x1")...`);

  try {
    // 1. Locate the settings pill button at bottom right
    const pillBtn = await page.$('button[aria-haspopup="menu"]:has-text("Banana"), button[aria-haspopup="menu"]:has-text("x1"), button[aria-haspopup="menu"]:has-text("x2"), button:has-text("Banana")');
    if (!pillBtn) {
      console.warn('[Playwright Action] Settings pill button not found on page.');
      return;
    }

    const currentPillText = (await pillBtn.textContent()) || '';
    const needsModelChange = !currentPillText.includes(targetModel);
    const needsCountChange = !currentPillText.includes('x1');

    if (!needsModelChange && !needsCountChange) {
      console.log(`[Playwright Action] Model ("${targetModel}") and count ("x1") are ALREADY active on pill ("${currentPillText.trim()}")!`);
      return;
    }

    console.log(`[Playwright Action] Opening settings popover dialog (Current pill: "${currentPillText.trim()}")...`);
    await pillBtn.click();
    await page.waitForTimeout(1000);

    // 2. Select Model 'Nano Banana Pro' if needed
    if (needsModelChange) {
      const modelDropdownBtn = await page.$('div[role="menu"] button:has-text("Banana"), [role="menu"] button:has-text("Nano")');
      if (modelDropdownBtn && (await modelDropdownBtn.isVisible())) {
        console.log(`[Playwright Action] Clicking model dropdown trigger in popover...`);
        await modelDropdownBtn.click();
        await page.waitForTimeout(1000);

        const proOption = await page.$(`div[role="menuitem"]:has-text("${targetModel}"), button:has-text("${targetModel}")`);
        if (proOption && (await proOption.isVisible())) {
          console.log(`[Playwright Action] Found and clicking "${targetModel}" menuitem!`);
          await proOption.click();
          await page.waitForTimeout(500);
        } else {
          console.log(`[Playwright Action] Using DOM fallback to click "${targetModel}"...`);
          await page.evaluate((target) => {
            const els = Array.from(document.querySelectorAll('div[role="menuitem"], button, div'));
            for (const el of els) {
              if (el.textContent?.trim() === target || el.textContent?.trim() === `🍌 ${target}`) {
                (el as HTMLElement).click();
                return true;
              }
            }
            return false;
          }, targetModel);
          await page.waitForTimeout(500);
        }
      }
    }

    // 3. Select 'x1' count tab inside popover
    if (needsCountChange) {
      console.log('[Playwright Action] Selecting "x1" image count tab in popover...');
      const x1Tab = await page.$('div[role="menu"] button[role="tab"]:has-text("x1"), button:has-text("x1")');
      if (x1Tab && (await x1Tab.isVisible())) {
        await x1Tab.click();
        await page.waitForTimeout(300);
        console.log('[Playwright Action] Clicked "x1" tab.');
      }
    }

    // 4. Close popover by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const verifiedText = (await pillBtn.textContent()) || '';
    console.log(`[Playwright Action] Settings verified! Pill text: "${verifiedText.trim()}"`);
  } catch (err) {
    console.warn('[Playwright Action] Warning during ensureModelAndSettings:', err);
  }
}

/**
 * Action: Generates images by typing prompt into Google Flow UI and intercepting the 200 OK batchGenerateImages response JSON.
 */
export async function generateFlowImagesUiAction(
  page: Page,
  options: GenerateUiOptions
): Promise<UiImageResult> {
  const {
    projectId,
    promptText,
    modelName = 'Nano Banana Pro',
    timeoutMs = 120000,
    ensureSingleImage = true,
  } = options;

  console.log(`[Playwright Action] Intercepting UI Image Generation for Project: ${projectId}`);
  console.log(`[Playwright Action] Target Model: "${modelName}" | Target Prompt: "${promptText.substring(0, 80)}..."`);

  let capturedResponseJson: any = null;
  let responsePromiseResolve: (json: any) => void;
  const responsePromise = new Promise<any>((resolve) => {
    responsePromiseResolve = resolve;
  });

  // Listen for the network response of batchGenerateImages
  const responseHandler = async (response: Response) => {
    const url = response.url();
    if (url.includes('flowMedia:batchGenerateImages') || url.includes('batchGenerateImages')) {
      if (response.status() === 200) {
        try {
          const json = await response.json();
          console.log('[Playwright Action] Intercepted 200 OK batchGenerateImages Response JSON!');
          capturedResponseJson = json;
          responsePromiseResolve(json);
        } catch (e) {
          console.warn('[Playwright Action] Failed to parse intercepted response JSON:', e);
        }
      } else {
        console.warn(`[Playwright Action] batchGenerateImages returned status ${response.status()}`);
      }
    }
  };

  page.on('response', responseHandler);

  try {
    // 1. Ensure page is loaded
    const currentUrl = page.url();
    if (!currentUrl.includes(projectId)) {
      const projectUrl = `https://labs.google/fx/id/tools/flow/project/${projectId}`;
      console.log(`[Playwright Action] Navigating to: ${projectUrl}`);
      await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: config.defaultTimeout });
    }

    console.log('[Playwright Action] Waiting for Google Flow prompt input bar to render...');

    // Dismiss any overlay popups first
    await dismissOverlayModals(page);

    const inputSelectorCombined = 'div[contenteditable="true"], [contenteditable="true"], div[role="textbox"]';

    try {
      await page.waitForSelector(inputSelectorCombined, { timeout: 45000, state: 'attached' });
      await page.waitForSelector(inputSelectorCombined, { timeout: 45000, state: 'visible' });
    } catch (err) {
      console.warn('[Playwright Action] First input wait attempt timed out. Retrying overlay dismissal...');
      await dismissOverlayModals(page);
      await page.waitForSelector(inputSelectorCombined, { timeout: 20000, state: 'visible' });
    }
    await page.waitForTimeout(1000);

    // 2. Ensure Agent mode is OFF (deactivated)
    await ensureAgentModeDisabled(page);

    // 3. Ensure Model is set to 'Nano Banana Pro' and Count is set to 'x1'
    await ensureModelAndSettings(page, { modelName, ensureSingleImage });

    // 4. Locate prompt input element
    const promptSelectors = [
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      'div[role="textbox"]',
      'textarea[placeholder*="Apa yang ingin"]',
    ];

    let inputElement = null;
    for (const selector of promptSelectors) {
      const el = await page.$(selector);
      if (el && (await el.isVisible())) {
        inputElement = el;
        console.log(`[Playwright Action] Found prompt input element with selector: ${selector}`);
        break;
      }
    }

    if (!inputElement) {
      throw new Error('Prompt input field (div[contenteditable="true"]) could not be found on Google Flow page.');
    }

    // 5. Clean prompt text (normalize newlines to single spaces to avoid premature Enter triggers during keyboard typing)
    const cleanedPromptText = promptText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

    console.log('[Playwright Action] Typing prompt text into Slate.js editor...');
    await inputElement.click();
    await page.waitForTimeout(300);

    // Clear existing content
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Type cleaned prompt text via keyboard.type cleanly
    await page.keyboard.type(cleanedPromptText, { delay: 0.5 });
    await page.waitForTimeout(600);

    // 6. Submit prompt by clicking exact arrow_forward submit button
    console.log('[Playwright Action] Clicking Submit Arrow Button (arrow_forward)...');
    const arrowBtn = await page.$('button:has(i:has-text("arrow_forward"))');
    if (arrowBtn && (await arrowBtn.isVisible())) {
      await arrowBtn.click({ force: true });
    } else {
      console.log('[Playwright Action] Fallback: pressing Enter on input...');
      await inputElement.focus();
      await page.keyboard.press('Enter');
    }

    // 7. Wait for batchGenerateImages response JSON or timeout
    console.log('[Playwright Action] Waiting for Google Flow API response...');

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const jsonResult = await Promise.race([responsePromise, timeoutPromise]);

    page.off('response', responseHandler);

    if (!jsonResult) {
      return {
        success: false,
        images: [],
        error: `Timed out after ${timeoutMs / 1000}s waiting for batchGenerateImages API response.`,
      };
    }

    // 8. Extract fifeUrl images from response JSON
    let extractedImages: Array<{ url?: string; mediaId?: string; dimensions?: { width: number; height: number }; prompt?: string }> = [];

    if (jsonResult?.media && Array.isArray(jsonResult.media)) {
      extractedImages = jsonResult.media.map((item: any) => {
        const genImg = item?.image?.generatedImage;
        const dims = item?.image?.dimensions;
        return {
          url: genImg?.fifeUrl,
          mediaId: genImg?.mediaId || item?.name,
          dimensions: dims,
          prompt: genImg?.prompt,
        };
      });

      console.log(`[Playwright Action] Successfully extracted ${extractedImages.length} image URL(s):`);
      extractedImages.forEach((img, idx) => console.log(`  - [${idx + 1}] ${img.url}`));
    }

    return {
      success: extractedImages.length > 0,
      images: extractedImages,
      rawResponse: jsonResult,
    };
  } catch (error: any) {
    page.off('response', responseHandler);
    console.error('[Playwright Action] Exception in generateFlowImagesUiAction:', error);
    return {
      success: false,
      images: [],
      error: error?.message || String(error),
    };
  }
}
