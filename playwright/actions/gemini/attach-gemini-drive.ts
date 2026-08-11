import { Page } from 'playwright';
import path from 'path';
import { dismissGeminiModalsAction } from './dismiss-gemini-modals';

export interface AttachGeminiDriveOptions {
  timeout?: number;
}

export interface AttachGeminiDriveResult {
  success: boolean;
  fileName: string;
  error?: string;
}

/**
 * Action: Opens Google Drive picker on gemini.google.com/app, connects extension if prompted,
 * searches for the target file WITHOUT file extension (e.g. "WV-FILM-20260811-CTBB_part_04"),
 * and double-clicks to attach it. Closes Drive Picker modal if file is NOT FOUND.
 */
export async function attachGeminiDriveFileAction(
  page: Page,
  fileName: string,
  options: AttachGeminiDriveOptions = {}
): Promise<AttachGeminiDriveResult> {
  const timeout = options.timeout || 35000;

  // Extract basename and strip file extension (e.g. "WV-FILM-20260811-CTBB_part_04.mp4" -> "WV-FILM-20260811-CTBB_part_04")
  const searchBasename = path.basename(fileName);
  const searchQuery = path.parse(searchBasename).name;

  console.log(`[Gemini Action] Searching Google Drive without file extension: "${searchQuery}" (Original: "${searchBasename}")...`);

  await dismissGeminiModalsAction(page);

  // Step 1: Click "Upload & alat" button
  const uploadBtn = page.getByRole('button', { name: /Upload & alat|Upload|Add/i })
    .or(page.locator('button[aria-label*="Upload" i], button[aria-label*="Add" i], button.uploader-button'))
    .first();

  await uploadBtn.waitFor({ state: 'visible', timeout: 10000 });
  await uploadBtn.click({ force: true });
  await page.waitForTimeout(600);

  // Step 2: Click Drive button ([data-test-id="uploader-drive-button"])
  const driveBtn = page.locator('[data-test-id="uploader-drive-button"]')
    .or(page.getByRole('menuitem', { name: /drive/i }))
    .or(page.locator('button:has-text("Drive"), [role="menuitem"]:has-text("Drive")'))
    .first();

  await driveBtn.waitFor({ state: 'visible', timeout: 10000 });
  await driveBtn.click({ force: true });
  await page.waitForTimeout(1000);

  // Step 3: Handle "Hubungkan" / "Connect" permission dialog if prompted
  const connectBtn = page.getByRole('button', { name: /Hubungkan|Connect/i })
    .or(page.locator('button:has-text("Hubungkan"), button:has-text("Connect")'))
    .first();

  if (await connectBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    console.log('[Gemini Action] "Hubungkan" Drive extension button detected. Clicking to authorize...');
    await connectBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Step 4: Access Google Drive Picker iframe
  const pickerIframeLocator = page.locator('iframe[name^="I0_"], iframe[src*="picker"]').last();
  await pickerIframeLocator.waitFor({ state: 'attached', timeout: 15000 });

  const frame = pickerIframeLocator.contentFrame();
  if (!frame) {
    throw new Error('Failed to access Google Drive Picker iframe contentFrame.');
  }

  console.log('[Gemini Action] Drive Picker iframe accessed. Searching for file...');

  // Step 5: Search box inside Drive Picker ("Telusuri di Drive atau tempel")
  const searchBox = frame.getByRole('combobox', { name: /Telusuri di Drive|Search in Drive|tempel/i })
    .or(frame.locator('input[type="text"], input[aria-label*="Search" i], input[aria-label*="Telusuri" i]'))
    .first();

  await searchBox.waitFor({ state: 'visible', timeout: 10000 });
  await searchBox.hover({ force: true }).catch(() => {});
  await searchBox.click({ force: true });
  await page.waitForTimeout(300);

  await searchBox.fill(searchQuery);
  await page.keyboard.press('Enter');

  console.log(`[Gemini Action] Drive search query "${searchQuery}" submitted. Waiting for search results...`);
  await page.waitForTimeout(2000);

  // Step 6: Detect file match vs empty state ("Tidak ada hasil yang cocok")
  const targetItem = frame.getByRole('option', { name: searchQuery }).first()
    .or(frame.getByLabel(searchQuery, { exact: false }))
    .or(frame.locator(`[aria-label*="${searchQuery}" i], div[role="option"]:has-text("${searchQuery}")`))
    .first();

  const emptyState = frame.getByText(/Tidak ada hasil yang cocok|no matching results|Coba penelusuran lain/i)
    .or(frame.locator('.mQY6Zc'))
    .first();

  const searchOutcome = await Promise.race([
    targetItem.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'found').catch(() => null),
    emptyState.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'empty').catch(() => null),
  ]);

  if (searchOutcome === 'empty' || !searchOutcome) {
    console.warn(`[Gemini Action] ⚠️ File "${searchQuery}" NOT FOUND in Google Drive ("Tidak ada hasil yang cocok").`);
    
    // Close Drive Picker modal using exact close button or Escape
    const closeBtn = frame.getByRole('button', { name: /Tutup pemilih|Tutup|Close/i })
      .or(frame.locator('button[aria-label*="Tutup" i], button[aria-label*="Close" i]'))
      .first();

    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('[Gemini Action] Closing Drive Picker modal via "Tutup pemilih Pilih file" button...');
      await closeBtn.click({ force: true }).catch(() => {});
    } else {
      console.log('[Gemini Action] Closing Drive Picker modal via Escape key...');
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(1000);

    return {
      success: false,
      fileName,
      error: `File "${searchQuery}" not found in Drive.`,
    };
  }

  // Step 7: Double click to select and insert file
  console.log(`[Gemini Action] Found Drive match for "${searchQuery}". Double-clicking to insert asset...`);
  await targetItem.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  await targetItem.dblclick({ force: true });

  await page.waitForTimeout(3000);

  console.log(`[Gemini Action] ✅ Drive file "${searchQuery}" attached successfully.`);

  return {
    success: true,
    fileName,
  };
}
