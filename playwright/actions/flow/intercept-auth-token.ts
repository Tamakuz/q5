import { Page, Request } from 'playwright';

export interface InterceptedAuth {
  bearerToken: string;
  recaptchaToken?: string;
  headers: Record<string, string>;
}

/**
 * Action: Sets up a request interceptor listener to capture Authorization Bearer tokens sent to aisandbox-pa.googleapis.com
 */
export function setupAuthInterceptor(page: Page): { getAuth: () => InterceptedAuth | null } {
  let capturedAuth: InterceptedAuth | null = null;

  page.on('request', (request: Request) => {
    const url = request.url();
    if (url.includes('aisandbox-pa.googleapis.com') || url.includes('flowMedia')) {
      const headers = request.headers();
      const authHeader = headers['authorization'] || headers['Authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.replace('Bearer ', '').trim();
        capturedAuth = {
          bearerToken,
          headers,
        };
        console.log(`[Playwright Action] Captured Active Bearer Token (${bearerToken.substring(0, 15)}...)`);
      }
    }
  });

  return {
    getAuth: () => capturedAuth,
  };
}
