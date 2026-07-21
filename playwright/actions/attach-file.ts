// playwright/actions/attach-file.ts
import { Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { loadProjectState, updateStateResource } from '../../lib/state';
import { attachDriveFile } from './attach-drive-file';

export interface AttachFileOptions {
  filePath?: string;
  directoryPath?: string;
  searchTerm?: string;
  allowedExtensions?: string[];
}

/**
 * Dynamically resolves an asset file from explicit path or asset directory (default: input/assets)
 */
export function resolveAssetFile(options: AttachFileOptions = {}): string {
  if (options.filePath) {
    const resolved = path.resolve(options.filePath);
    if (fs.existsSync(resolved)) return resolved;
  }

  const state = loadProjectState();
  const dir = path.resolve(options.directoryPath || 'input/assets');
  if (!fs.existsSync(dir)) {
    throw new Error(`Asset directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir)
    .map((f) => path.join(dir, f))
    .filter((f) => {
      const stat = fs.statSync(f);
      if (!stat.isFile()) return false;
      if (options.allowedExtensions && options.allowedExtensions.length > 0) {
        const ext = path.extname(f).toLowerCase();
        return options.allowedExtensions.includes(ext);
      }
      return true;
    });

  if (files.length === 0) {
    throw new Error(`No valid asset files found in directory: ${dir}`);
  }

  const matchingContentId = files.find((f) => path.basename(f).includes(state.content_id));
  if (matchingContentId) return matchingContentId;

  files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0];
}

/**
 * Action 2 (Drive-First Attachment):
 * 1. Checks if target file exists in Google Drive via Drive Picker.
 * 2. If present: selects & attaches directly from Google Drive.
 * 3. If NOT present in Google Drive: switches to Drive Picker's "Upload" tab to upload directly into Drive!
 */
export async function attachFile(page: Page, options: AttachFileOptions = {}): Promise<string> {
  const state = loadProjectState();
  const searchFileName = options.searchTerm || state.drive_search_query || `${state.content_id}_video_trimmed.mp4`;

  console.log(`\n🔎 [Drive-First Attach] Checking Google Drive for "${searchFileName}"...`);

  const driveResult = await attachDriveFile(page, {
    searchTerm: searchFileName,
    filePath: options.filePath,
  });

  if (driveResult) {
    console.log(`🎉 [Drive-First Attach] File "${searchFileName}" successfully attached via Google Drive Picker!`);
    return `drive://${searchFileName}`;
  }

  throw new Error(`Failed to attach file "${searchFileName}" via Google Drive.`);
}

// ─── Direct CLI Runner ────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('attach-file.ts')) {
  const program = new Command();
  program
    .name('aistudio:attach')
    .description('Action 2: Attach file via Google Drive Picker (Search or Upload tab)')
    .option('-f, --file <string>', 'Explicit local file path to attach')
    .option('-d, --dir <string>', 'Asset directory path', 'input/assets')
    .action(async (opts) => {
      const { launchAIStudioSession } = await import('../aistudio');
      const { page } = await launchAIStudioSession({ headless: false });
      try {
        await attachFile(page, {
          filePath: opts.file,
          directoryPath: opts.dir,
        });
        console.log('🎉 Action 2 Drive-First Attachment completed!');
      } catch (err: any) {
        console.error(`❌ Action 2 Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
