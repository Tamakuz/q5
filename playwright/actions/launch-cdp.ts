import { chromium, BrowserContext, Page } from 'playwright';
import { exec } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';

export interface CDPSession {
  context: BrowserContext;
  page: Page;
  isCDP: boolean;
}

/**
 * Helper: Checks if Chrome Remote Debugging port 9222 is open and responding.
 */
export function checkCDPReady(port: number = 9222): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Action: Connects Playwright to a Real running Google Chrome browser via CDP (port 9222).
 * Spawns real system Google Chrome with --remote-debugging-port=9222 if not already running.
 */
export async function launchCDPBrowser(port: number = 9222): Promise<CDPSession> {
  console.log(`[CDP Action] Checking for running Real Chrome on http://127.0.0.1:${port}...`);

  let isCDPReady = await checkCDPReady(port);

  if (!isCDPReady) {
    console.log(`[CDP Action] Spawning Real Google Chrome with --remote-debugging-port=${port}...`);
    
    // Find real system Chrome binary
    const chromeBin = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/brave-browser'].find(p => fs.existsSync(p)) || 'google-chrome';
    const profileDir = path.join(process.cwd(), 'playwright', 'user_data', 'cdp_profile');

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const command = `${chromeBin} --remote-debugging-port=${port} --user-data-dir="${profileDir}" "https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview" > /dev/null 2>&1 &`;
    exec(command);

    // Wait up to 10s for CDP port to initialize
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await checkCDPReady(port)) {
        isCDPReady = true;
        break;
      }
    }
  }

  if (!isCDPReady) {
    throw new Error(`Failed to connect to Real Chrome via CDP on port ${port}.`);
  }

  console.log(`[CDP Action] ✅ Connecting Playwright to Real Chrome via CDP (http://127.0.0.1:${port})...`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  return { context, page, isCDP: true };
}
