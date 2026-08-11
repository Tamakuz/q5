import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface AttachDriveFileOptions {
  timeout?: number;
}

export interface AttachDriveFileResult {
  success: boolean;
  fileName: string;
  error?: string;
}

/**
 * Action: Searches for a file in Google Drive via AI Studio media picker and attaches it using double-click.
 * If file is not found in Drive, automatically switches to Upload tab and uploads local file fallback.
 */
export async function attachDriveFileAction(
  page: Page,
  fileName: string,
  options: AttachDriveFileOptions = {}
): Promise<AttachDriveFileResult> {
  const timeout = options.timeout || config.defaultTimeout;

  console.log(`[AI Studio Action] Attaching Drive File: "${fileName}"...`);

  // Step 1: Open Add Media menu (+ button)
  const addMediaBtn = page.locator('[data-test-id="add-media-button"]').or(
    page.getByRole('button', { name: /add files|insert|add media/i })
  ).first();

  await addMediaBtn.waitFor({ state: 'visible', timeout: 15000 });
  await addMediaBtn.click();

  // Step 2: Click 'Drive' option from popup menu (use .first() to prevent strict mode violation)
  const driveMenuItem = page.getByRole('menuitem', { name: 'Drive' })
    .or(page.getByText('Drive', { exact: true }))
    .first();

  await driveMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await driveMenuItem.click();

  // Step 3: Wait for the latest active Google Drive Picker iframe (.last())
  const iframeLocator = page.locator('iframe[name^="I0_"], iframe[src*="picker"]').last();
  await iframeLocator.waitFor({ state: 'visible', timeout: 15000 });

  const pickerFrame = page.frameLocator('iframe[name^="I0_"], iframe[src*="picker"]').last();

  // Step 4: Click 'Recent' tab if present
  try {
    const recentTab = pickerFrame.getByRole('tab', { name: 'Recent' });
    if (await recentTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await recentTab.click();
    }
  } catch {
    // Optional tab click
  }

  // Step 5: Search in Drive input
  const searchInput = pickerFrame.getByRole('combobox', { name: 'Search in Drive or paste URL' })
    .or(pickerFrame.locator('input[type="text"]').first());

  await searchInput.waitFor({ state: 'visible', timeout: 10000 });
  await searchInput.click();
  await searchInput.fill(fileName);
  await searchInput.press('Enter');

  console.log(`[AI Studio Action] Waiting for search result item "${fileName}"...`);

  // Step 6: Target file item in search results
  const fileItem = pickerFrame.getByLabel(fileName, { exact: false })
    .or(pickerFrame.locator(`[aria-label*="${fileName}"]`))
    .first();

  const emptyStateLocator = pickerFrame.getByText('No matching results')
    .or(pickerFrame.getByText('Try another search'))
    .or(pickerFrame.locator('.mQY6Zc'))
    .first();

  let isFileFound = false;
  try {
    await Promise.race([
      fileItem.waitFor({ state: 'visible', timeout: 10000 }).then(() => { isFileFound = true; }),
      emptyStateLocator.waitFor({ state: 'visible', timeout: 10000 }).then(() => { isFileFound = false; }),
    ]);
  } catch {
    isFileFound = await fileItem.isVisible().catch(() => false);
  }

  if (!isFileFound) {
    console.log(`[AI Studio Action] ⚠️ Asset file "${fileName}" NOT found in Drive search results.`);
    
    // Auto-fallback: Check if local file exists in input/alurfilm/compress/ or exact path
    const possiblePaths = [
      fileName,
      path.join(process.cwd(), 'input', 'alurfilm', 'compress', `${fileName}.mp4`),
      path.join(process.cwd(), 'input', 'alurfilm', 'compress', fileName),
    ];
    const resolvedPath = possiblePaths.find(p => fs.existsSync(p));

    if (resolvedPath) {
      console.log(`[AI Studio Action] 🔄 File not found in Drive. Clicking 'Back' and switching to 'Upload' tab for local file: "${resolvedPath}"...`);
      
      // Step A: In search view, tabs are hidden behind the Back button. Click 'Back' button first!
      try {
        const backBtn = pickerFrame.getByRole('button', { name: /back|kembali/i })
          .or(pickerFrame.locator('[aria-label*="Back"], [aria-label*="Kembali"], button:has-text("Back")'))
          .first();

        if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (err) {
        console.warn('[AI Studio Action] Note clicking Back button in Drive picker:', err);
      }

      // Step B: Now click the 'Upload' tab
      const uploadTab = pickerFrame.getByRole('tab', { name: 'Upload' })
        .or(pickerFrame.getByText('Upload', { exact: true }))
        .first();

      await uploadTab.waitFor({ state: 'visible', timeout: 8000 });
      await uploadTab.click();
      await page.waitForTimeout(1000);

      // Step C: Inject local file into input[type="file"]
      const fileInput = pickerFrame.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 10000 });
      await fileInput.setInputFiles(resolvedPath);

      console.log(`[AI Studio Action] Uploading... waiting for completion...`);
      const uploadingDialog = pickerFrame.locator('div:has-text("Cancel"), [role="progressbar"]').first();
      try {
        if (await uploadingDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
          await uploadingDialog.waitFor({ state: 'hidden', timeout: 180000 });
          console.log(`[AI Studio Action] Upload progress finished.`);
        }
      } catch {}

      try {
        const insertBtn = pickerFrame.getByRole('button', { name: /insert \d+ item|insert|select/i })
          .or(pickerFrame.locator('button:has-text("Insert"), [role="button"]:has-text("Insert")'))
          .first();

        if (await insertBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await insertBtn.click({ force: true });
          console.log(`[AI Studio Action] Clicked "Insert" button after upload.`);
        }
      } catch {}

      await iframeLocator.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);

      console.log(`[AI Studio Action] ✅ Local File "${path.basename(resolvedPath)}" uploaded & attached successfully as fallback!`);
      return {
        success: true,
        fileName: path.basename(resolvedPath),
      };
    }

    return {
      success: false,
      fileName,
      error: 'FILE_NOT_FOUND',
    };
  }

  // Step 7: Double-click the file item to insert directly!
  console.log(`[AI Studio Action] ✅ Found "${fileName}". Double-clicking to insert...`);
  await fileItem.click();
  await page.waitForTimeout(200);
  await fileItem.dblclick({ force: true });

  // Fallback: If "Insert 1 item" / "Insert" button is still visible, click it as well
  try {
    const insertBtn = pickerFrame.getByRole('button', { name: /insert/i }).first();
    if (await insertBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await insertBtn.click({ force: true }).catch(() => {});
    }
  } catch {
    // Ignore if button already disappeared
  }

  // Wait for iframe picker to disappear / close
  await iframeLocator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

  // Wait 2 seconds for attachment chip to settle in prompt editor
  await page.waitForTimeout(2000);

  console.log(`[AI Studio Action] ✅ Drive File "${fileName}" double-clicked and inserted.`);

  return {
    success: true,
    fileName,
  };
}
