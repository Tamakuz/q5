// playwright/actions/attach-drive-file.ts
import { Page } from 'playwright';
import path from 'path';
import { Command } from 'commander';
import { loadProjectState, updateStateResource } from '../../lib/state';
import { dismissPopups } from '../aistudio';

export interface AttachDriveFileOptions {
  searchTerm?: string; // Content ID or filename to search in Google Drive
  filePath?: string;    // Local file path to upload if missing in Drive
  timeoutMs?: number;
}

/**
 * Action 2 (Drive Mode): Select file from Google Drive picker inside Google AI Studio,
 * or upload via Drive Picker's "Upload" tab if missing.
 */
export async function attachDriveFile(
  page: Page,
  options: AttachDriveFileOptions = {}
): Promise<string | null> {
  const state = loadProjectState();
  
  // ⚠️ CRITICAL: Strip file extension (.mp4, etc.) for Google Drive search query
  const rawSearchTerm = options.searchTerm || state.drive_search_query || `${state.content_id}_video_trimmed`;
  const cleanSearchTerm = rawSearchTerm.replace(/\.[^/.]+$/, '');

  console.log(`☁️ Checking Google Drive in AI Studio...`);
  console.log(`🆔 Content ID: ${state.content_id}`);
  console.log(`🔎 Clean Search Term (No Extension): "${cleanSearchTerm}"`);

  // Check & click dynamic popups ("Continue", etc.) before proceeding
  await dismissPopups(page);

  // Wait for prompt area to load
  await page.waitForSelector('textarea, [contenteditable="true"]', { timeout: 15000 });

  // 1. Locate '+' / 'Insert' button near prompt input area
  const plusButtonSelectors = [
    'button[aria-label*="Insert"]',
    'button[aria-label*="Add"]',
    'button[aria-label*="Upload"]',
    'button[mattooltip*="Insert"]',
    'button[mattooltip*="Add"]',
    'ms-prompt-input button',
    'button:has-text("+")',
  ];

  let plusBtn = null;
  for (const sel of plusButtonSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      plusBtn = loc;
      console.log(`🔍 Found insert button using selector: ${sel}`);
      break;
    }
  }

  if (!plusBtn) {
    await dismissPopups(page);
    for (const sel of plusButtonSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        plusBtn = loc;
        break;
      }
    }
  }

  if (!plusBtn) {
    throw new Error('Could not find (+) Insert button in AI Studio prompt bar.');
  }

  console.log('🔘 Clicking (+) Insert button...');
  await plusBtn.click();
  await page.waitForTimeout(1000);

  // 2. Click "Drive" menu item
  const driveMenuItem = page.locator('button, [role="menuitem"], mat-option, div, span')
    .filter({ hasText: /^Drive$|^Google Drive$/i })
    .first();

  await driveMenuItem.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

  let targetDriveBtn = driveMenuItem;
  if (!(await targetDriveBtn.isVisible().catch(() => false))) {
    targetDriveBtn = page.locator('text=/Drive/i').first();
  }

  if (!(await targetDriveBtn.isVisible({ timeout: 4000 }).catch(() => false))) {
    throw new Error('Google Drive menu item not found in (+) dropdown.');
  }

  console.log('📂 Clicking "Drive" menu item...');
  await targetDriveBtn.click({ force: true });
  await page.waitForTimeout(2500);

  // 3. Locate Google Drive Picker Frame
  console.log('⏳ Waiting for Google Drive picker iframe to open...');
  await page.waitForSelector('iframe.picker-frame, iframe[src*="picker"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  let pickerFrame = page.frames().find(f => f.url().includes('picker'));
  if (!pickerFrame) {
    await page.waitForTimeout(2000);
    pickerFrame = page.frames().find(f => f.url().includes('picker'));
  }

  const pickerIframeLocator = page.frameLocator('iframe.picker-frame, iframe[src*="picker"]');
  const isIframe = !!pickerFrame;

  console.log(`📌 Picker container type: ${isIframe ? 'iframe (Frame found)' : 'page modal'}`);

  // 4. Search for the exact file in Google Drive (WITHOUT extension)
  if (cleanSearchTerm) {
    console.log(`🔎 Locating search input box in Drive picker...`);
    
    let searchInput = null;

    if (pickerFrame) {
      // Check if search icon needs to be clicked first
      const searchBtn = pickerFrame.locator('.picker-search-button, button[aria-label*="Search"]').first();
      if (await searchBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await searchBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }

      // Locate search input inside pickerFrame
      const candidates = [
        pickerFrame.locator('input[type="text"]').first(),
        pickerFrame.locator('input[aria-label*="Search"]').first(),
        pickerFrame.locator('input[placeholder*="Search"]').first(),
        pickerFrame.locator('input').first(),
      ];

      for (const cand of candidates) {
        if (await cand.isVisible({ timeout: 3000 }).catch(() => false)) {
          searchInput = cand;
          break;
        }
      }
    }

    if (!searchInput) {
      const candidates = [
        pickerIframeLocator.locator('input[type="text"]').first(),
        pickerIframeLocator.locator('input[aria-label*="Search"]').first(),
        pickerIframeLocator.locator('input').first(),
        page.locator('input[placeholder*="Search Drive"]').first(),
      ];
      for (const cand of candidates) {
        if (await cand.isVisible({ timeout: 2000 }).catch(() => false)) {
          searchInput = cand;
          break;
        }
      }
    }

    if (searchInput) {
      console.log(`🔎 Typing search query: "${cleanSearchTerm}"...`);
      await searchInput.click({ force: true }).catch(() => {});
      await searchInput.fill('');
      await searchInput.pressSequentially(cleanSearchTerm, { delay: 40 });
      await page.keyboard.press('Enter');
      
      console.log('⏳ Waiting 6 seconds for Google Drive search query results to load...');
      await page.waitForTimeout(6000);
      console.log('✅ Google Drive search query wait complete!');
    } else {
      console.log('⚠️ Could not locate search input box in Drive picker.');
    }
  }

  // 5. Check search results for matching file card using Content ID
  console.log(`🔍 Checking search results for Content ID: "${state.content_id}"...`);

  const itemLocators = [
    pickerFrame ? pickerFrame.locator(`[role="option"]:has-text("${state.content_id}")`).first() : null,
    pickerFrame ? pickerFrame.locator(`[aria-label*="${state.content_id}"]`).first() : null,
    pickerFrame ? pickerFrame.locator(`[title*="${state.content_id}"]`).first() : null,
    pickerFrame ? pickerFrame.locator(`.picker-item:has-text("${state.content_id}")`).first() : null,
    pickerFrame ? pickerFrame.locator(`div:has-text("${state.content_id}")`).first() : null,
    pickerIframeLocator.locator(`[role="option"]:has-text("${state.content_id}")`).first(),
    page.locator(`[role="option"]:has-text("${state.content_id}")`).first(),
    page.locator(`[aria-label*="${state.content_id}"]`).first(),
  ].filter((loc): loc is NonNullable<typeof loc> => loc !== null);

  let targetItem = null;
  for (const loc of itemLocators) {
    if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
      targetItem = loc;
      console.log(`🎯 Found matching file card in Drive using Content ID!`);
      break;
    }
  }

  // 6. IF FILE IS FOUND IN DRIVE: Click item -> Click "Insert" button
  if (targetItem) {
    console.log(`✅ File card "${cleanSearchTerm}" selected!`);
    await targetItem.click({ force: true });
    await page.waitForTimeout(800);

    console.log('🔘 Clicking "Insert" button in Drive picker footer...');
    const insertBtnLocators = [
      pickerFrame ? pickerFrame.locator('button:has-text("Insert"), button[aria-label*="Insert"]').first() : null,
      pickerIframeLocator.locator('button:has-text("Insert"), button[aria-label*="Insert"]').first(),
      page.locator('button:has-text("Insert"), button[aria-label*="Insert"]').first(),
      page.locator('.picker-btn-aria-label:has-text("Insert")').first(),
    ].filter((loc): loc is NonNullable<typeof loc> => loc !== null);

    let inserted = false;
    for (const btn of insertBtnLocators) {
      if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
        await btn.click({ force: true });
        inserted = true;
        console.log('✅ Clicked "Insert" button in Drive picker!');
        break;
      }
    }

    if (!inserted) {
      console.log('ℹ️ Insert button not clicked directly, double-clicking file card fallback...');
      await targetItem.dblclick({ force: true }).catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
    }

    await page.waitForTimeout(4000);
    console.log(`✅ File attached from Google Drive successfully!`);
    updateStateResource('video_trimmed', `drive://${cleanSearchTerm}`);
    return cleanSearchTerm;
  }

  // 7. IF FILE IS NOT IN DRIVE ("No matching results"): Back -> Upload Tab -> Set File
  console.log(`\n⚠️ FILE DENGAN NAMA PERSIS BELUM ADA DI GOOGLE DRIVE! ("No matching results")`);
  
  // Step 7A: Click exact "← Back" button [aria-label="Back"] in Drive picker header
  console.log('⬅️ Clicking real "← Back" button in Drive picker header...');
  
  let backClicked = false;
  const realBackBtn = pickerFrame ? pickerFrame.locator('[aria-label="Back"]').first() : page.locator('[aria-label="Back"]').first();
  if (await realBackBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await realBackBtn.click({ force: true });
    backClicked = true;
    console.log(`✅ Clicked real "← Back" button in Drive picker!`);
  } else {
    console.log('ℹ️ Real Back button not visible directly, searching fallback Back selectors...');
    const backLocators = [
      pickerFrame ? pickerFrame.locator('button:has-text("Back"), div:has-text("Back"), [aria-label*="Back"]').first() : null,
      pickerIframeLocator.locator('button:has-text("Back"), div:has-text("Back"), [aria-label*="Back"]').first(),
    ].filter((loc): loc is NonNullable<typeof loc> => loc !== null);

    for (const b of backLocators) {
      if (await b.isVisible({ timeout: 1500 }).catch(() => false)) {
        await b.click({ force: true });
        backClicked = true;
        console.log(`✅ Clicked fallback "Back" button in Drive picker!`);
        break;
      }
    }
  }

  await page.waitForTimeout(1500);

  // Step 7B: Click "Upload" tab inside Drive Picker
  console.log('📂 Clicking "Upload" tab in Drive Picker...');
  let uploadTabClicked = false;

  const uploadTabLocators = [
    pickerFrame ? pickerFrame.locator('[role="tab"]:has-text("Upload"), div:has-text("Upload"), span:has-text("Upload")').filter({ hasText: /^Upload$/i }).first() : null,
    pickerIframeLocator.locator('[role="tab"]:has-text("Upload"), div:has-text("Upload"), span:has-text("Upload")').filter({ hasText: /^Upload$/i }).first(),
    page.locator('[role="tab"]:has-text("Upload"), div:has-text("Upload"), span:has-text("Upload")').filter({ hasText: /^Upload$/i }).first(),
  ].filter((loc): loc is NonNullable<typeof loc> => loc !== null);

  for (const tab of uploadTabLocators) {
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click({ force: true }).catch(() => {});
      uploadTabClicked = true;
      console.log('✅ Clicked "Upload" tab in Drive Picker!');
      break;
    }
  }

  await page.waitForTimeout(3000);

  // Step 7C: Upload local video file via "Browse" button or input[type="file"]
  const localFilePath = options.filePath || state.resources.video_trimmed || path.resolve('input/assets', `${state.content_id}_video_trimmed.mp4`);
  console.log(`📤 Uploading file to Google Drive via Upload Tab: ${path.basename(localFilePath)}`);

  let uploadAttached = false;

  // Primary Method: Click "Browse" button in Drive Picker Upload tab with filechooser listener
  for (const fr of page.frames()) {
    const browseBtn = fr.locator('button, div, span, [role="button"]').filter({ hasText: /Browse|Select files/i }).first();
    if (await browseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`🔘 Found "Browse" button in frame (${fr.url().slice(0, 45)}...), opening file chooser...`);
      try {
        const chooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
        await browseBtn.click({ force: true });
        const chooser = await chooserPromise;
        await chooser.setFiles(localFilePath);
        uploadAttached = true;
        console.log('🎉 File set via "Browse" button file chooser in Drive Picker!');
        break;
      } catch (e: any) {
        console.log(`ℹ️ Browse button click note: ${e.message}`);
      }
    }
  }

  // Fallback Method: Target any file input across frames directly
  if (!uploadAttached) {
    for (const fr of page.frames()) {
      try {
        const fileInputs = fr.locator('input[type="file"]');
        const count = await fileInputs.count().catch(() => 0);
        if (count > 0) {
          await fileInputs.first().setInputFiles(localFilePath);
          uploadAttached = true;
          console.log('✅ Local file set via frame input[type="file"]!');
          break;
        }
      } catch (e: any) {}
    }
  }

  if (!uploadAttached) {
    throw new Error('Failed to set local file in Drive Picker Upload tab.');
  }

  // Step 7D: Wait for upload progress bar to finish & auto-attach
  console.log('⏳ Waiting for file upload progress to complete in Google Drive...');
  await page.waitForTimeout(15000);
  console.log('🎉 File uploaded to Google Drive & automatically attached to AI Studio!');

  updateStateResource('video_trimmed', `drive://${cleanSearchTerm}`);
  return cleanSearchTerm;
}

// ─── Direct CLI Runner ────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('attach-drive-file.ts')) {
  const program = new Command();
  program
    .name('aistudio:drive')
    .description('Action 2 (Drive Mode): Select file from Google Drive in AI Studio')
    .option('-s, --search <string>', 'Search term (Content ID or filename) in Google Drive')
    .option('-a, --account <string>', 'Google account profile name (e.g. user2)', 'user2')
    .action(async (opts) => {
      const { launchAIStudioSession } = await import('../aistudio');
      const { page } = await launchAIStudioSession({ accountName: opts.account, headless: false });
      try {
        const result = await attachDriveFile(page, { searchTerm: opts.search });
        if (result) {
          console.log('🎉 Drive file attached in AI Studio window!');
        } else {
          console.log('💡 Workflow halted as file with exact name was not found in Drive.');
        }
      } catch (err: any) {
        console.error(`❌ Drive Attach Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
