// playwright/initialize.ts
import { chromium } from 'playwright';
import readline from 'readline';
import fs from 'fs';
import { USER_DATA_DIR, DEFAULT_AI_STUDIO_URL, BROWSER_LAUNCH_OPTIONS } from './config';

export async function initializeUserSession(): Promise<void> {
  console.log('\n======================================================');
  console.log('🔑 INITIALIZING GOOGLE AI STUDIO PERSISTENT SESSION');
  console.log('======================================================\n');
  console.log(`📁 Profile Directory: ${USER_DATA_DIR}`);
  console.log(`🖥️  Window Aspect: Landscape (1920x1080)`);

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
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
  console.log('👉 SILAKAN LOGIN GOOGLE AKUN KAMU DI JENDELA BROWSER.');
  console.log('👉 Setelah berhasil masuk ke Google AI Studio,');
  console.log('👉 Tekan [ENTER] di terminal ini untuk menyimpan sesi & menutup browser.');
  console.log('------------------------------------------------------\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question('Press ENTER after you have completed login: ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('\n💾 Saving cookies and session data to ./playwright/user_data...');
  await context.close();
  console.log('✅ Session initialized & saved successfully! You can now run automated scripts.\n');
}

if (require.main === module || process.argv[1]?.endsWith('initialize.ts')) {
  initializeUserSession().catch((err) => {
    console.error('❌ Error during session initialization:', err.message);
    process.exit(1);
  });
}
