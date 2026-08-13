import { launchBrowser } from './actions/launch-browser';
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
  console.log('=== Google AI Studio Profile Initializer ===');
  console.log('This utility opens a Chrome browser window to sign in to a Google Account and save its profile session.');

  let inputId = process.argv[2];
  if (!inputId) {
    inputId = await askQuestion('\nEnter Profile User ID to initialize (e.g. 1, 2, 3, etc.): ');
  }

  const userId = parseInt(inputId.trim(), 10);

  if (isNaN(userId) || userId <= 0) {
    console.error('Invalid User ID. Must be a positive number (e.g. 1 for user_1).');
    process.exit(1);
  }

  const profileName = `user_${userId}`;
  const userDataDir = path.join(PROJECT_ROOT, 'playwright', 'user_data', profileName);
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Remove stale locks
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
  for (const lockFile of lockFiles) {
    const lockPath = path.join(userDataDir, lockFile);
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch { }
    }
  }

  console.log(`\n[Init] Opening Chrome headed session with profile: ${profileName}`);
  console.log(`[Init] Profile directory: ${userDataDir}`);

  // Launch persistent context directly on main profile dir
  const session = await launchBrowser({
    headed: true,
    userDataDir,
    profileName
  });

  const { context, page } = session;

  const targetUrl = 'https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview';
  console.log(`[Init] Navigating to: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  console.log('\n========================================================================');
  console.log(`👉 ACTION REQUIRED:`);
  console.log(`   1. In the opened Chrome browser window, sign in to your Google Account (if not already logged in).`);
  console.log(`   2. Make sure you can access Google AI Studio.`);
  console.log(`   3. When successfully logged in, return to this terminal and press [ENTER].`);
  console.log('========================================================================\n');

  await askQuestion(`Press [ENTER] here once you are logged in and ready to save ${profileName}... `);

  console.log(`\n[Init] Saving profile state and closing browser context for ${profileName}...`);
  await context.close();
  console.log(`🎉 [SUCCESS] Successfully initialized and saved Profile ${profileName}!`);
}

main().catch(console.error);
