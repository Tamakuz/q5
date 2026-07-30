import { PlaywrightService } from './service';
import { Page, BrowserContext, Response } from 'playwright';
import { dismissOverlayModals } from './actions/flow/generate-images-ui';
import { createFlowProjectAction } from './actions/flow/create-project';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');

interface TestItem {
  segment_id: number;
  prompt: string;
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
  console.log('[Debug Switch Profile] Locating and deleting failed limit card...');
  try {
    const card = page.locator('div').filter({ hasText: /batas harian|daily limit|telah mencapai batas/i }).first();
    if (await card.isVisible()) {
      const buttons = card.locator('button');
      const count = await buttons.count();
      if (count > 0) {
        await buttons.last().click();
        console.log('[Debug Switch Profile] Clicked delete button on failed card.');
        await page.waitForTimeout(1000);
      }
    }
  } catch (err: any) {
    console.warn('[Debug Switch Profile] Warning: Failed to delete card:', err.message);
  }
}

async function ensureModelInUi(page: Page, targetModel: string): Promise<void> {
  console.log(`[Debug Switch Profile] Ensuring model is set to: "${targetModel}" and count to "x1"...`);
  try {
    const pillBtn = await page.$('button[aria-haspopup="menu"]:has-text("Banana"), button[aria-haspopup="menu"]:has-text("x1"), button[aria-haspopup="menu"]:has-text("x2"), button:has-text("Banana")');
    if (!pillBtn) {
      console.warn('[Debug Switch Profile] Settings pill button not found.');
      return;
    }

    const currentPillText = (await pillBtn.textContent()) || '';
    const needsModelChange = !currentPillText.includes(targetModel);
    const needsCountChange = !currentPillText.includes('x1');

    if (!needsModelChange && !needsCountChange) {
      console.log(`[Debug Switch Profile] Model "${targetModel}" and count "x1" are already active.`);
      return;
    }

    console.log(`[Debug Switch Profile] Opening settings (Current pill: "${currentPillText.trim()}")...`);
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
      console.log('[Debug Switch Profile] Selecting "x1" image count tab...');
      const x1Tab = await page.$('div[role="menu"] button[role="tab"]:has-text("x1"), button:has-text("x1")');
      if (x1Tab && (await x1Tab.isVisible())) {
        await x1Tab.click();
        await page.waitForTimeout(500);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err: any) {
    console.warn('[Debug Switch Profile] Warning in ensureModelInUi:', err.message);
  }
}

async function runDebug() {
  const baseUserDataDir = path.join(PROJECT_ROOT, 'playwright', 'user_data');
  const testItems: TestItem[] = [
    { segment_id: 1, prompt: 'Flat 2D illustration, thick black outline, semi-detailed caveman family sitting around a small campfire at night' },
    { segment_id: 2, prompt: 'Flat 2D illustration, thick black outline, cavemen exploring inside a dark cave with primitive torches' }
  ];

  let currentUserId = 1;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let activeResolve: ((url: string) => void) | null = null;
  let activeReject: ((err: Error) => void) | null = null;
  let activeItem: TestItem | null = null;

  const launchSessionForUser = async (userId: number) => {
    const userDataDir = path.join(baseUserDataDir, `user_${userId}`);
    if (!fs.existsSync(userDataDir)) {
      throw new Error(`Profile user_${userId} does not exist. Please initialize it first.`);
    }

    console.log(`\n[Debug Switch Profile] Launching Chromium with Profile: user_${userId}`);
    const session = await PlaywrightService.actions.launchBrowser({
      headed: true,
      userDataDir,
    });
    
    context = session.context;
    page = session.page;

    const projectJsonPath = path.join(userDataDir, 'flow_project.json');
    let projectId = '';
    
    if (fs.existsSync(projectJsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
        projectId = data.projectId || '';
      } catch { }
    }

    if (projectId) {
      const projectUrl = `https://labs.google/fx/id/tools/flow/project/${projectId}`;
      console.log(`[Debug Switch Profile] Navigating to existing project for user_${userId}: ${projectUrl}`);
      await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else {
      console.log(`[Debug Switch Profile] No project ID found. Creating a new Google Flow project...`);
      const createRes = await createFlowProjectAction(page);
      if (createRes.success && createRes.projectId) {
        projectId = createRes.projectId;
        fs.writeFileSync(projectJsonPath, JSON.stringify({ projectId }, null, 2), 'utf8');
        console.log(`[Debug Switch Profile] Created and saved new project ID: ${projectId} for user_${userId}`);
      } else {
        throw new Error(`Failed to create project: ${createRes.message}`);
      }
    }

    await dismissOverlayModals(page);
    await page.waitForSelector('div[contenteditable="true"]', { state: 'visible', timeout: 30000 });

    page.on('response', async (response: Response) => {
      const url = response.url();
      if ((url.includes('flowMedia:batchGenerateImages') || url.includes('batchGenerateImages')) && response.status() === 200) {
        try {
          const json = await response.json();
          if (json?.media && Array.isArray(json.media)) {
            for (const mediaItem of json.media) {
              const genImg = mediaItem?.image?.generatedImage;
              const fifeUrl = genImg?.fifeUrl;
              if (fifeUrl && activeItem && activeResolve) {
                console.log(`[Debug Switch Profile] Intercepted image for segment #${activeItem.segment_id}`);
                activeResolve(fifeUrl);
                return;
              }
            }
          }
        } catch { }
      }
    });
  };

  try {
    // Launch first profile
    await launchSessionForUser(currentUserId);

    for (const item of testItems) {
      activeItem = item;
      let fifeUrl: string | null = null;

      while (true) {
        if (!page) throw new Error('Session page is not active');

        try {
          console.log(`\n[Debug Switch Profile] Processing segment #${item.segment_id} on Profile user_${currentUserId}...`);

          // Ensure model is set to Nano Banana Pro and count is x1
          await ensureModelInUi(page, 'Nano Banana Pro');

          const input = await page.$('div[contenteditable="true"]');
          if (!input) throw new Error('Input field not found');

          await input.click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(100);

          await page.keyboard.type(item.prompt, { delay: 15 });
          await page.waitForTimeout(200);

          console.log('[Debug Switch Profile] Submitting prompt...');
          const arrowBtn = await page.$('button:has(i:has-text("arrow_forward"))');
          if (arrowBtn && (await arrowBtn.isVisible())) {
            await arrowBtn.click({ force: true });
          } else {
            await page.keyboard.press('Enter');
          }

          // Await generation or limit detection
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
            }, 2000);

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

          break; // Succeeded! Break the while loop

        } catch (err: any) {
          if (err.message === 'LIMIT_REACHED') {
            console.warn(`[Debug Switch Profile] ⚠️ Limit detected on Profile user_${currentUserId}!`);
            await deleteFailedLimitCards(page);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);

            // Close current context
            if (context) {
              await context.close();
              context = null;
              page = null;
            }

            // Increment profile ID
            currentUserId++;
            console.log(`[Debug Switch Profile] Switching to Profile user_${currentUserId}...`);
            await launchSessionForUser(currentUserId);
            continue; // Retry item on new profile
          } else {
            throw err;
          }
        }
      }

      if (fifeUrl) {
        console.log(`[Debug Switch Profile] 🎉 Succeeded! Image URL: ${fifeUrl}`);
      }
    }

    console.log('\n[Debug Switch Profile] Debug process finished successfully!');
  } catch (err: any) {
    console.error('\n[Debug Switch Profile] Error during execution:', err.message);
  } finally {
    if (context) {
      await context.close();
    }
  }
}

runDebug().catch(console.error);
