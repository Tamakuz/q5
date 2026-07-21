// playwright/initialize.ts
import { chromium } from 'playwright';
import readline from 'readline';
import fs from 'fs';
import { Command } from 'commander';
import { getUserDataDir, DEFAULT_AI_STUDIO_URL, BROWSER_LAUNCH_OPTIONS } from './config';

export async function initializeUserSession(accountName: string = 'default'): Promise<void> {
  const userDataDir = getUserDataDir(accountName);

  console.log('\n======================================================');
  console.log(`🔑 INITIALIZING GOOGLE AI STUDIO SESSION FOR: "${accountName}"`);
  console.log('======================================================\n');
  console.log(`📁 Profile Directory: ${userDataDir}`);
  console.log(`🖥️  Window Aspect: Landscape (1920x1080)`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...BROWSER_LAUNCH_OPTIONS,
    headless: false,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // Stealth script injection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  console.log(`🌐 Navigating to ${DEFAULT_AI_STUDIO_URL}...`);
  await page.goto(DEFAULT_AI_STUDIO_URL, { waitUntil: 'domcontentloaded' });

  console.log('\n------------------------------------------------------');
  console.log(`👉 SILAKAN LOGIN DENGAN AKUN GOOGLE UNTUK PROFILE: "${accountName}".`);
  console.log('👉 Setelah berhasil masuk ke Google AI Studio,');
  console.log('👉 Tekan [ENTER] di terminal ini untuk menyimpan sesi & menutup browser.');
  console.log('------------------------------------------------------\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Tekan [ENTER] setelah selesai login: ', () => {
      rl.close();
      resolve();
    });
  });

  console.log(`\n💾 Saving cookies and session data to: ${userDataDir}...`);
  await context.close();
  console.log(`✅ Session for account "${accountName}" saved successfully!\n`);
}

if (require.main === module || process.argv[1]?.endsWith('initialize.ts')) {
  const program = new Command();
  program
    .name('aistudio:init')
    .description('Initialize & Save Google AI Studio persistent login session for a specific account profile')
    .option('-a, --account <string>', 'Account profile name (e.g. user1, user2, jovan)', 'default')
    .action(async (opts) => {
      try {
        await initializeUserSession(opts.account);
      } catch (err: any) {
        console.error('❌ Error during session initialization:', err.message);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
