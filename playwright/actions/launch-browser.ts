import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface LaunchOptions {
  headed?: boolean;
  userDataDir?: string;
  storageStatePath?: string;
  slowMo?: number;
  useSystemChrome?: boolean;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  isPersistent: boolean;
}

/**
 * Action: Launches a browser session.
 * Uses stealth flags and ignoreDefaultArgs: ['--enable-automation'] to remove Chrome automation infobars and flags.
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<BrowserSession> {
  const headed = options.headed ?? false;

  const baseUserDataDir = options.userDataDir || config.userDataDir;
  const isDefaultDir = !options.userDataDir;
  const userDataDir = isDefaultDir
    ? path.join(baseUserDataDir, `worker_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1000)}`)
    : baseUserDataDir;

  const storageStatePath = options.storageStatePath || config.storageStatePath;

  // Ensure base and worker directories exist
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

  // Pre-populate worker profile from main authenticated Default profile directory if creating a temp worker
  if (isDefaultDir) {
    const mainDefaultDir = path.join(baseUserDataDir, 'Default');
    const workerDefaultDir = path.join(userDataDir, 'Default');

    if (fs.existsSync(mainDefaultDir)) {
      try {
        fs.cpSync(mainDefaultDir, workerDefaultDir, {
          recursive: true,
          filter: (src) =>
            !src.includes('SingletonLock') &&
            !src.includes('SingletonSocket') &&
            !src.includes('SingletonCookie'),
        });
      } catch (e) {
        console.warn('[Playwright Action] Warning copying Default profile to worker:', e);
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

  console.log(`[Playwright Action] Launching stealth browser (headed: ${headed}, user_data: ${userDataDir})`);

  const launchOptions: any = {
    headless: !headed,
    viewport: config.viewport,
    args: launchArgs,
    ignoreDefaultArgs: ['--enable-automation'], // Removes Chrome "controlled by automated software" infobar & flag!
    slowMo: options.slowMo ?? 0,
    acceptDownloads: true,
  };

  if (fs.existsSync(storageStatePath)) {
    launchOptions.storageState = storageStatePath;
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  // Stealth evasion script to mask navigator.webdriver in headless mode
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

  return { context, page, isPersistent: true };
}
