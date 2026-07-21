// playwright/aistudio.ts
import { chromium, BrowserContext, Page } from 'playwright';
import { Command } from 'commander';
import fs from 'fs';
import { getUserDataDir, DEFAULT_AI_STUDIO_URL, BROWSER_LAUNCH_OPTIONS } from './config';

export interface AIStudioLaunchOptions {
  headless?: boolean;
  url?: string;
  accountName?: string;  // e.g. 'user1', 'user2', 'jovan_work'
  userDataDir?: string;  // Custom profile path override
}

/**
 * Automatically detect and click dynamic modal popup buttons ("Continue", "Got it", "I understand") strictly inside overlay dialogs.
 */
export async function dismissPopups(page: Page): Promise<boolean> {
  const popupSelectors = [
    'mat-dialog-container button:has-text("Continue")',
    'mat-dialog-container button:has-text("Got it")',
    'mat-dialog-container button:has-text("I understand")',
    '.cdk-overlay-container button:has-text("Continue")',
    '.cdk-overlay-container button:has-text("Got it")',
    '[role="dialog"] button:has-text("Continue")',
    '[role="dialog"] button:has-text("Got it")',
    'button:has-text("Continue")',
    'button:has-text("Got it")',
  ];

  let clicked = false;
  for (const selector of popupSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
      try {
        await btn.click({ force: true });
        clicked = true;
        console.log(`💡 Automatically dismissed popup modal using button: "${selector}"`);
        await page.waitForTimeout(600);
      } catch {}
    }
  }
  return clicked;
}

/**
 * Launch Chromium with persistent user context saved per Google account session.
 */
export async function launchAIStudioSession(options: AIStudioLaunchOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const userDataDir = options.userDataDir || getUserDataDir(options.accountName);
  const targetUrl = options.url || DEFAULT_AI_STUDIO_URL;
  const isHeadless = options.headless ?? false;

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 Launching Google AI Studio Browser Session...');
  if (options.accountName) {
    console.log(`👤 Google Account Profile: "${options.accountName}"`);
  }
  console.log(`📁 Profile Directory: ${userDataDir}`);
  console.log(`🌐 Opening URL: ${targetUrl}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...BROWSER_LAUNCH_OPTIONS,
    headless: isHeadless,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Stealth script injection to bypass bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  console.log('✅ Google AI Studio page loaded successfully!');

  // Check & click dynamic popups ("Continue", etc.) on initial page load
  await dismissPopups(page);

  return { context, page };
}

// ─── CLI Entrypoint ────────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('aistudio.ts')) {
  const program = new Command();

  program
    .name('aistudio')
    .description('Google AI Studio Browser Automation & Session Manager')
    .option('-a, --account <string>', 'Google account profile name (e.g. user1, user2)', 'default')
    .option('-h, --headless', 'Run browser in headless mode', false)
    .option('-u, --url <string>', 'Target URL to open', DEFAULT_AI_STUDIO_URL)
    .option('--keep-open', 'Keep browser window open indefinitely', true)
    .action(async (opts) => {
      try {
        const { context, page } = await launchAIStudioSession({
          accountName: opts.account,
          headless: opts.headless,
          url: opts.url,
        });

        console.log('\n💡 Session Active!');
        console.log(`📌 Cookies & login state saved for account: "${opts.account}" at ${getUserDataDir(opts.account)}`);
        console.log('Press Ctrl+C in terminal to close session when finished.\n');

        if (opts.keepOpen) {
          await new Promise(() => {});
        } else {
          await context.close();
        }
      } catch (err: any) {
        console.error('❌ Error launching AI Studio session:', err.message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
