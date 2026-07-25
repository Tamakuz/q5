// playwright/pipelines/analysis-pipeline.ts
import { Command } from 'commander';
import { launchAIStudioSession, dismissPopups } from '../aistudio';
import { configureModelAndThinking, disableAllToolsInSidebar } from '../actions/select-model';
import { inputTextPrompt } from '../actions/input-prompt';
import { attachDriveFile } from '../actions/attach-drive-file';
import { submitAndExtract } from '../actions/submit-and-extract';
import { loadProjectState } from '../../lib/state';
import { listAvailableAccounts } from '../config';

export interface AnalysisPipelineOptions {
  accountName?: string;
  accountsPool?: string[];
  promptFilePath?: string;
  searchTerm?: string;
  filePath?: string;
  headless?: boolean;
}

/**
 * Single Execution Attempt for a specific Google Account Profile
 */
async function executePipelineForAccount(
  accountName: string,
  options: AnalysisPipelineOptions
): Promise<void> {
  const state = loadProjectState();
  console.log('\n======================================================');
  console.log('🎬 STARTING AUTOMATED CONTENT ANALYSIS PIPELINE');
  console.log(`🆔 Content ID: ${state.content_id}`);
  console.log(`👤 Active Google Account: "${accountName}"`);
  console.log('======================================================\n');

  const { context, page } = await launchAIStudioSession({
    accountName: accountName,
    headless: options.headless ?? false,
  });

  try {
    // Dismiss initial popups
    await dismissPopups(page);

    // STEP 1: Configure Model & Ensure ALL Tools are OFF FIRST
    console.log('\n--- STEP 1: Configuring Model & Disabling ALL Sidebar Tools FIRST ---');
    await configureModelAndThinking(page, {
      modelName: 'gemini-3.1-pro-preview',
      temperature: 1.5,
      thinkingLevel: 'High',
    });

    await disableAllToolsInSidebar(page);

    // STEP 2: Input Analysis Prompt ONLY AFTER Tools are confirmed OFF
    console.log('\n--- STEP 2: Inputting Analysis Prompt ---');
    await inputTextPrompt(page, {
      promptFilePath: options.promptFilePath || 'dashboard/prompts/shortform/analysis-prompt.md',
    });

    // STEP 3: Attach Video Asset (Drive-First)
    console.log('\n--- STEP 3: Attaching Video Asset (Drive-First) ---');
    await attachDriveFile(page, {
      searchTerm: options.searchTerm,
      filePath: options.filePath,
    });

    // STEP 4: Submit Prompt & Extract Validated JSON Response
    console.log('\n--- STEP 4: Submitting Prompt & Extracting Response ---');
    const responseText = await submitAndExtract(page);

    // Check if extracted response contained internal error
    if (responseText.toLowerCase().includes('an internal error has occurred') || responseText.toLowerCase().includes('error querying drive')) {
      throw new Error('GOOGLE_AI_STUDIO_QUOTA_ERROR: Google AI Studio returned an internal error.');
    }

    console.log('\n======================================================');
    console.log(`🎉 PIPELINE COMPLETED SUCCESSFULLY ON ACCOUNT: "${accountName}"!`);
    console.log('======================================================\n');
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * End-to-End Orchestrator with Automatic Account Failover & Retry
 */
export async function runAnalysisPipeline(options: AnalysisPipelineOptions = {}): Promise<void> {
  // Determine list of accounts to attempt
  let accountsToTry: string[] = [];

  if (options.accountsPool && options.accountsPool.length > 0) {
    accountsToTry = options.accountsPool;
  } else if (options.accountName) {
    accountsToTry = [options.accountName];
    // Add other available accounts as backup
    const allAccounts = listAvailableAccounts();
    for (const acc of allAccounts) {
      if (!accountsToTry.includes(acc)) {
        accountsToTry.push(acc);
      }
    }
  } else {
    accountsToTry = listAvailableAccounts();
    if (accountsToTry.length === 0) {
      accountsToTry = ['default'];
    }
  }

  console.log(`📋 Account Pool Strategy: [${accountsToTry.map(a => `"${a}"`).join(', ')}]`);

  let lastError: Error | null = null;

  for (let i = 0; i < accountsToTry.length; i++) {
    const currentAccount = accountsToTry[i];
    console.log(`\n🚀 Attempt ${i + 1}/${accountsToTry.length} using account: "${currentAccount}"`);

    try {
      await executePipelineForAccount(currentAccount, options);
      return; // Success! Exit pipeline.
    } catch (err: any) {
      lastError = err;
      console.error(`\n⚠️ Execution failed on account "${currentAccount}": ${err.message}`);

      if (i < accountsToTry.length - 1) {
        const nextAccount = accountsToTry[i + 1];
        console.log(`\n🔄 [FAILOVER RETRY] Switching to next backup account: "${nextAccount}" in 3 seconds...\n`);
        await new Promise(res => setTimeout(res, 3000));
      }
    }
  }

  throw new Error(`All accounts in pool failed. Last error: ${lastError?.message}`);
}

// ─── CLI Entrypoint ────────────────────────────────────

if (require.main === module || process.argv[1]?.endsWith('analysis-pipeline.ts')) {
  const program = new Command();
  program
    .name('aistudio:pipeline')
    .description('Run full automated analysis pipeline in Google AI Studio with Failover')
    .option('-a, --account <string>', 'Initial Google account profile name (e.g. user1, user2)')
    .option('-p, --prompt <string>', 'Path to prompt md file', 'dashboard/prompts/shortform/analysis-prompt.md')
    .option('-s, --search <string>', 'Search term for Drive asset')
    .option('-f, --file <string>', 'Fallback local file path')
    .option('-h, --headless', 'Run browser in headless mode', false)
    .action(async (opts) => {
      try {
        await runAnalysisPipeline({
          accountName: opts.account,
          promptFilePath: opts.prompt,
          searchTerm: opts.search,
          filePath: opts.file,
          headless: opts.headless,
        });
      } catch (err: any) {
        console.error(`\n❌ Pipeline Failover Exhausted: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
