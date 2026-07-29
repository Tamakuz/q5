import { runInitUserDataPipeline, InitUserDataPipelineOptions, PipelineResult } from './pipelines/init-user-data';
import { runCreateProjectPipeline, CreateProjectPipelineOptions } from './pipelines/create-project';
import { runGenerateFlowImagesPipeline, GenerateFlowImagesPipelineOptions } from './pipelines/generate-flow-images';
import { launchBrowser, BrowserSession, LaunchOptions } from './actions/launch-browser';
import { navigateToUrl, NavigateOptions } from './actions/navigate';
import { checkAuthStatus, AuthStatus } from './actions/auth/check-auth';
import { saveSessionState, SaveSessionOptions } from './actions/auth/save-session';
import { createFlowProjectAction, CreateProjectResult } from './actions/flow/create-project';
import { generateFlowImagesUiAction, GenerateUiOptions, UiImageResult } from './actions/flow/generate-images-ui';
import { generateFlowImagesPureApi, PureApiOptions, PureApiResult } from './actions/flow/generate-images-pure-api';
import { generateFlowImagesApi, GenerateImageOptions, GeneratedImageResult } from './actions/flow/generate-images-api';
import { setupAuthInterceptor } from './actions/flow/intercept-auth-token';
import { config, PlaywrightConfig } from './config';

/**
 * Service Entry Point for Electron IPC & API Integrations
 */
export class PlaywrightService {
  public static config: PlaywrightConfig = config;

  /**
   * Initializes user session data by launching browser, navigating to Google Labs, and saving auth state.
   */
  public static async initUserData(options?: InitUserDataPipelineOptions): Promise<PipelineResult> {
    return runInitUserDataPipeline(options);
  }

  /**
   * Navigates to Google Flow, creates a project, and extracts its unique UUID.
   */
  public static async createProject(options?: CreateProjectPipelineOptions): Promise<CreateProjectResult> {
    return runCreateProjectPipeline(options);
  }

  /**
   * Generates images via Google Flow UI prompt submission and intercepts response JSON fifeUrl.
   */
  public static async generateImages(options: GenerateFlowImagesPipelineOptions): Promise<UiImageResult> {
    return runGenerateFlowImagesPipeline(options);
  }

  /**
   * Pure HTTP API Mode: Generates images WITHOUT opening any browser window using saved cookies from state.json.
   */
  public static async generateImagesPureApi(options: PureApiOptions): Promise<PureApiResult> {
    return generateFlowImagesPureApi(options);
  }

  /**
   * Low-level action exports for custom pipelines
   */
  public static actions = {
    launchBrowser: (opts?: LaunchOptions): Promise<BrowserSession> => launchBrowser(opts),
    navigateToUrl: (page: any, opts?: NavigateOptions): Promise<void> => navigateToUrl(page, opts),
    checkAuthStatus: (page: any, context?: any): Promise<AuthStatus> => checkAuthStatus(page, context),
    saveSessionState: (context: any, opts?: SaveSessionOptions): Promise<string> => saveSessionState(context, opts),
    createFlowProject: (page: any, flowUrl?: string): Promise<CreateProjectResult> => createFlowProjectAction(page, flowUrl),
    generateFlowImagesUiAction: (page: any, opts: GenerateUiOptions): Promise<UiImageResult> => generateFlowImagesUiAction(page, opts),
    generateFlowImagesApi: (page: any, opts: GenerateImageOptions): Promise<GeneratedImageResult> => generateFlowImagesApi(page, opts),
    generateFlowImagesPureApi: (opts: PureApiOptions): Promise<PureApiResult> => generateFlowImagesPureApi(opts),
    setupAuthInterceptor: (page: any) => setupAuthInterceptor(page),
  };
}

export default PlaywrightService;
