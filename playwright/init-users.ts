import { PlaywrightService } from './service';
import readline from 'readline';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = path.resolve(__dirname, '..');

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function main() {
  console.log('=== Google Flow Profile Initializer ===');
  console.log('This utility helps you log in to multiple Google accounts and save their sessions.');

  const inputId = await askQuestion('\nEnter Profile User ID to initialize (e.g. 1, 2, 3, etc.): ');
  const userId = parseInt(inputId.trim(), 10);

  if (isNaN(userId) || userId <= 0) {
    console.error('Invalid User ID. Must be a positive number.');
    process.exit(1);
  }

  const userDataDir = path.join(PROJECT_ROOT, 'playwright', 'user_data', `user_${userId}`);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log(`\n[Init] Opening Chrome headed session with profile: user_${userId}`);
  console.log(`[Init] Profile directory: ${userDataDir}`);

  // Launch persistent context
  const session = await PlaywrightService.actions.launchBrowser({
    headed: true,
    userDataDir,
  });

  const { context, page } = session;

  // Navigate to Google Flow login / entry page
  const targetUrl = 'https://labs.google/fx/id/tools/flow';
  console.log(`[Init] Navigating to: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  console.log('\n========================================================================');
  console.log(`👉 ACTION REQUIRED:`);
  console.log(`   1. In the opened browser window, sign in to your Google Account (if not already logged in).`);
  console.log(`   2. Make sure you can access the Google Flow dashboard.`);
  console.log(`   3. When successfully logged in, return to this terminal and press [ENTER].`);
  console.log('========================================================================\n');

  await askQuestion('Press [ENTER] here once you are logged in and ready to save profile... ');

  console.log(`\n[Init] Saving profile state and closing browser context for user_${userId}...`);
  await context.close();
  console.log(`[Init] Successfully initialized and saved Profile user_${userId}!`);
}

main().catch(console.error);
