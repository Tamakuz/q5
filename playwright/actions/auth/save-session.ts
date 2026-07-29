import { BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface SaveSessionOptions {
  storageStatePath?: string;
}

/**
 * Action: Exports current browser context session state (cookies & localStorage) to state.json.
 */
export async function saveSessionState(
  context: BrowserContext,
  options: SaveSessionOptions = {}
): Promise<string> {
  const targetPath = options.storageStatePath || config.storageStatePath;
  const dir = path.dirname(targetPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`[Playwright Action] Saving storage state to: ${targetPath}`);

  await context.storageState({ path: targetPath });

  console.log(`[Playwright Action] Storage state saved successfully.`);
  return targetPath;
}
