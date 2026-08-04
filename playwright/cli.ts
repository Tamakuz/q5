import { Command } from 'commander';
import { PlaywrightService } from './service';
import { runBatchPersistentQueue } from './runner';

const program = new Command();

program
  .name('playwright-flow-cli')
  .description('CLI tool for Playwright Google Flow Automation')
  .version('1.0.0');

program
  .command('init-user-data')
  .description('Initialize Google user data session by opening browser for login and saving session state')
  .action(async () => {
    try {
      console.log('Running init-user-data pipeline via CLI...');
      const result = await PlaywrightService.initUserData();
      console.log('\n--- Init User Data Result ---');
      console.log(`Success: ${result.success}`);
      if (result.error) console.log(`Error: ${result.error}`);
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program
  .command('check-session')
  .description('Check Google Labs authentication status using saved session state')
  .action(async () => {
    try {
      const { context, page } = await PlaywrightService.actions.launchBrowser({ headed: false });
      const status = await PlaywrightService.actions.checkAuthStatus(page, context);
      console.log('\n--- Auth Status ---');
      console.log(JSON.stringify(status, null, 2));
      await context.close();
      process.exit(status.isLoggedIn ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program
  .command('create-project')
  .description('Create a new Google Flow project and return the project UUID and URL')
  .action(async () => {
    try {
      console.log('Running create-project pipeline via CLI...');
      const result = await PlaywrightService.createProject();
      console.log('\n--- Create Project Result ---');
      console.log(`Success:     ${result.success}`);
      console.log(`Project UUID: ${result.projectId}`);
      if (result.projectUrl) console.log(`Project URL:  ${result.projectUrl}`);
      if (result.error) console.log(`Error:        ${result.error}`);
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      console.error('CLI Command execution error:', err);
      process.exit(1);
    }
  });

program
  .command('generate-images')
  .description('Generate images via Google Flow API for a given project UUID and prompt text')
  .option('-p, --project <id>', 'Google Flow Project UUID', '10ab715a-31e2-48d3-8e56-840e8af6c062')
  .option('-t, --text <prompt>', 'Prompt text for image generation', 'Flat 2D illustration, Indonesian setting')
  .option('-m, --model <model>', 'Image model name', 'GEM_PIX_2')
  .option('-a, --aspect <aspect>', 'Aspect ratio (IMAGE_ASPECT_RATIO_LANDSCAPE|IMAGE_ASPECT_RATIO_SQUARE|IMAGE_ASPECT_RATIO_PORTRAIT)', 'IMAGE_ASPECT_RATIO_LANDSCAPE')
  .option('-b, --bearer <token>', 'Optional Bearer token')
  .option('--pure', 'Run in Pure API mode (NO browser window opened)')
  .option('--headed', 'Run browser in visible GUI mode', true)
  .option('--no-headed', 'Run browser in headless mode')
  .option('--close', 'Automatically close browser after API call')
  .option('--json', 'Output result strictly as JSON')
  .action(async (options) => {
    try {
      if (!options.json) {
        console.log(`Running generate-images pipeline via CLI (Pure API: ${Boolean(options.pure)})...`);
      }
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

      if (options.json) {
        console.log(JSON.stringify(result));
      } else {
        console.log('\n--- Generate Images Result ---');
        console.log(`Success: ${result.success}`);
        if (result.error) console.log(`Error:   ${result.error}`);
        if (result.rawResponse) console.log(`Raw Response:`, JSON.stringify(result.rawResponse, null, 2));
      }
      process.exit(result.success ? 0 : 1);
    } catch (err) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: String(err) }));
      } else {
        console.error('CLI Command execution error:', err);
      }
      process.exit(1);
    }
  });

program
  .command('batch-runner')
  .description('Run a batch queue of prompts in a single persistent browser tab')
  .option('-p, --project <id>', 'Google Flow Project UUID', '10ab715a-31e2-48d3-8e56-840e8af6c062')
  .option('-j, --items-json <json>', 'JSON string of items array [{segment_id, prompt}]')
  .option('-c, --concurrency <number>', 'Number of concurrent generations in Flow (default: 5)', '5')
  .option('--profiles <list>', 'Comma-separated profile names for auto-failover', 'user_1,user_2')
  .option('--models <list>', 'Comma-separated model names for auto-failover', 'Nano Banana Pro,Banana 2')
  .option('--headed', 'Run browser in visible GUI mode', true)
  .option('--no-headed', 'Run browser in headless mode')
  .option('--keep-open', 'Keep browser open after execution completes or fails', false)
  .action(async (options) => {
    try {
      const items = JSON.parse(options.itemsJson || '[]');
      const concurrency = parseInt(options.concurrency || '5', 10);
      const profiles = (options.profiles || 'user_1,user_2').split(',').map((s: string) => s.trim()).filter(Boolean);
      const models = (options.models || 'Nano Banana Pro,Banana 2').split(',').map((s: string) => s.trim()).filter(Boolean);
      await runBatchPersistentQueue({
        projectId: options.project,
        items,
        concurrency,
        profiles,
        models,
        headed: options.headed,
        keepBrowserOpen: Boolean(options.keepOpen),
        onItemStart: (segmentId) => {
          console.log(`[ITEM_START] ${segmentId}`);
        },
        onItemLog: (segmentId, text) => {
          console.log(`[ITEM_LOG] ${segmentId} | ${text}`);
        },
        onItemSuccess: (segmentId, result) => {
          console.log(`[ITEM_SUCCESS] ${segmentId} | ${JSON.stringify(result.images[0] || {})}`);
        },
        onItemError: (segmentId, error) => {
          console.log(`[ITEM_ERROR] ${segmentId} | ${error}`);
        },
      });
      process.exit(0);
    } catch (err) {
      console.error('Batch runner error:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);
