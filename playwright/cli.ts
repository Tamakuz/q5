import { Command } from 'commander';
import { PlaywrightService } from './service';
import { config } from './config';

const program = new Command();

program
  .name('playwright-cli')
  .description('CLI tool for testing Playwright AI Google Flow pipelines & actions')
  .version('0.1.0');

program
  .command('init-user-data')
  .description('Initialize Google Labs user data, launch headed browser for login, and persist session')
  .option('-u, --url <url>', 'Target URL', config.baseUrl)
  .option('--no-headed', 'Run browser in headless mode')
  .option('-t, --timeout <ms>', 'Max wait time for login in ms', '120000')
  .action(async (options) => {
    try {
      console.log('Running init-user-data pipeline via CLI...');
      const result = await PlaywrightService.initUserData({
        url: options.url,
        headed: options.headed,
        maxWaitLoginMs: parseInt(options.timeout, 10),
      });

      console.log('\n--- Pipeline Execution Summary ---');
      console.log(`Success: ${result.success}`);
      console.log(`Is Logged In: ${result.isLoggedIn}`);
      console.log(`Message: ${result.message}`);
      if (result.storageStatePath) console.log(`Storage State: ${result.storageStatePath}`);
      if (result.userDataDir) console.log(`User Data Dir: ${result.userDataDir}`);
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program
  .command('check-session')
  .description('Check auth status with existing saved session/persistent profile')
  .option('-u, --url <url>', 'Target URL', config.baseUrl)
  .action(async (options) => {
    try {
      console.log('Checking auth status with persistent session profile...');
      const session = await PlaywrightService.actions.launchBrowser({ headed: true });
      await PlaywrightService.actions.navigateToUrl(session.page, { url: options.url });
      const status = await PlaywrightService.actions.checkAuthStatus(session.page, session.context);
      console.log('\nAuth Status Result:', status);
      await session.context.close();
    } catch (err) {
      console.error('Check session error:', err);
      process.exit(1);
    }
  });

program
  .command('create-project')
  .description('Navigate to Google Flow, create a project, and extract the project UUID')
  .option('-u, --url <url>', 'Google Flow URL', config.flowUrl)
  .option('--no-headed', 'Run browser in headless mode')
  .option('--close', 'Automatically close browser after extracting project UUID')
  .action(async (options) => {
    try {
      console.log('Running create-project pipeline via CLI...');
      const result = await PlaywrightService.createProject({
        flowUrl: options.url,
        headed: options.headed,
        autoClose: options.close,
      });

      console.log('\n--- Create Project Result ---');
      console.log(`Success:     ${result.success}`);
      console.log(`Project ID:  ${result.projectId}`);
      console.log(`Project URL: ${result.projectUrl}`);
      console.log(`Message:     ${result.message}`);
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program
  .command('generate-images')
  .description('Generate images via Google Flow API for a given project UUID and prompt text')
  .option('-p, --project <id>', 'Google Flow Project UUID', '5aec769c-e1c8-4741-a8db-99546809c8db')
  .option('-t, --text <prompt>', 'Prompt text for image generation', 'Flat 2D illustration, Indonesian setting')
  .option('-m, --model <model>', 'Image model name', 'GEM_PIX_2')
  .option('-a, --aspect <aspect>', 'Aspect ratio (IMAGE_ASPECT_RATIO_LANDSCAPE|IMAGE_ASPECT_RATIO_SQUARE|IMAGE_ASPECT_RATIO_PORTRAIT)', 'IMAGE_ASPECT_RATIO_LANDSCAPE')
  .option('-b, --bearer <token>', 'Optional Bearer token')
  .option('--pure', 'Run in Pure API mode (NO browser window opened)')
  .option('--no-headed', 'Run browser in headless mode')
  .option('--close', 'Automatically close browser after API call')
  .action(async (options) => {
    try {
      console.log(`Running generate-images pipeline via CLI (Pure API: ${Boolean(options.pure)})...`);
      let result: any;
      if (options.pure) {
        result = await PlaywrightService.generateImagesPureApi({
          projectId: options.project,
          promptText: options.text,
          bearerToken: options.bearer,
          imageModelName: options.model,
          imageAspectRatio: options.aspect,
        });
      } else {
        result = await PlaywrightService.generateImages({
          projectId: options.project,
          promptText: options.text,
          imageModelName: options.model,
          imageAspectRatio: options.aspect,
          headed: options.headed,
          autoClose: options.close,
        });
      }

      console.log('\n--- Generate Images Result ---');
      console.log(`Success: ${result.success}`);
      if (result.error) console.log(`Error:   ${result.error}`);
      if (result.rawResponse) console.log(`Raw Response:`, JSON.stringify(result.rawResponse, null, 2));
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);
