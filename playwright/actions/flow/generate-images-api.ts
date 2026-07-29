import { Page } from 'playwright';
import { randomUUID } from 'crypto';

export interface GenerateImageOptions {
  projectId: string;
  promptText: string;
  bearerToken?: string;
  imageModelName?: string; // default: 'GEM_PIX_2'
  imageAspectRatio?: 'IMAGE_ASPECT_RATIO_LANDSCAPE' | 'IMAGE_ASPECT_RATIO_SQUARE' | 'IMAGE_ASPECT_RATIO_PORTRAIT';
  seed?: number;
}

export interface GeneratedImageResult {
  success: boolean;
  images: Array<{
    url?: string;
    mediaId?: string;
    encodedImage?: string;
  }>;
  rawResponse?: any;
  error?: string;
}

/**
 * Action: Generates images via Google Flow API inside the browser context.
 * Executing fetch inside page.evaluate() ensures cookies, reCAPTCHA, CORS, and Bearer tokens are dynamically handled.
 */
export async function generateFlowImagesApi(
  page: Page,
  options: GenerateImageOptions
): Promise<GeneratedImageResult> {
  const {
    projectId,
    promptText,
    imageModelName = 'GEM_PIX_2',
    imageAspectRatio = 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    seed = Math.floor(Math.random() * 1000000),
  } = options;

  console.log(`[Playwright Action] Generating Flow Images via API for Project: ${projectId}`);
  console.log(`[Playwright Action] Prompt: "${promptText.substring(0, 80)}..."`);

  try {
    const result = await page.evaluate(
      async (params: any) => {
        const pId = params.projectId;
        const pText = params.promptText;
        const model = params.imageModelName;
        const aspect = params.imageAspectRatio;
        const s = params.seed;

        const batchId = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });

        let recaptchaToken = '';
        try {
          if ((window as any).grecaptcha && (window as any).grecaptcha.enterprise) {
            recaptchaToken = await (window as any).grecaptcha.enterprise.execute(
              '6LdsFiUsAAAAAJi_XN3ZzL70aXN3-j7H56J7-8iX',
              { action: 'FLOW_GENERATE' }
            );
          }
        } catch (_) {}

        const clientContext = {
          recaptchaContext: {
            token: recaptchaToken,
            applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
          },
          projectId: pId,
          tool: 'PINHOLE',
          sessionId: ';' + Date.now(),
        };

        const payload = {
          clientContext: clientContext,
          mediaGenerationContext: {
            batchId: batchId,
          },
          useNewMedia: true,
          requests: [
            {
              clientContext: clientContext,
              imageModelName: model,
              imageAspectRatio: aspect,
              structuredPrompt: {
                parts: [{ text: pText }],
              },
              seed: s,
              imageInputs: [],
            },
          ],
        };

        const endpoint = 'https://aisandbox-pa.googleapis.com/v1/projects/' + pId + '/flowMedia:batchGenerateImages';

        const reqHeaders: Record<string, string> = {
          'Content-Type': 'text/plain;charset=UTF-8',
          'Accept': '*/*',
        };

        if (params.bearerToken) {
          reqHeaders['Authorization'] = params.bearerToken.startsWith('Bearer ') ? params.bearerToken : 'Bearer ' + params.bearerToken;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          return {
            success: false,
            error: 'API Request failed with status ' + response.status + ': ' + errText,
          };
        }

        const responseData = await response.json();

        return {
          success: true,
          rawResponse: responseData,
        };
      },
      { projectId, promptText, bearerToken: options.bearerToken, imageModelName, imageAspectRatio, seed }
    );

    let extractedImages: Array<{ url?: string; mediaId?: string; dimensions?: { width: number; height: number }; prompt?: string }> = [];

    if (result.success && result.rawResponse?.media) {
      console.log('[Playwright Action] Parsing response media items...');
      extractedImages = result.rawResponse.media.map((item: any) => {
        const genImg = item?.image?.generatedImage;
        const dims = item?.image?.dimensions;
        return {
          url: genImg?.fifeUrl,
          mediaId: genImg?.mediaId || item?.name,
          dimensions: dims,
          prompt: genImg?.prompt,
        };
      });

      console.log(`[Playwright Action] Successfully extracted ${extractedImages.length} image URL(s):`);
      extractedImages.forEach((img, idx) => console.log(`  - [${idx + 1}] ${img.url}`));
    } else if (!result.success) {
      console.warn('[Playwright Action] API Image Generation Warning:', result.error);
    }

    return {
      success: result.success,
      images: extractedImages,
      rawResponse: result.rawResponse,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[Playwright Action] Exception in generateFlowImagesApi:', error);
    return {
      success: false,
      images: [],
      error: error?.message || String(error),
    };
  }
}
