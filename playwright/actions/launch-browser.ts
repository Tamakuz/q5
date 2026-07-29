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
 * Uses persistent context by default to preserve Google login sessions cleanly.
 */
export async function launchBrowser(options: LaunchOptions = {}): Promise<BrowserSession> {
  const headed = options.headed ?? true;
  const userDataDir = options.userDataDir || config.userDataDir;
  const storageStatePath = options.storageStatePath || config.storageStatePath;

  // Ensure directories exist
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
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

  let context: BrowserContext;

  // Use persistent context for full Chrome profile & Google session retention
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: !headed,
    viewport: config.viewport,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    args: launchArgs,
    slowMo: options.slowMo ?? 0,
    acceptDownloads: true,
  });

  // Stealth evasion script to mask navigator.webdriver in headless mode
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  page.setDefaultTimeout(config.defaultTimeout);

  return { context, page, isPersistent: true };
}
