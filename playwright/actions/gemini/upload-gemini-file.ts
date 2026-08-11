import { Page } from 'playwright';
import fs from 'fs';
import { dismissGeminiModalsAction } from './dismiss-gemini-modals';

export interface UploadGeminiFileOptions {
  timeout?: number;
}

export interface UploadGeminiFileResult {
  success: boolean;
  filePath: string;
  error?: string;
}

/**
 * Action: Uploads a local file to gemini.google.com/app directly via DOM input (input[name="Filedata"]).
 * Bypasses clicking the upload button so native OS File Manager window NEVER pops up.
 */
export async function uploadGeminiLocalFileAction(
  page: Page,
  filePath: string,
  options: UploadGeminiFileOptions = {}
): Promise<UploadGeminiFileResult> {
  const timeout = options.timeout || 60000;

  console.log(`[Gemini Action] Uploading local file automatically without OS file dialog: "${filePath}"...`);

  if (!fs.existsSync(filePath)) {
    console.error(`[Gemini Action] ❌ Error: Local file does not exist at path: ${filePath}`);
    return {
      success: false,
      filePath,
      error: `File not found at path: ${filePath}`,
    };
  }

  await dismissGeminiModalsAction(page);

  // Set file directly on input[name="Filedata"] or input[type="file"].
  // This bypasses opening native OS File Manager window completely!
  const fileInput = page.locator('input[name="Filedata"], input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(filePath);

  console.log(`[Gemini Action] ✅ File "${filePath}" attached automatically via DOM input (No OS file manager popup).`);
  await page.waitForTimeout(3000);

  return {
    success: true,
    filePath,
  };
}
