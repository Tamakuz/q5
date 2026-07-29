import { request as playwrightRequest } from 'playwright';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { config } from '../../config';

export interface PureApiOptions {
  projectId: string;
  promptText: string;
  bearerToken?: string;
  recaptchaToken?: string;
  imageModelName?: string;
  imageAspectRatio?: 'IMAGE_ASPECT_RATIO_LANDSCAPE' | 'IMAGE_ASPECT_RATIO_SQUARE' | 'IMAGE_ASPECT_RATIO_PORTRAIT';
  seed?: number;
}

export interface PureApiResult {
  success: boolean;
  rawResponse?: any;
  error?: string;
}

/**
 * Pure API Action: Sends HTTP POST request directly to Google Flow API without launching any browser window.
 * Uses storageState (cookies JSON) directly via Playwright's headless request context.
 */
export async function generateFlowImagesPureApi(
  options: PureApiOptions
): Promise<PureApiResult> {
  const {
    projectId,
    promptText,
    bearerToken,
    recaptchaToken = '',
    imageModelName = 'GEM_PIX_2',
    imageAspectRatio = 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  console.log(`[Pure API Action] Sending direct HTTP POST request to Google Flow API for Project: ${projectId}`);
  console.log(`[Pure API Action] Prompt: "${promptText.substring(0, 80)}..."`);

  if (!fs.existsSync(config.storageStatePath)) {
    return {
      success: false,
      error: `Storage state file not found at ${config.storageStatePath}. Please run "npm run playwright:init" first.`,
    };
  }

  try {
    const extraHeaders: Record<string, string> = {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Origin': 'https://labs.google',
      'Referer': `https://labs.google/fx/id/tools/flow/project/${projectId}`,
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    };

    if (bearerToken) {
      extraHeaders['Authorization'] = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
    }

    // Create lightweight headless HTTP request context loaded with session cookies from state.json
    const apiContext = await playwrightRequest.newContext({
      storageState: config.storageStatePath,
      extraHTTPHeaders: extraHeaders,
    });

    const batchId = randomUUID();
    const sessionId = `;${Date.now()}`;

    const clientContext = {
      recaptchaContext: {
        token: recaptchaToken,
        applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
      },
      projectId,
      tool: 'PINHOLE',
      sessionId,
    };

    const payload = {
      clientContext,
      mediaGenerationContext: {
        batchId,
      },
      useNewMedia: true,
      requests: [
        {
          clientContext,
          imageModelName,
          imageAspectRatio,
          structuredPrompt: {
            parts: [{ text: promptText }],
          },
          seed,
          imageInputs: [],
        },
      ],
    };

    const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${projectId}/flowMedia:batchGenerateImages`;

    const response = await apiContext.post(endpoint, {
      data: payload,
    });

    const status = response.status();
    const responseText = await response.text();
    await apiContext.dispose();

    if (status !== 200) {
      console.warn(`[Pure API Action] HTTP Error ${status}:`, responseText);
      return {
        success: false,
        error: `HTTP ${status}: ${responseText}`,
      };
    }

    let rawResponse: any;
    try {
      rawResponse = JSON.parse(responseText);
    } catch (_) {
      rawResponse = responseText;
    }

    console.log('[Pure API Action] Pure HTTP Request Completed Successfully (200 OK)!');

    return {
      success: true,
      rawResponse,
    };
  } catch (error: any) {
    console.error('[Pure API Action] Request failed:', error);
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}
