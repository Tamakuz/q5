import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

export interface LaunchOptions {
  headed?: boolean;
  userDataDir?: string;
  storageStatePath?: string;
  slowMo?: number;
}

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  isPersistent: boolean;
}

/**
 * Action: Launches a browser session.
 * Generates an isolated user_data directory per worker process, pre-populated with authenticated profile cookies
 * to prevent SingletonLock collisions and guarantee 100% authenticated Google session access.
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

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
  ];

  console.log(`[Playwright Action] Launching browser (headed: ${headed}, user_data: ${userDataDir})`);

  const launchOptions: any = {
    headless: !headed,
    viewport: config.viewport,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    args: launchArgs,
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

  // Clean up temporary worker directory on context close
  if (isDefaultDir) {
    context.on('close', async () => {
      try {
        await fs.promises.rm(userDataDir, { recursive: true, force: true });
      } catch { }
    });
  }

  return { context, page, isPersistent: true };
}
