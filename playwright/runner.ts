import { PlaywrightService } from './service';
import { Page, BrowserContext, Response } from 'playwright';
import { dismissOverlayModals } from './actions/flow/generate-images-ui';
import { createFlowProjectAction } from './actions/flow/create-project';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');

export interface BatchRunnerItem {
  segment_id: number;
  prompt: string;
}

export interface BatchRunnerOptions {
  projectId: string;
  items: BatchRunnerItem[];
  headed?: boolean;
  onItemStart?: (segmentId: number) => void;
  onItemLog?: (segmentId: number, text: string) => void;
  onItemSuccess?: (segmentId: number, result: any) => void;
  onItemError?: (segmentId: number, error: string) => void;
}

async function detectDailyLimit(page: Page): Promise<boolean> {
  try {
    const limitTexts = ['batas harian', 'daily limit', 'reach the daily limit', 'telah mencapai batas', 'gunakan model lain', 'use another model'];
    return await page.evaluate((texts) => {
      const pageText = document.body.innerText.toLowerCase();
      return texts.some(t => pageText.includes(t));
    }, limitTexts);
  } catch {
    return false;
  }
}

async function deleteFailedLimitCards(page: Page): Promise<void> {
  console.log('[Sequential Engine] Locating and deleting failed limit card...');
  try {
    const card = page.locator('div').filter({ hasText: /batas harian|daily limit|telah mencapai batas/i }).first();
    if (await card.isVisible()) {
      const buttons = card.locator('button');
      const count = await buttons.count();
      if (count > 0) {
        await buttons.last().click();
        console.log('[Sequential Engine] Clicked delete button on failed card.');
        await page.waitForTimeout(1000);
      }
    }
  } catch (err: any) {
    console.warn('[Sequential Engine] Warning: Failed to delete card:', err.message);
  }
}

