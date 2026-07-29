import { launchBrowser } from '../actions/launch-browser';
import { navigateToUrl } from '../actions/navigate';
import { checkAuthStatus } from '../actions/auth/check-auth';
import { saveSessionState } from '../actions/auth/save-session';
import { config } from '../config';

export interface InitUserDataPipelineOptions {
  url?: string;
  headed?: boolean;
  maxWaitLoginMs?: number;
  autoClose?: boolean;
}

export interface PipelineResult {
  success: boolean;
  message: string;
  isLoggedIn: boolean;
  storageStatePath?: string;
  userDataDir?: string;
}

/**
 * Pipeline: Initializes Google user session data.
 * Opens https://labs.google/, checks auth status, waits for login if needed, and saves cookies/profile.
 */
export async function runInitUserDataPipeline(
  options: InitUserDataPipelineOptions = {}
): Promise<PipelineResult> {
  const targetUrl = options.url || config.baseUrl;
  const headed = options.headed ?? true;
  const maxWaitMs = options.maxWaitLoginMs || 120000; // 2 minutes default wait for manual login
  const autoClose = options.autoClose ?? true;

  console.log('====================================================');
  console.log('[Pipeline] Starting: Init User Data (Google Labs Auth)');
  console.log('====================================================');

  const { context, page } = await launchBrowser({ headed });

  try {
    // 1. Navigate to target URL
    await navigateToUrl(page, { url: targetUrl });

    // 2. Check initial auth status
    let auth = await checkAuthStatus(page, context);

    if (!auth.isLoggedIn) {
      console.log(`\n[Pipeline] User is not logged in yet.`);
      console.log(`[Pipeline] Please log in to your Google Account in the browser window.`);
      console.log(`[Pipeline] Waiting up to ${maxWaitMs / 1000} seconds for login completion...\n`);

      const pollInterval = 3000;
      let elapsed = 0;

      while (!auth.isLoggedIn && elapsed < maxWaitMs) {
        await page.waitForTimeout(pollInterval);
        elapsed += pollInterval;
        auth = await checkAuthStatus(page, context);
      }
    }

    // 3. Save session state regardless (captures cookies & profile state)
    const savedPath = await saveSessionState(context);

    if (auth.isLoggedIn) {
      console.log(`\n[Pipeline] SUCCESS: Logged in and saved session state to ${savedPath}`);
    } else {
      console.log(`\n[Pipeline] WARNING: User data initialized, but login status could not be verified automatically.`);
      console.log(`[Pipeline] Persistent profile stored in: ${config.userDataDir}`);
    }

    if (autoClose) {
      console.log('[Pipeline] Closing browser context...');
      await context.close();
    }

    return {
      success: true,
      isLoggedIn: auth.isLoggedIn,
      message: auth.isLoggedIn
        ? 'User data initialized and logged in successfully.'
        : 'User data initialized (profile stored, but active login unconfirmed).',
      storageStatePath: savedPath,
      userDataDir: config.userDataDir,
    };
  } catch (error: any) {
    console.error(`[Pipeline] Init User Data failed:`, error);
    try {
      if (autoClose) await context.close();
    } catch (_) {}

    return {
      success: false,
      isLoggedIn: false,
      message: `Pipeline error: ${error?.message || error}`,
    };
  }
}
