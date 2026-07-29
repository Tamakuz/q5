import { launchBrowser } from '../actions/launch-browser';
import { createFlowProjectAction, CreateProjectResult } from '../actions/flow/create-project';
import { config } from '../config';

export interface CreateProjectPipelineOptions {
  flowUrl?: string;
  headed?: boolean;
  autoClose?: boolean;
}

/**
 * Pipeline: Opens Google Flow tools, creates a project, and extracts its unique UUID.
 */
export async function runCreateProjectPipeline(
  options: CreateProjectPipelineOptions = {}
): Promise<CreateProjectResult> {
  const flowUrl = options.flowUrl || config.flowUrl;
  const headed = options.headed ?? true;
  const autoClose = options.autoClose ?? false; // Keep open by default so user can inspect or work on the project

  console.log('====================================================');
  console.log('[Pipeline] Starting: Create Google Flow Project');
  console.log('====================================================');

  const { context, page } = await launchBrowser({ headed });

  try {
    const result = await createFlowProjectAction(page, flowUrl);

    if (result.success) {
      console.log(`\n[Pipeline] Project creation successful!`);
      console.log(`[Pipeline] Project UUID: ${result.projectId}`);
      console.log(`[Pipeline] Project URL:  ${result.projectUrl}\n`);
    } else {
      console.warn(`\n[Pipeline] Warning: ${result.message}`);
    }

    if (autoClose) {
      console.log('[Pipeline] Closing browser context...');
      await context.close();
    }

    return result;
  } catch (error: any) {
    console.error(`[Pipeline] Create Project Pipeline Error:`, error);
    if (autoClose) {
      try { await context.close(); } catch (_) {}
    }
    return {
      success: false,
      projectId: '',
      projectUrl: page.url(),
      message: `Error: ${error?.message || error}`,
    };
  }
}
