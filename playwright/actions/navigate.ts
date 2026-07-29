import { Page } from 'playwright';
import { config } from '../config';

export interface NavigateOptions {
  url?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
}

/**
 * Action: Navigates page to target URL.
 */
export async function navigateToUrl(
  page: Page,
  options: NavigateOptions = {}
): Promise<void> {
  const targetUrl = options.url || config.baseUrl;
  const waitUntil = options.waitUntil || 'domcontentloaded';
  const timeout = options.timeout || config.defaultTimeout;

  console.log(`[Playwright Action] Navigating to: ${targetUrl}`);

  await page.goto(targetUrl, {
    waitUntil,
    timeout,
  });

  console.log(`[Playwright Action] Successfully loaded: ${targetUrl} (Title: "${await page.title()}")`);
}