async function ensureModelInUi(page: Page, targetModel: string): Promise<void> {
  console.log(`[Sequential Engine] Ensuring model is set to: "${targetModel}" and count to "x1"...`);
  try {
    const pillBtn = await page.$('button[aria-haspopup="menu"]:has-text("Banana"), button[aria-haspopup="menu"]:has-text("x1"), button[aria-haspopup="menu"]:has-text("x2"), button:has-text("Banana")');
    if (!pillBtn) {
      console.warn('[Sequential Engine] Settings pill button not found.');
      return;
    }

    const currentPillText = (await pillBtn.textContent()) || '';
    const needsModelChange = !currentPillText.includes(targetModel);
    const needsCountChange = !currentPillText.includes('x1');

    if (!needsModelChange && !needsCountChange) {
      console.log(`[Sequential Engine] Model "${targetModel}" and count "x1" are already active.`);
      return;
    }

    console.log(`[Sequential Engine] Opening settings (Current pill: "${currentPillText.trim()}")...`);
    await pillBtn.click();
    await page.waitForTimeout(1000);

    if (needsModelChange) {
      const modelDropdownBtn = await page.$('div[role="menu"] button:has-text("Banana"), [role="menu"] button:has-text("Nano")');
      if (modelDropdownBtn && (await modelDropdownBtn.isVisible())) {
        await modelDropdownBtn.click();
        await page.waitForTimeout(1000);

        const option = await page.$(`div[role="menuitem"]:has-text("${targetModel}"), button:has-text("${targetModel}")`);
        if (option && (await option.isVisible())) {
          await option.click();
          await page.waitForTimeout(500);
        } else {
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

    if (needsCountChange) {
      console.log('[Sequential Engine] Selecting "x1" image count tab...');
      const x1Tab = await page.$('div[role="menu"] button[role="tab"]:has-text("x1"), button:has-text("x1")');
      if (x1Tab && (await x1Tab.isVisible())) {
        await x1Tab.click();
        await page.waitForTimeout(500);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err: any) {
    console.warn('[Sequential Engine] Warning in ensureModelInUi:', err.message);
  }
}

/**
 * Sequential Queue Injection Persistent Batch Engine.
 * Submits prompts sequentially 1-by-1, waiting for each image response.
 * Always creates a new Google Flow project at start and enforces 1x image generation.
 */
export async function runBatchPersistentQueue(options: BatchRunnerOptions): Promise<void> {
  const { items, headed = true } = options;
  const userDataDir = path.join(PROJECT_ROOT, 'playwright', 'user_data', 'user_1');

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  console.log(`[Sequential Engine] Starting sequential generation for ${items.length} item(s) using Profile user_1...`);

  let activeResolve: ((url: string) => void) | null = null;
  let activeReject: ((err: Error) => void) | null = null;
  let activeItem: BatchRunnerItem | null = null;

  try {
    // 1. Launch Chromium persistent context
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const session = await PlaywrightService.actions.launchBrowser({
      headed,
      userDataDir,
    });
    context = session.context;
    page = session.page;

    // 2. Navigate to target Google Flow project
    const projectId = options.projectId || process.env.GOOGLE_FLOW_PROJECT_ID || '10ab715a-31e2-48d3-8e56-840e8af6c062';
    console.log(`[Sequential Engine] Opening Google Flow project ID: ${projectId}`);
    const projectUrl = `https://labs.google/fx/id/tools/flow/project/${projectId}`;
    await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    const INPUT_SELECTOR = 'div[contenteditable="true"], [contenteditable="true"], div[role="textbox"], textarea';

    try {
      await page.waitForSelector(INPUT_SELECTOR, { state: 'visible', timeout: 15000 });
    } catch {
      console.warn('[Sequential Engine] Warning: input element not immediately visible, attempting overlay dismiss and retry...');
      await dismissOverlayModals(page);
      try {
        await page.waitForSelector(INPUT_SELECTOR, { state: 'visible', timeout: 15000 });
      } catch {
        console.warn('[Sequential Engine] Target project input not found. Creating/opening fallback project...');
        const createRes = await createFlowProjectAction(page);
        if (createRes.success && createRes.projectId) {
          const newUrl = `https://labs.google/fx/id/tools/flow/project/${createRes.projectId}`;
          await page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await dismissOverlayModals(page);
        }
        await page.waitForSelector(INPUT_SELECTOR, { timeout: 30000 });
      }
    }

    // 3. Setup network response listener for image generation
    page.on('response', async (response: Response) => {
      const url = response.url();
      if ((url.includes('flowMedia:batchGenerateImages') || url.includes('batchGenerateImages')) && response.status() === 200) {
        try {
          const json = await response.json();
          if (json?.media && Array.isArray(json.media)) {
            for (const mediaItem of json.media) {
              const genImg = mediaItem?.image?.generatedImage;
              const fifeUrl = genImg?.fifeUrl;
              const respPrompt = (genImg?.prompt || '').trim().toLowerCase();

              if (fifeUrl && activeItem && activeResolve) {
                console.log(`[Sequential Engine] Intercepted 200 OK image response for active segment #${activeItem.segment_id}: "${respPrompt.substring(0, 40)}..."`);
                activeResolve(fifeUrl);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('[Sequential Engine] Error parsing response JSON:', e);
        }
      }
    });

    // 4. Process each item sequentially
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      activeItem = item;

      if (options.onItemStart) {
        options.onItemStart(item.segment_id);
      }

      let fifeUrl: string | null = null;

      try {
        if (options.onItemLog) {
          options.onItemLog(item.segment_id, '✍️ Preparing prompt...');
        }

        // Ensure model is Nano Banana Pro and count is x1
        await ensureModelInUi(page, 'Nano Banana Pro');

        const input = await page.$(INPUT_SELECTOR);
        if (!input) throw new Error('Prompt input field not found on Google Flow page');

        await input.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(100);

        const cleanedText = item.prompt.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (options.onItemLog) {
          options.onItemLog(item.segment_id, `⌨️ Typing prompt (length: ${cleanedText.length})...`);
        }
        await page.keyboard.type(cleanedText, { delay: 15 });
        await page.waitForTimeout(200);

        console.log(`[Sequential Engine] Submitting prompt #${item.segment_id} to Google AI...`);
        const arrowBtn = await page.$('button:has(i:has-text("arrow_forward"))');
        if (arrowBtn && (await arrowBtn.isVisible())) {
          await arrowBtn.click({ force: true });
        } else {
          await page.keyboard.press('Enter');
        }

        if (options.onItemLog) {
          options.onItemLog(item.segment_id, '📩 Prompt Submitted! Waiting for image response...');
        }

        // Wait for active image response OR daily limit detection (timeout 75s)
        fifeUrl = await new Promise<string>((resolve, reject) => {
          activeResolve = resolve;
          activeReject = reject;

          const checkerInterval = setInterval(async () => {
            try {
              if (page) {
                const isLimit = await detectDailyLimit(page);
                if (isLimit) {
                  clearInterval(checkerInterval);
                  reject(new Error('LIMIT_REACHED'));
                }
              }
            } catch { }
          }, 2500);

          const timeoutId = setTimeout(() => {
            clearInterval(checkerInterval);
            reject(new Error('TIMEOUT'));
          }, 75000);

          activeResolve = (url: string) => {
            clearInterval(checkerInterval);
            clearTimeout(timeoutId);
            resolve(url);
          };
          activeReject = (err: Error) => {
            clearInterval(checkerInterval);
            clearTimeout(timeoutId);
            reject(err);
          };
        });

      } catch (err: any) {
        if (err.message === 'LIMIT_REACHED' && page) {
          await deleteFailedLimitCards(page);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
        throw err;
      }

      // Record result
      if (fifeUrl) {
        const resObj = {
          success: true,
          images: [{ url: fifeUrl }],
        };

        if (options.onItemLog) {
          options.onItemLog(item.segment_id, '🎉 Image generated successfully!');
        }
        if (options.onItemSuccess) {
          options.onItemSuccess(item.segment_id, resObj);
        }

        // Moderate pause between sequential generations to avoid rate limits
        await page.waitForTimeout(2000 + Math.random() * 2000);
      } else {
        throw new Error('Failed to generate image URL');
      }
    }

  } catch (err: any) {
    console.error('[Sequential Engine] Global Exception:', err);
  } finally {
    if (context) {
      console.log('[Sequential Engine] Queue complete. Closing browser context...');
      try {
        await context.close();
      } catch { }
    }
  }
}
