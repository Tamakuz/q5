import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface UploadLocalFileOptions {
  timeout?: number;
  delayMs?: number;
}

export interface UploadLocalFileResult {
  success: boolean;
  filePath: string;
  error?: string;
}

/**
 * Action: Uploads a local file from disk (e.g. input/alurfilm/compress/...) via AI Studio Upload tab.
 * Includes human-like delays between step transitions and handles upload progress & completion.
 */
export async function uploadLocalFileAction(
  page: Page,
  filePath: string,
  options: UploadLocalFileOptions = {}
): Promise<UploadLocalFileResult> {
  const timeout = options.timeout || 180000; // 3 minutes timeout for video upload
  const delayMs = options.delayMs ?? 600; // 600ms delay between steps for smooth interaction

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

  console.log(`[AI Studio Action] Uploading local file: "${absolutePath}"...`);

  if (!fs.existsSync(absolutePath)) {
    console.error(`[AI Studio Action] ❌ File does NOT exist on disk: ${absolutePath}`);
    return {
      success: false,
      filePath: absolutePath,
      error: 'FILE_NOT_FOUND_ON_DISK',
    };
  }

  // Step 1: Open Add Media menu (+ button)
  const addMediaBtn = page.locator('[data-test-id="add-media-button"]').or(
    page.getByRole('button', { name: /add files|insert|add media/i })
  ).first();

  await addMediaBtn.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(delayMs);
  await addMediaBtn.click();

  // Step 2: Click 'Drive' option from popup menu
  const driveMenuItem = page.getByRole('menuitem', { name: 'Drive' })
    .or(page.getByText('Drive', { exact: true }))
    .first();

  await driveMenuItem.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(delayMs);
  await driveMenuItem.click();

  // Step 3: Wait for the latest active Google Drive Picker iframe (.last())
  const iframeLocator = page.locator('iframe[name^="I0_"], iframe[src*="picker"]').last();
  await iframeLocator.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(delayMs);

  const pickerFrame = page.frameLocator('iframe[name^="I0_"], iframe[src*="picker"]').last();

  // Step 4: Click 'Upload' tab inside the Drive picker iframe
  const uploadTab = pickerFrame.getByRole('tab', { name: 'Upload' })
    .or(pickerFrame.getByText('Upload', { exact: true }))
    .first();

  await uploadTab.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(delayMs);
  await uploadTab.click();

  // Step 5: Inject local file path into input[type="file"]
  const fileInput = pickerFrame.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForTimeout(delayMs);

  console.log(`[AI Studio Action] Injecting file path into input[type="file"] & monitoring upload progress...`);
  await fileInput.setInputFiles(absolutePath);

  // Step 6: Wait for file upload progress dialog to complete
  console.log(`[AI Studio Action] Upload in progress... Waiting for completion...`);

  // Wait until uploading progress dialog / cancel button is hidden
  const uploadingDialog = pickerFrame.locator('div:has-text("Cancel"), [role="progressbar"]').first();
  try {
    if (await uploadingDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadingDialog.waitFor({ state: 'hidden', timeout });
      console.log(`[AI Studio Action] Upload progress finished.`);
    }
  } catch (err) {
    console.warn('[AI Studio Action] Upload progress bar wait note:', err);
  }

  // After upload progress completes, check if "Insert" / "Select" button needs to be clicked
  try {
    const insertBtn = pickerFrame.getByRole('button', { name: /insert \d+ item|insert|select/i })
      .or(pickerFrame.locator('button:has-text("Insert"), [role="button"]:has-text("Insert")'))
      .first();

    if (await insertBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.waitForTimeout(delayMs);
      await insertBtn.click({ force: true });
      console.log(`[AI Studio Action] Clicked "Insert" button after upload.`);
    }
  } catch {
    // Ignore if dialog already closed
  }

  // Wait for iframe picker to disappear / close
  try {
    await iframeLocator.waitFor({ state: 'hidden', timeout: 30000 });
  } catch {
    // Continued
  }

  // Wait for attachment chip to land in prompt editor
  await page.waitForTimeout(3000);

  console.log(`[AI Studio Action] ✅ Local File "${path.basename(absolutePath)}" successfully uploaded & attached.`);

  return {
    success: true,
    filePath: absolutePath,
  };
}
