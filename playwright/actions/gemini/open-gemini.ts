import { Page, BrowserContext } from 'playwright';
import { launchBrowser, BrowserSession } from '../launch-browser';
import { navigateToUrl } from '../navigate';
import { config } from '../../config';
import { dismissGeminiModalsAction } from './dismiss-gemini-modals';

export interface OpenGeminiOptions {
  headed?: boolean;
  userDataDir?: string;
  url?: string;
  timeout?: number;
  slowMo?: number;
}

export interface OpenGeminiSession extends BrowserSession {
  isLoggedIn: boolean;
}

export const GEMINI_APP_URL = 'https://gemini.google.com/app';

/**
 * Action: Launches persistent browser session and navigates to Gemini Web App (gemini.google.com/app).
 */
export async function openGeminiAction(
  options: OpenGeminiOptions = {}
): Promise<OpenGeminiSession> {
  const headed = options.headed ?? true;
  const userDataDir = options.userDataDir || config.userDataDir;
  const targetUrl = options.url || GEMINI_APP_URL;
  const timeout = options.timeout || config.defaultTimeout;
  const slowMo = options.slowMo ?? (headed ? 300 : 0);

  console.log(`[Gemini Action] Opening Gemini Web App...`);
  console.log(`  - Profile Path: ${userDataDir}`);
  console.log(`  - Target URL:   ${targetUrl}`);
  console.log(`  - Headed Mode:  ${headed} (slowMo: ${slowMo}ms)`);

  const session = await launchBrowser({
    headed,
    userDataDir,
    slowMo,
  });

  const { page } = session;

  await navigateToUrl(page, {
    url: targetUrl,
    waitUntil: 'domcontentloaded',
    timeout,
  });

  let isLoggedIn = true;
  try {
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
      console.warn('[Gemini Action] ⚠️ Redirected to Google Sign-in page. Please complete login in the opened browser window.');
      isLoggedIn = false;
    } else {
      await dismissGeminiModalsAction(page);

      // Wait for Gemini prompt input area
      await page.waitForSelector('rich-textarea, [contenteditable="true"], textarea, p.rich-textarea-aria', {
        timeout: 15000,
      }).catch(() => {
        console.warn('[Gemini Action] Prompt input element not detected within 15s, page loaded.');
      });

      await page.waitForTimeout(1000);
      await dismissGeminiModalsAction(page);
    }
  } catch (err) {
    console.warn('[Gemini Action] Auth check warning:', err);
  }

  console.log(`[Gemini Action] ✅ Gemini Web App session ready. Logged in: ${isLoggedIn}`);

  return {
    ...session,
    isLoggedIn,
  };
}
