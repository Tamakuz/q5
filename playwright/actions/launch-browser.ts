import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface LaunchOptions {
  headed?: boolean;
  userDataDir?: string;
  profileName?: string; // e.g. 'user_1', 'user_2'
  storageStatePath?: string;
  slowMo?: number;
  useSystemChrome?: boolean;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  isPersistent: boolean;
  profileName: string;
}

/**
 * Returns available user profiles in playwright/user_data/ (e.g. ['user_1', 'user_2'])
 */
export function getAvailableProfiles(): string[] {
  const baseDir = path.join(process.cwd(), 'playwright', 'user_data');
  if (!fs.existsSync(baseDir)) return ['user_2', 'user_1'];

  const dirs = fs.readdirSync(baseDir).filter(name => {
    return name.startsWith('user_') && fs.statSync(path.join(baseDir, name)).isDirectory();
  });

  // Prioritize user_2 first, then remaining profiles sorted
  dirs.sort((a, b) => (a === 'user_2' ? -1 : b === 'user_2' ? 1 : a.localeCompare(b)));

  return dirs.length > 0 ? dirs : ['user_2', 'user_1'];
}

/**
 * Action: Launches a browser session.
 * Supports dynamic profile switching (e.g. profileName: 'user_1' | 'user_2').
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<BrowserSession> {
  const headed = options.headed ?? false;
  const availableProfiles = getAvailableProfiles();
  const profileName = options.profileName || availableProfiles[0] || 'user_1';

  const baseUserDataDir = options.userDataDir || path.join(process.cwd(), 'playwright', 'user_data', profileName);
  const isDefaultDir = !options.userDataDir;
  const userDataDir = isDefaultDir
    ? path.join(path.dirname(baseUserDataDir), profileName, `worker_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1000)}`)
    : baseUserDataDir;

  const storageStatePath = options.storageStatePath || config.storageStatePath;

  // Ensure directories exist
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Remove stale SingletonLock files if present to prevent Chrome profile lock collisions
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const lockFile of lockFiles) {
    const lockPath = path.join(userDataDir, lockFile);
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch { }
    }
  }

  // Pre-populate worker profile from authenticated Default profile directory of selected profile
  if (isDefaultDir) {
    const mainDefaultDir = path.join(path.dirname(baseUserDataDir), profileName, 'Default');
    const workerDefaultDir = path.join(userDataDir, 'Default');

    if (fs.existsSync(mainDefaultDir)) {
      console.log(`[Playwright Action] Preparing profile (${profileName}) from ${mainDefaultDir}...`);
      try {
        fs.cpSync(mainDefaultDir, workerDefaultDir, {
          recursive: true,
          filter: (src) =>
            !src.includes('SingletonLock') &&
            !src.includes('SingletonSocket') &&
            !src.includes('SingletonCookie') &&
            !src.includes('/Cache') &&
            !src.includes('/Code Cache') &&
            !src.includes('/GPUCache') &&
            !src.includes('/Service Worker') &&
            !src.includes('/CacheStorage'),
        });
      } catch (e) {
        console.warn(`[Playwright Action] Warning copying ${profileName} profile to worker:`, e);
      }
    }
  }

  const storageDir = path.dirname(storageStatePath);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const extensionPath = path.join(process.cwd(), 'playwright', 'extension');
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--no-first-run',
    '--no-default-browser-check',
  ];

  if (fs.existsSync(extensionPath)) {
    launchArgs.push(
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    );
  }

  console.log(`[Playwright Action] Launching stealth browser (profile: ${profileName}, headed: ${headed})`);

  const launchOptions: any = {
    headless: !headed,
    viewport: config.viewport,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'],
    slowMo: options.slowMo ?? 0,
    acceptDownloads: true,
  };

  if (fs.existsSync(storageStatePath)) {
    launchOptions.storageState = storageStatePath;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  // Stealth evasion script to mask navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  page.setDefaultTimeout(config.defaultTimeout);

  if (isDefaultDir) {
    context.on('close', async () => {
      try {
        await fs.promises.rm(userDataDir, { recursive: true, force: true });
      } catch { }
    });
  }

  return { context, page, isPersistent: true, profileName };
}
