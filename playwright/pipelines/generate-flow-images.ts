import { launchBrowser } from '../actions/launch-browser';
import { createFlowProjectAction } from '../actions/flow/create-project';
import { generateFlowImagesUiAction, UiImageResult } from '../actions/flow/generate-images-ui';
import { config } from '../config';

export interface GenerateFlowImagesPipelineOptions {
  projectId?: string;
  promptText?: string;
  headed?: boolean;
  autoClose?: boolean;
}

/**
 * Pipeline: Opens/creates a Google Flow project, inputs prompt into UI, and intercepts the generated image fifeUrl JSON.
 */
export async function runGenerateFlowImagesPipeline(
  options: GenerateFlowImagesPipelineOptions
): Promise<UiImageResult> {
  const headed = options.headed ?? true;
  const autoClose = options.autoClose ?? false;

  console.log('====================================================');
  console.log('[Pipeline] Starting: Generate Google Flow Images via UI Interceptor');
  console.log('====================================================');

  const { context, page } = await launchBrowser({ headed });

  try {
    let projectId = options.projectId;

    // 1. If no projectId provided, create/open a project
    if (!projectId) {
      console.log('[Pipeline] No projectId provided. Creating new project...');
      const createRes = await createFlowProjectAction(page);
      if (!createRes.success || !createRes.projectId) {
        throw new Error(`Failed to create project: ${createRes.message}`);
      }
      projectId = createRes.projectId;
    } else {
      const projectUrl = `https://labs.google/fx/id/tools/flow/project/${projectId}`;
      console.log(`[Pipeline] Navigating to existing project: ${projectUrl}`);
      await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: config.defaultTimeout });
      await page.waitForTimeout(3000);
    }

    // 2. Execute UI Prompt Generation & Intercept Response JSON
    const promptText = options.promptText || 'Flat 2D illustration, Indonesian setting, warm colors';

    const result = await generateFlowImagesUiAction(page, {
      projectId,
      promptText,
    });

    if (result.success) {
      console.log(`\n[Pipeline] SUCCESS! Generated ${result.images.length} Image(s):`);
      result.images.forEach((img, i) => {
        console.log(`  - Image [${i + 1}]: ${img.url}`);
      });
    } else {
      console.warn(`\n[Pipeline] Generation Warning: ${result.error}`);
    }

    if (autoClose) {
      console.log('[Pipeline] Closing browser context...');
      await context.close();
    }

    return result;
  } catch (error: any) {
    console.error('[Pipeline] Generate Flow Images Pipeline Error:', error);
    if (autoClose) {
      try { await context.close(); } catch (_) {}
    }
    return {
      success: false,
      images: [],
      error: `Pipeline error: ${error?.message || error}`,
    };
  }
}
