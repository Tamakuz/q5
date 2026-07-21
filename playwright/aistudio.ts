// playwright/aistudio.ts
import { chromium, BrowserContext, Page } from 'playwright';
import { Command } from 'commander';
import fs from 'fs';
import { USER_DATA_DIR, DEFAULT_AI_STUDIO_URL, BROWSER_LAUNCH_OPTIONS } from './config';

export interface AIStudioLaunchOptions {
  headless?: boolean;
  url?: string;
  userDataDir?: string;
}

/**
 * Launch Chromium with persistent user context saved in ./playwright/user_data
 */
export async function launchAIStudioSession(options: AIStudioLaunchOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const userDataDir = options.userDataDir || USER_DATA_DIR;
  const targetUrl = options.url || DEFAULT_AI_STUDIO_URL;
  const isHeadless = options.headless ?? false;

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 Launching Google AI Studio Browser Session...');
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

  return { context, page };
}

// ─── CLI Entrypoint ────────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('aistudio.ts')) {
  const program = new Command();

  program
    .name('aistudio')
    .description('Google AI Studio Browser Automation & Session Manager')
    .option('-h, --headless', 'Run browser in headless mode', false)
    .option('-u, --url <string>', 'Target URL to open', DEFAULT_AI_STUDIO_URL)
    .option('--keep-open', 'Keep browser window open indefinitely', true)
    .action(async (opts) => {
      try {
        const { context, page } = await launchAIStudioSession({
          headless: opts.headless,
          url: opts.url,
        });

        console.log('\n💡 Session Active!');
        console.log('📌 Cookies & login state will be saved automatically to ./playwright/user_data');
        console.log('Press Ctrl+C in terminal to close session when finished.\n');

        if (opts.keepOpen) {
          // Keep process alive so browser remains open for interactive use
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
