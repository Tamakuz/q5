import { Page, BrowserContext } from 'playwright';

export interface AuthStatus {
  isLoggedIn: boolean;
  userEmail?: string;
  avatarFound: boolean;
  message: string;
}

/**
 * Action: Checks if user is logged into Google Labs.
 */
export async function checkAuthStatus(page: Page, context?: BrowserContext): Promise<AuthStatus> {
  console.log('[Playwright Action] Checking Google authentication status...');

  try {
    // Wait briefly for elements to stabilize
    await page.waitForTimeout(2000);

    // Look for Google user profile avatar or account menu buttons
    const avatarSelectors = [
      'img[src*="googleusercontent.com"]',
      'a[aria-label*="Google Account"]',
      'button[aria-label*="Google Account"]',
      'div[aria-label*="Google Account"]',
      'a[aria-label*="Akun Google"]',
      'button[aria-label*="Akun Google"]',
      '[data-profile-avatar]',
    ];

    let avatarFound = false;
    for (const selector of avatarSelectors) {
      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        avatarFound = true;
        break;
      }
    }

    // Check for sign-in button
    const signInSelectors = [
      'a[href*="accounts.google.com"]',
      'button:has-text("Sign in")',
      'a:has-text("Sign in")',
      'button:has-text("Masuk")',
      'a:has-text("Masuk")',
    ];

    let hasSignInButton = false;
    for (const selector of signInSelectors) {
      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        hasSignInButton = true;
        break;
      }
    }

    // Check cookies for Google auth session keys (SID, HSID, SSID, etc.)
    let hasAuthCookies = false;
    if (context) {
      const cookies = await context.cookies();
      hasAuthCookies = cookies.some(c => c.name === 'SID' || c.name === 'HSID' || c.name === '__Secure-3PSID');
    }

    const isLoggedIn = avatarFound || (hasAuthCookies && !hasSignInButton);

    const message = isLoggedIn
      ? 'User is logged in.'
      : 'User is not logged in. Manual login required.';

    console.log(`[Playwright Action] Auth Check Result: ${message} (avatar: ${avatarFound}, authCookies: ${hasAuthCookies})`);

    return {
      isLoggedIn,
      avatarFound,
      message,
    };
  } catch (error: any) {
    console.warn(`[Playwright Action] Auth check encountered warning: ${error?.message || error}`);
    return {
      isLoggedIn: false,
      avatarFound: false,
      message: `Auth check failed: ${error?.message || error}`,
    };
  }
}
