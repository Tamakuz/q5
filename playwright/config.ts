// playwright/config.ts
import path from 'path';
import fs from 'fs';

export const PLAYWRIGHT_DIR = path.resolve(__dirname);
export const USER_DATA_BASE_DIR = path.join(PLAYWRIGHT_DIR, 'user_data');
export const USER_DATA_DIR = USER_DATA_BASE_DIR;

/**
 * List all available saved Google account profile names.
 * Only returns user account folders (e.g. user1, user2, user3) sorted numerically.
 */
export function listAvailableAccounts(): string[] {
  const accounts: string[] = [];

  if (fs.existsSync(USER_DATA_BASE_DIR)) {
    const items = fs.readdirSync(USER_DATA_BASE_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const dirName = item.name;
        // Only include folders matching user* or account* (e.g. user1, user2, user_jovan)
        if (/^(user|account)/i.test(dirName)) {
          accounts.push(dirName);
        }
      }
    }
  }

  // Sort accounts naturally (user1, user2, user3...)
  accounts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Fallback to default only if no user1/user2 profiles exist
  if (accounts.length === 0) {
    accounts.push('default');
  }

  return accounts;
}

/**
 * Resolve persistent profile directory for a specific Google account name.
 * Example: getUserDataDir('user1') => .../playwright/user_data/user1
 */
export function getUserDataDir(accountName?: string): string {
  const available = listAvailableAccounts();

  let target = accountName;
  if (!target || target.trim() === '' || target === 'default') {
    // Default to the first available user account if present (e.g. user1)
    if (available.length > 0 && available[0] !== 'default') {
      target = available[0];
    } else {
      return USER_DATA_BASE_DIR;
    }
  }

  const safeAccountName = target.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  
  // Backward compatibility check for legacy profiles subfolder
  const legacyPath = path.join(USER_DATA_BASE_DIR, 'profiles', safeAccountName);
  const directPath = path.join(USER_DATA_BASE_DIR, safeAccountName);

  if (fs.existsSync(legacyPath) && !fs.existsSync(directPath)) {
    return legacyPath;
  }

  return directPath;
}

// Default target URL with Gemini 3.5 Flash model pre-selected
export const DEFAULT_AI_STUDIO_URL = 'https://aistudio.google.com/prompts/new_chat?model=gemini-3.5-flash';

export const BROWSER_LAUNCH_OPTIONS = {
  headless: false,
  viewport: null, // Set to null so Chromium dynamically scales to full native screen size without cropping
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--start-maximized',
    '--window-size=1920,1080',
  ],
  ignoreDefaultArgs: ['--enable-automation'],
};
