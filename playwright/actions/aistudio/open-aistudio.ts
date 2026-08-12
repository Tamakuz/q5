import { Page, BrowserContext } from 'playwright';
import path from 'path';
import { launchBrowser, BrowserSession } from '../launch-browser';
import { launchCDPBrowser, checkCDPReady } from '../launch-cdp';
import { navigateToUrl } from '../navigate';
import { config } from '../../config';
import { dismissAIStudioModalsAction } from './dismiss-modals';

export interface OpenAIStudioOptions {
  headed?: boolean;
  userDataDir?: string;
  url?: string;
  timeout?: number;
  slowMo?: number;
  useCDP?: boolean;
}

export interface OpenAIStudioSession {
  context: BrowserContext;
  page: Page;
  isLoggedIn: boolean;
  isCDP?: boolean;
}

export const AI_STUDIO_NEW_CHAT_URL = 'https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview';

/**
 * Action: Opens Google AI Studio using CDP Remote Debugging (Real Chrome) or Persistent Context.
 */
export async function openAIStudioAction(
  options: OpenAIStudioOptions = {}
): Promise<OpenAIStudioSession> {
  const useCDP = options.useCDP ?? true; // Default to Real Chrome CDP connection
  const targetUrl = options.url || AI_STUDIO_NEW_CHAT_URL;
  const timeout = options.timeout || config.defaultTimeout;

  console.log(`[AI Studio Action] Opening Google AI Studio (Mode: ${useCDP ? 'Real Chrome CDP' : 'Persistent Context'})...`);

  let context: BrowserContext;
  let page: Page;
  let isCDP = false;

  if (useCDP) {
    try {
      const cdpSession = await launchCDPBrowser(9222);
      context = cdpSession.context;
      page = cdpSession.page;
      isCDP = true;
    } catch (cdpErr) {
      console.warn('[AI Studio Action] CDP connection warning, falling back to standard launch:', cdpErr);
      const session = await launchBrowser(options);
      context = session.context;
      page = session.page;
    }
  } else {
    const session = await launchBrowser(options);
    context = session.context;
    page = session.page;
  }

  // Ensure target URL is loaded
  const currentUrl = page.url();
  if (!currentUrl.includes('aistudio.google.com/prompts/new_chat')) {
    await navigateToUrl(page, {
      url: targetUrl,
      waitUntil: 'domcontentloaded',
      timeout,
    });
  }

  let isLoggedIn = true;
  try {
    const url = page.url();
    if (url.includes('accounts.google.com') || url.includes('signin')) {
      console.warn('[AI Studio Action] ⚠️ Google Sign-in page detected. Please complete login in the Real Chrome window.');
      isLoggedIn = false;
    } else {
      await dismissAIStudioModalsAction(page);

      await page.waitForSelector('ms-prompt-editor, textarea, [contenteditable="true"], ms-run-button, body', {
        timeout: 15000,
      }).catch(() => {});

      await page.waitForTimeout(1500);
      await dismissAIStudioModalsAction(page);
    }
  } catch (err) {
    console.warn('[AI Studio Action] Auth status check warning:', err);
  }

  console.log(`[AI Studio Action] ✅ AI Studio session ready. Logged in: ${isLoggedIn} (CDP: ${isCDP})`);

  return {
    context,
    page,
    isLoggedIn,
    isCDP,
  };
}
