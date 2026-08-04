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
  concurrency?: number;
  profiles?: string[];
  models?: string[];
  headed?: boolean;
  keepBrowserOpen?: boolean;
  onItemStart?: (segmentId: number) => void;
  onItemLog?: (segmentId: number, text: string) => void;
  onItemSuccess?: (segmentId: number, result: any) => void;
  onItemError?: (segmentId: number, error: string) => void;
}

async function detectDailyLimit(page: Page): Promise<boolean> {
  try {
    if (page.isClosed()) return false;
    if ((page as any).__dailyLimitHit) {
      (page as any).__dailyLimitHit = false;
      return true;
    }
    const limitTexts = ['batas harian', 'daily limit', 'reach the daily limit', 'telah mencapai batas', 'gunakan model lain', 'use another model', 'quota_reached'];
    return await page.evaluate((texts) => {
      // 1. Check modal dialogs, alert popups, or toasts (avoiding main document body text & input fields)
      const modalElements = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="alert"], div.modal, div.dialog, div.toast, [aria-modal="true"]'));
      for (const el of modalElements) {
        const txt = el.textContent?.toLowerCase() || '';
        if (texts.some(t => txt.includes(t))) return true;
      }
      // 2. Check explicit banner cards with limit text
      const bannerElements = Array.from(document.querySelectorAll('div, section, article'));
      for (const el of bannerElements) {
        const txt = (el.textContent || '').toLowerCase();
        if (txt.length < 500 && txt.includes('gagal') && texts.some(t => txt.includes(t))) return true;
      }
      return false;
    }, limitTexts);
  } catch {
    return false;
  }
}

