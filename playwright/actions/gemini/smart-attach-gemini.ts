import { Page } from 'playwright';
import { attachGeminiDriveFileAction } from './attach-gemini-drive';
import { uploadGeminiLocalFileAction } from './upload-gemini-file';

export interface SmartAttachGeminiOptions {
  fileName: string;
  localFilePath?: string;
  timeout?: number;
}

export interface SmartAttachGeminiResult {
  success: boolean;
  source: 'drive' | 'local_upload';
  fileName: string;
  error?: string;
}

/**
 * Action: Smart Asset Ingestion for gemini.google.com/app.
 * 1. Searches Google Drive for fileName.
 * 2. If NOT FOUND ("Tidak ada hasil yang cocok"), closes Drive Picker and automatically uploads localFilePath via [data-test-id="local-images-files-uploader-button"].
 */
export async function smartAttachGeminiAssetAction(
  page: Page,
  options: SmartAttachGeminiOptions
): Promise<SmartAttachGeminiResult> {
  const { fileName, localFilePath } = options;

  console.log(`[Gemini Action] 🔄 Smart Asset Ingestion starting for: "${fileName}"...`);

  // Try Category 1: Attach from Google Drive
  const driveResult = await attachGeminiDriveFileAction(page, fileName, { timeout: options.timeout });

  if (driveResult.success) {
    console.log(`[Gemini Action] ✅ Asset found and attached directly from Google Drive.`);
    return {
      success: true,
      source: 'drive',
      fileName,
    };
  }

  // Category 2: Drive search returned NOT FOUND ("Tidak ada hasil yang cocok") -> Fallback to Local Upload
  console.log(`[Gemini Action] ⚠️ Drive search returned NOT FOUND for "${fileName}". Triggering Category 2 (Local File Upload)...`);

  if (!localFilePath) {
    return {
      success: false,
      source: 'drive',
      fileName,
      error: `File "${fileName}" not found in Drive, and no localFilePath was provided for fallback.`,
    };
  }

  const uploadResult = await uploadGeminiLocalFileAction(page, localFilePath, { timeout: options.timeout });

  return {
    success: uploadResult.success,
    source: 'local_upload',
    fileName,
    error: uploadResult.error,
  };
}