function extractUniqueSceneSignature(promptText: string): string {
  let cleaned = promptText.toLowerCase()
    .replace(/\[seg#\d+\]/gi, '')
    .replace(/\[segment\s*\d+\]/gi, '')
    .replace(/full canvas 16:9[^\n,]*/gi, '')
    .replace(/canvas: 1280x720px[^\n,]*/gi, '')
    .replace(/negative constraints:[^\n,]*/gi, '')
    .trim();

  const sceneMatch = cleaned.match(/scene & action:\s*([^.\n]{15,70})/i);
  if (sceneMatch && sceneMatch[1]) {
    return sceneMatch[1].trim();
  }
  if (cleaned.length > 40) {
    const start = Math.floor(cleaned.length / 4);
    return cleaned.substring(start, start + 40).trim();
  }
  return cleaned;
}

async function detectSafetyPolicyErrorCards(page: Page, activeSlots: Map<number, ActiveSlot>): Promise<number[]> {
  const failedSegIds: number[] = [];
  try {
    if (page.isClosed() || activeSlots.size === 0) return failedSegIds;

    const detected = await page.evaluate(() => {
      // Find leaf error elements to prevent matching parent container elements that wrap historical prompts
      const elements = Array.from(document.querySelectorAll('div, article, section, p, span'));
      const ids: number[] = [];
      for (const c of elements) {
        if (c.children.length > 5) continue;
        const text = c.textContent || '';
        if (text.length > 1000) continue;

        if (text.includes('Gagal') && (text.includes('kebijakan') || text.includes('berbahaya') || text.includes('policy') || text.includes('perintah ini mungkin melanggar') || text.includes('tidak dapat membuat'))) {
          // Extract tag ONLY from within this localized card text
          const matches = text.match(/\[SEG#(\d+)\]/gi) || text.match(/\[Segment\s*(\d+)\]/gi);
          if (matches && matches.length === 1) {
            const singleMatch = matches[0].match(/(\d+)/);
            if (singleMatch && singleMatch[1]) {
              ids.push(Number(singleMatch[1]));
            }
          }
        }
      }
      return ids;
    });

    for (const segId of detected) {
      if (activeSlots.has(segId) && !failedSegIds.includes(segId)) {
        failedSegIds.push(segId);
      }
    }

    // Fallback: Check unique scene signature instead of generic boilerplate prefix/suffix
    if (failedSegIds.length === 0) {
      const cardTexts = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, article, section, p, span'));
        return elements.filter(c => {
          if (c.children.length > 5) return false;
          const t = c.textContent || '';
          return t.length < 1000 && t.includes('Gagal') && (t.includes('kebijakan') || t.includes('berbahaya') || t.includes('policy') || t.includes('perintah ini mungkin melanggar'));
        }).map(c => c.textContent || '');
      });

      for (const cardText of cardTexts) {
        const lowerCard = cardText.toLowerCase();
        for (const [segId, slot] of activeSlots.entries()) {
          const uniqueSignature = extractUniqueSceneSignature(slot.cleanedText);
          if (uniqueSignature && uniqueSignature.length >= 15 && lowerCard.includes(uniqueSignature)) {
            if (!failedSegIds.includes(segId)) {
              failedSegIds.push(segId);
            }
          }
        }
      }
    }
  } catch {}
  return failedSegIds;
}

async function deleteFailedLimitCards(page: Page): Promise<void> {
  console.log('[Batch Engine] Locating and deleting failed limit / error card...');
  try {
    if (page.isClosed()) return;
    const card = page.locator('div').filter({ hasText: /batas harian|daily limit|telah mencapai batas|gagal|kebijakan/i }).first();
    if (await card.isVisible({ timeout: 1500 })) {
      const buttons = card.locator('button');
      const count = await buttons.count();
      if (count > 0) {
        await buttons.last().click({ timeout: 1500, force: true });
        console.log('[Batch Engine] Clicked delete button on failed card.');
        await page.waitForTimeout(500);
      }
    }
  } catch (err: any) {
    console.warn('[Batch Engine] Warning: Failed to delete card:', err.message);
  }
}

async function ensureModelInUi(page: Page, targetModel: string): Promise<void> {
  console.log(`[Batch Engine] Ensuring model is set to: "${targetModel}" and count to "x1"...`);
  try {
    if (page.isClosed()) return;
    await dismissOverlayModals(page);
    await deleteFailedLimitCards(page);

    let pillBtn = await page.$('button[aria-haspopup="menu"]:has-text("Banana"), button[aria-haspopup="menu"]:has-text("x1"), button[aria-haspopup="menu"]:has-text("x2"), button:has-text("Banana")');
    if (!pillBtn) {
      console.warn('[Batch Engine] Settings pill button not found initially. Retrying after modal dismissal...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await dismissOverlayModals(page);
      pillBtn = await page.$('button[aria-haspopup="menu"]:has-text("Banana"), button[aria-haspopup="menu"]:has-text("x1"), button[aria-haspopup="menu"]:has-text("x2"), button:has-text("Banana")');
    }

    if (!pillBtn) {
      console.warn('[Batch Engine] Settings pill button still not found after retry.');
      return;
    }

    const currentPillText = (await pillBtn.textContent()) || '';
    const needsModelChange = !currentPillText.includes(targetModel);
    const needsCountChange = !currentPillText.includes('x1');

    if (!needsModelChange && !needsCountChange) {
      console.log(`[Batch Engine] Model "${targetModel}" and count "x1" are already active.`);
      return;
    }

    console.log(`[Batch Engine] Opening settings (Current pill: "${currentPillText.trim()}")...`);
    await pillBtn.click();
    await page.waitForTimeout(1000);

    if (needsModelChange) {
      const modelDropdownBtn = await page.$('div[role="menu"] button:has-text("Banana"), [role="menu"] button:has-text("Nano")');
      if (modelDropdownBtn && (await modelDropdownBtn.isVisible())) {
        await modelDropdownBtn.click();
        await page.waitForTimeout(1000);
      }

      const option = await page.$(`div[role="menuitem"]:has-text("${targetModel}"), button:has-text("${targetModel}")`);
      if (option && (await option.isVisible())) {
        await option.click();
        await page.waitForTimeout(500);
      } else {
        await page.evaluate((target) => {
          const els = Array.from(document.querySelectorAll('div[role="menuitem"], button, div, span'));
          for (const el of els) {
            const txt = el.textContent?.trim() || '';
            if (txt.includes(target) || txt.includes(`🍌 ${target}`)) {
              (el as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, targetModel);
        await page.waitForTimeout(500);
      }
    }

    if (needsCountChange) {
      console.log('[Batch Engine] Selecting "x1" image count tab...');
      const x1Tab = await page.$('div[role="menu"] button[role="tab"]:has-text("x1"), button:has-text("x1")');
      if (x1Tab && (await x1Tab.isVisible())) {
        await x1Tab.click();
        await page.waitForTimeout(500);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (err: any) {
    console.warn('[Batch Engine] Warning in ensureModelInUi:', err.message);
  }
}

interface ActiveSlot {
  segment_id: number;
  prompt: string;
  cleanedText: string;
  taggedPrompt: string;
  submissionOrder: number;
  item: BatchRunnerItem;
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
}

function getSavedProjectId(profileName: string): string | null {
  const mapPath = path.join(PROJECT_ROOT, 'playwright', 'user_data', 'projects_map.json');
  if (fs.existsSync(mapPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      return data[profileName] || null;
    } catch {}
  }
  return null;
}

function saveProjectId(profileName: string, projectId: string): void {
  const mapPath = path.join(PROJECT_ROOT, 'playwright', 'user_data', 'projects_map.json');
  let data: Record<string, string> = {};
  if (fs.existsSync(mapPath)) {
    try {
      data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    } catch {}
  }
  data[profileName] = projectId;
  fs.writeFileSync(mapPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[Batch Engine] Saved Project UUID "${projectId}" for profile "${profileName}"`);
}

async function initSessionForProfile(profileName: string, options: BatchRunnerOptions, activeSlots: Map<number, ActiveSlot>) {
  const userDataDir = path.join(PROJECT_ROOT, 'playwright', 'user_data', profileName);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const session = await PlaywrightService.actions.launchBrowser({
    headed: options.headed ?? true,
    userDataDir,
  });
  const context = session.context;
  const page = session.page;
  const INPUT_SELECTOR = 'div[contenteditable="true"], [contenteditable="true"], div[role="textbox"], textarea';

  const savedProjectId = getSavedProjectId(profileName);
  let loadedSavedSuccess = false;

  if (savedProjectId) {
    console.log(`[Batch Engine] Profile "${profileName}" has saved Project ID "${savedProjectId}". Opening existing project...`);
    const targetUrl = `https://labs.google/fx/id/tools/flow/project/${savedProjectId}`;
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissOverlayModals(page);
      await page.waitForSelector(INPUT_SELECTOR, { state: 'visible', timeout: 10000 });
      console.log(`[Batch Engine] Successfully re-used saved Project ID "${savedProjectId}" for profile "${profileName}"!`);
      loadedSavedSuccess = true;
    } catch (e) {
      console.warn(`[Batch Engine] Saved project "${savedProjectId}" for profile "${profileName}" could not be loaded or is inaccessible. Will create a fresh project.`);
    }
  }

  if (!loadedSavedSuccess) {
    console.log(`[Batch Engine] Creating a new project for profile "${profileName}"...`);
    const createRes = await createFlowProjectAction(page);
    if (createRes.success && createRes.projectId) {
      console.log(`[Batch Engine] Fresh project created for profile "${profileName}": ${createRes.projectId} (URL: ${createRes.projectUrl})`);
      saveProjectId(profileName, createRes.projectId);
    } else {
      console.warn(`[Batch Engine] Warning: createFlowProjectAction did not return project ID, navigating to base tool URL...`);
      await page.goto('https://labs.google/fx/id/tools/flow', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const currentId = extractProjectIdFromUrl(page.url());
      if (currentId) {
        saveProjectId(profileName, currentId);
      }
    }

    await dismissOverlayModals(page);

    try {
      await page.waitForSelector(INPUT_SELECTOR, { state: 'visible', timeout: 20000 });
    } catch (e) {
      console.warn(`[Batch Engine] Retrying selector check for profile "${profileName}"...`);
      await dismissOverlayModals(page);
      await page.waitForSelector(INPUT_SELECTOR, { timeout: 20000 });
    }
  }

  // Setup network response listener for image generation
  page.on('response', async (response: Response) => {
    const url = response.url();
    if (url.includes('flowMedia:batchGenerateImages') || url.includes('batchGenerateImages')) {
      try {
        const status = response.status();
        const postData = response.request().postData();
        let reqPromptText = '';
        if (postData) {
          try {
            const reqJson = JSON.parse(postData);
            if (reqJson?.requests?.[0]?.structuredPrompt?.parts?.[0]?.text) {
              reqPromptText = reqJson.requests[0].structuredPrompt.parts[0].text;
            }
          } catch {}
        }

        // Extract segment ID from request payload prompt tag [SEG#ID]
        let reqSegId: number | null = null;
        if (reqPromptText) {
          const tagMatch = reqPromptText.match(/\[SEG#(\d+)\]/i);
          if (tagMatch && tagMatch[1]) {
            reqSegId = Number(tagMatch[1]);
          }
        }

        // Handle Network Level Error Responses (e.g. HTTP 400 PUBLIC_ERROR_UNSAFE_GENERATION / Safety policy filter)
        if (status !== 200) {
          let errorMsg = `HTTP Error ${status}`;
          let isDailyLimitError = status === 429;
          try {
            const errJson = await response.json();
            const reason = String(errJson?.error?.details?.[0]?.reason || errJson?.error?.message || errJson?.error?.status || '');
            if (reason) {
              if (reason.includes('QUOTA') || reason.includes('RESOURCE_EXHAUSTED') || reason.includes('DAILY')) {
                isDailyLimitError = true;
              }
              errorMsg = reason.includes('UNSAFE')
                ? '⚠️ Kebijakan Konten: Google Flow menolak prompt karena aturan keamanan (PUBLIC_ERROR_UNSAFE_GENERATION).'
                : `⚠️ Google Flow Error (${reason})`;
            }
          } catch {}

          if (isDailyLimitError) {
            if ((page as any).__isSwitchingModel) {
              console.warn(`[Batch Engine] 🛑 Discarded trailing HTTP ${status} limit error for segment #${reqSegId} (Model switch ALREADY in progress).`);
              return;
            }
            console.warn(`[Batch Engine] 🛑 Daily limit HTTP ${status} intercepted for segment #${reqSegId}. Preserving item in activeSlots for model/profile switch...`);
            (page as any).__dailyLimitHit = true;
            return;
          }

          if (reqSegId !== null && activeSlots.has(reqSegId)) {
            const slot = activeSlots.get(reqSegId);
            if (slot) {
              console.warn(`[Batch Engine] 🛑 Network payload intercepted HTTP ${status} error for segment #${reqSegId}: ${errorMsg}`);
              activeSlots.delete(reqSegId);
              clearTimeout(slot.timeoutId);
              slot.reject(new Error(errorMsg));
            }
          }
          return;
        }

        // Handle HTTP 200 OK Successful Image Generation Payload
        const json = await response.json();
        if (json?.media && Array.isArray(json.media)) {
          for (const mediaItem of json.media) {
            const genImg = mediaItem?.image?.generatedImage;
            const fifeUrl = genImg?.fifeUrl;
            const respPrompt = (genImg?.prompt || '').trim().toLowerCase();

            if (fifeUrl && activeSlots.size > 0) {
              let matchedSegId: number | null = reqSegId;
              
              // 1. Precise Tag matching from request payload tag or response prompt tag
              if (matchedSegId === null || !activeSlots.has(matchedSegId)) {
                const tagMatch = respPrompt.match(/\[SEG#(\d+)\]/i);
                if (tagMatch && tagMatch[1]) {
                  const segIdFromTag = Number(tagMatch[1]);
                  if (activeSlots.has(segIdFromTag)) {
                    matchedSegId = segIdFromTag;
                  }
                }
              }

              // 2. Substring matching if tag wasn't returned in response
              if (matchedSegId === null) {
                for (const [segId, slot] of activeSlots.entries()) {
                  const cleaned = slot.cleanedText.toLowerCase();
                  if (!respPrompt) continue;
                  const pHead = respPrompt.slice(0, 25);
                  const pTail = respPrompt.slice(-25);
                  if (
                    cleaned.includes(respPrompt) ||
                    respPrompt.includes(cleaned.slice(0, 25)) ||
                    (pHead && cleaned.includes(pHead)) ||
                    (pTail && cleaned.includes(pTail))
                  ) {
                    matchedSegId = segId;
                    break;
                  }
                }
              }

              // 3. Safe Fallback ONLY if activeSlots has exactly 1 item (unambiguous)
              if (matchedSegId === null && activeSlots.size === 1) {
                matchedSegId = activeSlots.keys().next().value;
              }

              if (matchedSegId !== null && matchedSegId !== undefined && activeSlots.has(matchedSegId)) {
                const slot = activeSlots.get(matchedSegId);
                if (slot) {
                  console.log(`[Batch Engine] Intercepted 200 OK image response for segment #${matchedSegId}: "${respPrompt.substring(0, 30)}..."`);
                  activeSlots.delete(matchedSegId);
                  clearTimeout(slot.timeoutId);
                  slot.resolve(fifeUrl);
                }
              } else {
                console.warn(`[Batch Engine] ⚠️ Received image response that did not match active slots unambiguously. Skipping assignment to prevent segment swapping. (Prompt: "${respPrompt.substring(0, 30)}...")`);
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Batch Engine] Error parsing response JSON:', e);
      }
    }
  });

  return { context, page, INPUT_SELECTOR };
}

function extractProjectIdFromUrl(urlStr: string): string | null {
  try {
    const match = urlStr.match(/\/project\/([a-f0-9\-]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Concurrent Queue Injection Persistent Batch Engine.
 * Submits prompts into Google Flow input box concurrently up to targetConcurrency (default 5),
 * maintaining active concurrent jobs in a single Chromium browser context.
 * Automatically switches AI model to "Banana 2" and profile to "user_2" if daily limit is reached.
 */
export async function runBatchPersistentQueue(options: BatchRunnerOptions): Promise<void> {
  const {
    items,
    headed = true,
    concurrency = 5,
    profiles = ['user_1', 'user_2'],
    models = ['Nano Banana Pro', 'Banana 2'],
  } = options;
  const targetConcurrency = Math.max(1, concurrency);
  let profileIdx = 0;
  let modelIdx = 0;
  let globalSubmissionCounter = 0;
  const processedFailedSegIds = new Set<number>();

  console.log(
    `[Batch Engine] Starting batch generation for ${items.length} item(s) (Concurrency: ${targetConcurrency}, Profiles: ${profiles.join(', ')}, Models: ${models.join(', ')})...`
  );

  const activeSlots = new Map<number, ActiveSlot>();
  let pendingQueue = [...items];
  let isTyping = false;

  let currentProfile = profiles[profileIdx] || 'user_1';
  let currentModel = models[modelIdx] || 'Nano Banana Pro';

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let INPUT_SELECTOR = 'div[contenteditable="true"], [contenteditable="true"], div[role="textbox"], textarea';

  try {
    const sessionData = await initSessionForProfile(currentProfile, options, activeSlots);
    context = sessionData.context;
    page = sessionData.page;
    INPUT_SELECTOR = sessionData.INPUT_SELECTOR;

    if (page && !page.isClosed()) {
      await ensureModelInUi(page, currentModel);
    }

    while (pendingQueue.length > 0 || activeSlots.size > 0) {
      // Check active page for Safety Policy Error Cards on DOM with precise segment tag matching
      if (page && !page.isClosed() && activeSlots.size > 0) {
        const failedIds = await detectSafetyPolicyErrorCards(page, activeSlots);
        for (const segId of failedIds) {
          if (!processedFailedSegIds.has(segId)) {
            processedFailedSegIds.add(segId);
            const slot = activeSlots.get(segId);
            if (slot) {
              console.warn(`[Batch Engine] 🛑 Safety policy / DOM error detected on Google Flow for Segment #${segId}`);
              activeSlots.delete(segId);
              clearTimeout(slot.timeoutId);
              slot.reject(new Error('⚠️ Kebijakan Konten: Google Flow menolak prompt karena aturan keamanan.'));
              await deleteFailedLimitCards(page);
            }
          }
        }
      }

      // Check daily limit on active page
      if (page && !page.isClosed()) {
        const isLimit = await detectDailyLimit(page);
        if (isLimit) {
          if ((page as any).__isSwitchingModel) {
            console.warn('[Batch Engine] 🛑 Limit check ignored because model/profile switch is ALREADY in progress.');
            continue;
          }
          (page as any).__isSwitchingModel = true;
          (page as any).__dailyLimitHit = false;

          console.warn(`[Batch Engine] 🛑 Daily limit detected on profile "${currentProfile}" (Model: ${currentModel})!`);
          await deleteFailedLimitCards(page);

          // Return active slots back to pending queue in exact original order so no work is lost
          const interruptedItems = Array.from(activeSlots.values()).map((s) => s.item).filter(Boolean);
          for (const [segId, slot] of activeSlots.entries()) {
            clearTimeout(slot.timeoutId);
          }
          activeSlots.clear();
          pendingQueue = [...interruptedItems, ...pendingQueue];

          // Phase 1 Fallback: Try next AI model on the current profile
          modelIdx++;
          if (modelIdx < models.length) {
            currentModel = models[modelIdx];
            console.log(`[Batch Engine] 🔄 Model limit hit on profile "${currentProfile}". Reloading page & switching AI Model to "${currentModel}" (${pendingQueue.length} items remaining)...`);
            if (options.onItemLog) {
              options.onItemLog(
                0,
                `🛑 Batas harian ${models[modelIdx - 1]} tercapai pada ${currentProfile}. 🔄 Mengubah Model AI ke "${currentModel}"...`
              );
            }

            // Reload page to clear old error cards from DOM so detectDailyLimit doesn't re-trigger falsely
            try {
              if (page && !page.isClosed()) {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await dismissOverlayModals(page);
                await deleteFailedLimitCards(page);
              }
            } catch (err: any) {
              console.warn('[Batch Engine] Warning: Page reload failed, continuing with model switch:', err.message);
            }

            if (page && !page.isClosed()) {
              await ensureModelInUi(page, currentModel);
              await page.waitForTimeout(1500);
            }

            // Clear any trailing limit flags that arrived during reload
            (page as any).__dailyLimitHit = false;
            (page as any).__isSwitchingModel = false;
            continue;
          }

          // Phase 2 Fallback: All models exhausted on current profile -> switch to next profile
          modelIdx = 0;
          currentModel = models[0];

          if (context) {
            try { await context.close(); } catch {}
            context = null;
            page = null;
          }

          profileIdx++;
          if (profileIdx < profiles.length) {
            currentProfile = profiles[profileIdx];
            console.log(`[Batch Engine] 🔄 Profile "${profiles[profileIdx - 1]}" exhausted. Auto-switching to Profile "${currentProfile}" (${pendingQueue.length} items remaining)...`);
            if (options.onItemLog) {
              options.onItemLog(
                0,
                `🛑 Batas harian tercapai pada ${profiles[profileIdx - 1]}. 🔄 Mengalihkan ke Profile ${currentProfile}...`
              );
            }

            const newSession = await initSessionForProfile(currentProfile, options, activeSlots);
            context = newSession.context;
            page = newSession.page;
            INPUT_SELECTOR = newSession.INPUT_SELECTOR;
            await ensureModelInUi(page, currentModel);
            await page.waitForTimeout(1500);

            // Clear any trailing limit flags
            (page as any).__dailyLimitHit = false;
            (page as any).__isSwitchingModel = false;
            continue;
          } else {
            console.error(`[Batch Engine] ❌ All profiles (${profiles.join(', ')}) and models (${models.join(', ')}) reached daily limit!`);
            for (const item of pendingQueue) {
              if (item && options.onItemError) {
                options.onItemError(
                  item.segment_id,
                  'LIMIT_REACHED: Semua Profile Chrome (user_1 & user_2) dan Model AI telah mencapai batas harian.'
                );
              }
            }
            pendingQueue = [];
            (page as any).__isSwitchingModel = false;
            break;
          }
        }
      }

      // If active pool has capacity and queue has items and no typing in progress:
      if (page && !page.isClosed() && activeSlots.size < targetConcurrency && pendingQueue.length > 0 && !isTyping) {
        const item = pendingQueue.shift();
        if (!item || !item.prompt) continue;

        const cleanedText = item.prompt.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
        const hasTag = /^\[SEG#\d+\]/i.test(cleanedText) || /^\[Segment\s*\d+\]/i.test(cleanedText);
        const taggedPrompt = hasTag ? cleanedText : `[SEG#${item.segment_id}] ${cleanedText}`;
        globalSubmissionCounter++;
        const currentOrder = globalSubmissionCounter;

        if (options.onItemStart) {
          options.onItemStart(item.segment_id);
        }

        // Create promise for this item
        const itemPromise = new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            activeSlots.delete(item.segment_id);
            reject(new Error('TIMEOUT'));
          }, 85000);

          activeSlots.set(item.segment_id, {
            segment_id: item.segment_id,
            prompt: item.prompt,
            cleanedText,
            taggedPrompt,
            submissionOrder: currentOrder,
            item,
            resolve: (url: string) => {
              clearTimeout(timeoutId);
              resolve(url);
            },
            reject: (err: Error) => {
              clearTimeout(timeoutId);
              reject(err);
            },
            timeoutId,
          });
        });

        itemPromise.then(
          (fifeUrl) => {
            console.log(`[Batch Engine] Segment #${item.segment_id} completed successfully (Profile: ${currentProfile}, Model: ${currentModel}).`);
            if (options.onItemLog) options.onItemLog(item.segment_id, `🎉 Image generated successfully (${currentProfile} — ${currentModel})!`);
            if (options.onItemSuccess) {
              options.onItemSuccess(item.segment_id, { success: true, images: [{ url: fifeUrl }] });
            }
          },
          (err) => {
            console.warn(`[Batch Engine] Segment #${item.segment_id} failed:`, err?.message || err);
            if (options.onItemError) options.onItemError(item.segment_id, err?.message || String(err));
          }
        );

        // Submit prompt into Google Flow textbox (Instant Paste with Tagged Prompt)
        isTyping = true;
        try {
          if (options.onItemLog) options.onItemLog(item.segment_id, '✍️ Preparing prompt...');
          await ensureModelInUi(page, currentModel);

          const input = await page.$(INPUT_SELECTOR);
          if (!input) throw new Error('Prompt input field not found on Google Flow page');

          await input.click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(50);

          if (options.onItemLog) {
            options.onItemLog(item.segment_id, `📋 Instant pasting prompt #${item.segment_id} [${currentProfile} — ${currentModel}] (active pool: ${activeSlots.size}/${targetConcurrency})...`);
          }

          // Instant paste insertion of tagged prompt:
          await page.keyboard.insertText(taggedPrompt);
          await page.waitForTimeout(100);

          // Fallback check: if text is empty, set textContent & dispatch events
          const currentVal = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            return el ? el.textContent || '' : '';
          }, INPUT_SELECTOR);

          if (!currentVal.trim()) {
            await page.evaluate(({ sel, text }) => {
              const el = document.querySelector(sel) as HTMLElement;
              if (el) {
                el.focus();
                el.textContent = text;
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, { sel: INPUT_SELECTOR, text: taggedPrompt });
            await page.waitForTimeout(100);
          }

          console.log(`[Batch Engine] Submitting prompt #${item.segment_id} [SEG#${item.segment_id}] to Google AI [${currentProfile} — ${currentModel}] (Active slots: ${activeSlots.size})...`);
          const arrowBtn = await page.$('button:has(i:has-text("arrow_forward"))');
          if (arrowBtn && (await arrowBtn.isVisible())) {
            await arrowBtn.click({ force: true });
          } else {
            await page.keyboard.press('Enter');
          }

          if (options.onItemLog) {
            options.onItemLog(item.segment_id, `📩 Prompt Submitted [${currentProfile} — ${currentModel}]! Processing in Google Flow...`);
          }

          // Brief pause after submission before pasting next prompt
          await page.waitForTimeout(300);
        } catch (err: any) {
          console.warn(`[Batch Engine] Error typing prompt for seg #${item.segment_id}:`, err.message);
          const slot = activeSlots.get(item.segment_id);
          if (slot) {
            activeSlots.delete(item.segment_id);
            slot.reject(err);
          }
        } finally {
          isTyping = false;
        }
      }

      await page?.waitForTimeout(200);
    }

  } catch (err: any) {
    console.error('[Batch Engine] Global Exception:', err);
  } finally {
    if (context) {
      if (options.keepBrowserOpen) {
        console.log('[Batch Engine] 👁️ Batch runner completed/paused. Keeping Chromium browser OPEN for inspection.');
      } else {
        console.log('[Batch Engine] Queue complete. Closing browser context...');
        try {
          await context.close();
        } catch { }
      }
    }
  }
}
